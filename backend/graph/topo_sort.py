"""Topological sort with SCC detection for translation ordering."""
import networkx as nx
from typing import List, Tuple
from utils.logger import logger


def get_translation_order(G: nx.DiGraph) -> List[List[str]]:
    """
    Get the translation order: leaf functions first, callers last.
    Groups SCCs into bundles for joint translation.
    
    Returns:
        List of groups, where each group is a list of function IDs to translate together.
        Groups are ordered so that dependencies come before dependents.
    """
    # Detect strongly connected components
    sccs = list(nx.strongly_connected_components(G))
    scc_map = {}
    for i, scc in enumerate(sccs):
        for node in scc:
            scc_map[node] = i

    # Build condensation graph (DAG of SCCs)
    condensation = nx.condensation(G, scc=sccs)

    # Topological sort of the condensation (reverse = leaf SCCs first)
    try:
        topo_order = list(nx.topological_sort(condensation))
    except nx.NetworkXUnfeasible:
        logger.error("Condensation graph has cycles (should not happen)")
        topo_order = list(condensation.nodes())

    # Reverse to get leaf-first order (nodes with no outgoing edges first)
    topo_order = list(reversed(topo_order))

    translation_order = []
    for scc_id in topo_order:
        members = sorted(sccs[scc_id])
        if len(members) == 1:
            translation_order.append(members)
        elif len(members) <= 3:
            # Small SCC: bundle for joint translation
            translation_order.append(members)
            logger.info(f"SCC bundle (size {len(members)}): {members}")
        else:
            # Large SCC: still bundle but add warning
            translation_order.append(members)
            logger.warning(f"Large SCC (size {len(members)}): {members} - may need manual review")

    total_funcs = sum(len(g) for g in translation_order)
    logger.info(f"Translation order: {len(translation_order)} groups, {total_funcs} total functions")

    return translation_order


def detect_cycles(G: nx.DiGraph) -> List[List[str]]:
    """Detect and return all cycles in the graph."""
    try:
        cycles = list(nx.simple_cycles(G))
        return cycles
    except Exception:
        return []
