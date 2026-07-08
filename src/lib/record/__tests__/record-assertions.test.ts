import { describe, expect, it } from "vitest";

import {
  createRecordIdentity,
  createRecordService,
  createRecordUlid,
  isRecordError,
  RecordError,
  stringifyRecordRef,
} from "../index";

describe("Record assertions and observations", () => {
  it("submits assertion observations with bitemporal fields, provenance, scope, and a recorded event", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;
    const manifestRef = createRecordUlid();

    const result = record.submitAssertions({
      tenantId: "tenant-a",
      idempotencyKey: "extract-royalty-rate",
      actor: { kind: "agent", id: "clause-extractor", onBehalfOf: "u-tax" },
      manifestRef,
      assertions: [
        {
          subject: {
            objectRef: entityRef,
            field: "royalty_rate",
          },
          value: { rate: 0.05, currency: "USD" },
          validFrom: "2026-01-01",
          validTo: "2026-12-31",
          assertedAt: "2026-02-03T10:30:00.000Z",
          source: {
            kind: "extraction",
            docRef,
            span: { start: 244, end: 309 },
            extractorVersion: "clause-extractor@1.4.0",
          },
          confidence: 0.91,
          sensitivity: 1,
          scopeKeys: {
            jurisdictions: ["US"],
          },
        },
      ],
    });

    expect(result.assertions).toHaveLength(1);
    expect(result.events.map((event) => event.type)).toEqual(["assertion.recorded"]);

    const [assertion] = result.assertions;
    expect(assertion).toMatchObject({
      tenantId: "tenant-a",
      subject: {
        objectRef: entityRef,
        field: "royalty_rate",
      },
      value: { rate: 0.05, currency: "USD" },
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      assertedAt: "2026-02-03T10:30:00.000Z",
      retractedAt: null,
      source: {
        kind: "extraction",
        docRef,
        span: { start: 244, end: 309 },
        extractorVersion: "clause-extractor@1.4.0",
      },
      confidence: 0.91,
      supersedes: null,
      sensitivity: 1,
      scopeKeys: {
        entityIds: [entityRef.objectId],
        jurisdictions: ["US"],
      },
    });

    expect(record.listAssertions({ tenantId: "tenant-a" })).toEqual([assertion]);
    expect(record.listEvents("tenant-a")[0]).toMatchObject({
      type: "assertion.recorded",
      manifestRef,
      payload: {
        assertionId: assertion.assertionId,
        subject: {
          objectRef: stringifyRecordRef(entityRef),
          field: "royalty_rate",
        },
      },
    });
  });

  it("refuses incomplete provenance without committing assertions or events", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;

    try {
      record.submitAssertions({
        tenantId: "tenant-a",
        idempotencyKey: "bad-extraction",
        actor: { kind: "agent", id: "clause-extractor" },
        assertions: [
          {
            subject: {
              objectRef: entityRef,
              field: "pricing_method",
            },
            value: "TNMM",
            validFrom: "2026-01-01",
            source: {
              kind: "extraction",
              docRef,
              span: { start: 88, end: 88 },
              extractorVersion: "clause-extractor@1.4.0",
            },
          },
        ],
      });
      throw new Error("expected incomplete provenance to fail");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      expect(error).toBeInstanceOf(RecordError);
      expect((error as RecordError).code).toBe("PROVENANCE_INCOMPLETE");
    }

    expect(record.listAssertions({ tenantId: "tenant-a", includeRetracted: true })).toEqual([]);
    expect(record.listEvents("tenant-a")).toEqual([]);
    expect(record.readOutbox("tenant-a")).toEqual([]);
  });

  it("replays submit_assertions idempotently without creating duplicate assertion rows", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const command = {
      tenantId: "tenant-a",
      idempotencyKey: "answer-once",
      actor: { kind: "user" as const, id: "analyst-1" },
      assertions: [
        {
          subject: {
            objectRef: entityRef,
            field: "functional_profile",
          },
          value: "limited-risk distributor",
          validFrom: "2026-01-01",
          assertedAt: "2026-02-02T09:00:00.000Z",
          source: {
            kind: "human" as const,
            userId: "analyst-1",
          },
        },
      ],
    };

    const first = record.submitAssertions(command);
    const replay = record.submitAssertions(command);

    expect(replay).toEqual(first);
    expect(record.listAssertions({ tenantId: "tenant-a" })).toEqual(first.assertions);
    expect(record.listEvents("tenant-a")).toEqual(first.events);
  });

  it("retracts assertions by closing knowledge time while preserving earlier lenses", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    const recorded = record.submitAssertions({
      tenantId: "tenant-a",
      idempotencyKey: "human-answer",
      actor: { kind: "user", id: "ngupta" },
      assertions: [
        {
          subject: {
            objectRef: entityRef,
            field: "jurisdiction",
          },
          value: "US",
          validFrom: "2026-01-01",
          assertedAt: "2026-02-01T09:00:00.000Z",
          source: {
            kind: "human",
            userId: "ngupta",
          },
        },
      ],
    });
    const assertionId = recorded.assertions[0].assertionId;

    const result = record.retractAssertion({
      tenantId: "tenant-a",
      idempotencyKey: "retract-human-answer",
      actor: { kind: "user", id: "ngupta" },
      assertionId,
      reason: "answered against the wrong entity",
      retractedAt: "2026-02-05T12:00:00.000Z",
    });

    expect(result.assertion).toMatchObject({
      assertionId,
      retractedAt: "2026-02-05T12:00:00.000Z",
    });
    expect(result.event).toMatchObject({
      type: "assertion.retracted",
      payload: {
        assertionId,
        reason: "answered against the wrong entity",
      },
    });
    expect(
      record.listAssertions({
        tenantId: "tenant-a",
        subject: { objectRef: entityRef, field: "jurisdiction" },
        lens: { validAt: "2026-03-01", knownAt: "2026-02-04T12:00:00.000Z" },
      }),
    ).toHaveLength(1);
    expect(
      record.listAssertions({
        tenantId: "tenant-a",
        subject: { objectRef: entityRef, field: "jurisdiction" },
        lens: { validAt: "2026-03-01", knownAt: "2026-02-06T12:00:00.000Z" },
      }),
    ).toEqual([]);
  });

  it("supersedes assertions with a replacement observation and linked events", () => {
    const record = createRecordService();
    const { ref: flowRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "flow" });
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;

    const recorded = record.submitAssertions({
      tenantId: "tenant-a",
      idempotencyKey: "initial-rate",
      actor: { kind: "agent", id: "clause-extractor" },
      assertions: [
        {
          subject: {
            objectRef: flowRef,
            field: "royalty_rate",
          },
          value: { rate: 0.05 },
          validFrom: "2026-01-01",
          assertedAt: "2026-02-01T09:00:00.000Z",
          source: {
            kind: "extraction",
            docRef,
            span: { start: 120, end: 160 },
            extractorVersion: "clause-extractor@1.4.0",
          },
          confidence: 0.8,
        },
      ],
    });
    const originalId = recorded.assertions[0].assertionId;

    const command = {
      tenantId: "tenant-a",
      idempotencyKey: "correct-rate",
      actor: { kind: "user" as const, id: "manager-1" },
      assertionId: originalId,
      reason: "reviewer confirmed the executed amendment",
      supersededAt: "2026-02-10T15:00:00.000Z",
      replacement: {
        subject: {
          objectRef: flowRef,
          field: "royalty_rate",
        },
        value: { rate: 0.055 },
        validFrom: "2026-01-01",
        assertedAt: "2026-02-10T15:00:00.000Z",
        source: {
          kind: "reviewer",
          userId: "manager-1",
        },
        confidence: 1,
        sensitivity: 1,
      },
    };
    const result = record.supersedeAssertion(command);
    const replay = record.supersedeAssertion(command);

    expect(replay).toEqual(result);
    expect(result.superseded).toMatchObject({
      assertionId: originalId,
      retractedAt: "2026-02-10T15:00:00.000Z",
    });
    expect(result.replacement).toMatchObject({
      value: { rate: 0.055 },
      supersedes: originalId,
      assertedAt: "2026-02-10T15:00:00.000Z",
    });
    expect(result.events.map((event) => event.type)).toEqual(["assertion.superseded", "assertion.recorded"]);
    expect(result.events[0].payload).toMatchObject({
      assertionId: originalId,
      supersededBy: result.replacement.assertionId,
    });

    expect(
      record.listAssertions({
        tenantId: "tenant-a",
        subject: { objectRef: flowRef, field: "royalty_rate" },
        lens: { validAt: "2026-03-01", knownAt: "2026-02-05T12:00:00.000Z" },
      }).map((assertion) => assertion.value),
    ).toEqual([{ rate: 0.05 }]);
    expect(
      record.listAssertions({
        tenantId: "tenant-a",
        subject: { objectRef: flowRef, field: "royalty_rate" },
        lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      }).map((assertion) => assertion.value),
    ).toEqual([{ rate: 0.055 }]);
  });

  it("audits assertion provenance completeness by source kind", () => {
    const record = createRecordService();
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;

    record.submitAssertions({
      tenantId: "tenant-a",
      idempotencyKey: "mixed-sources",
      actor: { kind: "system", id: "record-seed" },
      assertions: [
        {
          subject: { objectRef: entityRef, field: "name" },
          value: "Helios US Inc.",
          validFrom: "2026-01-01",
          source: {
            kind: "extraction",
            docRef,
            span: { start: 1, end: 20 },
            extractorVersion: "entity-extractor@2.0.0",
          },
          confidence: 0.92,
        },
        {
          subject: { objectRef: entityRef, field: "effective_tax_rate" },
          value: 0.151,
          validFrom: "2026-01-01",
          source: {
            kind: "engine",
            engineId: "globe",
            rulepackVersion: "oecd-2026.01",
          },
        },
        {
          subject: { objectRef: entityRef, field: "functional_profile" },
          value: "principal",
          validFrom: "2026-01-01",
          source: {
            kind: "human",
            userId: "manager-1",
          },
        },
      ],
    });

    expect(record.auditAssertionProvenance({ tenantId: "tenant-a" })).toEqual({
      tenantId: "tenant-a",
      totalAssertions: 3,
      completeAssertions: 3,
      incompleteAssertions: [],
      completenessRate: 1,
      sourceKinds: {
        engine: 1,
        extraction: 1,
        human: 1,
        reviewer: 0,
      },
    });
  });
});
