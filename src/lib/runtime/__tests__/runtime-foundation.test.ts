import { describe, expect, it } from "vitest";

import {
  createRuntimeService,
  RUNTIME_COST_CLASS_BUDGETS,
  RUNTIME_FAILURE_CLASSES,
  RUNTIME_DEFAULT_TOOLS,
  RUNTIME_DEFAULT_MODEL_ROUTES,
  RUNTIME_DEFAULT_MODELS,
  RUNTIME_JOB_TOOL_SETS,
  RUNTIME_JOB_KINDS,
  RUNTIME_JOB_STATUSES,
  RUNTIME_PLAN_SOURCES,
  RUNTIME_PLAN_STATUSES,
  RUNTIME_PLAN_TOOL_CLASSES,
  RUNTIME_PRIORITY_LANES,
  RUNTIME_RETRY_POLICIES,
  RUNTIME_STEP_TYPES,
  RUNTIME_SENSITIVITY_CEILINGS,
  RUNTIME_COST_CLASSES,
  RUNTIME_MODEL_ROUTE_KEYS,
  RUNTIME_TOOL_CAPABILITY_CLASSES,
  RuntimeError,
} from "../index";

describe("Runtime service foundation", () => {
  it("submits and persists a tenant-scoped runtime job", () => {
    const runtime = createRuntimeService();

    const submitted = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "scenario-recompute-fy2026",
      kind: "engine",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: {
        entityIds: ["entity-us"],
        jurisdictions: ["us"],
        objectRefs: [{ objectType: "flow", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
        period: "FY2026",
      },
      priorityLane: "interactive",
    });

    expect(submitted.job).toMatchObject({
      tenantId: "tenant-a",
      kind: "engine",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: {
        entityIds: ["entity-us"],
        jurisdictions: ["US"],
        objectRefs: [{ objectType: "flow", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
        period: "FY2026",
      },
      priorityLane: "interactive",
      status: "queued",
      failure: null,
      steps: [],
      planRef: null,
    });
    expect(submitted.job.jobId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(submitted.job.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: submitted.job.jobId })).toEqual(submitted.job);
    expect(runtime.listRuns({ tenantId: "tenant-a" })).toEqual([submitted.job]);
    expect(runtime.listRuns({ tenantId: "tenant-a", status: "queued" })).toEqual([submitted.job]);
    expect(runtime.listRuns({ tenantId: "tenant-a", status: "running" })).toEqual([]);
    expect(runtime.getRun({ tenantId: "tenant-b", jobId: submitted.job.jobId })).toBeNull();
  });

  it("replays submit_job idempotently and rejects conflicting reuse", () => {
    const runtime = createRuntimeService();
    const command = {
      tenantId: "tenant-a",
      idempotencyKey: "nightly-refresh",
      kind: "pipeline" as const,
      initiator: { kind: "system" as const, ref: "system:scheduler" },
      scope: { jurisdictions: ["US"] },
      priorityLane: "batch" as const,
    };

    const first = runtime.submitJob(command);
    const replay = runtime.submitJob(command);

    expect(replay).toEqual(first);
    expect(runtime.listRuns({ tenantId: "tenant-a" })).toEqual([first.job]);
    expect(() =>
      runtime.submitJob({
        ...command,
        kind: "engine",
      }),
    ).toThrow(RuntimeError);
    try {
      runtime.submitJob({
        ...command,
        kind: "engine",
      });
      throw new Error("Expected idempotency conflict.");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeError);
      expect((error as RuntimeError).code).toBe("IDEMPOTENCY_CONFLICT");
    }
  });

  it("publishes and enforces the v0 runtime enum contracts", () => {
    expect(RUNTIME_JOB_KINDS).toEqual(["agent", "engine", "pipeline", "composite"]);
    expect(RUNTIME_PRIORITY_LANES).toEqual(["interactive", "standard", "background", "batch"]);
    expect(RUNTIME_STEP_TYPES).toEqual(["tool", "engine", "model", "subjob"]);
    expect(RUNTIME_PLAN_STATUSES).toEqual(["compiled", "approved", "superseded"]);
    expect(RUNTIME_PLAN_SOURCES).toEqual(["user_command", "inline_directive", "commitment_ref", "schedule_ref"]);
    expect(RUNTIME_PLAN_TOOL_CLASSES).toEqual(["read", "engine-call", "staging-write", "export-prepare"]);
    expect(RUNTIME_TOOL_CAPABILITY_CLASSES).toEqual(["read", "engine-call", "staging-write", "export-prepare"]);
    expect(RUNTIME_SENSITIVITY_CEILINGS).toEqual(["public", "internal", "confidential", "privileged-vault"]);
    expect(RUNTIME_DEFAULT_TOOLS.map((tool) => tool.name)).toEqual([
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
    expect(RUNTIME_JOB_TOOL_SETS).toEqual({
      agent: ["read", "engine-call", "staging-write"],
      engine: ["engine-call"],
      pipeline: ["read", "engine-call", "staging-write", "export-prepare"],
      composite: [],
    });
    expect(RUNTIME_COST_CLASSES).toEqual(["instant", "standard", "heavy", "batch"]);
    expect(RUNTIME_COST_CLASS_BUDGETS).toMatchObject({
      instant: { tokenCeiling: 0, toolCallCeiling: 4, wallclockMs: 1000 },
      standard: { tokenCeiling: 250000, toolCallCeiling: 40 },
      heavy: { tokenCeiling: 2000000, toolCallCeiling: 200 },
      batch: { tokenCeiling: 10000000, toolCallCeiling: 1000 },
    });
    expect(RUNTIME_MODEL_ROUTE_KEYS).toEqual(["classification", "extraction", "drafting", "investigation"]);
    expect(RUNTIME_DEFAULT_MODELS.map((model) => `${model.modelId}@${model.version}`)).toEqual([
      "veritax-small-classifier@2026.06.19",
      "veritax-large-investigator@2026.06.19",
      "veritax-large-investigator-failover@2026.06.19",
    ]);
    expect(RUNTIME_DEFAULT_MODEL_ROUTES.map((route) => route.routeKey)).toEqual([
      "classification",
      "extraction",
      "drafting",
      "investigation",
    ]);
    expect(RUNTIME_RETRY_POLICIES).toMatchObject({
      tool_error: { maxAttempts: 2, initialBackoffMs: 1000, multiplier: 2 },
      validation: { maxAttempts: 0 },
      refusal: { maxAttempts: 0 },
    });
    expect(RUNTIME_JOB_STATUSES).toEqual([
      "queued",
      "planning",
      "running",
      "producing",
      "awaiting-gate",
      "completed",
      "failed",
      "cancelled",
      "budget-exceeded",
    ]);
    expect(RUNTIME_FAILURE_CLASSES).toEqual(["tool_error", "timeout", "budget", "validation", "refusal", "conflict"]);

    const runtime = createRuntimeService();
    expect(() =>
      runtime.submitJob({
        tenantId: "tenant-a",
        idempotencyKey: "bad-kind",
        kind: "draft" as never,
        initiator: { kind: "user", ref: "user:manager-1" },
      }),
    ).toThrow(RuntimeError);
    expect(() =>
      runtime.submitJob({
        tenantId: "tenant-a",
        idempotencyKey: "bad-initiator",
        kind: "engine",
        initiator: { kind: "bot" as never, ref: "bot:1" },
      }),
    ).toThrow(RuntimeError);
    expect(() =>
      runtime.submitJob({
        tenantId: "tenant-a",
        idempotencyKey: "bad-priority",
        kind: "engine",
        initiator: { kind: "user", ref: "user:manager-1" },
        priorityLane: "urgent" as never,
      }),
    ).toThrow(RuntimeError);
    expect(() =>
      runtime.submitJob({
        tenantId: "tenant-a",
        idempotencyKey: "bad-ref",
        kind: "engine",
        initiator: { kind: "user", ref: "user:manager-1" },
        scope: {
          objectRefs: [{ objectType: "Flow", objectId: "not-a-ulid" }],
        },
      }),
    ).toThrow(RuntimeError);
  });
});
