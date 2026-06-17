import type { GraphEdge, GraphNode } from "./graph-data";

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  matchIds: string[];
}

export function searchGraphNodes(
  nodes: GraphNode[],
  query: string,
): SearchResult {
  if (!query.trim()) {
    return { matchIds: nodes.map((n) => n.id) };
  }

  const q = query.toLowerCase().trim();
  const matchIds = nodes
    .filter(
      (n) =>
        n.data.label.toLowerCase().includes(q) ||
        n.data.jurisdiction.toLowerCase().includes(q),
    )
    .map((n) => n.id);

  return { matchIds };
}

// ── Selection ─────────────────────────────────────────────────────────────────

export interface SelectionState {
  selectedNodeIds: string[];
  dimmedNodeIds: string[];
}

/**
 * Given a set of selected node IDs, compute which nodes should be dimmed.
 * Dimmed = not selected AND not a direct neighbor of any selected node.
 */
export function computeSelectionState(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedIds: string[],
): SelectionState {
  if (selectedIds.length === 0) {
    return { selectedNodeIds: [], dimmedNodeIds: [] };
  }

  // Build neighbor set: all nodes directly connected to any selected node
  const neighborIds = new Set<string>(selectedIds);
  for (const edge of edges) {
    if (selectedIds.includes(edge.source)) neighborIds.add(edge.target);
    if (selectedIds.includes(edge.target)) neighborIds.add(edge.source);
  }

  const dimmedNodeIds = nodes
    .map((n) => n.id)
    .filter((id) => !neighborIds.has(id));

  return { selectedNodeIds: selectedIds, dimmedNodeIds };
}
