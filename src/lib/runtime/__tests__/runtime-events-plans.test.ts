import { describe, expect, it } from "vitest";

import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime events and plans", () => {
  it("emits lifecycle and step events into a run stream", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "evented-engine-run",
      kind: "engine",
      initiator: { kind: "user", ref: "user:manager-1" },
      priorityLane: "interactive",
    });

    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "planning",
      transitionedAt: "2026-06-19T16:00:00.000Z",
    });
    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "running",
      transitionedAt: "2026-06-19T16:01:00.000Z",
    });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-engine-call",
      type: "engine",
      argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YC" },
      resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YD" },
      t0: "2026-06-19T16:01:10.000Z",
      t1: "2026-06-19T16:01:12.000Z",
      cost: { engineCalls: 1 },
    });
    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "producing",
      transitionedAt: "2026-06-19T16:02:00.000Z",
    });
    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "completed",
      transitionedAt: "2026-06-19T16:03:00.000Z",
    });

    const stream = runtime.streamRun({ tenantId: "tenant-a", jobId: job.jobId });

    expect(stream.job.status).toBe("completed");
    expect(stream.events.map((event) => event.type)).toEqual([
      "run.queued",
      "run.planning",
      "run.started",
      "run.step",
      "run.producing",
      "run.completed",
    ]);
    expect(stream.events.at(0)).toMatchObject({
      tenantId: "tenant-a",
      jobId: job.jobId,
      type: "run.queued",
      payload: { status: "queued", kind: "engine" },
    });
    expect(stream.events.at(3)).toMatchObject({
      type: "run.step",
      occurredAt: "2026-06-19T16:01:12.000Z",
      payload: {
        stepId: "step-engine-call",
        type: "engine",
        argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YC" },
        resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YD" },
        cost: { engineCalls: 1 },
      },
    });
  });

  it("compiles and persists a durable plan object", () => {
    const runtime = createRuntimeService();

    const compiled = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-irish-sbc-scan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: {
        entityIds: ["entity-ie"],
        jurisdictions: ["ie"],
        objectRefs: [{ objectType: "agreement", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YE" }],
        period: "FY2026",
      },
      intentRestated: "Review the Irish SBC election against the current agreement and ledger evidence.",
      steps: [
        {
          action: "Read the governing agreement and ledger assertions.",
          scope: {
            jurisdictions: ["IE"],
            objectRefs: [{ objectType: "agreement", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YE" }],
          },
          toolClass: "read",
        },
        {
          action: "Run the deterministic SBC election check.",
          scope: { jurisdictions: ["IE"] },
          toolClass: "engine-call",
        },
      ],
      invalidationsPreview: [
        {
          objectType: "finding",
          label: "Irish SBC exposure finding",
          reason: "The election result can change the finding candidate.",
        },
      ],
      produces: [{ objectType: "finding_candidate", label: "SBC election finding candidate" }],
      estDurationMs: 900000,
      costClass: "standard",
      instructionEcho: "Use FY2026 scope only.",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:briefing" },
    });
    const replay = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-irish-sbc-scan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: {
        entityIds: ["entity-ie"],
        jurisdictions: ["ie"],
        objectRefs: [{ objectType: "agreement", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YE" }],
        period: "FY2026",
      },
      intentRestated: "Review the Irish SBC election against the current agreement and ledger evidence.",
      steps: [
        {
          action: "Read the governing agreement and ledger assertions.",
          scope: {
            jurisdictions: ["IE"],
            objectRefs: [{ objectType: "agreement", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YE" }],
          },
          toolClass: "read",
        },
        {
          action: "Run the deterministic SBC election check.",
          scope: { jurisdictions: ["IE"] },
          toolClass: "engine-call",
        },
      ],
      invalidationsPreview: [
        {
          objectType: "finding",
          label: "Irish SBC exposure finding",
          reason: "The election result can change the finding candidate.",
        },
      ],
      produces: [{ objectType: "finding_candidate", label: "SBC election finding candidate" }],
      estDurationMs: 900000,
      costClass: "standard",
      instructionEcho: "Use FY2026 scope only.",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:briefing" },
    });

    expect(replay).toEqual(compiled);
    expect(compiled.plan).toMatchObject({
      tenantId: "tenant-a",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      status: "compiled",
      planRef: { objectType: "plan", objectId: compiled.plan.planId },
      scope: {
        entityIds: ["entity-ie"],
        jurisdictions: ["IE"],
        objectRefs: [{ objectType: "agreement", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YE" }],
        period: "FY2026",
      },
      intentRestated: "Review the Irish SBC election against the current agreement and ledger evidence.",
      steps: [
        {
          action: "Read the governing agreement and ledger assertions.",
          toolClass: "read",
        },
        {
          action: "Run the deterministic SBC election check.",
          toolClass: "engine-call",
        },
      ],
      invalidationsPreview: [
        {
          objectType: "finding",
          label: "Irish SBC exposure finding",
          reason: "The election result can change the finding candidate.",
        },
      ],
      produces: [{ objectType: "finding_candidate", label: "SBC election finding candidate", reason: null }],
      estDurationMs: 900000,
      costClass: "standard",
      instructionEcho: "Use FY2026 scope only.",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:briefing" },
      supersedesPlanId: null,
      approvedJobId: null,
    });
    expect(runtime.getPlan({ tenantId: "tenant-a", planId: compiled.plan.planId })).toEqual(compiled.plan);
    expect(runtime.listPlans({ tenantId: "tenant-a", status: "compiled" })).toEqual([compiled.plan]);
  });

  it("edits a plan by recompiling a superseding plan", () => {
    const runtime = createRuntimeService();
    const original = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-original-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US"], period: "FY2026" },
      intentRestated: "Scan US intercompany flows for stale range support.",
      steps: [{ action: "Read current US flow evidence.", toolClass: "read" }],
      invalidationsPreview: [],
      produces: [{ objectType: "finding_candidate", label: "US range support candidate" }],
      estDurationMs: 600000,
      costClass: "standard",
      instructionEcho: "Use current FY only.",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:runs" },
    }).plan;

    const edited = runtime.editPlan({
      tenantId: "tenant-a",
      planId: original.planId,
      idempotencyKey: "edit-plan-scope",
      intentRestated: "Scan US and Canada intercompany flows for stale range support.",
      scope: { jurisdictions: ["US", "CA"], period: "FY2026" },
      steps: [
        { action: "Read current US and Canada flow evidence.", toolClass: "read" },
        { action: "Run the range support check for both jurisdictions.", toolClass: "engine-call" },
      ],
      invalidationsPreview: [
        {
          objectType: "finding",
          label: "North America range support finding",
          reason: "Expanded scope can change stale-support findings.",
        },
      ],
      produces: [{ objectType: "finding_candidate", label: "North America range support candidate" }],
      estDurationMs: 1200000,
      costClass: "heavy",
      instructionEcho: "Include Canada in the same run.",
      permissionVerdict: { allowed: true, reason: null },
    });

    expect(runtime.getPlan({ tenantId: "tenant-a", planId: original.planId })).toMatchObject({
      status: "superseded",
      approvedJobId: null,
    });
    expect(edited.plan).toMatchObject({
      status: "compiled",
      supersedesPlanId: original.planId,
      intentRestated: "Scan US and Canada intercompany flows for stale range support.",
      scope: { jurisdictions: ["CA", "US"], period: "FY2026" },
      steps: [
        { action: "Read current US and Canada flow evidence.", toolClass: "read" },
        { action: "Run the range support check for both jurisdictions.", toolClass: "engine-call" },
      ],
      costClass: "heavy",
      source: original.source,
    });
    expect(runtime.listPlans({ tenantId: "tenant-a", status: "compiled" })).toEqual([edited.plan]);
    expect(runtime.listPlans({ tenantId: "tenant-a", status: "superseded" })).toEqual([
      runtime.getPlan({ tenantId: "tenant-a", planId: original.planId }),
    ]);
  });

  it("approves a compiled plan into a queued job with frozen pins", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-approval-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: {
        entityIds: ["entity-sg"],
        jurisdictions: ["SG"],
        period: "FY2026",
      },
      intentRestated: "Investigate Singapore service fee support before producing a finding candidate.",
      steps: [
        { action: "Read Singapore service fee evidence.", toolClass: "read" },
        { action: "Run service fee range check.", toolClass: "engine-call" },
      ],
      invalidationsPreview: [],
      produces: [{ objectType: "finding_candidate", label: "Singapore service fee finding candidate" }],
      estDurationMs: 1500000,
      costClass: "standard",
      instructionEcho: "Use current signed agreements only.",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:briefing" },
    }).plan;

    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-plan",
      priorityLane: "interactive",
      approvedAt: "2026-06-19T17:00:00.000Z",
      pins: {
        corpusVersion: 418,
        rulepackVersions: { transfer_pricing: "2026.2" },
        modelVersions: { examiner: "gpt-5.0-2026-06-01" },
      },
    });
    const replay = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-plan",
      priorityLane: "interactive",
      approvedAt: "2026-06-19T17:00:00.000Z",
      pins: {
        corpusVersion: 418,
        rulepackVersions: { transfer_pricing: "2026.2" },
        modelVersions: { examiner: "gpt-5.0-2026-06-01" },
      },
    });

    expect(replay).toEqual(approved);
    expect(approved.plan).toMatchObject({
      status: "approved",
      approvedJobId: approved.job.jobId,
      updatedAt: "2026-06-19T17:00:00.000Z",
    });
    expect(approved.job).toMatchObject({
      tenantId: "tenant-a",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { entityIds: ["entity-sg"], jurisdictions: ["SG"], period: "FY2026" },
      planRef: plan.planRef,
      priorityLane: "interactive",
      status: "queued",
      pins: {
        corpusVersion: 418,
        rulepackVersions: { transfer_pricing: "2026.2" },
        modelVersions: { examiner: "gpt-5.0-2026-06-01" },
      },
    });
    expect(runtime.getPlan({ tenantId: "tenant-a", planId: plan.planId })).toEqual(approved.plan);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: approved.job.jobId })).toEqual(approved.job);
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: approved.job.jobId }).events.at(0)).toMatchObject({
      type: "run.queued",
      occurredAt: "2026-06-19T17:00:00.000Z",
      payload: {
        status: "queued",
        kind: "agent",
        planRef: plan.planRef,
      },
    });
  });

  it("requires plan refs for agentic and composite submissions while keeping engine and pipeline jobs plan-exempt", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-submit-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US"], period: "FY2026" },
      intentRestated: "Investigate the US services finding candidate.",
      steps: [{ action: "Read the US services evidence.", toolClass: "read" }],
      invalidationsPreview: [],
      produces: [{ objectType: "finding_candidate", label: "US services finding candidate" }],
      estDurationMs: 600000,
      costClass: "standard",
      instructionEcho: "",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:findings" },
    }).plan;

    expect(() =>
      runtime.submitJob({
        tenantId: "tenant-a",
        idempotencyKey: "agent-without-plan",
        kind: "agent",
        initiator: { kind: "user", ref: "user:manager-1" },
      }),
    ).toThrow(RuntimeError);
    expect(() =>
      runtime.submitJob({
        tenantId: "tenant-a",
        idempotencyKey: "composite-without-plan",
        kind: "composite",
        initiator: { kind: "user", ref: "user:manager-1" },
      }),
    ).toThrow(RuntimeError);

    const engine = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "engine-plan-exempt",
      kind: "engine",
      initiator: { kind: "system", ref: "engine:range" },
    });
    const pipeline = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "pipeline-plan-exempt",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    });
    const agent = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "agent-with-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      planRef: plan.planRef,
    });

    expect(engine.job.planRef).toBeNull();
    expect(pipeline.job.planRef).toBeNull();
    expect(agent.job).toMatchObject({
      kind: "agent",
      planRef: plan.planRef,
      status: "queued",
    });
  });
});
