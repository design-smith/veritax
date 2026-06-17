import { describe, it, expect } from "vitest";
import { toTreeNodes, toOwnershipEdges, detectStructuralChanges, type OwnershipEntry } from "../graph-tree";

const ownership: OwnershipEntry[] = [
  { parentId: "e1", childId: "e2", ownershipPct: 100, elections: ["check-the-box"] },
  { parentId: "e1", childId: "e3", ownershipPct: 100, elections: [] },
  { parentId: "e1", childId: "e4", ownershipPct: 51,  elections: ["disregarded-entity"] },
  { parentId: "e4", childId: "e5", ownershipPct: 100, elections: [] },
];

describe("toTreeNodes", () => {
  it("creates one node per unique entity in the ownership structure", () => {
    const nodes = toTreeNodes(ownership);
    const ids = new Set(nodes.map((n) => n.id));
    expect(ids.has("e1")).toBe(true);
    expect(ids.has("e2")).toBe(true);
    expect(ids.has("e5")).toBe(true);
  });

  it("root node (no parent) has depth 0", () => {
    const nodes = toTreeNodes(ownership);
    const root = nodes.find((n) => n.id === "e1");
    expect(root?.depth).toBe(0);
  });

  it("direct children have depth 1", () => {
    const nodes = toTreeNodes(ownership);
    const child = nodes.find((n) => n.id === "e2");
    expect(child?.depth).toBe(1);
  });

  it("grandchildren have depth 2", () => {
    const nodes = toTreeNodes(ownership);
    const grand = nodes.find((n) => n.id === "e5");
    expect(grand?.depth).toBe(2);
  });

  it("nodes carry elections badges from their incoming ownership entry", () => {
    const nodes = toTreeNodes(ownership);
    const e2 = nodes.find((n) => n.id === "e2");
    expect(e2?.elections).toContain("check-the-box");
    const e3 = nodes.find((n) => n.id === "e3");
    expect(e3?.elections).toHaveLength(0);
  });
});

describe("toOwnershipEdges", () => {
  it("creates one edge per ownership relationship", () => {
    const edges = toOwnershipEdges(ownership);
    expect(edges).toHaveLength(ownership.length);
  });

  it("each edge carries ownership percentage as label", () => {
    const edges = toOwnershipEdges(ownership);
    const e1e4 = edges.find((e) => e.source === "e1" && e.target === "e4");
    expect(e1e4?.ownershipPct).toBe(51);
    expect(e1e4?.label).toContain("51%");
  });
});

describe("detectStructuralChanges", () => {
  const previous: OwnershipEntry[] = [
    { parentId: "e1", childId: "e2", ownershipPct: 100, elections: [] },
    { parentId: "e1", childId: "e3", ownershipPct: 100, elections: [] },
  ];
  const current: OwnershipEntry[] = [
    { parentId: "e1", childId: "e2", ownershipPct: 75, elections: [] }, // changed %
    { parentId: "e1", childId: "e3", ownershipPct: 100, elections: [] },
    { parentId: "e1", childId: "e6", ownershipPct: 25, elections: [] }, // new child
  ];

  it("detects changed ownership percentage", () => {
    const changes = detectStructuralChanges(previous, current);
    const changed = changes.find((c) => c.type === "ownership-change");
    expect(changed).toBeDefined();
    expect(changed?.childId).toBe("e2");
  });

  it("detects new entity added to structure", () => {
    const changes = detectStructuralChanges(previous, current);
    const added = changes.find((c) => c.type === "entity-added");
    expect(added?.childId).toBe("e6");
  });

  it("returns empty array when structures are identical", () => {
    const changes = detectStructuralChanges(previous, previous);
    expect(changes).toHaveLength(0);
  });
});
