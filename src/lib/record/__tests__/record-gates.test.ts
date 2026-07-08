import { describe, expect, it } from "vitest";

import {
  createRecordIdentity,
  createRecordService,
  createRecordUlid,
  stringifyRecordRef,
} from "../index";

describe("Record staging and gates", () => {
  it("stages proposed canonical values and requests a gate with a diff snapshot", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    const current = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-current-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-01T09:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });

    const staged = record.stageObject({
      tenantId: "tenant-a",
      idempotencyKey: "stage-role-change",
      actor: { kind: "agent", id: "mapping-studio", onBehalfOf: "analyst-1" },
      ref: entityRef,
      proposedValue: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Principal",
        status: "active",
      },
      producedByRun: "run-map-42",
      lens: { validAt: "2026-03-01", knownAt: "2026-02-02T09:00:00.000Z" },
      stagedAt: "2026-02-02T09:00:00.000Z",
    });

    expect(staged.stagingObject).toMatchObject({
      tenantId: "tenant-a",
      objectRef: entityRef,
      producedByRun: "run-map-42",
      gateId: null,
      status: "staged",
      stagedBy: { kind: "agent", id: "mapping-studio", onBehalfOf: "analyst-1" },
      stagedAt: "2026-02-02T09:00:00.000Z",
      proposedValue: {
        entityId: entityRef.objectId,
        roleInGroup: "Principal",
      },
      diffSnapshot: {
        current: expect.objectContaining({
          entityId: entityRef.objectId,
          roleInGroup: "Distributor",
        }),
        proposed: expect.objectContaining({
          entityId: entityRef.objectId,
          roleInGroup: "Principal",
        }),
        changes: [
          {
            field: "roleInGroup",
            before: "Distributor",
            after: "Principal",
          },
        ],
      },
    });

    const requested = record.requestGate({
      tenantId: "tenant-a",
      idempotencyKey: "request-role-gate",
      actor: { kind: "user", id: "analyst-1" },
      stagingId: staged.stagingObject.stagingId,
      requestedAt: "2026-02-02T10:00:00.000Z",
      slaDue: "2026-02-03T10:00:00.000Z",
    });

    expect(requested.gate).toMatchObject({
      tenantId: "tenant-a",
      objectRef: entityRef,
      stagingId: staged.stagingObject.stagingId,
      requestedBy: { kind: "user", id: "analyst-1" },
      requestedAt: "2026-02-02T10:00:00.000Z",
      slaDue: "2026-02-03T10:00:00.000Z",
      decision: null,
      decider: null,
      decidedAt: null,
      status: "pending",
      delegateChain: [],
      diffSnapshot: staged.stagingObject.diffSnapshot,
    });
    expect(requested.stagingObject).toMatchObject({
      stagingId: staged.stagingObject.stagingId,
      gateId: requested.gate.gateId,
      status: "gate_requested",
    });
    expect(requested.event).toMatchObject({
      seq: current.event.seq + 1,
      type: "gate.requested",
      payload: {
        gateId: requested.gate.gateId,
        stagingId: staged.stagingObject.stagingId,
        objectRef: stringifyRecordRef(entityRef),
      },
    });
  });

  it("approves a gate by promoting the staged snapshot into canonical state idempotently", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-current-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-01T09:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const staged = record.stageObject({
      tenantId: "tenant-a",
      idempotencyKey: "stage-role-change",
      actor: { kind: "agent", id: "mapping-studio", onBehalfOf: "analyst-1" },
      ref: entityRef,
      proposedValue: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Principal",
        status: "active",
      },
      lens: { validAt: "2026-03-01", knownAt: "2026-02-02T09:00:00.000Z" },
      stagedAt: "2026-02-02T09:00:00.000Z",
    });
    const requested = record.requestGate({
      tenantId: "tenant-a",
      idempotencyKey: "request-role-gate",
      actor: { kind: "user", id: "analyst-1" },
      stagingId: staged.stagingObject.stagingId,
      requestedAt: "2026-02-02T10:00:00.000Z",
      slaDue: "2026-02-03T10:00:00.000Z",
    });
    const command = {
      tenantId: "tenant-a",
      idempotencyKey: "approve-role-gate",
      actor: { kind: "user" as const, id: "manager-1" },
      gateId: requested.gate.gateId,
      decision: "approved" as const,
      decidedAt: "2026-02-02T11:00:00.000Z",
    };

    const approved = record.decideGate(command);
    const replay = record.decideGate(command);

    expect(replay).toEqual(approved);
    expect(approved.gate).toMatchObject({
      gateId: requested.gate.gateId,
      decision: "approved",
      decider: { kind: "user", id: "manager-1" },
      decidedAt: "2026-02-02T11:00:00.000Z",
      status: "approved",
    });
    expect(approved.stagingObject).toMatchObject({
      stagingId: staged.stagingObject.stagingId,
      status: "promoted",
    });
    expect(approved.events.map((event) => event.type)).toEqual(["gate.decided", "canonical.promoted"]);
    expect(approved.events[0].payload).toMatchObject({
      gateId: requested.gate.gateId,
      decision: "approved",
    });
    expect(approved.events[1].payload).toMatchObject({
      gateId: requested.gate.gateId,
      stagingId: staged.stagingObject.stagingId,
      approvalRef: requested.gate.gateId,
      objectRef: stringifyRecordRef(entityRef),
      diffSnapshot: staged.stagingObject.diffSnapshot,
    });
    expect(approved.row).toMatchObject({
      roleInGroup: "Principal",
      approvalKind: "gate",
      approvalRef: requested.gate.gateId,
      lastChangeEvent: approved.events[1].seq,
      lastChangeEventId: approved.events[1].eventId,
    });
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-02T11:30:00.000Z" },
      }),
    ).toEqual(approved.row);
  });

  it("rejects a gate without promoting the staged snapshot", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const current = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-current-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-01T09:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const staged = record.stageObject({
      tenantId: "tenant-a",
      idempotencyKey: "stage-bad-change",
      actor: { kind: "agent", id: "mapping-studio" },
      ref: entityRef,
      proposedValue: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Holding company",
        status: "active",
      },
      lens: { validAt: "2026-03-01", knownAt: "2026-02-02T09:00:00.000Z" },
    });
    const requested = record.requestGate({
      tenantId: "tenant-a",
      idempotencyKey: "request-bad-change",
      actor: { kind: "user", id: "analyst-1" },
      stagingId: staged.stagingObject.stagingId,
      requestedAt: "2026-02-02T10:00:00.000Z",
      slaDue: "2026-02-03T10:00:00.000Z",
    });

    const rejected = record.decideGate({
      tenantId: "tenant-a",
      idempotencyKey: "reject-bad-change",
      actor: { kind: "user", id: "manager-1" },
      gateId: requested.gate.gateId,
      decision: "rejected",
      reason: "contradicts the executed agreement",
      decidedAt: "2026-02-02T11:00:00.000Z",
    });

    expect(rejected.gate).toMatchObject({
      decision: "rejected",
      decisionReason: "contradicts the executed agreement",
      status: "rejected",
    });
    expect(rejected.stagingObject).toMatchObject({
      status: "rejected",
    });
    expect(rejected.row).toBeNull();
    expect(rejected.events.map((event) => event.type)).toEqual(["gate.decided"]);
    expect(rejected.events[0].payload).toMatchObject({
      gateId: requested.gate.gateId,
      decision: "rejected",
      reason: "contradicts the executed agreement",
    });
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-02T11:30:00.000Z" },
      }),
    ).toEqual(current.row);
  });

  it("delegates and escalates open gates without deciding them", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const staged = record.stageObject({
      tenantId: "tenant-a",
      idempotencyKey: "stage-role-change",
      actor: { kind: "agent", id: "mapping-studio" },
      ref: entityRef,
      proposedValue: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Principal",
        status: "active",
      },
      lens: { validAt: "2026-03-01", knownAt: "2026-02-02T09:00:00.000Z" },
    });
    const requested = record.requestGate({
      tenantId: "tenant-a",
      idempotencyKey: "request-role-gate",
      actor: { kind: "user", id: "analyst-1" },
      stagingId: staged.stagingObject.stagingId,
      requestedAt: "2026-02-02T10:00:00.000Z",
      slaDue: "2026-02-03T10:00:00.000Z",
    });

    const delegated = record.delegateGate({
      tenantId: "tenant-a",
      idempotencyKey: "delegate-role-gate",
      actor: { kind: "user", id: "manager-1" },
      gateId: requested.gate.gateId,
      delegatedTo: "manager-2",
      delegatedAt: "2026-02-02T12:00:00.000Z",
      expiresAt: "2026-02-03T12:00:00.000Z",
      reason: "scope owner is out",
    });

    expect(delegated.gate).toMatchObject({
      gateId: requested.gate.gateId,
      status: "delegated",
      decision: null,
      delegateChain: [
        {
          delegatedTo: "manager-2",
          delegatedBy: { kind: "user", id: "manager-1" },
          delegatedAt: "2026-02-02T12:00:00.000Z",
          expiresAt: "2026-02-03T12:00:00.000Z",
          reason: "scope owner is out",
        },
      ],
    });
    expect(delegated.event).toMatchObject({
      type: "gate.delegated",
      payload: {
        gateId: requested.gate.gateId,
        delegatedTo: "manager-2",
      },
    });

    const escalated = record.escalateGate({
      tenantId: "tenant-a",
      idempotencyKey: "escalate-role-gate",
      actor: { kind: "system", id: "gate-sla" },
      gateId: requested.gate.gateId,
      escalatedTo: "vp-tax",
      reason: "SLA breached",
      escalatedAt: "2026-02-03T10:05:00.000Z",
    });

    expect(escalated.gate).toMatchObject({
      status: "escalated",
      decision: null,
      delegateChain: delegated.gate.delegateChain,
      escalations: [
        {
          escalatedTo: "vp-tax",
          escalatedBy: { kind: "system", id: "gate-sla" },
          escalatedAt: "2026-02-03T10:05:00.000Z",
          reason: "SLA breached",
        },
      ],
    });
    expect(escalated.event).toMatchObject({
      type: "gate.escalated",
      payload: {
        gateId: requested.gate.gateId,
        escalatedTo: "vp-tax",
        reason: "SLA breached",
      },
    });
  });

  it("lists staging objects and gate queues by status", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const staged = record.stageObject({
      tenantId: "tenant-a",
      idempotencyKey: "stage-role-change",
      actor: { kind: "agent", id: "mapping-studio" },
      ref: entityRef,
      proposedValue: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Principal",
        status: "active",
      },
      lens: { validAt: "2026-03-01", knownAt: "2026-02-02T09:00:00.000Z" },
    });

    expect(record.listStagingObjects({ tenantId: "tenant-a", status: "staged" })).toEqual([staged.stagingObject]);

    const requested = record.requestGate({
      tenantId: "tenant-a",
      idempotencyKey: "request-role-gate",
      actor: { kind: "user", id: "analyst-1" },
      stagingId: staged.stagingObject.stagingId,
      requestedAt: "2026-02-02T10:00:00.000Z",
      slaDue: "2026-02-03T10:00:00.000Z",
    });

    expect(record.listStagingObjects({ tenantId: "tenant-a", status: "gate_requested" })).toEqual([
      requested.stagingObject,
    ]);
    expect(record.listGates({ tenantId: "tenant-a", status: "pending" })).toEqual([requested.gate]);
    expect(record.listGates({ tenantId: "tenant-b" })).toEqual([]);
  });
});
