import { describe, it, expect } from "vitest";
import { searchAskObjects } from "../ask-search";
import { mockEntities, mockFlows, mockFindings, mockDocuments, mockRuns } from "@/lib/mock";

const corpus = { entities: mockEntities, flows: mockFlows, findings: mockFindings, documents: mockDocuments, runs: mockRuns };

describe("searchAskObjects", () => {
  it("returns empty groups for empty query", () => {
    const result = searchAskObjects("", corpus);
    expect(result.entities).toHaveLength(0);
    expect(result.findings).toHaveLength(0);
  });

  it("matches entities by name (case-insensitive)", () => {
    const result = searchAskObjects("uk", corpus);
    result.entities.forEach((e) => expect(e.name.toLowerCase()).toContain("uk"));
    expect(result.entities.length).toBeGreaterThan(0);
  });

  it("matches findings by title or summary", () => {
    const result = searchAskObjects("royalty", corpus);
    expect(result.findings.length).toBeGreaterThan(0);
    result.findings.forEach((f) => {
      const matchesTitle = f.title.toLowerCase().includes("royalt");
      const matchesSummary = f.summary.toLowerCase().includes("royalt");
      expect(matchesTitle || matchesSummary).toBe(true);
    });
  });

  it("matches documents by name", () => {
    const result = searchAskObjects("local file", corpus);
    expect(result.documents.length).toBeGreaterThan(0);
  });

  it("matches flows by kind", () => {
    const result = searchAskObjects("royalty", corpus);
    // Should also find royalty flows
    expect(result.flows.length).toBeGreaterThan(0);
  });

  it("returns no results for a non-matching query", () => {
    const result = searchAskObjects("ZZZNOMATCHXXX", corpus);
    const total = Object.values(result).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBe(0);
  });

  it("limits each group to at most 5 results", () => {
    const result = searchAskObjects("a", corpus); // broad query
    Object.values(result).forEach((arr) => expect(arr.length).toBeLessThanOrEqual(5));
  });
});
