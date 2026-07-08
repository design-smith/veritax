import { describe, expect, it } from "vitest";

import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime tool registry", () => {
  it("boots with the v1 deploy-time tool catalog", () => {
    const runtime = createRuntimeService();

    expect(runtime.listTools().map((tool) => tool.name)).toEqual([
      "record.get",
      "record.subgraph",
      "record.conflicts",
      "record.timeline",
      "record.current_value",
      "retrieval.search",
      "blob.read",
      "engine.range_test",
      "engine.globe_check",
      "engine.cascade_traversal",
      "staging.put",
      "export.prepare",
    ]);
    expect(runtime.getTool({ name: "record.get" })).toMatchObject({
      name: "record.get",
      capabilityClass: "read",
      scopeRequirements: {
        objectTypes: ["record"],
        jurisdictionsRequired: false,
        objectRefsRequired: true,
      },
      sensitivityCeiling: "confidential",
      costWeight: 1,
      rateLimits: { perMinute: 600, burst: 120 },
      registeredBy: "deploy",
    });
    expect(runtime.getTool({ name: "staging.put" })).toMatchObject({
      name: "staging.put",
      capabilityClass: "staging-write",
      scopeRequirements: {
        objectTypes: ["staged_object"],
        jurisdictionsRequired: false,
        objectRefsRequired: true,
      },
      sensitivityCeiling: "confidential",
      costWeight: 2,
      rateLimits: { perMinute: 120, burst: 30 },
    });
    expect(runtime.getTool({ name: "email.send" })).toBeNull();
  });

  it("registers deploy-time tools and rejects egress or runtime registration", () => {
    const runtime = createRuntimeService();

    const registered = runtime.registerTool({
      name: "engine.custom_range",
      capabilityClass: "engine-call",
      scopeRequirements: {
        objectTypes: ["flow"],
        jurisdictionsRequired: true,
        objectRefsRequired: true,
      },
      sensitivityCeiling: "confidential",
      costWeight: 3,
      rateLimits: { perMinute: 60, burst: 10 },
      registeredBy: "deploy",
    });

    expect(registered.tool).toMatchObject({
      name: "engine.custom_range",
      capabilityClass: "engine-call",
      scopeRequirements: {
        objectTypes: ["flow"],
        jurisdictionsRequired: true,
        objectRefsRequired: true,
      },
      sensitivityCeiling: "confidential",
      costWeight: 3,
      rateLimits: { perMinute: 60, burst: 10 },
      registeredBy: "deploy",
    });
    expect(runtime.getTool({ name: "engine.custom_range" })).toEqual(registered.tool);

    expect(() =>
      runtime.registerTool({
        name: "email.send",
        capabilityClass: "egress" as never,
        scopeRequirements: {
          objectTypes: ["message"],
          jurisdictionsRequired: false,
          objectRefsRequired: false,
        },
        sensitivityCeiling: "confidential",
        costWeight: 1,
        rateLimits: { perMinute: 10, burst: 1 },
        registeredBy: "deploy",
      }),
    ).toThrow(RuntimeError);
    expect(() =>
      runtime.registerTool({
        name: "retrieval.web_search",
        capabilityClass: "read",
        scopeRequirements: {
          objectTypes: ["document"],
          jurisdictionsRequired: false,
          objectRefsRequired: false,
        },
        sensitivityCeiling: "confidential",
        costWeight: 1,
        rateLimits: { perMinute: 10, burst: 1 },
        registeredBy: "runtime" as never,
      }),
    ).toThrow(RuntimeError);
  });

  it("enforces per-minute tool rate limits at authorization time", () => {
    const runtime = createRuntimeService();
    const tool = runtime.registerTool({
      name: "record.rate_limited_get",
      capabilityClass: "read",
      scopeRequirements: {
        objectTypes: ["record"],
        jurisdictionsRequired: false,
        objectRefsRequired: true,
      },
      sensitivityCeiling: "confidential",
      costWeight: 1,
      rateLimits: { perMinute: 2, burst: 2 },
      registeredBy: "deploy",
    }).tool;
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "rate-limited-tool-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
      scope: {
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RT" }],
      },
    }).job;
    const command = {
      tenantId: "tenant-a",
      jobId: job.jobId,
      toolName: tool.name,
      requestedScope: {
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RT" }],
      },
      requestedSensitivity: "confidential" as const,
      capabilityMap: {
        toolClasses: ["read" as const],
        entityIds: [],
        jurisdictions: [],
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RT" }],
        sensitivityCeiling: "confidential" as const,
      },
    };

    expect(runtime.authorizeToolUse({ ...command, requestedAt: "2026-06-19T20:00:00.000Z" })).toMatchObject({
      allowed: true,
      reason: null,
    });
    expect(runtime.authorizeToolUse({ ...command, requestedAt: "2026-06-19T20:00:20.000Z" })).toMatchObject({
      allowed: true,
      reason: null,
    });
    expect(runtime.authorizeToolUse({ ...command, requestedAt: "2026-06-19T20:00:40.000Z" })).toMatchObject({
      allowed: false,
      reason: "tool_rate_limited",
      tool: { name: tool.name },
    });
    expect(runtime.authorizeToolUse({ ...command, requestedAt: "2026-06-19T20:01:01.000Z" })).toMatchObject({
      allowed: true,
      reason: null,
    });
  });
});
