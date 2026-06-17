import { describe, it, expect } from "vitest";
import { clusterNodes, expandCluster } from "../graph-virtualization";
import type { GraphNode } from "../graph-data";

function makeNode(id: string, x = 0, y = 0): GraphNode {
  return {
    id,
    type: "entityNode",
    position: { x, y },
    data: { label: `Entity ${id}`, jurisdiction: "US", role: "principal", status: "active", asOf: "2024-12-31" },
  };
}

const SMALL = Array.from({ length: 30 }, (_, i) => makeNode(`e${i}`, i * 100, 0));
const LARGE = Array.from({ length: 80 }, (_, i) => makeNode(`e${i}`, i * 60, Math.floor(i / 10) * 200));

describe("clusterNodes", () => {
  it("returns nodes unchanged when count <= 60", () => {
    const result = clusterNodes(SMALL, new Set());
    expect(result.nodes).toHaveLength(SMALL.length);
    expect(result.clusters).toHaveLength(0);
  });

  it("produces cluster nodes when count > 60", () => {
    const result = clusterNodes(LARGE, new Set());
    expect(result.clusters.length).toBeGreaterThan(0);
    // Total visible items (visible nodes + cluster nodes) should be less than original
    expect(result.nodes.length + result.clusters.length).toBeLessThan(LARGE.length);
  });

  it("each cluster has a count of the hidden nodes", () => {
    const result = clusterNodes(LARGE, new Set());
    result.clusters.forEach((c) => {
      expect(c.count).toBeGreaterThan(0);
      expect(c.memberIds.length).toBe(c.count);
    });
  });

  it("keeps expanded cluster members visible", () => {
    const result = clusterNodes(LARGE, new Set());
    const firstClusterId = result.clusters[0].id;
    const expanded = new Set([firstClusterId]);
    const expandedResult = clusterNodes(LARGE, expanded);
    // Should have more visible nodes when a cluster is expanded
    expect(expandedResult.nodes.length).toBeGreaterThan(result.nodes.length);
  });

  it("all original node ids are accounted for (in nodes or cluster memberIds)", () => {
    const result = clusterNodes(LARGE, new Set());
    const visibleIds = new Set(result.nodes.map((n) => n.id));
    const clusterMemberIds = new Set(result.clusters.flatMap((c) => c.memberIds));
    LARGE.forEach((n) => {
      expect(visibleIds.has(n.id) || clusterMemberIds.has(n.id)).toBe(true);
    });
  });
});

describe("expandCluster", () => {
  it("adds a cluster id to the expanded set", () => {
    const expanded = new Set<string>(["c1"]);
    const next = expandCluster(expanded, "c2");
    expect(next.has("c1")).toBe(true);
    expect(next.has("c2")).toBe(true);
  });

  it("removes a cluster id if already expanded (toggle)", () => {
    const expanded = new Set<string>(["c1"]);
    const next = expandCluster(expanded, "c1");
    expect(next.has("c1")).toBe(false);
  });
});
