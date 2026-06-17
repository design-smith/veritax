import type { Flow } from "@/lib/mock/types";

export interface GraphFilterState {
  statuses: Array<Flow["status"]>;
  kinds: Array<Flow["kind"]>;
  materialityThreshold: number;
}

export const INITIAL_FILTER_STATE: GraphFilterState = {
  statuses: [],
  kinds: [],
  materialityThreshold: 0,
};

/**
 * Pure filter function — applies status, kind, and materiality filters to flows.
 * Empty arrays mean "show all" for that dimension.
 */
export function applyGraphFilters(
  flows: Flow[],
  filters: GraphFilterState,
): Flow[] {
  return flows.filter((flow) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(flow.status)) {
      return false;
    }
    if (filters.kinds.length > 0 && !filters.kinds.includes(flow.kind)) {
      return false;
    }
    if (filters.materialityThreshold > 0 && flow.exposure < filters.materialityThreshold) {
      return false;
    }
    return true;
  });
}

/** Toggle a value in an array (add if absent, remove if present). */
export function toggleFilter<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}
