import { describe, it, expect } from "vitest";
import { searchGraphNodes, computeSelectionState } from "../graph-search-selection";
import { mockEntities, mockFlows } from "@/lib/mock";
import { toGraphNodes, toGraphEdges } from "../graph-data";

const nodes = toGraphNodes(mockEntities);
const edges = toGraphEdges(mockFlows);

describe("searchGraphNodes", () => {
  it("returns all nodes when query is empty", () => {
    const result = searchGraphNodes(nodes, "");
    expect(result.matchIds).toHaveLength(nodes.length);
  });

  it("matches nodes whose label contains the query (case-insensitive)", () => {
    const result = searchGraphNodes(nodes, "uk");
    result.matchIds.forEach((id) => {
      const node = nodes.find((n) => n.id === id)!;
      expect(node.data.label.toLowerCase()).toContain("uk");
    });
  });

  it("also matches on jurisdiction code", () => {
    const result = searchGraphNodes(nodes, "SG");
    expect(result.matchIds.length).toBeGreaterThan(0);
  });

  it("returns empty matchIds for a query with no matches", () => {
    const result = searchGraphNodes(nodes, "ZZZNOMATCH");
    expect(result.matchIds).toHaveLength(0);
  });
});

describe("computeSelectionState", () => {
  it("returns all nodes as highlighted when nothing is selected", () => {
    const state = computeSelectionState(nodes, edges, []);
    state.dimmedNodeIds.forEach((id) => {
      // Nothing dimmed when no selection
    });
    expect(state.dimmedNodeIds).toHaveLength(0);
  });

  it("dims non-neighbor nodes when one entity node is selected", () => {
    // e5 (nodes[4]) is only connected to e1 and e4 — e2, e3, e6 should be dimmed
    const selectedId = nodes[4].id;
    const state = computeSelectionState(nodes, edges, [selectedId]);
    expect(state.dimmedNodeIds.length).toBeGreaterThan(0);
    expect(state.dimmedNodeIds).not.toContain(selectedId);
  });

  it("does not dim direct neighbors of the selected node", () => {
    const selectedId = nodes[4].id; // e5 — neighbors are e1 and e4
    const state = computeSelectionState(nodes, edges, [selectedId]);
    // Find at least one neighbor of e1
    const neighborEdge = edges.find(
      (e) => e.source === selectedId || e.target === selectedId
    );
    if (neighborEdge) {
      const neighborId = neighborEdge.source === selectedId
        ? neighborEdge.target
        : neighborEdge.source;
      expect(state.dimmedNodeIds).not.toContain(neighborId);
    }
  });

  it("expands selection to all neighbors when multiple nodes selected", () => {
    const selected = [nodes[0].id, nodes[1].id];
    const state = computeSelectionState(nodes, edges, selected);
    // Neither selected node should be dimmed
    selected.forEach((id) => expect(state.dimmedNodeIds).not.toContain(id));
  });
});
