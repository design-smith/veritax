import type { Entity, Flow } from "@/lib/mock/types";

// ── React Flow node/edge shapes ──────────────────────────────────────────────

export interface GraphNodeData {
  label: string;
  jurisdiction: string;
  role: Entity["role"];
  status: Entity["status"];
  asOf: string;
}

export interface GraphNode {
  id: string;
  type: "entityNode";
  position: { x: number; y: number };
  data: GraphNodeData;
}

export interface GraphEdgeData {
  kind: Flow["kind"];
  method: string;
  status: Flow["status"];
  exposure: number;
  currency: string;
  policyRate: number;
  observedRate: number;
}

export interface GraphEdge {
  id: string;
  type: "flowEdge";
  source: string;
  target: string;
  data: GraphEdgeData;
}

// ── Pure transformation functions ────────────────────────────────────────────

// Simple grid layout — React Flow will override with the actual positions
// after auto-layout runs in the browser.
function gridPosition(idx: number, cols = 4, spacing = 250): { x: number; y: number } {
  return {
    x: (idx % cols) * spacing,
    y: Math.floor(idx / cols) * spacing,
  };
}

export function toGraphNodes(entities: Entity[]): GraphNode[] {
  return entities.map((entity, idx) => ({
    id: entity.id,
    type: "entityNode",
    position: gridPosition(idx),
    data: {
      label: entity.name,
      jurisdiction: entity.jurisdictionCode,
      role: entity.role,
      status: entity.status,
      asOf: entity.asOf,
    },
  }));
}

export function toGraphEdges(flows: Flow[]): GraphEdge[] {
  return flows.map((flow) => ({
    id: flow.id,
    type: "flowEdge",
    source: flow.fromEntityId,
    target: flow.toEntityId,
    data: {
      kind: flow.kind,
      method: flow.method,
      status: flow.status,
      exposure: flow.exposure,
      currency: flow.currency,
      policyRate: flow.policyRate,
      observedRate: flow.observedRate,
    },
  }));
}
