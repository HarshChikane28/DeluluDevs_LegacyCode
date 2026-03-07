"""Core pipeline orchestrator: coordinates parsing, graph building, translation, validation, and packaging."""
import json
import shutil
import os
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Dict, Any

from parser.java_parser import parse_java_file
from parser.cobol_parser import parse_cobol_file
from graph.graph_builder import build_call_graph
from graph.topo_sort import get_translation_order
from graph.visualizer import generate_graph_png, get_graph_json
from translator.llm_client import LLMClient
from translator.translator import translate_functions
from builder.file_writer import write_translated_files
from builder.requirements_builder import (
    scan_source_dependencies,
    scan_translated_imports,
    build_requirements_txt,
)
from builder.project_rebuilder import assemble_project
from validator.compile_runner import compile_translated_files
from validator.fix_loop import run_fix_loop
from utils.logger import logger

# Directories to skip when scanning
SKIP_DIRS = {"node_modules", "venv", ".venv", "build", "dist", ".git", "__pycache__", ".idea", ".gradle", "target"}


async def run_pipeline(
    repo_path: str,
    source_lang: str = "java",
    output_dir: str = "translated_repo",
    progress_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Run the full modernization pipeline.
    
    Args:
        repo_path: Path to the cloned/uploaded repository
        source_lang: "java" or "cobol" or "auto"
        output_dir: Where to write translated files
        progress_callback: async callback(stage, progress, message, data)
    
    Returns:
        metadata dict with all results
    """
    start_time = datetime.utcnow()
    metadata = {
        "repo": repo_path,
        "source": source_lang,
        "target": "python",
        "start_time": start_time.isoformat(),
        "errors": [],
    }

    try:
        # ── Stage 1: Scan source files ──────────────────────────────────
        if progress_callback:
            await progress_callback("parsing", 0.0, "Scanning repository files...", {})

        # Auto-detect language if needed
        if source_lang == "auto":
            source_lang = _detect_language(repo_path)
            metadata["source"] = source_lang

        # Get source files
        source_files = _collect_source_files(repo_path, source_lang)
        if progress_callback:
            await progress_callback(
                "parsing", 0.1,
                f"Found {len(source_files)} {source_lang} files",
                {"file_count": len(source_files)},
            )

        if not source_files:
            raise ValueError(f"No {source_lang} files found in {repo_path}")

        # ── Stage 2: Scan dependencies (requirements Phase 1) ──────────
        if progress_callback:
            await progress_callback("parsing", 0.15, "Scanning build dependencies...", {})

        phase1_deps = scan_source_dependencies(repo_path)
        if progress_callback:
            await progress_callback(
                "parsing", 0.2,
                f"Found {len(phase1_deps)} dependency mappings: {', '.join(phase1_deps[:5])}",
                {"dependencies": phase1_deps},
            )

        # ── Stage 3: Parse files into function nodes ────────────────────
        if progress_callback:
            await progress_callback("parsing", 0.25, "Parsing source files into function nodes...", {})

        all_functions = []
        for i, (file_path, content) in enumerate(source_files):
            rel_path = os.path.relpath(file_path, repo_path)
            try:
                if source_lang == "java":
                    funcs = parse_java_file(rel_path, content)
                else:
                    funcs = parse_cobol_file(rel_path, content)
                all_functions.extend(funcs)
            except Exception as e:
                logger.error(f"Parse error in {rel_path}: {e}")
                metadata["errors"].append({"function": rel_path, "error": f"Parse error: {e}"})

            if progress_callback:
                await progress_callback(
                    "parsing",
                    0.25 + 0.25 * ((i + 1) / len(source_files)),
                    f"Parsed {rel_path} ({len(funcs) if 'funcs' in dir() else 0} functions)",
                    {"file": rel_path},
                )

        metadata["total_functions"] = len(all_functions)

        if not all_functions:
            raise ValueError("No functions extracted from source files")

        # Save functions.json
        func_json_path = Path(output_dir) / "functions.json"
        func_json_path.parent.mkdir(parents=True, exist_ok=True)
        func_json_path.write_text(json.dumps(
            [{k: v for k, v in f.items() if k != "code"} for f in all_functions],
            indent=2,
        ))

        # ── Stage 4: Build call graph ──────────────────────────────────
        if progress_callback:
            await progress_callback("graph_building", 0.5, "Building function call graph...", {})

        G, unresolved = build_call_graph(all_functions)

        # Get graph JSON for frontend visualization
        graph_json = get_graph_json(G)

        # Save call_graph.json
        (Path(output_dir) / "call_graph.json").write_text(json.dumps(graph_json, indent=2))

        if progress_callback:
            await progress_callback(
                "graph_building", 0.6,
                f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges"
                + (f", {len(unresolved)} unresolved calls" if unresolved else ""),
                {"graph": graph_json, "unresolved": unresolved[:20]},
            )

        # ── Stage 5: Topological sort ──────────────────────────────────
        translation_order = get_translation_order(G)

        if progress_callback:
            await progress_callback(
                "graph_building", 0.65,
                f"Translation order: {len(translation_order)} groups (leaf-first)",
                {"group_count": len(translation_order)},
            )

        # ── Stage 6: Translate functions ────────────────────────────────
        if progress_callback:
            await progress_callback("translating", 0.0, "Starting function-by-function translation...", {})

        llm_client = LLMClient()
        translation_result = await translate_functions(
            G, translation_order, source_lang, llm_client, progress_callback
        )

        metadata["translated_count"] = translation_result["translated"]
        metadata["llm_provider_used"] = translation_result["provider"]
        metadata["errors"].extend(translation_result.get("errors", []))

        # ── Stage 7: Write translated files ─────────────────────────────
        if progress_callback:
            await progress_callback("assembling", 0.7, "Writing translated files...", {})

        translated_dir = str(Path(output_dir) / "src")
        written_files = write_translated_files(G, translated_dir, source_lang)

        if progress_callback:
            await progress_callback(
                "assembling", 0.75,
                f"Wrote {len(written_files)} translated Python files",
                {"files_written": len(written_files)},
            )

        # ── Stage 8: Compile validation ─────────────────────────────────
        if progress_callback:
            await progress_callback("compiling", 0.8, "Running compilation validation...", {})

        compile_status, compile_errors = compile_translated_files(translated_dir)

        if not compile_status:
            if progress_callback:
                await progress_callback(
                    "fixing", 0.85,
                    f"Found {len(compile_errors)} compile errors, starting fix loop...",
                    {"error_count": len(compile_errors)},
                )

            compile_status_str, remaining = await run_fix_loop(
                translated_dir, llm_client, max_attempts=3, progress_callback=progress_callback
            )
            metadata["compile_status"] = compile_status_str
            if remaining:
                metadata["errors"].extend([{"function": e["file"], "error": e["error"]} for e in remaining])
        else:
            metadata["compile_status"] = "success"

        # ── Stage 9: Requirements Phase 2 ───────────────────────────────
        if progress_callback:
            await progress_callback("assembling", 0.9, "Generating requirements.txt...", {})

        phase2_deps = scan_translated_imports(translated_dir)
        requirements_content = build_requirements_txt(phase1_deps, phase2_deps)
        metadata["requirements_generated"] = sorted(set(phase1_deps + phase2_deps))

        # ── Stage 10: Generate graph PNG ────────────────────────────────
        graph_png_path = str(Path(output_dir) / "call_graph.png")
        generate_graph_png(G, graph_png_path)

        # ── Stage 11: Assemble final project ────────────────────────────
        if progress_callback:
            await progress_callback("assembling", 0.95, "Packaging final ZIP...", {})

        metadata["end_time"] = datetime.utcnow().isoformat()
        zip_path = assemble_project(output_dir, requirements_content, metadata, graph_png_path)

        if progress_callback:
            await progress_callback(
                "done", 1.0,
                "Modernization complete! Download your translated project.",
                {"zip_path": zip_path, "metadata": metadata},
            )

        return metadata

    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        metadata["end_time"] = datetime.utcnow().isoformat()
        metadata["compile_status"] = "fail"
        metadata["errors"].append({"function": "pipeline", "error": str(e)})

        if progress_callback:
            await progress_callback(
                "error", 0.0,
                f"Pipeline error: {str(e)}",
                {"error": str(e)},
            )

        return metadata


def _detect_language(repo_path: str) -> str:
    """Auto-detect source language based on file extensions."""
    java_count = 0
    cobol_count = 0
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.endswith(".java"):
                java_count += 1
            elif f.endswith((".cob", ".cobol", ".cbl", ".cpy")):
                cobol_count += 1
    return "cobol" if cobol_count > java_count else "java"


def _collect_source_files(repo_path: str, source_lang: str) -> list:
    """Collect all relevant source files."""
    extensions = {
        "java": (".java",),
        "cobol": (".cob", ".cobol", ".cbl", ".cpy"),
    }
    exts = extensions.get(source_lang, (".java",))
    files = []

    for root, dirs, filenames in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in filenames:
            if fname.endswith(exts):
                fpath = os.path.join(root, fname)
                try:
                    content = open(fpath, "r", errors="ignore").read()
                    files.append((fpath, content))
                except Exception as e:
                    logger.warning(f"Could not read {fpath}: {e}")

    return files
