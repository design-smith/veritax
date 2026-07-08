import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, createRecordUlid } from "../index";

describe("Record metrics dashboard", () => {
  it("aggregates the PRD-02 release metrics for a healthy tenant", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document", version: 3 }).ref;
    const runRef = createRecordIdentity({ tenantId, objectType: "run" }).ref;

    const staged = record.stageObject({
      tenantId,
      idempotencyKey: "stage-entity",
      actor: { kind: "agent", id: "mapping-studio" },
      ref: entityRef,
      proposedValue: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
      lens: { validAt: "2026-03-01", knownAt: "2026-02-01T10:00:00.000Z" },
      stagedAt: "2026-02-01T10:00:00.000Z",
    });
    const gate = record.requestGate({
      tenantId,
      idempotencyKey: "request-entity",
      actor: { kind: "user", id: "analyst-1" },
      stagingId: staged.stagingObject.stagingId,
      requestedAt: "2026-02-02T10:00:00.000Z",
      slaDue: "2026-02-03T10:00:00.000Z",
    }).gate;
    record.decideGate({
      tenantId,
      idempotencyKey: "approve-entity",
      actor: { kind: "user", id: "manager-1" },
      gateId: gate.gateId,
      decision: "approved",
      decidedAt: "2026-02-02T16:00:00.000Z",
    });

    record.submitAssertions({
      tenantId,
      idempotencyKey: "extract-name",
      actor: { kind: "agent", id: "extractor" },
      assertions: [
        {
          subject: { objectRef: entityRef, field: "name" },
          value: "Helios US Inc.",
          validFrom: "2026-01-01",
          source: {
            kind: "extraction",
            docRef: documentRef,
            span: { start: 4, end: 18 },
            extractorVersion: "entity-extractor@1.0.0",
          },
          confidence: 0.93,
        },
      ],
    });
    record.declareDependencies({
      tenantId,
      idempotencyKey: "doc-depends-on-entity",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: documentRef,
      upstreamRefs: [{ ref: entityRef, kind: "record-read" }],
      declaredAt: "2026-02-03T09:00:00.000Z",
    });
    record.applyGovernedEdit({
      tenantId,
      idempotencyKey: "edit-entity-name",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Legal-name correction after source review.",
      occurredAt: "2026-02-03T10:00:00.000Z",
      value: {
        name: "Helios Distribution US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });

    const content = "Golden dossier bytes\nentity=Helios Distribution US Inc.";
    const contentHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
    const manifest = record.registerManifest({
      tenantId,
      idempotencyKey: "manifest",
      actor: { kind: "system", id: "runtime" },
      jobRef: runRef,
      corpusVersion: 3,
      inputPins: [{ ref: documentRef, version: 3 }],
      outputHashes: { "dossier.pdf": contentHash },
    }).manifest;
    const artifact = record.registerArtifact({
      tenantId,
      idempotencyKey: "artifact",
      actor: { kind: "system", id: "assembler" },
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/dossier.pdf",
      contentHash,
    }).artifact;
    const tenantBRef = createRecordIdentity({ tenantId: "tenant-b", objectType: "entity" }).ref;
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
      record.getMetricsDashboard({
        tenantId,
        generatedAt: "2026-02-04T10:00:00.000Z",
        replaySamples: [{ artifactId: artifact.artifactId, renderedContent: content }],
      }),
    ).toMatchObject({
      tenantId,
      generatedAt: "2026-02-04T10:00:00.000Z",
      releaseGate: {
        status: "pass",
        invariantFailures: 0,
        blockingMetrics: [],
      },
      invariants: {
        status: "pass",
        failed: 0,
        total: 8,
      },
      provenance: {
        totalAssertions: 1,
        completenessRate: 1,
        targetCompletenessRate: 0.999,
        withinTarget: true,
        status: "pass",
      },
      replayDeterminism: {
        sampleCount: 1,
        passed: 1,
        failed: 0,
        status: "pass",
      },
      eventLag: {
        targetP95Ms: 2000,
        withinTarget: true,
        status: "pass",
      },
      stalenessPropagation: {
        propagationRuns: 1,
        dirtyFlagsCreated: 1,
        rebuildProposalsCreated: 1,
        targetP95Ms: 5000,
        withinTarget: true,
        status: "pass",
      },
      gateDecisionLatency: {
        decidedGates: 1,
        p50DecisionLatencyMs: 21_600_000,
        targetP50Ms: 86_400_000,
        withinTarget: true,
        status: "pass",
      },
      tenantCanaries: {
        crossTenantHits: 0,
        status: "pass",
      },
      eventLogPartitions: [
        expect.objectContaining({
          tenantId,
          partitionBy: "tenant_id",
          scaleOutReviewDue: false,
        }),
      ],
    });
  });

  it("blocks the release gate when replay determinism fails", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const runRef = createRecordIdentity({ tenantId, objectType: "run" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document", version: 1 }).ref;
    const content = "Filed dossier bytes v1";
    const contentHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
    const manifest = record.registerManifest({
      tenantId,
      idempotencyKey: "manifest",
      actor: { kind: "system", id: "runtime" },
      jobRef: runRef,
      corpusVersion: 1,
      inputPins: [{ ref: documentRef, version: 1 }],
      outputHashes: { "dossier.pdf": contentHash },
    }).manifest;
    const artifact = record.registerArtifact({
      tenantId,
      idempotencyKey: "artifact",
      actor: { kind: "system", id: "assembler" },
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/dossier.pdf",
      contentHash,
    }).artifact;

    const dashboard = record.getMetricsDashboard({
      tenantId,
      replaySamples: [{ artifactId: artifact.artifactId, renderedContent: "changed bytes" }],
    });

    expect(dashboard.replayDeterminism).toMatchObject({
      sampleCount: 1,
      passed: 0,
      failed: 1,
      status: "fail",
    });
    expect(dashboard.releaseGate).toMatchObject({
      status: "fail",
      invariantFailures: 0,
      blockingMetrics: ["replay-determinism"],
    });
  });
});
