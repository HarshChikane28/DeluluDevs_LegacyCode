"""Extract only relevant dependencies for each function to minimize LLM context."""
import networkx as nx
from typing import List, Dict, Any


def get_translated_dependencies(func_id: str, G: nx.DiGraph) -> List[Dict[str, str]]:
    """
    Get already-translated dependency code for a function.
    Only includes direct callees that have been translated.
    """
    deps = []
    if func_id not in G:
        return deps

    for callee_id in G.successors(func_id):
        node_data = G.nodes[callee_id]
        if node_data.get("status") in ("translated", "verified") and node_data.get("translated_code"):
            deps.append({
                "id": callee_id,
                "qualified_name": node_data.get("qualified_name", callee_id),
                "translated_code": node_data["translated_code"],
            })

    return deps


def get_dependency_context_size(func_id: str, G: nx.DiGraph) -> int:
    """Estimate token count for dependency context."""
    deps = get_translated_dependencies(func_id, G)
    total_chars = sum(len(d["translated_code"]) for d in deps)
    return total_chars // 4  # rough token estimate
