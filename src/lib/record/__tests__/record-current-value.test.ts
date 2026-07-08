import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, isRecordError, RecordError } from "../index";

describe("Record current value and conflicts", () => {
  it("resolves current values through a versioned field-class precedence policy with provenance", () => {
    const record = createRecordService();
    const flowRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "flow" }).ref;
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;
    const subject = { objectRef: flowRef, field: "royalty_rate" };

    const recorded = record.submitAssertions({
      tenantId: "tenant-a",
      idempotencyKey: "royalty-rate-assertions",
      actor: { kind: "system", id: "record-seed" },
      assertions: [
        {
          subject,
          value: { rate: 0.04 },
          validFrom: "2026-01-01",
          assertedAt: "2026-02-01T09:00:00.000Z",
          source: {
            kind: "engine",
            engineId: "range-test",
            rulepackVersion: "tp-2026.01",
          },
          confidence: 0.72,
        },
        {
          subject,
          value: { rate: 0.05 },
          validFrom: "2026-01-01",
          assertedAt: "2026-02-02T09:00:00.000Z",
          source: {
            kind: "extraction",
            docRef,
            span: { start: 240, end: 268 },
            extractorVersion: "clause-extractor@1.4.0",
          },
          confidence: 0.9,
        },
        {
          subject,
          value: { rate: 0.055 },
          validFrom: "2026-01-01",
          assertedAt: "2026-02-03T09:00:00.000Z",
          source: {
            kind: "reviewer",
            userId: "manager-1",
          },
          confidence: 1,
        },
      ],
    });

    const policy = record.registerPrecedencePolicy({
      tenantId: "tenant-a",
      idempotencyKey: "rate-policy-v1",
      actor: { kind: "user", id: "vp-tax" },
      name: "TP field-class precedence",
      effectiveFrom: "2026-01-01",
      entries: [
        {
          fieldClass: "rate-class",
          fields: ["royalty_rate", "effective_tax_rate"],
          sourcePrecedence: ["reviewer", "human", "extraction", "engine"],
        },
      ],
      changedAt: "2026-02-04T09:00:00.000Z",
    });

    expect(policy.event).toMatchObject({
      type: "precedence.policy_changed",
      payload: {
        policyVersion: policy.policy.version,
        policyId: policy.policy.policyId,
        fieldClasses: ["rate-class"],
      },
    });

    const currentValue = record.getCurrentValue({
      tenantId: "tenant-a",
      subject,
      lens: { validAt: "2026-03-01", knownAt: "2026-02-05T12:00:00.000Z" },
    });

    expect(currentValue).toMatchObject({
      tenantId: "tenant-a",
      subject,
      status: "resolved",
      value: { rate: 0.055 },
      policyVersion: policy.policy.version,
      fieldClass: "rate-class",
      provenance: {
        assertionId: recorded.assertions[2].assertionId,
        source: { kind: "reviewer", userId: "manager-1" },
        confidence: 1,
        assertedAt: "2026-02-03T09:00:00.000Z",
      },
    });
    expect(currentValue.candidates.map((candidate) => candidate.assertionId)).toEqual([
      recorded.assertions[2].assertionId,
      recorded.assertions[1].assertionId,
      recorded.assertions[0].assertionId,
    ]);
  });

  it("returns conflict groups with all assertion tiers and normalized values", () => {
    const record = createRecordService();
    const flowRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "flow" }).ref;
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;
    const subject = { objectRef: flowRef, field: "royalty_rate" };

    const recorded = record.submitAssertions({
      tenantId: "tenant-a",
      idempotencyKey: "conflicting-rate-assertions",
      actor: { kind: "system", id: "record-seed" },
      assertions: [
        {
          subject,
          value: 0.04,
          validFrom: "2026-01-01",
          assertedAt: "2026-02-01T09:00:00.000Z",
          source: {
            kind: "engine",
            engineId: "range-test",
            rulepackVersion: "tp-2026.01",
          },
        },
        {
          subject,
          value: "4.0%",
          validFrom: "2026-01-01",
          assertedAt: "2026-02-02T09:00:00.000Z",
          source: {
            kind: "extraction",
            docRef,
            span: { start: 240, end: 268 },
            extractorVersion: "clause-extractor@1.4.0",
          },
          confidence: 0.9,
        },
        {
          subject,
          value: 0.055,
          validFrom: "2026-01-01",
          assertedAt: "2026-02-03T09:00:00.000Z",
          source: {
            kind: "reviewer",
            userId: "manager-1",
          },
          confidence: 1,
        },
      ],
    });

    const conflicts = record.getConflicts({
      tenantId: "tenant-a",
      subject,
      lens: { validAt: "2026-03-01", knownAt: "2026-02-04T12:00:00.000Z" },
    });

    expect(conflicts.status).toBe("conflict");
    expect(conflicts.totalAssertions).toBe(3);
    expect(conflicts.groups).toEqual([
      {
        normalizedValue: "0.04",
        value: 0.04,
        assertions: [
          expect.objectContaining({ assertionId: recorded.assertions[0].assertionId, source: { kind: "engine", engineId: "range-test", rulepackVersion: "tp-2026.01" } }),
          expect.objectContaining({ assertionId: recorded.assertions[1].assertionId, source: { kind: "extraction", docRef, span: { start: 240, end: 268 }, extractorVersion: "clause-extractor@1.4.0" } }),
        ],
      },
      {
        normalizedValue: "0.055",
        value: 0.055,
        assertions: [
          expect.objectContaining({ assertionId: recorded.assertions[2].assertionId, source: { kind: "reviewer", userId: "manager-1" } }),
        ],
      },
    ]);
  });

  it("lists the materialized current value view for every visible subject", () => {
    const record = createRecordService();
    const flowRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "flow" }).ref;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;

    record.registerPrecedencePolicy({
      tenantId: "tenant-a",
      idempotencyKey: "policy",
      actor: { kind: "user", id: "vp-tax" },
      name: "Default policy",
      effectiveFrom: "2026-01-01",
      entries: [
        {
          fieldClass: "rate-class",
          fields: ["royalty_rate"],
          sourcePrecedence: ["reviewer", "human", "extraction", "engine"],
        },
        {
          fieldClass: "characterization-class",
          fields: ["role_in_group"],
          sourcePrecedence: ["human", "reviewer", "extraction", "engine"],
        },
      ],
      changedAt: "2026-02-01T09:00:00.000Z",
    });
    record.submitAssertions({
      tenantId: "tenant-a",
      idempotencyKey: "current-value-view-assertions",
      actor: { kind: "system", id: "record-seed" },
      assertions: [
        {
          subject: { objectRef: flowRef, field: "royalty_rate" },
          value: 0.05,
          validFrom: "2026-01-01",
          assertedAt: "2026-02-02T09:00:00.000Z",
          source: {
            kind: "engine",
            engineId: "range-test",
            rulepackVersion: "tp-2026.01",
          },
        },
        {
          subject: { objectRef: entityRef, field: "role_in_group" },
          value: "principal",
          validFrom: "2026-01-01",
          assertedAt: "2026-02-02T09:05:00.000Z",
          source: {
            kind: "human",
            userId: "manager-1",
          },
        },
      ],
    });

    const values = record.listCurrentValues({
      tenantId: "tenant-a",
      lens: { validAt: "2026-03-01", knownAt: "2026-02-03T12:00:00.000Z" },
    });

    expect(values.map((value) => ({ field: value.subject.field, status: value.status, resolved: value.value }))).toEqual([
      { field: "role_in_group", status: "resolved", resolved: "principal" },
      { field: "royalty_rate", status: "resolved", resolved: 0.05 },
    ]);
  });

  it("refuses per-field precedence policies before appending policy events", () => {
    const record = createRecordService();

    try {
      record.registerPrecedencePolicy({
        tenantId: "tenant-a",
        idempotencyKey: "bad-policy",
        actor: { kind: "user", id: "vp-tax" },
        name: "Per-field policy",
        effectiveFrom: "2026-01-01",
        entries: [
          {
            field: "royalty_rate",
            sourcePrecedence: ["human", "extraction"],
          },
        ] as never,
      });
      throw new Error("expected per-field policy to fail");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      expect(error).toBeInstanceOf(RecordError);
      expect((error as RecordError).code).toBe("INVALID_PRECEDENCE_POLICY");
    }

    expect(record.listEvents("tenant-a")).toEqual([]);
  });
});
