"""Build NetworkX call graph from parsed function nodes."""
import networkx as nx
from typing import List, Dict, Any, Tuple
from utils.logger import logger


def build_call_graph(functions: List[Dict[str, Any]]) -> Tuple[nx.DiGraph, List[str]]:
    """
    Build a directed call graph from function nodes.
    
    Returns:
        (graph, unresolved_calls) - The NetworkX DiGraph and list of unresolved external calls
    """
    G = nx.DiGraph()
    unresolved = []

    # Build ID lookup (normalized name -> function id)
    id_lookup = {}
    for func in functions:
        G.add_node(func["id"], **func)
        # Multiple lookup keys for matching
        qname = func["qualified_name"]
        id_lookup[qname] = func["id"]
        id_lookup[qname.lower()] = func["id"]
        # Short name (method name only)
        short_name = qname.split(".")[-1] if "." in qname else qname
        if short_name not in id_lookup:
            id_lookup[short_name] = func["id"]
        if short_name.lower() not in id_lookup:
            id_lookup[short_name.lower()] = func["id"]

    # Add edges (caller -> callee)
    for func in functions:
        caller_id = func["id"]
        for callee_name in func.get("callees", []):
            # Try to resolve callee to a known function ID
            callee_id = _resolve_callee(callee_name, id_lookup, func["file"])
            if callee_id:
                G.add_edge(caller_id, callee_id)
                # Update called_by in the target node
                if callee_id in G.nodes:
                    called_by = G.nodes[callee_id].get("called_by", [])
                    if caller_id not in called_by:
                        called_by.append(caller_id)
                        G.nodes[callee_id]["called_by"] = called_by
            else:
                unresolved.append(f"{caller_id} -> {callee_name}")

    logger.info(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(unresolved)} unresolved")
    return G, unresolved


def _resolve_callee(callee_name: str, id_lookup: Dict[str, str], caller_file: str) -> str:
    """Try to resolve a callee name to a function ID."""
    # Direct match
    if callee_name in id_lookup:
        return id_lookup[callee_name]

    # Case-insensitive match
    lower = callee_name.lower()
    if lower in id_lookup:
        return id_lookup[lower]

    # Try with caller's file prefix
    candidate = f"{caller_file}::{callee_name}"
    for func_id in id_lookup.values():
        if func_id == candidate:
            return func_id

    # Partial match on method name
    short = callee_name.split(".")[-1] if "." in callee_name else callee_name
    if short in id_lookup:
        return id_lookup[short]
    if short.lower() in id_lookup:
        return id_lookup[short.lower()]

    return None
