import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Document } from "@/lib/mock/types";

export interface LibraryFacets {
  type?: Document["type"];
  jurisdiction?: string;
  fy?: string;
  custody?: Document["custody"];
  sensitivity?: Document["sensitivity"];
  entityId?: string;
}

export function filterDocuments(docs: Document[], facets: LibraryFacets): Document[] {
  return docs.filter((d) => {
    if (facets.type && d.type !== facets.type) return false;
    if (facets.jurisdiction && d.jurisdiction !== facets.jurisdiction) return false;
    if (facets.fy && d.fy !== facets.fy) return false;
    if (facets.custody && d.custody !== facets.custody) return false;
    if (facets.sensitivity && d.sensitivity !== facets.sensitivity) return false;
    if (facets.entityId && !d.entityIds.includes(facets.entityId)) return false;
    return true;
  });
}

/** Days remaining until a retention deadline. Negative = expired. */
export function retentionDaysRemaining(retentionDate: string): number {
  return differenceInCalendarDays(parseISO(retentionDate), new Date());
}

/** All unique values for a given facet key across a document set. */
export function facetValues<K extends keyof LibraryFacets>(
  docs: Document[],
  key: K,
): string[] {
  const set = new Set<string>();
  for (const doc of docs) {
    const val = doc[key as keyof Document];
    if (typeof val === "string") set.add(val);
  }
  return [...set].sort();
}
