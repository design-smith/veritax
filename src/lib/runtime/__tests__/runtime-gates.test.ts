import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, createRecordUlid } from "../../record";
import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime gate mechanics", () => {
  it("opens a Record gate for a staged canonical write and approves it through the runtime", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-current-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-19T19:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "gate-runtime-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
      priorityLane: "interactive",
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });

    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-entity-role-change",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZJ" },
      writtenAt: "2026-06-19T19:05:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios US Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T19:05:00.000Z" },
        slaDue: "2026-06-20T19:05:00.000Z",
      },
    });

    expect(staged.gate).toMatchObject({
      objectRef: entityRef,
      requestedBy: { kind: "user", id: "analyst-1" },
      requestedAt: "2026-06-19T19:05:00.000Z",
      slaDue: "2026-06-20T19:05:00.000Z",
      status: "pending",
      diffSnapshot: {
        changes: [{ field: "roleInGroup", before: "Distributor", after: "Principal" }],
      },
    });
    expect(record.listGates({ tenantId: "tenant-a", status: "pending" })).toEqual([staged.gate]);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toMatchObject({
      status: "awaiting-gate",
      stagingWrites: [
        expect.objectContaining({
          outputRef: entityRef,
          gateRef: { objectType: "gate", objectId: staged.gate!.gateId },
        }),
      ],
    });
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: job.jobId }).events.map((event) => event.type)).toEqual([
      "run.queued",
      "run.planning",
      "run.started",
      "run.producing",
      "gate.requested",
      "run.awaiting_gate",
    ]);

    const approved = runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "approve-entity-role-change",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-19T20:00:00.000Z",
    });
    const replay = runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "approve-entity-role-change",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-19T20:00:00.000Z",
    });

    expect(replay).toEqual(approved);
    expect(approved.decision.gate).toMatchObject({
      gateId: staged.gate!.gateId,
      status: "approved",
      decision: "approved",
      decider: { kind: "user", id: "manager-1" },
    });
    expect(approved.job.status).toBe("producing");
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T20:01:00.000Z" },
      }),
    ).toMatchObject({
      roleInGroup: "Principal",
      approvalKind: "gate",
      approvalRef: staged.gate!.gateId,
    });
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: job.jobId }).events.at(-1)).toMatchObject({
      type: "gate.decided",
      payload: {
        gateId: staged.gate!.gateId,
        decision: "approved",
      },
    });
  });

  it("enforces four-eyes gate policy before promoting staged objects", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const current = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-four-eyes-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-19T20:30:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const policy = runtime.configureGatePolicy({
      tenantId: "tenant-a",
      objectType: "entity",
      fourEyes: true,
      configuredBy: { kind: "user", ref: "user:policy-admin" },
      configuredAt: "2026-06-19T20:31:00.000Z",
    });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "four-eyes-runtime-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
      priorityLane: "interactive",
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });

    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-four-eyes-entity-role-change",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZR" },
      writtenAt: "2026-06-19T20:35:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios US Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T20:35:00.000Z" },
        slaDue: "2026-06-20T20:35:00.000Z",
      },
    });

    let error: unknown;
    try {
      runtime.decideGate({
        tenantId: "tenant-a",
        jobId: job.jobId,
        gateId: staged.gate!.gateId,
        idempotencyKey: "requester-self-approves-four-eyes-gate",
        actor: { kind: "user", ref: "user:analyst-1" },
        decision: "approved",
        decidedAt: "2026-06-19T20:40:00.000Z",
      });
    } catch (caught) {
      error = caught;
    }

    expect(policy).toMatchObject({
      tenantId: "tenant-a",
      objectType: "entity",
      fourEyes: true,
      configuredBy: { kind: "user", ref: "user:policy-admin" },
      configuredAt: "2026-06-19T20:31:00.000Z",
    });
    expect(runtime.getGatePolicy({ tenantId: "tenant-a", objectType: "entity" })).toEqual(policy);
    expect(error).toBeInstanceOf(RuntimeError);
    expect(error).toMatchObject({
      code: "GATE_FOUR_EYES_REQUIRED",
      details: {
        gateId: staged.gate!.gateId,
        objectType: "entity",
        requester: { kind: "user", id: "analyst-1" },
        decider: { kind: "user", id: "analyst-1" },
      },
    });
    expect(record.listGates({ tenantId: "tenant-a", status: "pending" })).toEqual([staged.gate]);
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T20:41:00.000Z" },
      }),
    ).toEqual(current.row);

    const approved = runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "manager-approves-four-eyes-gate",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-19T20:45:00.000Z",
    });

    expect(approved.decision.gate).toMatchObject({
      gateId: staged.gate!.gateId,
      status: "approved",
      decider: { kind: "user", id: "manager-1" },
    });
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T20:46:00.000Z" },
      }),
    ).toMatchObject({ roleInGroup: "Principal", approvalRef: staged.gate!.gateId });
  });

  it("refuses late gate approval after the run has been cancelled", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const current = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-cancelled-gate-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-19T20:50:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "cancelled-gate-runtime-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
      priorityLane: "interactive",
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });

    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-cancelled-gate-entity-role-change",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZS" },
      writtenAt: "2026-06-19T20:55:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios US Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T20:55:00.000Z" },
        slaDue: "2026-06-20T20:55:00.000Z",
      },
    });
    const cancelled = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "cancelled",
      transitionedAt: "2026-06-19T21:00:00.000Z",
    });

    expect(() =>
      runtime.decideGate({
        tenantId: "tenant-a",
        jobId: job.jobId,
        gateId: staged.gate!.gateId,
        idempotencyKey: "late-approve-cancelled-gate",
        actor: { kind: "user", ref: "user:manager-1" },
        decision: "approved",
        decidedAt: "2026-06-19T21:05:00.000Z",
      }),
    ).toThrow(RuntimeError);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toEqual(cancelled.job);
    expect(record.listGates({ tenantId: "tenant-a", status: "pending" })).toEqual([staged.gate]);
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T21:06:00.000Z" },
      }),
    ).toEqual(current.row);
  });

  it("blocks completion while a runtime Record gate is still open", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-open-gate-completion-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-20T02:10:00.000Z",
      value: {
        name: "Helios Germany GmbH",
        jurisdiction: "DE",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "open-gate-completion-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
      priorityLane: "interactive",
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-open-gate-completion-trace",
      type: "tool",
      toolName: "record.get",
      argsRef: { objectType: "trace_args", objectId: "01KVK1VVC3M6S67YHYQH51MQAG" },
      resultRef: { objectType: "trace_result", objectId: "01KVK1VVC3M6S67YHYQH51MQAH" },
      cost: { toolCalls: 1 },
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-open-gate-completion",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVK1VVC3M6S67YHYQH51MQAJ" },
      writtenAt: "2026-06-20T02:15:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios Germany GmbH",
          jurisdiction: "DE",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-20", knownAt: "2026-06-20T02:15:00.000Z" },
        slaDue: "2026-06-21T02:15:00.000Z",
      },
    });

    let error: unknown;
    try {
      runtime.transitionJob({
        tenantId: "tenant-a",
        jobId: job.jobId,
        status: "completed",
        transitionedAt: "2026-06-20T02:20:00.000Z",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(RuntimeError);
    expect(error).toMatchObject({
      code: "OPEN_GATES_BLOCK_COMPLETION",
      details: {
        jobId: job.jobId,
        gateIds: [staged.gate!.gateId],
      },
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })).toMatchObject({
      status: "awaiting-gate",
      manifestRef: null,
    });
    expect(record.listGates({ tenantId: "tenant-a", status: "pending" })).toEqual([staged.gate]);

    runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "approve-open-gate-before-completion",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-20T02:25:00.000Z",
    });

    const completed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "completed",
      transitionedAt: "2026-06-20T02:30:00.000Z",
    });

    expect(completed.job.status).toBe("completed");
  });

  it("refuses stale gate decisions when Record already decided the gate", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-record-decided-gate-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-20T01:20:00.000Z",
      value: {
        name: "Helios Canada Inc.",
        jurisdiction: "CA",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "record-decided-gate-runtime-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
      priorityLane: "interactive",
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-record-decided-gate",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVK1VVC3M6S67YHYQH51MQAC" },
      writtenAt: "2026-06-20T01:25:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios Canada Inc.",
          jurisdiction: "CA",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-20", knownAt: "2026-06-20T01:25:00.000Z" },
        slaDue: "2026-06-21T01:25:00.000Z",
      },
    });
    const awaitingGate = runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId });

    record.decideGate({
      tenantId: "tenant-a",
      idempotencyKey: "record-approves-before-runtime",
      actor: { kind: "user", id: "manager-2" },
      gateId: staged.gate!.gateId,
      decision: "approved",
      decidedAt: "2026-06-20T01:30:00.000Z",
    });

    let error: unknown;
    try {
      runtime.decideGate({
        tenantId: "tenant-a",
        jobId: job.jobId,
        gateId: staged.gate!.gateId,
        idempotencyKey: "runtime-approves-record-decided-gate",
        actor: { kind: "user", ref: "user:manager-1" },
        decision: "approved",
        decidedAt: "2026-06-20T01:35:00.000Z",
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
    expect(
      runtime
        .streamRun({ tenantId: "tenant-a", jobId: job.jobId })
        .events.filter((event) => event.type === "gate.decided"),
    ).toEqual([]);
  });

  it("delegates and escalates open runtime gates through the Record service", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "delegate-runtime-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-delegated-gate",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZK" },
      writtenAt: "2026-06-19T21:00:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios US Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T21:00:00.000Z" },
        slaDue: "2026-06-20T21:00:00.000Z",
      },
    });

    const delegated = runtime.delegateGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "delegate-runtime-gate",
      actor: { kind: "user", ref: "user:manager-1" },
      delegatedTo: "manager-2",
      delegatedAt: "2026-06-19T21:10:00.000Z",
      expiresAt: "2026-06-20T21:10:00.000Z",
      reason: "Scope owner is out.",
    });

    expect(delegated.job.status).toBe("awaiting-gate");
    expect(delegated.delegation.gate).toMatchObject({
      gateId: staged.gate!.gateId,
      status: "delegated",
      delegateChain: [
        {
          delegatedTo: "manager-2",
          delegatedBy: { kind: "user", id: "manager-1" },
          delegatedAt: "2026-06-19T21:10:00.000Z",
          expiresAt: "2026-06-20T21:10:00.000Z",
          reason: "Scope owner is out.",
        },
      ],
    });

    const escalated = runtime.escalateGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "escalate-runtime-gate",
      actor: { kind: "system", ref: "gate-sla" },
      escalatedTo: "vp-tax",
      reason: "SLA breached",
      escalatedAt: "2026-06-20T21:05:00.000Z",
    });

    expect(escalated.escalation.gate).toMatchObject({
      gateId: staged.gate!.gateId,
      status: "escalated",
      escalations: [
        {
          escalatedTo: "vp-tax",
          escalatedBy: { kind: "system", id: "gate-sla" },
          escalatedAt: "2026-06-20T21:05:00.000Z",
          reason: "SLA breached",
        },
      ],
    });
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: job.jobId }).events.map((event) => event.type)).toEqual([
      "run.queued",
      "run.planning",
      "run.started",
      "run.producing",
      "gate.requested",
      "run.awaiting_gate",
      "gate.delegated",
      "gate.escalated",
    ]);
  });

  it("rejects runtime gates with a reason and leaves canonical state unchanged", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const current = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-current-rejected-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-19T22:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "reject-runtime-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-rejected-gate",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZM" },
      writtenAt: "2026-06-19T22:05:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios US Inc.",
          jurisdiction: "US",
          roleInGroup: "Holding company",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T22:05:00.000Z" },
        slaDue: "2026-06-20T22:05:00.000Z",
      },
    });

    const rejected = runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staged.gate!.gateId,
      idempotencyKey: "reject-runtime-gate",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "rejected",
      reason: "Contradicts the executed agreement.",
      decidedAt: "2026-06-19T22:30:00.000Z",
    });

    expect(rejected.job).toMatchObject({
      status: "failed",
      failure: {
        class: "validation",
        detailRef: { objectType: "gate", objectId: staged.gate!.gateId },
      },
    });
    expect(rejected.decision.gate).toMatchObject({
      status: "rejected",
      decision: "rejected",
      decisionReason: "Contradicts the executed agreement.",
    });
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T22:31:00.000Z" },
      }),
    ).toEqual(current.row);
  });

  it("batch-approves only identical gate classes with itemized confirmation", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: firstEntityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const { ref: secondEntityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "batch-gate-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
    }).job;

    [firstEntityRef, secondEntityRef].forEach((ref, index) => {
      record.promoteCanonical({
        tenantId: "tenant-a",
        idempotencyKey: `seed-batch-entity-${index}`,
        actor: { kind: "user", id: "manager-1" },
        ref,
        approvalRef: createRecordUlid(),
        occurredAt: "2026-06-19T23:00:00.000Z",
        value: {
          name: `Helios Entity ${index}`,
          jurisdiction: "US",
          roleInGroup: "Distributor",
          status: "active",
        },
      });
    });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });

    const firstGate = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-first-batch-gate",
      outputRef: firstEntityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZN" },
      writtenAt: "2026-06-19T23:05:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios Entity 0",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T23:05:00.000Z" },
        slaDue: "2026-06-20T23:05:00.000Z",
      },
    }).gate!;
    const secondGate = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-second-batch-gate",
      outputRef: secondEntityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZP" },
      writtenAt: "2026-06-19T23:06:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios Entity 1",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T23:06:00.000Z" },
        slaDue: "2026-06-20T23:06:00.000Z",
      },
    }).gate!;

    const batch = runtime.decideGateBatch({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateIds: [firstGate.gateId, secondGate.gateId],
      idempotencyKey: "approve-identical-gates",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-19T23:30:00.000Z",
      confirmation: {
        gateIds: [firstGate.gateId, secondGate.gateId],
        objectType: "entity",
        diffFields: ["roleInGroup"],
      },
    });

    expect(batch.decisions.map((decision) => decision.gate.status)).toEqual(["approved", "approved"]);
    expect(batch.job.status).toBe("producing");
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: firstEntityRef,
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T23:31:00.000Z" },
      }),
    ).toMatchObject({ roleInGroup: "Principal", approvalRef: firstGate.gateId });
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: secondEntityRef,
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T23:31:00.000Z" },
      }),
    ).toMatchObject({ roleInGroup: "Principal", approvalRef: secondGate.gateId });
    expect(
      runtime
        .streamRun({ tenantId: "tenant-a", jobId: job.jobId })
        .events.filter((event) => event.type === "gate.decided"),
    ).toHaveLength(2);
  });

  it("refuses stale batch gate decisions without partially promoting earlier gates", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: firstEntityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const { ref: secondEntityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const currentRows = [firstEntityRef, secondEntityRef].map((ref, index) =>
      record.promoteCanonical({
        tenantId: "tenant-a",
        idempotencyKey: `seed-stale-batch-entity-${index}`,
        actor: { kind: "user", id: "manager-1" },
        ref,
        approvalRef: createRecordUlid(),
        occurredAt: "2026-06-20T00:00:00.000Z",
        value: {
          name: `Stale Batch Entity ${index}`,
          jurisdiction: "US",
          roleInGroup: "Distributor",
          status: "active",
        },
      }).row,
    );
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "stale-batch-gate-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });

    const firstGate = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-first-stale-batch-gate",
      outputRef: firstEntityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZT" },
      writtenAt: "2026-06-20T00:05:00.000Z",
      promotion: {
        proposedValue: {
          name: "Stale Batch Entity 0",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-20", knownAt: "2026-06-20T00:05:00.000Z" },
        slaDue: "2026-06-21T00:05:00.000Z",
      },
    }).gate!;
    const secondGate = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-second-stale-batch-gate",
      outputRef: secondEntityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZV" },
      writtenAt: "2026-06-20T00:06:00.000Z",
      promotion: {
        proposedValue: {
          name: "Stale Batch Entity 1",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-20", knownAt: "2026-06-20T00:06:00.000Z" },
        slaDue: "2026-06-21T00:06:00.000Z",
      },
    }).gate!;
    const batchSubjects = new Map([
      [firstGate.gateId, { ref: firstEntityRef, currentRow: currentRows[0] }],
      [secondGate.gateId, { ref: secondEntityRef, currentRow: currentRows[1] }],
    ]);
    const gateIds = [firstGate.gateId, secondGate.gateId].sort((left, right) => left.localeCompare(right));
    const openGateId = gateIds[0];
    const staleGateId = gateIds[1];
    const openSubject = batchSubjects.get(openGateId)!;

    runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: staleGateId,
      idempotencyKey: "approve-second-before-batch",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-20T00:10:00.000Z",
    });

    let error: unknown;
    try {
      runtime.decideGateBatch({
        tenantId: "tenant-a",
        jobId: job.jobId,
        gateIds,
        idempotencyKey: "approve-stale-batch-gates",
        actor: { kind: "user", ref: "user:manager-1" },
        decision: "approved",
        decidedAt: "2026-06-20T00:15:00.000Z",
        confirmation: {
          gateIds,
          objectType: "entity",
          diffFields: ["roleInGroup"],
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: openSubject.ref,
        lens: { validAt: "2026-06-20", knownAt: "2026-06-20T00:16:00.000Z" },
      }),
    ).toEqual(openSubject.currentRow);
    expect(record.listGates({ tenantId: "tenant-a" }).find((gate) => gate.gateId === openGateId)).toMatchObject({
      decision: null,
      status: "pending",
    });
    expect(error).toBeInstanceOf(RuntimeError);
    expect(error).toMatchObject({
      code: "INVALID_GATE_BATCH",
      details: { gateId: staleGateId, status: "approved" },
    });
  });

  it("auto-escalates overdue gates through the configured hierarchy", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "auto-escalate-runtime-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const staged = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-auto-escalated-gate",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZQ" },
      writtenAt: "2026-06-19T23:40:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios US Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T23:40:00.000Z" },
        slaDue: "2026-06-20T23:40:00.000Z",
      },
    });

    const firstSweep = runtime.escalateOverdueGates({
      tenantId: "tenant-a",
      idempotencyKey: "auto-escalate-first-hop",
      actor: { kind: "system", ref: "gate-sla" },
      asOf: "2026-06-21T00:00:00.000Z",
      escalationPath: ["manager-2", "vp-tax"],
      reason: "SLA breached",
    });

    expect(firstSweep.escalations).toHaveLength(1);
    expect(firstSweep.escalations[0].gate.gateId).toBe(staged.gate!.gateId);
    expect(firstSweep.escalations[0].gate).toMatchObject({
      status: "escalated",
      escalations: [
        {
          escalatedTo: "manager-2",
          escalatedBy: { kind: "system", id: "gate-sla" },
          escalatedAt: "2026-06-21T00:00:00.000Z",
          reason: "SLA breached",
        },
      ],
    });
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: job.jobId }).events.at(-1)).toMatchObject({
      type: "gate.escalated",
      payload: {
        gateId: staged.gate!.gateId,
        escalatedTo: "manager-2",
      },
    });

    const secondSweep = runtime.escalateOverdueGates({
      tenantId: "tenant-a",
      idempotencyKey: "auto-escalate-second-hop",
      actor: { kind: "system", ref: "gate-sla" },
      asOf: "2026-06-21T12:00:00.000Z",
      escalationPath: ["manager-2", "vp-tax"],
      reason: "SLA still breached",
    });

    expect(secondSweep.escalations).toHaveLength(1);
    expect(secondSweep.escalations[0].gate.escalations.map((escalation) => escalation.escalatedTo)).toEqual([
      "manager-2",
      "vp-tax",
    ]);
  });

  it("replays overdue-gate sweeps and skips gates that are not open or not overdue", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: futureRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const { ref: decidedRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "auto-escalate-skip-run",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-not-overdue-gate",
      outputRef: futureRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZR" },
      writtenAt: "2026-06-19T23:45:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios Future Inc.",
          jurisdiction: "US",
          roleInGroup: "Distributor",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T23:45:00.000Z" },
        slaDue: "2026-06-22T23:45:00.000Z",
      },
    });
    const decidedGate = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-decided-overdue-gate",
      outputRef: decidedRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZS" },
      writtenAt: "2026-06-19T23:46:00.000Z",
      promotion: {
        proposedValue: {
          name: "Helios Decided Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T23:46:00.000Z" },
        slaDue: "2026-06-20T23:46:00.000Z",
      },
    }).gate!;
    runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: decidedGate.gateId,
      idempotencyKey: "approve-decided-before-sweep",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-21T00:05:00.000Z",
    });

    const sweep = runtime.escalateOverdueGates({
      tenantId: "tenant-a",
      idempotencyKey: "auto-escalate-noop",
      actor: { kind: "system", ref: "gate-sla" },
      asOf: "2026-06-21T00:10:00.000Z",
      escalationPath: ["vp-tax"],
    });
    const replay = runtime.escalateOverdueGates({
      tenantId: "tenant-a",
      idempotencyKey: "auto-escalate-noop",
      actor: { kind: "system", ref: "gate-sla" },
      asOf: "2026-06-21T00:10:00.000Z",
      escalationPath: ["vp-tax"],
    });

    expect(replay).toEqual(sweep);
    expect(sweep).toMatchObject({
      inspectedGateCount: 2,
      overdueGateCount: 0,
      escalations: [],
    });
    expect(record.listGates({ tenantId: "tenant-a", status: "escalated" })).toEqual([]);
  });
});
