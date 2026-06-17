import { describe, it, expect } from "vitest";
import { toGraphNodes, toGraphEdges } from "../graph-data";
import { mockEntities, mockFlows } from "@/lib/mock";

describe("toGraphNodes", () => {
  it("creates one node per entity", () => {
    const nodes = toGraphNodes(mockEntities);
    expect(nodes).toHaveLength(mockEntities.length);
  });

  it("each node carries entity id, label, and jurisdiction", () => {
    const nodes = toGraphNodes(mockEntities);
    const first = nodes[0];
    expect(first.id).toBe(mockEntities[0].id);
    expect(first.data.label).toBe(mockEntities[0].name);
    expect(first.data.jurisdiction).toBe(mockEntities[0].jurisdictionCode);
  });

  it("each node has a position (number pair)", () => {
    const nodes = toGraphNodes(mockEntities);
    nodes.forEach((n) => {
      expect(typeof n.position.x).toBe("number");
      expect(typeof n.position.y).toBe("number");
    });
  });

  it("node type is 'entityNode'", () => {
    const nodes = toGraphNodes(mockEntities);
    nodes.forEach((n) => expect(n.type).toBe("entityNode"));
  });
});

describe("toGraphEdges", () => {
  it("creates one edge per flow", () => {
    const edges = toGraphEdges(mockFlows);
    expect(edges).toHaveLength(mockFlows.length);
  });

  it("each edge source and target match the flow's entities", () => {
    const edges = toGraphEdges(mockFlows);
    const flow = mockFlows[0];
    const edge = edges.find((e) => e.id === flow.id);
    expect(edge?.source).toBe(flow.fromEntityId);
    expect(edge?.target).toBe(flow.toEntityId);
  });

  it("edge data carries flow kind, status, and exposure", () => {
    const edges = toGraphEdges(mockFlows);
    const edge = edges[0];
    expect(edge.data.kind).toBeDefined();
    expect(edge.data.status).toBeDefined();
    expect(typeof edge.data.exposure).toBe("number");
  });

  it("edge type is 'flowEdge'", () => {
    const edges = toGraphEdges(mockFlows);
    edges.forEach((e) => expect(e.type).toBe("flowEdge"));
  });
});
