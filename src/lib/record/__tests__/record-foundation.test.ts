import { describe, expect, it } from "vitest";

import {
  createRecordIdentity,
  createRecordLens,
  createRecordRef,
  createRecordService,
  isRecordUlid,
  isRecordError,
  parseRecordRef,
  RecordError,
  stringifyRecordRef,
} from "../index";

describe("Record foundation", () => {
  it("creates tenant-scoped ULID refs and round-trips record refs", () => {
    const identity = createRecordIdentity({
      tenantId: "tenant-us",
      objectType: "entity",
      version: 3,
    });

    expect(identity.tenantId).toBe("tenant-us");
    expect(identity.ref.objectType).toBe("entity");
    expect(identity.ref.version).toBe(3);
    expect(isRecordUlid(identity.ref.objectId)).toBe(true);

    const encoded = stringifyRecordRef(identity.ref);
    expect(parseRecordRef(encoded)).toEqual(identity.ref);
  });

  it("normalizes and validates bitemporal record lenses", () => {
    const lens = createRecordLens({
      validAt: "2026-03-31",
      knownAt: "2026-04-15T12:30:00.000Z",
    });

    expect(lens).toEqual({
      validAt: "2026-03-31",
      knownAt: "2026-04-15T12:30:00.000Z",
    });
    expect(() =>
      createRecordLens({
        validAt: "2026-03-31T10:00:00.000Z",
        knownAt: "2026-04-15T12:30:00.000Z",
      }),
    ).toThrow(/validAt must be a calendar date/i);
  });

  it("uses typed Record errors for contract refusals", () => {
    try {
      createRecordRef({ objectType: "entity", objectId: "not-a-ulid" });
      throw new Error("expected invalid ref to fail");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      expect(error).toBeInstanceOf(RecordError);
      expect((error as RecordError).code).toBe("INVALID_REF");
      expect((error as RecordError).details).toEqual({ objectId: "not-a-ulid" });
    }
  });

  it("refuses lens-less canonical reads with a typed Record error", () => {
    const record = createRecordService();
    const { ref } = createRecordIdentity({ tenantId: "tenant-us", objectType: "entity" });

    expect(() => record.getCanonical({ tenantId: "tenant-us", ref })).toThrow(RecordError);

    try {
      record.getCanonical({ tenantId: "tenant-us", ref });
      throw new Error("expected lens-less canonical read to fail");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      expect((error as RecordError).code).toBe("LENS_REQUIRED");
    }
  });

  it("replays append_event commands idempotently by caller-supplied key", () => {
    const record = createRecordService();
    const command = {
      tenantId: "tenant-us",
      idempotencyKey: "cmd-open-fy2026",
      actor: { kind: "system" as const, id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
    };

    const first = record.appendEvent(command);
    const replay = record.appendEvent({ ...command });

    expect(replay).toEqual(first);
    expect(record.listEvents("tenant-us")).toEqual([first]);
  });

  it("rejects idempotency key reuse with different append_event input", () => {
    const record = createRecordService();
    const base = {
      tenantId: "tenant-us",
      idempotencyKey: "cmd-open-fy2026",
      actor: { kind: "system" as const, id: "record-seed" },
      type: "period.opened",
    };
    const first = record.appendEvent({ ...base, payload: { fy: "FY2026" } });

    expect(() => record.appendEvent({ ...base, payload: { fy: "FY2027" } })).toThrow(RecordError);
    expect(record.listEvents("tenant-us")).toEqual([first]);
  });

  it("commits record transactions atomically and rolls back failed operations", () => {
    const record = createRecordService();

    const committed = record.runTransaction({
      tenantId: "tenant-us",
      idempotencyKey: "tx-open-and-close",
      operations: [
        {
          kind: "append_event",
          actor: { kind: "system", id: "record-seed" },
          type: "period.opened",
          payload: { fy: "FY2026" },
        },
        {
          kind: "append_event",
          actor: { kind: "system", id: "record-seed" },
          type: "period.closing",
          payload: { fy: "FY2026" },
        },
      ],
    });

    expect(committed.events.map((event) => event.type)).toEqual(["period.opened", "period.closing"]);
    expect(record.listEvents("tenant-us")).toEqual(committed.events);

    expect(() =>
      record.runTransaction({
        tenantId: "tenant-us",
        idempotencyKey: "tx-invalid",
        operations: [
          {
            kind: "append_event",
            actor: { kind: "system", id: "record-seed" },
            type: "period.opened",
            payload: { fy: "FY2027" },
          },
          {
            kind: "append_event",
            actor: { kind: "system", id: "" },
            type: "period.closing",
            payload: { fy: "FY2027" },
          },
        ],
      }),
    ).toThrow(RecordError);

    expect(record.listEvents("tenant-us")).toEqual(committed.events);

    const retry = record.runTransaction({
      tenantId: "tenant-us",
      idempotencyKey: "tx-invalid",
      operations: [
        {
          kind: "append_event",
          actor: { kind: "system", id: "record-seed" },
          type: "period.opened",
          payload: { fy: "FY2027" },
        },
      ],
    });

    expect(retry.events).toHaveLength(1);
    expect(record.listEvents("tenant-us").map((event) => event.type)).toEqual([
      "period.opened",
      "period.closing",
      "period.opened",
    ]);
  });
});
