"""Write translated files to disk."""
import os
import networkx as nx
from pathlib import Path
from typing import Dict, List, Any
from utils.logger import logger


def write_translated_files(
    G: nx.DiGraph,
    output_dir: str,
    source_lang: str = "java",
) -> List[str]:
    """
    Write translated functions to Python files, organized by original file structure.
    
    Returns list of written file paths.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Group functions by original file
    file_groups: Dict[str, List[Dict[str, Any]]] = {}
    for node_id in G.nodes():
        data = G.nodes[node_id]
        if data.get("translated_code") and data.get("status") in ("translated", "verified"):
            orig_file = data.get("file", "unknown")
            if orig_file not in file_groups:
                file_groups[orig_file] = []
            file_groups[orig_file].append({
                "id": node_id,
                "qualified_name": data.get("qualified_name", ""),
                "code": data["translated_code"],
                "params": data.get("params", []),
                "return_type": data.get("return_type", ""),
            })

    written_files = []
    for orig_file, functions in file_groups.items():
        # Convert original file path to Python module path
        py_file = _convert_path_to_python(orig_file, source_lang)
        full_path = output_path / py_file

        # Ensure directory exists
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Assemble file content
        content = _assemble_file(functions, orig_file)

        full_path.write_text(content)
        written_files.append(str(full_path))
        logger.info(f"Wrote {full_path} ({len(functions)} functions)")

    # Write __init__.py files for all directories
    for dirpath in set(Path(f).parent for f in written_files):
        init_file = dirpath / "__init__.py"
        if not init_file.exists():
            init_file.write_text("# Auto-generated\n")

    return written_files


def _convert_path_to_python(orig_path: str, source_lang: str) -> str:
    """Convert original file path to Python file path."""
    p = Path(orig_path)
    if source_lang == "java":
        # Remove src/main/java prefix if present
        parts = list(p.parts)
        for prefix in [["src", "main", "java"], ["src", "main"], ["src"]]:
            if parts[:len(prefix)] == prefix:
                parts = parts[len(prefix):]
                break
        new_path = Path(*parts) if parts else p
        return str(new_path.with_suffix(".py"))
    elif source_lang == "cobol":
        return str(p.with_suffix(".py"))
    return str(p.with_suffix(".py"))


def _assemble_file(functions: List[Dict[str, Any]], orig_file: str) -> str:
    """Assemble translated functions into a complete Python file."""
    lines = []
    lines.append(f'"""Translated from {orig_file}"""')
    lines.append("")

    # Collect imports from all functions
    all_imports = set()
    func_codes = []
    for func in functions:
        code = func["code"]
        # Extract import lines
        for line in code.split("\n"):
            stripped = line.strip()
            if stripped.startswith("import ") or stripped.startswith("from "):
                all_imports.add(stripped)
            else:
                break
        func_codes.append(code)

    # Write imports
    if all_imports:
        for imp in sorted(all_imports):
            lines.append(imp)
        lines.append("")
        lines.append("")

    # Write functions
    for code in func_codes:
        # Skip import lines already added
        code_lines = code.split("\n")
        non_import_start = 0
        for i, line in enumerate(code_lines):
            stripped = line.strip()
            if not (stripped.startswith("import ") or stripped.startswith("from ") or stripped == ""):
                non_import_start = i
                break
        clean_code = "\n".join(code_lines[non_import_start:])
        lines.append(clean_code)
        lines.append("")
        lines.append("")

    return "\n".join(lines)
