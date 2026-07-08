import { describe, expect, it } from "vitest";

import { createRuntimeService, RUNTIME_COST_CLASS_BUDGETS } from "../index";

describe("Runtime budgets, metering, and model routing", () => {
  it("applies cost-class ceilings and emits cost telemetry from step traces", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "budgeted-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US"], period: "FY2026" },
      intentRestated: "Investigate the US service fee support.",
      steps: [{ action: "Read evidence and run a range check.", toolClass: "engine-call" }],
      estDurationMs: 600000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:findings" },
    }).plan;
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-budgeted-plan",
    });

    expect(approved.job.budget).toEqual({
      costClass: "standard",
      tokenCeiling: RUNTIME_COST_CLASS_BUDGETS.standard.tokenCeiling,
      toolCallCeiling: RUNTIME_COST_CLASS_BUDGETS.standard.toolCallCeiling,
      wallclockMs: RUNTIME_COST_CLASS_BUDGETS.standard.wallclockMs,
    });
    expect(approved.job.meter).toEqual({
      tokens: 0,
      toolCalls: 0,
      engineCalls: 0,
      modelCalls: 0,
      wallclockMs: 0,
      costWeight: 0,
    });

    const recorded = runtime.recordStep({
      tenantId: "tenant-a",
      jobId: approved.job.jobId,
      stepId: "step-range-check",
      type: "engine",
      argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" },
      resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ" },
      t0: "2026-06-19T16:00:00.000Z",
      t1: "2026-06-19T16:00:02.500Z",
      cost: { tokens: 1200, toolCalls: 1, engineCalls: 1, costWeight: 3 },
    });

    expect(recorded.job.meter).toEqual({
      tokens: 1200,
      toolCalls: 1,
      engineCalls: 1,
      modelCalls: 0,
      wallclockMs: 2500,
      costWeight: 3,
    });
    expect(runtime.listCostTelemetry({ tenantId: "tenant-a" })).toEqual([
      {
        tenantId: "tenant-a",
        jobId: approved.job.jobId,
        stepId: "step-range-check",
        type: "engine",
        costClass: "standard",
        occurredAt: "2026-06-19T16:00:02.500Z",
        cost: { costWeight: 3, engineCalls: 1, tokens: 1200, toolCalls: 1 },
        meter: {
          tokens: 1200,
          toolCalls: 1,
          engineCalls: 1,
          modelCalls: 0,
          wallclockMs: 2500,
          costWeight: 3,
        },
      },
    ]);
  });

  it("moves a run to budget-exceeded when step metering crosses its ceiling", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "budget-cutoff-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US"], period: "FY2026" },
      intentRestated: "Run a bounded investigation.",
      steps: [{ action: "Investigate the evidence chain.", toolClass: "read" }],
      estDurationMs: 600000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:briefing" },
    }).plan;
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-budget-cutoff-plan",
    });

    const recorded = runtime.recordStep({
      tenantId: "tenant-a",
      jobId: approved.job.jobId,
      stepId: "step-too-expensive",
      type: "model",
      modelIO: {
        promptRef: { objectType: "model_prompt", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RJ" },
        outputRef: { objectType: "model_output", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RK" },
        retentionClass: "gate-adjacent-24-months",
      },
      t0: "2026-06-19T17:00:00.000Z",
      t1: "2026-06-19T17:00:03.000Z",
      cost: {
        tokens: RUNTIME_COST_CLASS_BUDGETS.standard.tokenCeiling + 1,
        toolCalls: 1,
        modelCalls: 1,
        costWeight: 8,
      },
    });

    expect(recorded.job).toMatchObject({
      status: "budget-exceeded",
      failure: { class: "budget", detailRef: null },
      meter: {
        tokens: RUNTIME_COST_CLASS_BUDGETS.standard.tokenCeiling + 1,
        toolCalls: 1,
        engineCalls: 0,
        modelCalls: 1,
        wallclockMs: 3000,
        costWeight: 8,
      },
    });
    expect(runtime.listRuns({ tenantId: "tenant-a", status: "budget-exceeded" })).toEqual([recorded.job]);
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: approved.job.jobId }).events.map((event) => event.type)).toEqual([
      "run.queued",
      "run.step",
      "run.budget_exceeded",
    ]);
  });

  it("raises a budget-exceeded run and retries it with larger ceilings", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "raise-budget-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US"], period: "FY2026" },
      intentRestated: "Run a bounded investigation that may need approval for more budget.",
      steps: [{ action: "Investigate the evidence chain.", toolClass: "read" }],
      estDurationMs: 600000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:briefing" },
    }).plan;
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-raise-budget-plan",
    });
    const exceeded = runtime.recordStep({
      tenantId: "tenant-a",
      jobId: approved.job.jobId,
      stepId: "step-budget-stop",
      type: "model",
      modelIO: {
        promptRef: { objectType: "model_prompt", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RM" },
        outputRef: { objectType: "model_output", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RN" },
        retentionClass: "gate-adjacent-24-months",
      },
      t0: "2026-06-19T18:00:00.000Z",
      t1: "2026-06-19T18:00:02.000Z",
      cost: {
        tokens: RUNTIME_COST_CLASS_BUDGETS.standard.tokenCeiling + 1,
        toolCalls: 1,
        modelCalls: 1,
      },
    }).job;

    const raised = runtime.raiseBudget({
      tenantId: "tenant-a",
      jobId: exceeded.jobId,
      idempotencyKey: "raise-budget-once",
      approvedBy: { kind: "user", ref: "user:manager-1" },
      reason: "Manager approved more tokens after reviewing the first evidence pass.",
      budget: {
        tokenCeiling: RUNTIME_COST_CLASS_BUDGETS.standard.tokenCeiling + 10000,
        toolCallCeiling: RUNTIME_COST_CLASS_BUDGETS.standard.toolCallCeiling,
        wallclockMs: RUNTIME_COST_CLASS_BUDGETS.standard.wallclockMs,
      },
    });
    const replay = runtime.raiseBudget({
      tenantId: "tenant-a",
      jobId: exceeded.jobId,
      idempotencyKey: "raise-budget-once",
      approvedBy: { kind: "user", ref: "user:manager-1" },
      reason: "Manager approved more tokens after reviewing the first evidence pass.",
      budget: {
        tokenCeiling: RUNTIME_COST_CLASS_BUDGETS.standard.tokenCeiling + 10000,
        toolCallCeiling: RUNTIME_COST_CLASS_BUDGETS.standard.toolCallCeiling,
        wallclockMs: RUNTIME_COST_CLASS_BUDGETS.standard.wallclockMs,
      },
    });

    expect(replay).toEqual(raised);
    expect(raised.job).toMatchObject({
      status: "queued",
      failure: null,
      budget: {
        costClass: "standard",
        tokenCeiling: RUNTIME_COST_CLASS_BUDGETS.standard.tokenCeiling + 10000,
        toolCallCeiling: RUNTIME_COST_CLASS_BUDGETS.standard.toolCallCeiling,
        wallclockMs: RUNTIME_COST_CLASS_BUDGETS.standard.wallclockMs,
      },
      meter: exceeded.meter,
    });
    expect(raised.budgetRaise).toMatchObject({
      approvedBy: { kind: "user", ref: "user:manager-1" },
      previousBudget: exceeded.budget,
      budget: raised.job.budget,
      reason: "Manager approved more tokens after reviewing the first evidence pass.",
    });
    expect(runtime.listRuns({ tenantId: "tenant-a", status: "queued" })).toEqual([raised.job]);
  });

  it("enforces tenant concurrency and monthly spend guards", () => {
    const runtime = createRuntimeService();
    runtime.configureTenantBudgetGuard({
      tenantId: "tenant-a",
      maxConcurrentRunningJobs: 1,
      monthlyCostWeightCeiling: 5,
    });
    const first = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "guarded-engine-1",
      kind: "engine",
      initiator: { kind: "system", ref: "engine:range" },
    }).job;
    const second = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "guarded-engine-2",
      kind: "engine",
      initiator: { kind: "system", ref: "engine:range" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: first.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: first.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: second.jobId, status: "planning" });
    expect(() =>
      runtime.transitionJob({ tenantId: "tenant-a", jobId: second.jobId, status: "running" }),
    ).toThrowError("Tenant running-job concurrency guard");

    const exceeded = runtime.recordStep({
      tenantId: "tenant-a",
      jobId: first.jobId,
      stepId: "step-tenant-spend",
      type: "engine",
      t0: "2026-06-19T19:00:00.000Z",
      t1: "2026-06-19T19:00:01.000Z",
      cost: { engineCalls: 1, costWeight: 6 },
    }).job;

    expect(exceeded).toMatchObject({
      status: "budget-exceeded",
      failure: { class: "budget", detailRef: null },
    });
    expect(runtime.getTenantBudgetGuard({ tenantId: "tenant-a" })).toEqual({
      tenantId: "tenant-a",
      maxConcurrentRunningJobs: 1,
      monthlyCostWeightCeiling: 5,
    });
  });

  it("routes models through a versioned registry and preserves run pins across failover", () => {
    const runtime = createRuntimeService();

    expect(runtime.routeModel({ routeKey: "classification" }).model).toMatchObject({
      modelId: "veritax-small-classifier",
      version: "2026.06.19",
      provider: "openai",
      capabilityTags: ["classification", "extraction", "small"],
    });

    const investigationRoute = runtime.routeModel({ routeKey: "investigation" });
    expect(investigationRoute.model).toMatchObject({
      modelId: "veritax-large-investigator",
      version: "2026.06.19",
      capabilityTags: ["drafting", "investigation", "large"],
    });

    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "pinned-model-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      intentRestated: "Investigate a finding with a pinned model route.",
      steps: [{ action: "Investigate evidence.", toolClass: "read" }],
      estDurationMs: 600000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:findings" },
    }).plan;
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-pinned-model-plan",
      pins: {
        modelVersions: { investigation: `${investigationRoute.model.modelId}@${investigationRoute.model.version}` },
      },
    });

    runtime.setModelAvailability({
      modelId: "veritax-large-investigator",
      version: "2026.06.19",
      available: false,
    });

    expect(runtime.routeModel({ routeKey: "investigation" })).toMatchObject({
      failover: true,
      model: {
        modelId: "veritax-large-investigator-failover",
        version: "2026.06.19",
        evalStatusRef: investigationRoute.model.evalStatusRef,
      },
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: approved.job.jobId })?.pins.modelVersions).toEqual({
      investigation: "veritax-large-investigator@2026.06.19",
    });
  });

  it("rejects model routing changes outside release gates and blocks non-equivalent failover", () => {
    const runtime = createRuntimeService();
    runtime.registerModel({
      modelId: "veritax-untested-investigator",
      version: "2026.06.19",
      provider: "openai-compatible",
      capabilityTags: ["drafting", "investigation", "large"],
      costWeight: 2,
      evalStatusRef: { objectType: "eval_status", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0MC" },
      registeredBy: "deploy",
    });
    expect(() =>
      runtime.configureModelRoute({
        routeKey: "investigation",
        preferredModel: { modelId: "veritax-large-investigator", version: "2026.06.19" },
        fallbackModels: [{ modelId: "veritax-untested-investigator", version: "2026.06.19" }],
        requiredCapabilityTags: ["investigation", "large"],
        configuredBy: "runtime" as never,
        version: "2026.06.20",
      }),
    ).toThrowError("PRD-15 release gate");

    runtime.configureModelRoute({
      routeKey: "investigation",
      preferredModel: { modelId: "veritax-large-investigator", version: "2026.06.19" },
      fallbackModels: [{ modelId: "veritax-untested-investigator", version: "2026.06.19" }],
      requiredCapabilityTags: ["investigation", "large"],
      configuredBy: "prd-15-release-gate",
      version: "2026.06.20",
    });
    runtime.setModelAvailability({
      modelId: "veritax-large-investigator",
      version: "2026.06.19",
      available: false,
    });

    expect(() => runtime.routeModel({ routeKey: "investigation" })).toThrowError("equivalent-eval");
  });
});
