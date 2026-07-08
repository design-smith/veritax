import { describe, expect, it } from "vitest";

import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime retries, poison queue, and staging writes", () => {
  it("reschedules retryable tool failures with backoff", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "retryable-tool-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    const retry = runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: job.jobId,
      occurredAt: "2026-06-19T18:00:00.000Z",
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YH" },
      },
      diagnostics: "record.get timed out before returning the flow evidence.",
    });

    expect(retry).toMatchObject({
      decision: "retry",
      nextRetryAt: "2026-06-19T18:00:01.000Z",
      poisonEntry: null,
      job: {
        status: "queued",
        failure: null,
        retry: {
          attempts: 1,
          nextRetryAt: "2026-06-19T18:00:01.000Z",
          lastFailure: {
            class: "tool_error",
            detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YH" },
          },
          poisonEntryId: null,
        },
      },
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toEqual(retry.job);
    expect(runtime.listPoisonQueue({ tenantId: "tenant-a" })).toEqual([]);
  });

  it("does not retry validation or refusal failures", () => {
    const runtime = createRuntimeService();
    const validationRun = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "validation-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    }).job;
    const refusalRun = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "refusal-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: validationRun.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: validationRun.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: refusalRun.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: refusalRun.jobId, status: "running" });

    const validation = runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: validationRun.jobId,
      occurredAt: "2026-06-19T18:10:00.000Z",
      failure: {
        class: "validation",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YJ" },
      },
    });
    const refusal = runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: refusalRun.jobId,
      occurredAt: "2026-06-19T18:11:00.000Z",
      failure: {
        class: "refusal",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YK" },
      },
    });

    expect(validation).toMatchObject({
      decision: "failed",
      nextRetryAt: null,
      poisonEntry: null,
      job: {
        status: "failed",
        failure: { class: "validation" },
        retry: { attempts: 0, nextRetryAt: null, poisonEntryId: null },
      },
    });
    expect(refusal).toMatchObject({
      decision: "failed",
      nextRetryAt: null,
      poisonEntry: null,
      job: {
        status: "failed",
        failure: { class: "refusal" },
        retry: { attempts: 0, nextRetryAt: null, poisonEntryId: null },
      },
    });
    expect(runtime.listPoisonQueue({ tenantId: "tenant-a" })).toEqual([]);
  });

  it("parks retry-exhausted jobs in the poison queue with diagnostics", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "poison-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: job.jobId,
      occurredAt: "2026-06-19T18:20:00.000Z",
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YM" },
      },
      diagnostics: "First transient tool error.",
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: job.jobId,
      occurredAt: "2026-06-19T18:21:00.000Z",
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YN" },
      },
      diagnostics: "Second transient tool error.",
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });

    const poisoned = runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: job.jobId,
      occurredAt: "2026-06-19T18:22:00.000Z",
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YP" },
      },
      diagnostics: "Third tool error after retry budget was exhausted.",
    });

    expect(poisoned.decision).toBe("poisoned");
    expect(poisoned.poisonEntry).toMatchObject({
      tenantId: "tenant-a",
      jobId: job.jobId,
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YP" },
      },
      attempts: 2,
      diagnostics: "Third tool error after retry budget was exhausted.",
      parkedAt: "2026-06-19T18:22:00.000Z",
    });
    expect(poisoned.job).toMatchObject({
      status: "failed",
      failure: { class: "tool_error" },
      retry: {
        attempts: 2,
        nextRetryAt: null,
        poisonEntryId: poisoned.poisonEntry?.entryId,
      },
    });
    expect(runtime.listPoisonQueue({ tenantId: "tenant-a" })).toEqual([poisoned.poisonEntry]);
  });

  it("deduplicates staging writes by idempotency key and output ref", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "staging-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });

    const first = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "put-output",
      outputRef: { objectType: "finding_candidate", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YQ" },
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YR" },
      writtenAt: "2026-06-19T18:30:00.000Z",
    });
    const replay = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "put-output",
      outputRef: { objectType: "finding_candidate", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YQ" },
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YS" },
      writtenAt: "2026-06-19T18:31:00.000Z",
    });
    const secondOutput = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "put-output",
      outputRef: { objectType: "finding_candidate", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YT" },
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YV" },
      writtenAt: "2026-06-19T18:32:00.000Z",
    });

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    expect(secondOutput.replayed).toBe(false);
    expect(runtime.listStagingWrites({ tenantId: "tenant-a", jobId: job.jobId })).toEqual([
      first.write,
      secondOutput.write,
    ]);
  });

  it("fails the run on competing staged writes for the same output ref", () => {
    const runtime = createRuntimeService();
    const { job } = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "staging-conflict-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    });
    const outputRef = { objectType: "finding_candidate", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YW" };

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const first = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "put-output-v1",
      outputRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YX" },
      writtenAt: "2026-06-19T18:40:00.000Z",
    });

    expect(() =>
      runtime.recordStagingWrite({
        tenantId: "tenant-a",
        jobId: job.jobId,
        idempotencyKey: "put-output-v2",
        outputRef,
        stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YY" },
        writtenAt: "2026-06-19T18:41:00.000Z",
      }),
    ).toThrow(RuntimeError);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toMatchObject({
      status: "failed",
      failure: {
        class: "conflict",
        detailRef: { objectType: "staging_conflict", objectId: first.write.writeId },
      },
    });
    expect(runtime.listStagingWrites({ tenantId: "tenant-a", jobId: job.jobId })).toEqual([first.write]);
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: job.jobId }).events.map((event) => event.type)).toEqual([
      "run.queued",
      "run.planning",
      "run.started",
      "run.producing",
      "run.failed",
    ]);
  });
});
