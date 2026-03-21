"""Function-by-function translation engine using topological order."""
import re
import asyncio
import networkx as nx
from typing import List, Dict, Any, Optional, Callable
from .llm_client import LLMClient
from .prompt_builder import (
    build_translation_prompt,
    build_scc_bundle_prompt,
    build_file_assembly_prompt,
)
from context.dependency_resolver import get_translated_dependencies
from utils.logger import logger


def _clean_llm_response(response: str) -> str:
    """Strip markdown fences and commentary from LLM response."""
    text = response.strip()
    # Remove markdown code blocks
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```python or ```)
        lines = lines[1:]
        # Remove last ``` if present
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    # Remove trailing explanation after the code
    # Look for a line that starts with common commentary patterns
    clean_lines = []
    for line in text.split("\n"):
        if line.strip().startswith("Note:") or line.strip().startswith("Explanation:"):
            break
        clean_lines.append(line)
    return "\n".join(clean_lines).strip()


async def translate_functions(
    G: nx.DiGraph,
    translation_order: List[List[str]],
    source_lang: str,
    llm_client: LLMClient,
    progress_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Translate all functions in topological order (leaf-first).
    
    Args:
        G: The call graph with function data in nodes
        translation_order: Groups of function IDs in dependency order
        source_lang: Source language ("java" or "cobol")
        llm_client: LLM client instance
        progress_callback: async callback(stage, progress, message, data) for WebSocket updates
    """
    total = sum(len(group) for group in translation_order)
    translated = 0
    errors = []

    for group_idx, group in enumerate(translation_order):
        if len(group) == 1:
            # Single function translation
            func_id = group[0]
            node_data = G.nodes[func_id]

            if progress_callback:
                deps = get_translated_dependencies(func_id, G)
                dep_names = [d["qualified_name"] for d in deps]
                await progress_callback(
                    "translating",
                    translated / total,
                    f"Translating {node_data.get('qualified_name', func_id)} [{translated+1}/{total}]"
                    + (f" — depends on: {', '.join(dep_names)}" if dep_names else " — leaf function, no dependencies"),
                    {
                        "current_function": node_data.get("qualified_name", func_id),
                        "dependencies_used": dep_names,
                        "status": "in_progress",
                        "graph_update": {"node_id": func_id, "new_status": "translating"},
                    },
                )

            try:
                G.nodes[func_id]["status"] = "translating"

                # Get translated dependencies
                deps = get_translated_dependencies(func_id, G)

                # Build and send prompt
                prompt = build_translation_prompt(
                    node_data, deps, node_data["code"], source_lang
                )
                response = await llm_client.complete(prompt)
                clean_code = _clean_llm_response(response)

                G.nodes[func_id]["translated_code"] = clean_code
                G.nodes[func_id]["status"] = "translated"
                translated += 1

                if progress_callback:
                    await progress_callback(
                        "translating",
                        translated / total,
                        f"✓ {node_data.get('qualified_name', func_id)} translated ({len(clean_code)} chars)",
                        {
                            "current_function": node_data.get("qualified_name", func_id),
                            "status": "translated",
                            "graph_update": {"node_id": func_id, "new_status": "translated"},
                        },
                    )

                # Rate limit awareness — small delay
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.error(f"Translation error for {func_id}: {e}")
                G.nodes[func_id]["status"] = "error"
                G.nodes[func_id]["notes"] = str(e)
                errors.append({"function": func_id, "error": str(e)})
                translated += 1

                if progress_callback:
                    await progress_callback(
                        "translating",
                        translated / total,
                        f"✗ {node_data.get('qualified_name', func_id)} failed: {str(e)[:100]}",
                        {
                            "current_function": node_data.get("qualified_name", func_id),
                            "status": "error",
                            "graph_update": {"node_id": func_id, "new_status": "error"},
                        },
                    )

        else:
            # SCC bundle translation
            bundle_names = [G.nodes[fid].get("qualified_name", fid) for fid in group]
            if progress_callback:
                await progress_callback(
                    "translating",
                    translated / total,
                    f"Translating SCC bundle ({len(group)} functions): {', '.join(bundle_names)}",
                    {
                        "current_function": f"SCC[{','.join(bundle_names)}]",
                        "status": "in_progress",
                    },
                )

            try:
                for fid in group:
                    G.nodes[fid]["status"] = "translating"

                # Collect raw code for all functions in bundle
                filtered_codes = []
                funcs_data = []
                for fid in group:
                    nd = G.nodes[fid]
                    filtered_codes.append(nd["code"])
                    funcs_data.append(nd)

                # Get external dependencies (outside the SCC)
                ext_deps = []
                for fid in group:
                    for dep in get_translated_dependencies(fid, G):
                        if dep["id"] not in group:
                            ext_deps.append(dep)

                prompt = build_scc_bundle_prompt(
                    funcs_data, ext_deps, filtered_codes, source_lang
                )
                response = await llm_client.complete(prompt)
                clean_code = _clean_llm_response(response)

                # Split response among bundle members (best effort)
                # Each function gets the full bundle code (they're interdependent)
                for fid in group:
                    G.nodes[fid]["translated_code"] = clean_code
                    G.nodes[fid]["status"] = "translated"
                    translated += 1

                if progress_callback:
                    await progress_callback(
                        "translating",
                        translated / total,
                        f"✓ SCC bundle translated: {', '.join(bundle_names)}",
                        {"status": "translated"},
                    )

                await asyncio.sleep(0.5)

            except Exception as e:
                for fid in group:
                    G.nodes[fid]["status"] = "error"
                    G.nodes[fid]["notes"] = str(e)
                    translated += 1
                errors.append({"function": f"SCC[{','.join(group)}]", "error": str(e)})

    return {
        "total": total,
        "translated": translated - len(errors),
        "errors": errors,
        "provider": llm_client.get_provider_name(),
    }
