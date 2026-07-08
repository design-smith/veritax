import { describe, expect, it } from "vitest";
import { createCanonicalHref, parseCanonicalHref } from "../canonical-link";

describe("canonical deep links", () => {
  it("creates stable object links for graph entities, graph flows, findings, and documents", () => {
    expect(createCanonicalHref({ type: "entity", id: "ent-1" })).toBe("/graph/entities/ent-1");
    expect(createCanonicalHref({ type: "flow", id: "flow-1" })).toBe("/graph/flows/flow-1");
    expect(createCanonicalHref({ type: "finding", id: "finding-1" })).toBe("/findings/finding-1");
    expect(createCanonicalHref({ type: "document", id: "doc-1" })).toBe("/library/doc-1");
  });

  it("preserves addressable tabs, document sections, runs, and queue items", () => {
    expect(createCanonicalHref({ type: "document", id: "doc-1", sectionId: "sec-4" })).toBe(
      "/library/doc-1?section=sec-4",
    );
    expect(createCanonicalHref({ type: "finding", id: "finding-1", tab: "history" })).toBe(
      "/findings/finding-1?tab=history",
    );
    expect(createCanonicalHref({ type: "run", id: "run-1", tab: "trace" })).toBe(
      "/runs?run=run-1&tab=trace",
    );
    expect(createCanonicalHref({ type: "queue_item", id: "queue-1" })).toBe(
      "/verification-queue?item=queue-1",
    );
  });

  it("parses supported canonical links back into object refs", () => {
    expect(parseCanonicalHref("/graph/entities/ent-1")).toEqual({ type: "entity", id: "ent-1" });
    expect(parseCanonicalHref("/findings/finding-1?tab=history")).toEqual({
      type: "finding",
      id: "finding-1",
      tab: "history",
    });
    expect(parseCanonicalHref("/library/doc-1?section=sec-4")).toEqual({
      type: "document",
      id: "doc-1",
      sectionId: "sec-4",
    });
  });
});
