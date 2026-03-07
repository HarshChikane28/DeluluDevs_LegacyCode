"""Generate graph visualizations using matplotlib."""
import networkx as nx
from pathlib import Path
from utils.logger import logger

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


def generate_graph_png(G: nx.DiGraph, output_path: str) -> bool:
    """Generate a PNG visualization of the call graph."""
    if not HAS_MATPLOTLIB:
        logger.warning("matplotlib not available, skipping graph PNG")
        return False

    try:
        fig, ax = plt.subplots(1, 1, figsize=(max(12, G.number_of_nodes() * 0.5),
                                                max(8, G.number_of_nodes() * 0.3)))

        # Color nodes by status
        color_map = {
            "untranslated": "#6b7280",
            "translating": "#3b82f6",
            "translated": "#10b981",
            "verified": "#059669",
            "error": "#ef4444",
        }
        colors = []
        for node in G.nodes():
            status = G.nodes[node].get("status", "untranslated")
            colors.append(color_map.get(status, "#6b7280"))

        # Shorten labels
        labels = {}
        for node in G.nodes():
            qname = G.nodes[node].get("qualified_name", node)
            short = qname.split(".")[-1] if "." in qname else qname
            labels[node] = short[:20]

        pos = nx.spring_layout(G, k=2, iterations=50, seed=42)
        nx.draw_networkx_nodes(G, pos, ax=ax, node_color=colors, node_size=600, alpha=0.9)
        nx.draw_networkx_edges(G, pos, ax=ax, edge_color="#94a3b8", alpha=0.6,
                                arrows=True, arrowsize=15, arrowstyle="-|>")
        nx.draw_networkx_labels(G, pos, labels, ax=ax, font_size=7, font_color="white")

        ax.set_facecolor("#1e1e2e")
        fig.patch.set_facecolor("#1e1e2e")
        ax.set_title("Function Call Graph", color="white", fontsize=14, pad=20)
        ax.axis("off")

        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches="tight",
                    facecolor="#1e1e2e", edgecolor="none")
        plt.close()
        logger.info(f"Graph PNG saved to {output_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to generate graph PNG: {e}")
        return False


def get_graph_json(G: nx.DiGraph) -> dict:
    """Convert graph to JSON-serializable format for frontend visualization."""
    nodes = []
    for node_id in G.nodes():
        data = dict(G.nodes[node_id])
        # Remove non-serializable fields
        data.pop("code", None)
        data.pop("translated_code", None)
        nodes.append({
            "id": node_id,
            "label": data.get("qualified_name", node_id),
            "status": data.get("status", "untranslated"),
            "file": data.get("file", ""),
            "params": data.get("params", []),
            "return_type": data.get("return_type", ""),
        })

    edges = []
    for source, target in G.edges():
        edges.append({"source": source, "target": target})

    return {"nodes": nodes, "edges": edges}
