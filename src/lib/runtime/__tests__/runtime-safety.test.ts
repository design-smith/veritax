import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, createRecordUlid } from "../../record";
import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime safety controls", () => {
  it("halts tenant scheduling without touching already running jobs", () => {
    const runtime = createRuntimeService();
    const running = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "already-running",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    }).job;
    const queued = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "queued-before-kill",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: running.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: running.jobId, status: "running" });
    const killSwitch = runtime.setKillSwitch({
      tenantId: "tenant-a",
      idempotencyKey: "halt-tenant",
      actor: { kind: "user", ref: "user:ops-lead" },
      scope: { kind: "tenant" },
      enabled: true,
      reason: "Quarterly kill-switch drill.",
      changedAt: "2026-06-19T20:00:00.000Z",
    });

    expect(killSwitch.switch).toMatchObject({
      tenantId: "tenant-a",
      scope: { kind: "tenant", jobKind: null },
      enabled: true,
      reason: "Quarterly kill-switch drill.",
    });
    expect(() =>
      runtime.submitJob({
        tenantId: "tenant-a",
        idempotencyKey: "blocked-after-kill",
        kind: "pipeline",
        initiator: { kind: "system", ref: "pipeline:nightly" },
      }),
    ).toThrow(RuntimeError);

    runtime.transitionJob({ tenantId: "tenant-a", jobId: queued.jobId, status: "planning" });
    expect(() =>
      runtime.transitionJob({ tenantId: "tenant-a", jobId: queued.jobId, status: "running" }),
    ).toThrow(RuntimeError);

    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: running.jobId,
      stepId: "step-running-before-halt",
      type: "tool",
      argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QV" },
      resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QW" },
      cost: { toolCalls: 1 },
    });
    const completed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: running.jobId,
      status: "producing",
    });
    const final = runtime.transitionJob({ tenantId: "tenant-a", jobId: running.jobId, status: "completed" });

    expect(completed.job.status).toBe("producing");
    expect(final.job.status).toBe("completed");
  });

  it("halts scheduling for one job kind without blocking other job kinds", () => {
    const runtime = createRuntimeService();

    runtime.setKillSwitch({
      tenantId: "tenant-a",
      idempotencyKey: "halt-agents",
      actor: { kind: "user", ref: "user:ops-lead" },
      scope: { kind: "job-kind", jobKind: "agent" },
      enabled: true,
      reason: "Pause agent runs while a model incident is reviewed.",
    });

    expect(() =>
      runtime.submitJob({
        tenantId: "tenant-a",
        idempotencyKey: "blocked-agent",
        kind: "agent",
        initiator: { kind: "user", ref: "user:manager-1" },
        planRef: { objectType: "plan", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QA" },
      }),
    ).toThrow(RuntimeError);

    const engine = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "allowed-engine",
      kind: "engine",
      initiator: { kind: "user", ref: "user:manager-1" },
    }).job;

    expect(engine.kind).toBe("engine");
  });

  it("opens a circuit breaker after repeated tool failures and removes the tool from discovery", () => {
    const runtime = createRuntimeService();
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "record-get-failures",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
      scope: {
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QB" }],
      },
    }).job;

    runtime.configureCircuitBreaker({
      tenantId: "tenant-a",
      toolName: "record.get",
      failureThreshold: 2,
      windowMs: 60_000,
      cooldownMs: 300_000,
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: job.jobId,
      toolName: "record.get",
      occurredAt: "2026-06-19T20:10:00.000Z",
      failure: { class: "tool_error", detailRef: null },
      diagnostics: "record.get timed out.",
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: job.jobId,
      toolName: "record.get",
      occurredAt: "2026-06-19T20:10:30.000Z",
      failure: { class: "tool_error", detailRef: null },
      diagnostics: "record.get returned a transient transport error.",
    });

    expect(runtime.getCircuitBreaker({ tenantId: "tenant-a", toolName: "record.get" })).toMatchObject({
      state: "open",
      openedAt: "2026-06-19T20:10:30.000Z",
      openUntil: "2026-06-19T20:15:30.000Z",
      recentFailures: 2,
    });

    const capabilityMap = {
      toolClasses: ["read" as const],
      entityIds: [],
      jurisdictions: [],
      objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QB" }],
      sensitivityCeiling: "confidential" as const,
    };

    expect(
      runtime.authorizeToolUse({
        tenantId: "tenant-a",
        jobId: job.jobId,
        toolName: "record.get",
        requestedScope: {
          objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QB" }],
        },
        requestedAt: "2026-06-19T20:11:00.000Z",
        capabilityMap,
      }),
    ).toMatchObject({ allowed: false, reason: "tool_circuit_open" });
    expect(
      runtime
        .listAvailableToolsForJob({
          tenantId: "tenant-a",
          jobId: job.jobId,
          asOf: "2026-06-19T20:11:00.000Z",
          capabilityMap,
        })
        .map((tool) => tool.name),
    ).not.toContain("record.get");
  });

  it("closes an open circuit breaker after its cooldown expires", () => {
    const runtime = createRuntimeService();
    const objectRef = { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QC" };
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "record-get-cooldown",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
      scope: { objectRefs: [objectRef] },
    }).job;
    const capabilityMap = {
      toolClasses: ["read" as const],
      entityIds: [],
      jurisdictions: [],
      objectRefs: [objectRef],
      sensitivityCeiling: "confidential" as const,
    };

    runtime.configureCircuitBreaker({
      tenantId: "tenant-a",
      toolName: "record.get",
      failureThreshold: 1,
      windowMs: 60_000,
      cooldownMs: 300_000,
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordFailure({
      tenantId: "tenant-a",
      jobId: job.jobId,
      toolName: "record.get",
      occurredAt: "2026-06-19T20:20:00.000Z",
      failure: { class: "tool_error", detailRef: null },
      diagnostics: "record.get timed out.",
    });

    expect(
      runtime.authorizeToolUse({
        tenantId: "tenant-a",
        jobId: job.jobId,
        toolName: "record.get",
        requestedScope: { objectRefs: [objectRef] },
        requestedAt: "2026-06-19T20:21:00.000Z",
        capabilityMap,
      }),
    ).toMatchObject({ allowed: false, reason: "tool_circuit_open" });

    expect(
      runtime.authorizeToolUse({
        tenantId: "tenant-a",
        jobId: job.jobId,
        toolName: "record.get",
        requestedScope: { objectRefs: [objectRef] },
        requestedAt: "2026-06-19T20:25:01.000Z",
        capabilityMap,
      }),
    ).toMatchObject({ allowed: true, reason: null });
    expect(runtime.getCircuitBreaker({ tenantId: "tenant-a", toolName: "record.get" })).toMatchObject({
      state: "closed",
      recentFailures: 0,
      failureTimes: [],
      openedAt: null,
      openUntil: null,
    });
  });

  it("returns a gate to the producer when changes are requested without promoting or rejecting the Record gate", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "gate-change-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:manager-1" },
    }).job;

    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-canonical-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: { objectType: "entity", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QC" },
      value: {
        name: "Veritax US Inc.",
        jurisdiction: "US",
        roleInGroup: "Routine distributor",
        status: "active",
        sensitivity: 2,
      },
      approvalRef: "01KVJ9N8M7P6Q5R4S3T2V1W0QF",
      occurredAt: "2026-06-19T20:20:00.000Z",
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-entity-change",
      outputRef: { objectType: "entity", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QC" },
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QD" },
      promotion: {
        proposedValue: {
          name: "Veritax US Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
          sensitivity: 2,
        },
        lens: { validAt: "2026-01-01", knownAt: "2026-06-19T20:21:00.000Z" },
        requestedAt: "2026-06-19T20:21:00.000Z",
        slaDue: "2026-06-20T20:21:00.000Z",
      },
      writtenAt: "2026-06-19T20:21:00.000Z",
    });

    const changes = runtime.requestGateChanges({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "request-anchored-changes",
      actor: { kind: "user", ref: "user:vp-tax" },
      comments: [
        {
          anchorRef: { objectType: "doc_section", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QE", version: 2 },
          text: "Tie the characterization change back to the executed distribution agreement.",
        },
      ],
      requestedAt: "2026-06-19T20:22:00.000Z",
    });

    expect(changes.job.status).toBe("producing");
    expect(changes.changeRequest).toMatchObject({
      tenantId: "tenant-a",
      gateId: staged.gate!.gateId,
      requestedBy: { kind: "user", ref: "user:vp-tax" },
      comments: [
        {
          anchorRef: { objectType: "doc_section", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QE", version: 2 },
          text: "Tie the characterization change back to the executed distribution agreement.",
        },
      ],
    });
    expect(record.listGates({ tenantId: "tenant-a" })[0]).toMatchObject({
      gateId: staged.gate!.gateId,
      status: "pending",
      decision: null,
    });
    expect(
      record.listCanonical({
        tenantId: "tenant-a",
        objectType: "entity",
        lens: { validAt: "2026-01-01", knownAt: "2026-06-19T20:22:00.000Z" },
      })[0],
    ).toMatchObject({
      roleInGroup: "Routine distributor",
    });
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: job.jobId }).events.at(-1)).toMatchObject({
      type: "gate.changes_requested",
    });

    const corrected = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-corrected-entity-change",
      outputRef: { objectType: "entity", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QC" },
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QG" },
      promotion: {
        proposedValue: {
          name: "Veritax US Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
          sensitivity: 2,
        },
        lens: { validAt: "2026-01-01", knownAt: "2026-06-19T20:23:00.000Z" },
        requestedAt: "2026-06-19T20:23:00.000Z",
        slaDue: "2026-06-20T20:23:00.000Z",
      },
      writtenAt: "2026-06-19T20:23:00.000Z",
    });

    expect(corrected.gate).toMatchObject({
      status: "pending",
      objectRef: { objectType: "entity", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0QC" },
    });
    expect(corrected.gate!.gateId).not.toBe(staged.gate!.gateId);
    expect(() =>
      runtime.decideGate({
        tenantId: "tenant-a",
        jobId: job.jobId,
        gateId: staged.gate!.gateId,
        idempotencyKey: "approve-stale-gate-after-changes",
        actor: { kind: "user", ref: "user:vp-tax" },
        decision: "approved",
        decidedAt: "2026-06-19T20:24:00.000Z",
      }),
    ).toThrow(RuntimeError);

    const approvedCorrection = runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: corrected.gate!.gateId,
      idempotencyKey: "approve-corrected-gate",
      actor: { kind: "user", ref: "user:vp-tax" },
      decision: "approved",
      decidedAt: "2026-06-19T20:25:00.000Z",
    });

    expect(approvedCorrection.job.status).toBe("producing");
    expect(
      record.listCanonical({
        tenantId: "tenant-a",
        objectType: "entity",
        lens: { validAt: "2026-01-01", knownAt: "2026-06-19T20:26:00.000Z" },
      })[0],
    ).toMatchObject({
      roleInGroup: "Principal",
      approvalRef: corrected.gate!.gateId,
    });
  });

  it("refuses change requests for gates already decided in Record", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-decided-change-request-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      value: {
        name: "Veritax Mexico S. de R.L.",
        jurisdiction: "MX",
        roleInGroup: "Distributor",
        status: "active",
      },
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-20T01:00:00.000Z",
    });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "decided-change-request-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:manager-1" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-decided-change-request-gate",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVK1VVC3M6S67YHYQH51MQAA" },
      writtenAt: "2026-06-20T01:05:00.000Z",
      promotion: {
        proposedValue: {
          name: "Veritax Mexico S. de R.L.",
          jurisdiction: "MX",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-20", knownAt: "2026-06-20T01:05:00.000Z" },
        slaDue: "2026-06-21T01:05:00.000Z",
      },
    });
    const awaitingGate = runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId });

    record.decideGate({
      tenantId: "tenant-a",
      idempotencyKey: "external-approve-before-change-request",
      actor: { kind: "user", id: "manager-2" },
      gateId: staged.gate!.gateId,
      decision: "approved",
      decidedAt: "2026-06-20T01:10:00.000Z",
    });

    let error: unknown;
    try {
      runtime.requestGateChanges({
        tenantId: "tenant-a",
        jobId: job.jobId,
        gateId: staged.gate!.gateId,
        idempotencyKey: "request-changes-after-record-decision",
        actor: { kind: "user", ref: "user:vp-tax" },
        comments: [
          {
            anchorRef: { objectType: "doc_section", objectId: "01KVK1VVC3M6S67YHYQH51MQAB", version: 1 },
            text: "Reconcile this with the final approval before changing the proposal.",
          },
        ],
        requestedAt: "2026-06-20T01:15:00.000Z",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(RuntimeError);
    expect(error).toMatchObject({
      code: "GATE_NOT_OPEN",
      details: {
        gateId: staged.gate!.gateId,
        status: "approved",
        decision: "approved",
      },
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toEqual(awaitingGate);
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: job.jobId }).events.map((event) => event.type)).not.toContain(
      "gate.changes_requested",
    );
  });

  it("blocks completion after gate changes are requested until a corrected gate is approved", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-unresolved-change-request-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      value: {
        name: "Veritax Canada Inc.",
        jurisdiction: "CA",
        roleInGroup: "Distributor",
        status: "active",
      },
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-20T02:40:00.000Z",
    });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "unresolved-change-request-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:manager-1" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-unresolved-change-request-trace",
      type: "tool",
      toolName: "record.get",
      argsRef: { objectType: "trace_args", objectId: "01KVK1VVC3M6S67YHYQH51MQAK" },
      resultRef: { objectType: "trace_result", objectId: "01KVK1VVC3M6S67YHYQH51MQAM" },
      cost: { toolCalls: 1 },
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-unresolved-change-request",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVK1VVC3M6S67YHYQH51MQAN" },
      promotion: {
        proposedValue: {
          name: "Veritax Canada Inc.",
          jurisdiction: "CA",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-20", knownAt: "2026-06-20T02:45:00.000Z" },
        requestedAt: "2026-06-20T02:45:00.000Z",
        slaDue: "2026-06-21T02:45:00.000Z",
      },
      writtenAt: "2026-06-20T02:45:00.000Z",
    });
    const changes = runtime.requestGateChanges({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "request-unresolved-changes",
      actor: { kind: "user", ref: "user:vp-tax" },
      comments: [
        {
          anchorRef: { objectType: "doc_section", objectId: "01KVK1VVC3M6S67YHYQH51MQAP", version: 1 },
          text: "Add the executed agreement support before this characterization can close.",
        },
      ],
      requestedAt: "2026-06-20T02:50:00.000Z",
    });

    let error: unknown;
    try {
      runtime.transitionJob({
        tenantId: "tenant-a",
        jobId: job.jobId,
        status: "completed",
        transitionedAt: "2026-06-20T02:55:00.000Z",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(RuntimeError);
    expect(error).toMatchObject({
      code: "UNRESOLVED_GATE_CHANGES_BLOCK_COMPLETION",
      details: {
        jobId: job.jobId,
        gateIds: [staged.gate!.gateId],
      },
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toEqual(changes.job);

    const corrected = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-resolved-change-request",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVK1VVC3M6S67YHYQH51MQAQ" },
      promotion: {
        proposedValue: {
          name: "Veritax Canada Inc.",
          jurisdiction: "CA",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-20", knownAt: "2026-06-20T03:00:00.000Z" },
        requestedAt: "2026-06-20T03:00:00.000Z",
        slaDue: "2026-06-21T03:00:00.000Z",
      },
      writtenAt: "2026-06-20T03:00:00.000Z",
    });
    runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: corrected.gate!.gateId,
      idempotencyKey: "approve-resolved-change-request",
      actor: { kind: "user", ref: "user:vp-tax" },
      decision: "approved",
      decidedAt: "2026-06-20T03:05:00.000Z",
    });

    const completed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "completed",
      transitionedAt: "2026-06-20T03:10:00.000Z",
    });

    expect(completed.job.status).toBe("completed");
  });
});
