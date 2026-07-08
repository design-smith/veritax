import { describe, expect, it } from "vitest";

import {
  createRecordIdentity,
  createRecordService,
  createRecordUlid,
  getRecordArchitectureDecision,
  getRecordMigrationPlan,
  isRecordError,
  listRecordArchitectureDecisions,
  listRecordMigrationPlans,
} from "../index";

describe("Record operational governance", () => {
  it("publishes the event sourcing decisions and tenant partition baseline", () => {
    const eventSourcing = getRecordArchitectureDecision("event-sourcing-live-v0");
    const scaleOut = getRecordArchitectureDecision("postgres-log-scale-out-trigger");
    const partitioning = getRecordArchitectureDecision("event-log-partitioning-baseline");

    expect(listRecordArchitectureDecisions().map((decision) => decision.id)).toEqual([
      "event-sourcing-live-v0",
      "postgres-log-scale-out-trigger",
      "event-log-partitioning-baseline",
    ]);
    expect(eventSourcing).toMatchObject({
      status: "accepted",
      source: "DEMO-PRD/PRD-02-record.md#13",
      implementation: {
        authority: "postgres-event-log",
        eventLogLiveFrom: "v0",
        bitemporalReadsFrom: "v1",
      },
    });
    expect(scaleOut).toMatchObject({
      status: "accepted",
      source: "DEMO-PRD/PRD-02-record.md#15",
      implementation: {
        dedicatedLogServiceTriggerEventsPerTenant: 10_000_000,
        decisionMode: "evidence-review",
      },
    });
    expect(partitioning).toMatchObject({
      status: "accepted",
      implementation: {
        partitionBy: "tenant_id",
        insertOnlyRole: true,
        updateDeleteRevoked: true,
      },
    });

    const record = createRecordService();
    record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "open-a",
      actor: { kind: "system", id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    record.appendEvent({
      tenantId: "tenant-b",
      idempotencyKey: "open-b",
      actor: { kind: "system", id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
      occurredAt: "2026-01-01T00:00:00.000Z",
    });

    expect(record.getEventLogPartitions()).toEqual([
      expect.objectContaining({
        tenantId: "tenant-a",
        partitionKey: "tenant_id=tenant-a",
        eventCount: 1,
        firstSeq: 1,
        lastSeq: 1,
      }),
      expect.objectContaining({
        tenantId: "tenant-b",
        partitionKey: "tenant_id=tenant-b",
        eventCount: 1,
        firstSeq: 1,
        lastSeq: 1,
      }),
    ]);
  });

  it("reports event lag from committed events to consumer visibility", () => {
    const record = createRecordService();

    expect(record.getEventLagMetrics({ tenantId: "tenant-a" })).toEqual({
      tenantId: "tenant-a",
      sampleCount: 0,
      lastEnqueuedOffset: 0,
      targetP95Ms: 2000,
      p95CommitToConsumerMs: 0,
      maxCommitToConsumerMs: 0,
      withinTarget: true,
    });

    record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "open",
      actor: { kind: "system", id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
    });
    record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "closing",
      actor: { kind: "system", id: "record-seed" },
      type: "period.closing",
      payload: { fy: "FY2026" },
    });

    expect(record.getEventLagMetrics({ tenantId: "tenant-a" })).toMatchObject({
      tenantId: "tenant-a",
      sampleCount: 2,
      lastEnqueuedOffset: 2,
      targetP95Ms: 2000,
      withinTarget: true,
    });
    expect(record.getEventLagMetrics({ tenantId: "tenant-a" }).p95CommitToConsumerMs).toBeGreaterThanOrEqual(0);
    expect(record.getEventLagMetrics({ tenantId: "tenant-a" }).maxCommitToConsumerMs).toBeGreaterThanOrEqual(0);
  });

  it("runs the append-only event invariant gate against the tenant event chain", () => {
    const record = createRecordService();
    record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "open",
      actor: { kind: "system", id: "record-seed" },
      type: "period.opened",
      payload: { fy: "FY2026" },
    });
    record.appendEvent({
      tenantId: "tenant-a",
      idempotencyKey: "closing",
      actor: { kind: "system", id: "record-seed" },
      type: "period.closing",
      payload: { fy: "FY2026" },
    });

    expect(() => {
      (record.listEvents("tenant-a")[1].payload as { fy: string }).fy = "FY2027";
    }).toThrow();

    expect(record.runInvariantGates({ tenantId: "tenant-a", gates: ["append-only-events"] })).toEqual({
      tenantId: "tenant-a",
      status: "pass",
      results: [
        {
          gate: "append-only-events",
          status: "pass",
          checkedRecords: 2,
          failures: [],
        },
      ],
    });
  });

  it("runs the canonical change approval invariant gate", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;

    record.promoteCanonical({
      tenantId,
      idempotencyKey: "promote-entity",
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
    record.applyGovernedEdit({
      tenantId,
      idempotencyKey: "edit-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Approved legal-name correction.",
      value: {
        name: "Helios Distribution US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });

    expect(record.runInvariantGates({ tenantId, gates: ["canonical-change-approval"] })).toEqual({
      tenantId,
      status: "pass",
      results: [
        expect.objectContaining({
          gate: "canonical-change-approval",
          status: "pass",
          checkedRecords: 4,
          failures: [],
        }),
      ],
    });
  });

  it("runs the assertion provenance invariant gate", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document" }).ref;

    record.submitAssertions({
      tenantId,
      idempotencyKey: "extract-entity-name",
      actor: { kind: "agent", id: "extractor" },
      assertions: [
        {
          subject: { objectRef: entityRef, field: "name" },
          value: "Helios US Inc.",
          validFrom: "2026-01-01",
          source: {
            kind: "extraction",
            docRef: documentRef,
            span: { start: 10, end: 24 },
            extractorVersion: "entity-extractor@1.0.0",
          },
          confidence: 0.94,
        },
      ],
    });

    expect(record.runInvariantGates({ tenantId, gates: ["assertion-provenance"] })).toEqual({
      tenantId,
      status: "pass",
      results: [
        expect.objectContaining({
          gate: "assertion-provenance",
          status: "pass",
          checkedRecords: 1,
          failures: [],
        }),
      ],
    });
  });

  it("runs the sealed write rejection invariant gate", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const period = record.openPeriod({
      tenantId,
      idempotencyKey: "open-period",
      actor: { kind: "user", id: "controller-1" },
      fy: "FY2026",
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      openedAt: "2026-01-02T09:00:00.000Z",
    }).period;
    record.closePeriod({
      tenantId,
      idempotencyKey: "close-period",
      actor: { kind: "user", id: "controller-1" },
      periodId: period.periodId,
      closingAt: "2026-12-20T18:00:00.000Z",
    });
    record.sealPeriod({
      tenantId,
      idempotencyKey: "seal-period",
      actor: { kind: "user", id: "controller-1" },
      periodId: period.periodId,
      sealedAt: "2026-12-31T23:00:00.000Z",
    });

    try {
      record.applyGovernedEdit({
        tenantId,
        idempotencyKey: "late-doc",
        actor: { kind: "user", id: "controller-1" },
        ref: createRecordIdentity({ tenantId, objectType: "document" }).ref,
        approvalRef: createRecordUlid(),
        reason: "Late document change.",
        occurredAt: "2027-01-05T10:00:00.000Z",
        value: {
          docType: "local file",
          jurisdiction: "US",
          periodId: period.periodRef,
          lang: "en",
          status: "draft",
          outline: {},
          sensitivity: 1,
        },
      });
      throw new Error("Expected sealed write to fail.");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      if (isRecordError(error)) expect(error.code).toBe("PERIOD_SEALED");
    }

    expect(record.runInvariantGates({ tenantId, gates: ["sealed-write-rejection"] })).toEqual({
      tenantId,
      status: "pass",
      results: [
        expect.objectContaining({
          gate: "sealed-write-rejection",
          status: "pass",
          failures: [],
        }),
      ],
    });
  });

  it("runs the manifest and pins invariant gate", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const runRef = createRecordIdentity({ tenantId, objectType: "run" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document", version: 3 }).ref;
    const manifest = record.registerManifest({
      tenantId,
      idempotencyKey: "manifest-with-pins",
      actor: { kind: "system", id: "runtime" },
      jobRef: runRef,
      corpusVersion: 7,
      inputPins: [{ ref: documentRef, version: 3 }],
      outputHashes: { "board-pack.pdf": "sha256:board-pack-v1" },
    }).manifest;
    record.registerArtifact({
      tenantId,
      idempotencyKey: "artifact-with-manifest",
      actor: { kind: "system", id: "assembler" },
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/board-pack.pdf",
      contentHash: "sha256:board-pack-v1",
    });

    expect(record.runInvariantGates({ tenantId, gates: ["manifest-and-pins"] })).toEqual({
      tenantId,
      status: "pass",
      results: [
        expect.objectContaining({
          gate: "manifest-and-pins",
          status: "pass",
          checkedRecords: 2,
          failures: [],
        }),
      ],
    });
  });

  it("runs the alias survival invariant gate", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const sourceEntityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const targetEntityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const splitEntityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;

    record.addEntityAlias({
      tenantId,
      idempotencyKey: "alias-source",
      actor: { kind: "user", id: "analyst-1" },
      entityRef: sourceEntityRef,
      aliasText: "Helios Legacy US",
      resolvedAt: "2026-02-01T09:00:00.000Z",
    });
    record.mergeEntities({
      tenantId,
      idempotencyKey: "merge-source",
      actor: { kind: "user", id: "reviewer-1" },
      sourceEntityRef,
      targetEntityRef,
      reason: "Duplicate legal entity.",
      mergedAt: "2026-02-02T09:00:00.000Z",
    });
    record.splitEntity({
      tenantId,
      idempotencyKey: "split-services",
      actor: { kind: "user", id: "reviewer-1" },
      sourceEntityRef: targetEntityRef,
      newEntityRef: splitEntityRef,
      aliasTexts: ["Helios Shared Services"],
      reason: "Services entity was separated from parent.",
      splitAt: "2026-02-03T09:00:00.000Z",
    });

    expect(record.resolveEntityAlias({ tenantId, aliasText: "Helios Legacy US" })?.entityRef).toEqual(targetEntityRef);
    expect(record.resolveEntityAlias({ tenantId, aliasText: "Helios Shared Services" })?.entityRef).toEqual(
      splitEntityRef,
    );
    expect(record.runInvariantGates({ tenantId, gates: ["alias-survival"] })).toEqual({
      tenantId,
      status: "pass",
      results: [
        expect.objectContaining({
          gate: "alias-survival",
          status: "pass",
          checkedRecords: 3,
          failures: [],
        }),
      ],
    });
  });

  it("runs the staleness false-clean invariant gate", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const runRef = createRecordIdentity({ tenantId, objectType: "run" }).ref;
    const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document" }).ref;

    record.declareDependencies({
      tenantId,
      idempotencyKey: "doc-depends-on-entity",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: documentRef,
      upstreamRefs: [{ ref: entityRef, kind: "record-read" }],
      declaredAt: "2026-02-01T09:00:00.000Z",
    });
    const edit = record.applyGovernedEdit({
      tenantId,
      idempotencyKey: "edit-entity",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Entity name changed after document generation.",
      occurredAt: "2026-02-02T09:00:00.000Z",
      value: {
        name: "Helios Distribution US",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });

    expect(record.getDirtySet({ tenantId }).flags).toEqual([
      expect.objectContaining({
        objectRef: documentRef,
        upstreamRef: entityRef,
        dirtiedByEvent: edit.event.seq,
      }),
    ]);
    expect(record.runInvariantGates({ tenantId, gates: ["staleness-false-clean"] })).toEqual({
      tenantId,
      status: "pass",
      results: [
        expect.objectContaining({
          gate: "staleness-false-clean",
          status: "pass",
          checkedRecords: 1,
          failures: [],
        }),
      ],
    });
  });

  it("runs the tenant isolation invariant gate", () => {
    const record = createRecordService();
    const tenantARef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const tenantBRef = createRecordIdentity({ tenantId: "tenant-b", objectType: "entity" }).ref;

    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "tenant-a-entity",
      actor: { kind: "user", id: "manager-a" },
      ref: tenantARef,
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
    record.promoteCanonical({
      tenantId: "tenant-b",
      idempotencyKey: "tenant-b-entity",
      actor: { kind: "user", id: "manager-b" },
      ref: tenantBRef,
      approvalRef: createRecordUlid(),
      value: {
        name: "Orion IE Ltd.",
        jurisdiction: "IE",
        roleInGroup: "Principal",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });

    expect(
      record.getRef({
        tenantId: "tenant-b",
        ref: tenantARef,
        lens: { validAt: "2026-03-01", knownAt: new Date().toISOString() },
      }),
    ).toBeNull();
    expect(record.runInvariantGates({ tenantId: "tenant-a", gates: ["tenant-isolation"] })).toEqual({
      tenantId: "tenant-a",
      status: "pass",
      results: [
        expect.objectContaining({
          gate: "tenant-isolation",
          status: "pass",
          failures: [],
        }),
      ],
    });
    expect(record.runInvariantGates({ tenantId: "tenant-b", gates: ["tenant-isolation"] })).toEqual({
      tenantId: "tenant-b",
      status: "pass",
      results: [
        expect.objectContaining({
          gate: "tenant-isolation",
          status: "pass",
          failures: [],
        }),
      ],
    });
  });

  it("publishes the v0, v1, and v2 Record migration plans", () => {
    expect(listRecordMigrationPlans().map((plan) => plan.wave)).toEqual(["v0", "v1", "v2"]);
    expect(getRecordMigrationPlan("v0")).toMatchObject({
      wave: "v0",
      source: "DEMO-PRD/PRD-02-record.md#13",
      status: "active",
      capabilities: expect.arrayContaining([
        "hash-chained event log live from day one",
        "assertions with provenance",
        "staging and single-approver gates",
      ]),
    });
    expect(getRecordMigrationPlan("v1")).toMatchObject({
      wave: "v1",
      status: "planned",
      capabilities: expect.arrayContaining([
        "bitemporal reconstruction reads",
        "multi-tenant RLS enforcement",
        "async staleness propagation",
      ]),
      releaseGates: expect.arrayContaining(["all Record invariant gates pass"]),
    });
    expect(getRecordMigrationPlan("v2")).toMatchObject({
      wave: "v2",
      status: "planned",
      capabilities: expect.arrayContaining([
        "partition strategy hardening",
        "dedicated log-service evaluation at 10M events per tenant",
        "crypto-shredding field hooks",
      ]),
    });
  });
});
