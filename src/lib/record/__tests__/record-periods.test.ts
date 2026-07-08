import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, createRecordUlid, isRecordError, stringifyRecordRef } from "../index";

describe("Record period sealing", () => {
  it("opens and closes periods with domain events", () => {
    const record = createRecordService();

    const opened = record.openPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "open-fy2026",
      actor: { kind: "user", id: "controller-1" },
      fy: "FY2026",
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      openedAt: "2026-01-02T09:00:00.000Z",
    });

    expect(opened.period).toMatchObject({
      tenantId: "tenant-a",
      fy: "FY2026",
      quarter: null,
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      status: "open",
      openedAt: "2026-01-02T09:00:00.000Z",
    });
    expect(opened.event).toMatchObject({
      type: "period.opened",
      payload: {
        periodId: opened.period.periodId,
        periodRef: stringifyRecordRef(opened.period.periodRef),
        fy: "FY2026",
      },
    });

    const closing = record.closePeriod({
      tenantId: "tenant-a",
      idempotencyKey: "close-fy2026",
      actor: { kind: "user", id: "controller-1" },
      periodId: opened.period.periodId,
      closingAt: "2026-12-20T18:00:00.000Z",
    });

    expect(closing.period).toMatchObject({
      periodId: opened.period.periodId,
      status: "closing",
      closingAt: "2026-12-20T18:00:00.000Z",
    });
    expect(closing.event).toMatchObject({
      type: "period.closing",
      payload: {
        periodId: opened.period.periodId,
        periodRef: stringifyRecordRef(opened.period.periodRef),
      },
    });
    expect(record.getPeriod({ tenantId: "tenant-a", periodId: opened.period.periodId })).toEqual(closing.period);
    expect(record.listPeriods({ tenantId: "tenant-a", status: "closing" })).toEqual([closing.period]);
  });

  it("seals a closed period, marks linked artifacts, and captures an as-filed snapshot", () => {
    const record = createRecordService();
    const opened = record.openPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "open-fy2026-for-seal",
      actor: { kind: "user", id: "controller-1" },
      fy: "FY2026",
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      openedAt: "2026-01-02T09:00:00.000Z",
    }).period;
    const closing = record.closePeriod({
      tenantId: "tenant-a",
      idempotencyKey: "close-fy2026-for-seal",
      actor: { kind: "user", id: "controller-1" },
      periodId: opened.periodId,
      closingAt: "2026-12-20T18:00:00.000Z",
    }).period;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;

    const canonical = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-period-entity",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      value: {
        name: "Helios US",
        jurisdiction: "us",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 1,
      },
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-01T09:00:00.000Z",
    });
    const manifest = record.registerManifest({
      tenantId: "tenant-a",
      idempotencyKey: "period-board-pack-manifest",
      actor: { kind: "system", id: "runtime" },
      jobRef: createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref,
      corpusVersion: 8,
      inputPins: [
        { ref: closing.periodRef, version: closing.closingEvent ?? 1 },
        { ref: entityRef, version: canonical.event.seq },
      ],
      outputHashes: { "board-pack.pdf": "sha256:period-pack-v1" },
      registeredAt: "2026-12-21T09:00:00.000Z",
    }).manifest;
    const artifact = record.registerArtifact({
      tenantId: "tenant-a",
      idempotencyKey: "period-board-pack-artifact",
      actor: { kind: "system", id: "assembler" },
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/period-board-pack.pdf",
      contentHash: "sha256:period-pack-v1",
      renderedAt: "2026-12-21T09:01:00.000Z",
    }).artifact;

    const sealed = record.sealPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "seal-fy2026",
      actor: { kind: "user", id: "controller-1" },
      periodId: closing.periodId,
      sealedAt: "2026-12-31T23:00:00.000Z",
    });

    expect(sealed.event).toMatchObject({
      type: "period.sealed",
      payload: {
        periodId: closing.periodId,
        periodRef: stringifyRecordRef(closing.periodRef),
        fy: "FY2026",
      },
    });
    expect(sealed.period).toMatchObject({
      periodId: closing.periodId,
      status: "sealed",
      sealedAt: "2026-12-31T23:00:00.000Z",
      sealedBy: { kind: "user", id: "controller-1" },
      sealedEvent: sealed.event.seq,
    });
    expect(sealed.sealedArtifacts).toHaveLength(1);
    expect(sealed.sealedArtifacts[0]).toMatchObject({
      artifactId: artifact.artifactId,
      sealed: true,
    });
    expect(record.getArtifact({ tenantId: "tenant-a", artifactId: artifact.artifactId })).toMatchObject({
      artifactId: artifact.artifactId,
      sealed: true,
      sealedEvent: sealed.artifactEvents[0].seq,
    });
    expect(record.getPeriodSnapshot({ tenantId: "tenant-a", periodId: closing.periodId })).toMatchObject({
      tenantId: "tenant-a",
      periodId: closing.periodId,
      periodRef: closing.periodRef,
      cadence: "per-seal",
      sealedEvent: sealed.event.seq,
      capturedAt: "2026-12-31T23:00:00.000Z",
      rows: [
        expect.objectContaining({
          ref: entityRef,
          name: "Helios US",
          lastChangeEvent: canonical.event.seq,
        }),
      ],
    });
    expect(record.getPeriod({ tenantId: "tenant-a", periodId: closing.periodId })).toEqual(sealed.period);
  });

  it("refuses canonical writes scoped to a sealed period", () => {
    const record = createRecordService();
    const opened = record.openPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "open-sealed-write-period",
      actor: { kind: "user", id: "controller-1" },
      fy: "FY2026",
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      openedAt: "2026-01-02T09:00:00.000Z",
    }).period;
    record.closePeriod({
      tenantId: "tenant-a",
      idempotencyKey: "close-sealed-write-period",
      actor: { kind: "user", id: "controller-1" },
      periodId: opened.periodId,
      closingAt: "2026-12-20T18:00:00.000Z",
    });
    const sealed = record.sealPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "seal-sealed-write-period",
      actor: { kind: "user", id: "controller-1" },
      periodId: opened.periodId,
      sealedAt: "2026-12-31T23:00:00.000Z",
    });

    try {
      record.applyGovernedEdit({
        tenantId: "tenant-a",
        idempotencyKey: "edit-document-in-sealed-period",
        actor: { kind: "user", id: "controller-1" },
        ref: createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref,
        value: {
          docType: "local file",
          jurisdiction: "us",
          periodId: sealed.period.periodRef,
          lang: "en",
          status: "draft",
          outline: {},
          sensitivity: 1,
        },
        approvalRef: createRecordUlid(),
        reason: "Late supporting document",
        occurredAt: "2027-01-05T10:00:00.000Z",
      });
      throw new Error("Expected sealed period write to fail.");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      if (isRecordError(error)) {
        expect(error.code).toBe("PERIOD_SEALED");
        expect(error.details).toMatchObject({
          periodId: sealed.period.periodId,
          objectRef: expect.any(String),
        });
      }
    }
  });

  it("marks sealed artifact targets as superseded candidates instead of normal dirty rebuilds", () => {
    const record = createRecordService();
    const opened = record.openPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "open-superseded-artifact-period",
      actor: { kind: "user", id: "controller-1" },
      fy: "FY2026",
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      openedAt: "2026-01-02T09:00:00.000Z",
    }).period;
    record.closePeriod({
      tenantId: "tenant-a",
      idempotencyKey: "close-superseded-artifact-period",
      actor: { kind: "user", id: "controller-1" },
      periodId: opened.periodId,
      closingAt: "2026-12-20T18:00:00.000Z",
    });
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const manifest = record.registerManifest({
      tenantId: "tenant-a",
      idempotencyKey: "superseded-artifact-manifest",
      actor: { kind: "system", id: "runtime" },
      jobRef: createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref,
      corpusVersion: 8,
      inputPins: [
        { ref: opened.periodRef, version: 1 },
        { ref: entityRef, version: 1 },
      ],
      outputHashes: { "local-file.pdf": "sha256:sealed-v1" },
      registeredAt: "2026-12-21T09:00:00.000Z",
    }).manifest;
    const artifact = record.registerArtifact({
      tenantId: "tenant-a",
      idempotencyKey: "superseded-artifact",
      actor: { kind: "system", id: "assembler" },
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/sealed-local-file.pdf",
      contentHash: "sha256:sealed-v1",
      renderedAt: "2026-12-21T09:01:00.000Z",
    }).artifact;
    const sealed = record.sealPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "seal-superseded-artifact-period",
      actor: { kind: "user", id: "controller-1" },
      periodId: opened.periodId,
      sealedAt: "2026-12-31T23:00:00.000Z",
    });
    const artifactRef = { objectType: "artifact", objectId: artifact.artifactId };
    record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "sealed-artifact-depends-on-entity",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref,
      downstreamRef: artifactRef,
      upstreamRefs: [{ ref: entityRef, kind: "record-read" }],
      declaredAt: "2027-01-05T09:00:00.000Z",
    });

    const edit = record.applyGovernedEdit({
      tenantId: "tenant-a",
      idempotencyKey: "edit-entity-after-artifact-seal",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Refresh entity name after the filed package was sealed.",
      occurredAt: "2027-01-05T10:00:00.000Z",
      value: {
        name: "Helios Distribution US",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });

    expect(record.getDirtySet({ tenantId: "tenant-a" }).flags).toEqual([]);
    expect(record.listRebuildProposals({ tenantId: "tenant-a" })).toEqual([]);
    expect(record.getArtifact({ tenantId: "tenant-a", artifactId: artifact.artifactId })).toMatchObject({
      artifactId: artifact.artifactId,
      sealed: true,
      sealedEvent: sealed.artifactEvents[0].seq,
      supersededCandidate: true,
      supersededByEvent: edit.event.seq,
      supersededAt: "2027-01-05T10:00:00.000Z",
    });
    expect(record.listEvents("tenant-a").map((event) => event.type)).toContain("artifact.superseded");
  });

  it("answers as-filed from the sealed snapshot and as-known-today from current canonical history", () => {
    const record = createRecordService();
    const period = record.openPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "open-as-filed-period",
      actor: { kind: "user", id: "controller-1" },
      fy: "FY2026",
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      openedAt: "2026-01-02T09:00:00.000Z",
    }).period;
    record.closePeriod({
      tenantId: "tenant-a",
      idempotencyKey: "close-as-filed-period",
      actor: { kind: "user", id: "controller-1" },
      periodId: period.periodId,
      closingAt: "2026-12-20T18:00:00.000Z",
    });
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const filed = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-as-filed-entity",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      value: {
        name: "Helios US",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-01T09:00:00.000Z",
    }).row;
    record.sealPeriod({
      tenantId: "tenant-a",
      idempotencyKey: "seal-as-filed-period",
      actor: { kind: "user", id: "controller-1" },
      periodId: period.periodId,
      sealedAt: "2026-12-31T23:00:00.000Z",
    });
    const current = record.applyGovernedEdit({
      tenantId: "tenant-a",
      idempotencyKey: "edit-as-known-today-entity",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      value: {
        name: "Helios Distribution US",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
      approvalRef: createRecordUlid(),
      reason: "Entity name changed after filing.",
      occurredAt: "2027-01-05T10:00:00.000Z",
    }).row;

    expect(record.getAsFiled({ tenantId: "tenant-a", periodId: period.periodId, ref: entityRef })).toEqual(filed);
    expect(record.getAsKnownToday({ tenantId: "tenant-a", ref: entityRef })).toEqual(current);
  });
});
