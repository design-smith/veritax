export interface OwnershipEntry {
  parentId: string;
  childId: string;
  ownershipPct: number;
  elections: string[];
}

export interface TreeNode {
  id: string;
  depth: number;
  parentId: string | null;
  elections: string[];
  hasStructuralChange?: boolean;
}

export interface OwnershipEdge {
  id: string;
  source: string;
  target: string;
  ownershipPct: number;
  label: string;
  elections: string[];
}

export type StructuralChangeType = "ownership-change" | "entity-added" | "entity-removed" | "election-change";

export interface StructuralChange {
  type: StructuralChangeType;
  parentId?: string;
  childId: string;
  previousValue?: number | string;
  currentValue?: number | string;
}

// ── Pure transformation functions ────────────────────────────────────────────

export function toTreeNodes(ownership: OwnershipEntry[]): TreeNode[] {
  const childIds = new Set(ownership.map((o) => o.childId));
  const parentIds = new Set(ownership.map((o) => o.parentId));

  // Root = parentId that never appears as a childId
  const rootIds = new Set([...parentIds].filter((id) => !childIds.has(id)));

  const nodes = new Map<string, TreeNode>();

  // BFS to assign depths
  const queue: Array<{ id: string; depth: number; parentId: string | null }> = [
    ...[...rootIds].map((id) => ({ id, depth: 0, parentId: null })),
  ];

  while (queue.length > 0) {
    const { id, depth, parentId } = queue.shift()!;
    const entry = ownership.find((o) => o.childId === id);
    if (!nodes.has(id)) {
      nodes.set(id, { id, depth, parentId, elections: entry?.elections ?? [] });
    }
    const children = ownership.filter((o) => o.parentId === id);
    for (const child of children) {
      if (!nodes.has(child.childId)) {
        queue.push({ id: child.childId, depth: depth + 1, parentId: id });
      }
    }
  }

  return [...nodes.values()];
}

export function toOwnershipEdges(ownership: OwnershipEntry[]): OwnershipEdge[] {
  return ownership.map((o) => ({
    id: `${o.parentId}->${o.childId}`,
    source: o.parentId,
    target: o.childId,
    ownershipPct: o.ownershipPct,
    label: `${o.ownershipPct}%`,
    elections: o.elections,
  }));
}

export function detectStructuralChanges(
  previous: OwnershipEntry[],
  current: OwnershipEntry[],
): StructuralChange[] {
  const changes: StructuralChange[] = [];

  // Detect added entities
  const prevChildIds = new Set(previous.map((o) => o.childId));
  for (const entry of current) {
    if (!prevChildIds.has(entry.childId)) {
      changes.push({ type: "entity-added", parentId: entry.parentId, childId: entry.childId });
    }
  }

  // Detect removed entities
  const currChildIds = new Set(current.map((o) => o.childId));
  for (const entry of previous) {
    if (!currChildIds.has(entry.childId)) {
      changes.push({ type: "entity-removed", parentId: entry.parentId, childId: entry.childId });
    }
  }

  // Detect ownership % changes
  for (const curr of current) {
    const prev = previous.find(
      (o) => o.parentId === curr.parentId && o.childId === curr.childId
    );
    if (prev && prev.ownershipPct !== curr.ownershipPct) {
      changes.push({
        type: "ownership-change",
        parentId: curr.parentId,
        childId: curr.childId,
        previousValue: prev.ownershipPct,
        currentValue: curr.ownershipPct,
      });
    }
  }

  return changes;
}
