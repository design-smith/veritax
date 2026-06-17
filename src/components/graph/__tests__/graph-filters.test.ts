import { describe, it, expect } from "vitest";
import { applyGraphFilters } from "../graph-filters";
import { mockFlows } from "@/lib/mock";

describe("applyGraphFilters", () => {
  it("returns all flows when no filters applied", () => {
    const result = applyGraphFilters(mockFlows, {
      statuses: [],
      kinds: [],
      materialityThreshold: 0,
    });
    expect(result).toHaveLength(mockFlows.length);
  });

  it("filters to only exception flows when status=['exception']", () => {
    const result = applyGraphFilters(mockFlows, {
      statuses: ["exception"],
      kinds: [],
      materialityThreshold: 0,
    });
    result.forEach((f) => expect(f.status).toBe("exception"));
    expect(result.length).toBeLessThan(mockFlows.length);
  });

  it("filters by multiple statuses (exception + drift)", () => {
    const result = applyGraphFilters(mockFlows, {
      statuses: ["exception", "drift"],
      kinds: [],
      materialityThreshold: 0,
    });
    result.forEach((f) =>
      expect(["exception", "drift"]).toContain(f.status)
    );
  });

  it("filters by flow kind (royalty only)", () => {
    const result = applyGraphFilters(mockFlows, {
      statuses: [],
      kinds: ["royalty"],
      materialityThreshold: 0,
    });
    result.forEach((f) => expect(f.kind).toBe("royalty"));
  });

  it("excludes flows whose exposure is below the materiality threshold", () => {
    const threshold = 2_000_000;
    const result = applyGraphFilters(mockFlows, {
      statuses: [],
      kinds: [],
      materialityThreshold: threshold,
    });
    result.forEach((f) => expect(f.exposure).toBeGreaterThanOrEqual(threshold));
  });

  it("materialityThreshold of 0 includes all flows", () => {
    const result = applyGraphFilters(mockFlows, {
      statuses: [],
      kinds: [],
      materialityThreshold: 0,
    });
    expect(result).toHaveLength(mockFlows.length);
  });
});
