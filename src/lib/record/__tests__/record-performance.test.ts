import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, createRecordUlid } from "../index";

function durationMs(work: () => void) {
  const start = performance.now();
  work();
  return performance.now() - start;
}

function p95(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

describe("Record performance gates", () => {
  it("commits a 1,000 assertion batch under the v1 write target", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document" }).ref;
    const assertions = Array.from({ length: 1000 }, (_, index) => ({
      subject: { objectRef: entityRef, field: `metric_${index}` },
      value: { amount: index, currency: "USD" },
      validFrom: "2026-01-01",
      assertedAt: "2026-02-01T10:00:00.000Z",
      source: {
        kind: "extraction" as const,
        docRef: documentRef,
        span: { start: index * 2, end: index * 2 + 1 },
        extractorVersion: "extractor@1.0.0",
      },
    }));

    const elapsedMs = durationMs(() => {
      const result = record.submitAssertions({
        tenantId,
        idempotencyKey: "batch-1000",
        actor: { kind: "agent", id: "extractor" },
        manifestRef: createRecordUlid(),
        assertions,
      });

      expect(result.assertions).toHaveLength(1000);
      expect(result.events).toHaveLength(1000);
    });

    expect(elapsedMs).toBeLessThan(2000);
  });

  it("decides an approval gate under the v1 write target", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    record.promoteCanonical({
      tenantId,
      idempotencyKey: "seed-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });
    const staged = record.stageObject({
      tenantId,
      idempotencyKey: "stage-role",
      actor: { kind: "agent", id: "mapping-studio" },
      ref: entityRef,
      proposedValue: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Principal",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
      lens: { validAt: "2026-03-01", knownAt: new Date().toISOString() },
    });
    const requested = record.requestGate({
      tenantId,
      idempotencyKey: "request-role",
      actor: { kind: "user", id: "analyst-1" },
      stagingId: staged.stagingObject.stagingId,
      requestedAt: "2026-03-01T10:00:00.000Z",
      slaDue: "2026-03-02T10:00:00.000Z",
    });

    const elapsedMs = durationMs(() => {
      const result = record.decideGate({
        tenantId,
        idempotencyKey: "approve-role",
        actor: { kind: "user", id: "manager-1" },
        gateId: requested.gate.gateId,
        decision: "approved",
      });

      expect(result.gate.status).toBe("approved");
      expect(result.row?.roleInGroup).toBe("Principal");
    });

    expect(elapsedMs).toBeLessThan(500);
  });

  it("gets a canonical ref through a lens under the v1 read p95 target", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const refs = Array.from({ length: 500 }, (_, index) => {
      const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
      record.promoteCanonical({
        tenantId,
        idempotencyKey: `seed-entity-${index}`,
        actor: { kind: "user", id: "manager-1" },
        ref: entityRef,
        approvalRef: createRecordUlid(),
        occurredAt: "2026-02-01T10:00:00.000Z",
        value: {
          name: `Helios Entity ${index}`,
          jurisdiction: index % 2 === 0 ? "US" : "IE",
          roleInGroup: "Distributor",
          elections: {},
          status: "active",
          sensitivity: 0,
        },
      });
      return entityRef;
    });
    const lens = { validAt: "2026-03-01", knownAt: "2026-02-02T10:00:00.000Z" };

    const durations = refs.slice(0, 100).map((ref) =>
      durationMs(() => {
        expect(record.getRef({ tenantId, ref, lens })?.value.ref).toEqual(ref);
      }),
    );

    expect(p95(durations)).toBeLessThan(100);
  });

  it("queries conflicts for a subject under the v1 read p95 target", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const flowRef = createRecordIdentity({ tenantId, objectType: "flow" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document" }).ref;
    const subject = { objectRef: flowRef, field: "royalty_rate" };
    record.submitAssertions({
      tenantId,
      idempotencyKey: "conflict-samples",
      actor: { kind: "agent", id: "extractor" },
      assertions: Array.from({ length: 1000 }, (_, index) => ({
        subject,
        value: index % 2 === 0 ? { rate: 0.05 } : { rate: 0.055 },
        validFrom: "2026-01-01",
        assertedAt: "2026-02-01T10:00:00.000Z",
        source: {
          kind: "extraction" as const,
          docRef: documentRef,
          span: { start: index * 3, end: index * 3 + 2 },
          extractorVersion: "extractor@1.0.0",
        },
      })),
    });
    const lens = { validAt: "2026-03-01", knownAt: "2026-02-02T10:00:00.000Z" };

    const durations = Array.from({ length: 50 }, () =>
      durationMs(() => {
        const conflicts = record.getConflicts({ tenantId, subject, lens });
        expect(conflicts.status).toBe("conflict");
        expect(conflicts.totalAssertions).toBe(1000);
      }),
    );

    expect(p95(durations)).toBeLessThan(300);
  });

  it("queries a dependency subgraph under the v1 graph read p95 target", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const rootRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const runRef = createRecordIdentity({ tenantId, objectType: "run" }).ref;
    record.promoteCanonical({
      tenantId,
      idempotencyKey: "seed-root",
      actor: { kind: "user", id: "manager-1" },
      ref: rootRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-01T10:00:00.000Z",
      value: {
        name: "Helios Root",
        jurisdiction: "US",
        roleInGroup: "Principal",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });
    const downstreamRefs = Array.from({ length: 120 }, (_, index) => {
      const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
      record.promoteCanonical({
        tenantId,
        idempotencyKey: `seed-downstream-${index}`,
        actor: { kind: "user", id: "manager-1" },
        ref: entityRef,
        approvalRef: createRecordUlid(),
        occurredAt: "2026-02-01T10:00:00.000Z",
        value: {
          name: `Helios Downstream ${index}`,
          jurisdiction: index % 2 === 0 ? "US" : "IE",
          roleInGroup: "Distributor",
          elections: {},
          status: "active",
          sensitivity: 0,
        },
      });
      record.declareDependencies({
        tenantId,
        idempotencyKey: `dependency-${index}`,
        actor: { kind: "system", id: "runtime" },
        declaredByRun: runRef,
        downstreamRef: entityRef,
        upstreamRefs: [{ ref: rootRef, kind: "record-read" }],
        declaredAt: "2026-02-01T11:00:00.000Z",
      });
      return entityRef;
    });
    const lens = { validAt: "2026-03-01", knownAt: "2026-02-02T10:00:00.000Z" };

    const durations = Array.from({ length: 30 }, () =>
      durationMs(() => {
        const subgraph = record.getSubgraph({
          tenantId,
          root: rootRef,
          lens,
          direction: "downstream",
          depth: 1,
        });

        expect(subgraph.nodes).toHaveLength(downstreamRefs.length + 1);
        expect(subgraph.edges).toHaveLength(downstreamRefs.length);
      }),
    );

    expect(p95(durations)).toBeLessThan(500);
  });
});
