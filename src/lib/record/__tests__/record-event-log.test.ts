import { describe, expect, it } from "vitest";

import {
  createRecordService,
  createRecordUlid,
  RecordError,
  verifyRecordEventChain,
} from "../index";

describe("Record event log and stream", () => {
  it("appends per-tenant sequenced hash-chained events and verifies the chain", () => {
    const record = createRecordService();

    const tenantAFirst = record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "tenant-a-open",
      actor: { kind: "system", id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
    });
    const tenantASecond = record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "tenant-a-closing",
      actor: { kind: "system", id: "record-seed" },
      type: "period.closing",
      payload: { fy: "FY2026" },
    });
    const tenantBFirst = record.appendEvent({
      tenantId: "tenant-b",
      idempotencyKey: "tenant-b-open",
      actor: { kind: "system", id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
    });

    expect(tenantAFirst.seq).toBe(1);
    expect(tenantAFirst.prevHash).toBeNull();
    expect(tenantAFirst.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(tenantASecond.seq).toBe(2);
    expect(tenantASecond.prevHash).toBe(tenantAFirst.hash);
    expect(tenantBFirst.seq).toBe(1);
    expect(tenantBFirst.prevHash).toBeNull();

    expect(verifyRecordEventChain(record.listEvents("tenant-a"))).toMatchObject({
      ok: true,
      checkedEvents: 2,
      lastHash: tenantASecond.hash,
    });

    const tampered = record.listEvents("tenant-a").map((event) => ({ ...event }));
    tampered[1] = {
      ...tampered[1],
      payload: { fy: "FY2027" },
    };
    expect(verifyRecordEventChain(tampered)).toMatchObject({
      ok: false,
      brokenAtSeq: 2,
      reason: "Event hash does not match event contents.",
    });
  });

  it("returns append-only event snapshots that cannot mutate the log", () => {
    const record = createRecordService();
    const event = record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "open",
      actor: { kind: "system", id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
    });

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(() => {
      (event.payload as { fy: string }).fy = "FY2027";
    }).toThrow();
    expect(record.listEvents("tenant-a")[0].payload).toEqual({ fy: "FY2026" });
  });

  it("validates the domain event taxonomy, actors, payloads, and manifest refs", () => {
    const record = createRecordService();
    const manifestRef = createRecordUlid();

    const runCompleted = record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "run-completed",
      actor: { kind: "agent", id: "runtime", onBehalfOf: "u3" },
      type: "run.completed",
      manifestRef,
      payload: { runRef: "run-1", status: "completed" },
    });
    const instructionApproved = record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "instruction-approved",
      actor: { kind: "user", id: "u3" },
      type: "instruction.approved",
      payload: { instructionRef: "instr-1", tier: 2 },
    });

    expect(runCompleted.manifestRef).toBe(manifestRef);
    expect(instructionApproved.type).toBe("instruction.approved");
    expect(() =>
      record.appendEvent({
        tenantId: "tenant-a",
        idempotencyKey: "read-event",
        actor: { kind: "system", id: "audit" },
        type: "access.read",
        payload: { objectRef: "entity:01HZY3Z9Y6M7N8P9Q0R1S2T3V4" },
      }),
    ).toThrow(RecordError);
    expect(() =>
      record.appendEvent({
        tenantId: "tenant-a",
        idempotencyKey: "bad-run",
        actor: { kind: "agent", id: "runtime" },
        type: "run.failed",
        payload: { status: "failed" },
      }),
    ).toThrow(/runRef/i);
    expect(() =>
      record.appendEvent({
        tenantId: "tenant-a",
        idempotencyKey: "bad-actor",
        actor: { kind: "service", id: "runtime" } as never,
        type: "period.opened",
        payload: { fy: "FY2026" },
      }),
    ).toThrow(/actor/i);
  });

  it("enqueues domain events to the outbox and supports at-least-once subscriptions with offsets", () => {
    const record = createRecordService();
    const opened = record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "opened",
      actor: { kind: "system", id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
    });
    const runCompleted = record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "run-completed",
      actor: { kind: "agent", id: "runtime" },
      type: "run.completed",
      payload: { runRef: "run-1", status: "completed" },
    });

    expect(record.readOutbox("tenant-a")).toMatchObject([
      { offset: 1, event: opened, delivered: false },
      { offset: 2, event: runCompleted, delivered: false },
    ]);

    const firstDelivery = record.subscribe({ tenantId: "tenant-a", consumer: "mirror" });
    expect(firstDelivery.events.map((event) => event.type)).toEqual(["period.opened", "run.completed"]);
    expect(firstDelivery.nextOffset).toBe(2);

    const redeliveryBeforeAck = record.subscribe({ tenantId: "tenant-a", consumer: "mirror" });
    expect(redeliveryBeforeAck.events.map((event) => event.seq)).toEqual([1, 2]);

    record.acknowledgeConsumerOffset({ tenantId: "tenant-a", consumer: "mirror", offset: 1 });
    expect(record.getConsumerOffset({ tenantId: "tenant-a", consumer: "mirror" })).toBe(1);
    expect(record.subscribe({ tenantId: "tenant-a", consumer: "mirror" }).events).toEqual([runCompleted]);

    const filtered = record.subscribe({
      tenantId: "tenant-a",
      consumer: "runtime-dashboard",
      filters: { types: ["run.completed"] },
    });
    expect(filtered.events).toEqual([runCompleted]);

    record.acknowledgeConsumerOffset({ tenantId: "tenant-a", consumer: "mirror", offset: 2 });
    expect(record.subscribe({ tenantId: "tenant-a", consumer: "mirror" }).events).toEqual([]);
  });
});
