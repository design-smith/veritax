import { describe, expect, it } from "vitest";

import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime lifecycle", () => {
  it("records per-step traces on a submitted run", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "record-read-trace",
      kind: "engine",
      initiator: { kind: "user", ref: "user:manager-1" },
      priorityLane: "interactive",
    });

    const recorded = runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-read-record",
      type: "tool",
      argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" },
      resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ", version: 1 },
      t0: "2026-06-19T15:00:00.000Z",
      t1: "2026-06-19T15:00:01.500Z",
      cost: { toolCalls: 1, tokens: 0 },
    });

    expect(recorded.step).toEqual({
      stepId: "step-read-record",
      type: "tool",
      argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" },
      resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ", version: 1 },
      t0: "2026-06-19T15:00:00.000Z",
      t1: "2026-06-19T15:00:01.500Z",
      cost: { toolCalls: 1, tokens: 0 },
    });
    expect(recorded.job.steps).toEqual([recorded.step]);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toEqual(recorded.job);
  });

  it("records model prompt and output refs under a retention class", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "model-io-trace-run",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      planRef: { objectType: "plan", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" },
    });

    const recorded = runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-model-investigation",
      type: "model",
      argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RB" },
      resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RC" },
      modelIO: {
        promptRef: { objectType: "model_prompt", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RD" },
        outputRef: { objectType: "model_output", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RE" },
        retentionClass: "gate-adjacent-24-months",
      },
      t0: "2026-06-19T15:00:10.000Z",
      t1: "2026-06-19T15:00:15.000Z",
      cost: { modelCalls: 1, tokens: 4800 },
    });

    expect(recorded.step).toMatchObject({
      stepId: "step-model-investigation",
      type: "model",
      modelIO: {
        promptRef: { objectType: "model_prompt", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RD" },
        outputRef: { objectType: "model_output", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RE" },
        retentionClass: "gate-adjacent-24-months",
      },
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })?.steps).toEqual([recorded.step]);
  });

  it("refuses model steps without model I/O retention metadata", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "missing-model-io-run",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      planRef: { objectType: "plan", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RF" },
    });

    expect(() =>
      runtime.recordStep({
        tenantId: "tenant-a",
        jobId: job.jobId,
        stepId: "step-model-without-io",
        type: "model",
        argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RG" },
        resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RH" },
        cost: { modelCalls: 1 },
      }),
    ).toThrow(RuntimeError);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })?.steps).toEqual([]);
  });

  it("moves a run through the active lifecycle to completion", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "examiner-signal-run",
      kind: "engine",
      initiator: { kind: "user", ref: "user:manager-1" },
    });

    const planning = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "planning",
      transitionedAt: "2026-06-19T15:01:00.000Z",
    });
    const running = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "running",
      transitionedAt: "2026-06-19T15:02:00.000Z",
    });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-completion-trace",
      type: "engine",
      argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YJ" },
      resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YK" },
      t0: "2026-06-19T15:02:10.000Z",
      t1: "2026-06-19T15:02:20.000Z",
      cost: { engineCalls: 1 },
    });
    const producing = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "producing",
      transitionedAt: "2026-06-19T15:03:00.000Z",
    });
    const awaitingGate = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "awaiting-gate",
      transitionedAt: "2026-06-19T15:04:00.000Z",
    });
    const completed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "completed",
      transitionedAt: "2026-06-19T15:05:00.000Z",
    });

    expect(planning.job.status).toBe("planning");
    expect(running.job.status).toBe("running");
    expect(producing.job.status).toBe("producing");
    expect(awaitingGate.job.status).toBe("awaiting-gate");
    expect(completed.job).toMatchObject({
      status: "completed",
      failure: null,
      updatedAt: "2026-06-19T15:05:00.000Z",
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toEqual(completed.job);
    expect(runtime.listRuns({ tenantId: "tenant-a", status: "completed" })).toEqual([completed.job]);
  });

  it("blocks completion when an executable run has no trace steps", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "missing-trace-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });

    expect(() =>
      runtime.transitionJob({
        tenantId: "tenant-a",
        jobId: job.jobId,
        status: "completed",
        transitionedAt: "2026-06-19T15:05:30.000Z",
      }),
    ).toThrow(RuntimeError);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toMatchObject({
      status: "producing",
      steps: [],
    });
  });

  it("cancels a run as a safe terminal state", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "cancel-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "system:scheduler" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    const cancelled = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "cancelled",
      transitionedAt: "2026-06-19T15:06:00.000Z",
    });

    expect(cancelled.job).toMatchObject({
      status: "cancelled",
      failure: null,
      updatedAt: "2026-06-19T15:06:00.000Z",
    });
    expect(runtime.listRuns({ tenantId: "tenant-a", status: "cancelled" })).toEqual([cancelled.job]);
    expect(() =>
      runtime.transitionJob({
        tenantId: "tenant-a",
        jobId: job.jobId,
        status: "producing",
      }),
    ).toThrow(RuntimeError);
  });

  it("refuses trace mutations after a run reaches a terminal state", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "terminal-trace-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "system:scheduler" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    const cancelled = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "cancelled",
      transitionedAt: "2026-06-19T15:06:30.000Z",
    });

    expect(() =>
      runtime.recordStep({
        tenantId: "tenant-a",
        jobId: job.jobId,
        stepId: "step-after-terminal",
        type: "tool",
        argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YC" },
        resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YD" },
        t0: "2026-06-19T15:07:00.000Z",
        t1: "2026-06-19T15:07:01.000Z",
        cost: { toolCalls: 1 },
      }),
    ).toThrow(RuntimeError);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toEqual(cancelled.job);
  });

  it("refuses failure mutations after a run reaches a terminal state", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "terminal-failure-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "system:scheduler" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    const cancelled = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "cancelled",
      transitionedAt: "2026-06-19T15:07:30.000Z",
    });

    expect(() =>
      runtime.recordFailure({
        tenantId: "tenant-a",
        jobId: job.jobId,
        occurredAt: "2026-06-19T15:08:00.000Z",
        failure: {
          class: "tool_error",
          detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YE" },
        },
        diagnostics: "Late worker failure arrived after cancellation.",
      }),
    ).toThrow(RuntimeError);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toEqual(cancelled.job);
    expect(runtime.listPoisonQueue({ tenantId: "tenant-a" })).toEqual([]);
  });

  it("parks a run in budget-exceeded with a budget failure detail", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "budget-stop",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:manager-1" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    const budgetExceeded = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "budget-exceeded",
      transitionedAt: "2026-06-19T15:07:00.000Z",
      failure: {
        class: "budget",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YA" },
      },
    });

    expect(budgetExceeded.job).toMatchObject({
      status: "budget-exceeded",
      failure: {
        class: "budget",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YA" },
      },
      updatedAt: "2026-06-19T15:07:00.000Z",
    });
    expect(runtime.listRuns({ tenantId: "tenant-a", status: "budget-exceeded" })).toEqual([budgetExceeded.job]);
    expect(() =>
      runtime.transitionJob({
        tenantId: "tenant-a",
        jobId: job.jobId,
        status: "completed",
      }),
    ).toThrow(RuntimeError);
  });

  it("fails a run with a typed failure detail and keeps it terminal", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "tool-error-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "system:scheduler" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    const failed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "failed",
      transitionedAt: "2026-06-19T15:08:00.000Z",
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YB" },
      },
    });

    expect(failed.job).toMatchObject({
      status: "failed",
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YB" },
      },
      updatedAt: "2026-06-19T15:08:00.000Z",
    });
    expect(runtime.listRuns({ tenantId: "tenant-a", status: "failed" })).toEqual([failed.job]);
    expect(() =>
      runtime.transitionJob({
        tenantId: "tenant-a",
        jobId: job.jobId,
        status: "producing",
      }),
    ).toThrow(RuntimeError);
  });
});
