import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, createRecordUlid, stringifyRecordRef } from "../index";

describe("Record staleness dependencies", () => {
  it("declares dependency edges and emits dependency declared", () => {
    const record = createRecordService();
    const runRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const upstreamRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity", version: 2 }).ref;
    const downstreamRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document", version: 4 }).ref;

    const result = record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "deps-local-file",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef,
      upstreamRefs: [{ ref: upstreamRef, kind: "record-read" }],
      declaredAt: "2026-02-10T09:00:00.000Z",
    });

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toMatchObject({
      tenantId: "tenant-a",
      downstreamRef,
      upstreamRef,
      kind: "record-read",
      declaredByRun: runRef,
      declaredAt: "2026-02-10T09:00:00.000Z",
    });
    expect(result.event).toMatchObject({
      type: "dependency.declared",
      payload: {
        downstreamRef: stringifyRecordRef(downstreamRef),
        upstreamRefs: [stringifyRecordRef(upstreamRef)],
        dependencyIds: [result.dependencies[0].dependencyId],
      },
    });
    expect(record.listDependencies({ tenantId: "tenant-a", upstreamRef })).toEqual(result.dependencies);
    expect(record.listDependencies({ tenantId: "tenant-a", downstreamRef })).toEqual(result.dependencies);
  });

  it("declares dependency edges across downstreams in one batch and dedupes exact triples", () => {
    const record = createRecordService();
    const runRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity", version: 2 }).ref;
    const agreementRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "agreement", version: 1 }).ref;
    const ledgerRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "ledger_row", version: 3 }).ref;
    const documentRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;
    const artifactRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "artifact" }).ref;

    const result = record.declareDependenciesBatch({
      tenantId: "tenant-a",
      idempotencyKey: "batch-dependencies",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      edges: [
        {
          downstreamRef: documentRef,
          upstreamRefs: [
            { ref: entityRef, kind: "record-read" },
            { ref: agreementRef, kind: "record-read" },
            { ref: entityRef, kind: "record-read" },
          ],
        },
        {
          downstreamRef: artifactRef,
          upstreamRefs: [{ ref: agreementRef, kind: "record-read" }],
        },
        {
          downstreamRef: documentRef,
          upstreamRefs: [{ ref: entityRef, kind: "record-read" }],
        },
      ],
      declaredAt: "2026-02-10T09:05:00.000Z",
    });
    const replay = record.declareDependenciesBatch({
      tenantId: "tenant-a",
      idempotencyKey: "batch-dependencies",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      edges: [
        {
          downstreamRef: documentRef,
          upstreamRefs: [
            { ref: entityRef, kind: "record-read" },
            { ref: agreementRef, kind: "record-read" },
            { ref: entityRef, kind: "record-read" },
          ],
        },
        {
          downstreamRef: artifactRef,
          upstreamRefs: [{ ref: agreementRef, kind: "record-read" }],
        },
        {
          downstreamRef: documentRef,
          upstreamRefs: [{ ref: entityRef, kind: "record-read" }],
        },
      ],
      declaredAt: "2026-02-10T09:05:00.000Z",
    });

    expect(result.dependencies).toHaveLength(3);
    expect(replay).toEqual(result);
    expect(record.listEvents("tenant-a")).toHaveLength(1);
    expect(result.event).toMatchObject({
      type: "dependency.declared",
      payload: {
        downstreamRefs: [stringifyRecordRef(artifactRef), stringifyRecordRef(documentRef)],
        upstreamRefs: [stringifyRecordRef(agreementRef), stringifyRecordRef(entityRef)],
        dependencyIds: result.dependencies.map((dependency) => dependency.dependencyId),
      },
    });
    expect(record.listDependencies({ tenantId: "tenant-a", downstreamRef: documentRef })).toHaveLength(2);

    const newOnly = record.declareDependenciesBatch({
      tenantId: "tenant-a",
      idempotencyKey: "batch-dependencies-new-only",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      edges: [
        {
          downstreamRef: documentRef,
          upstreamRefs: [
            { ref: entityRef, kind: "record-read" },
            { ref: ledgerRef, kind: "record-read" },
          ],
        },
      ],
      declaredAt: "2026-02-10T09:06:00.000Z",
    });

    expect(newOnly.dependencies).toHaveLength(1);
    expect(newOnly.dependencies[0]).toMatchObject({
      downstreamRef: documentRef,
      upstreamRef: ledgerRef,
      kind: "record-read",
    });
  });

  it("recursively dirties downstream targets and creates a rebuild proposal after an upstream edit", () => {
    const record = createRecordService();
    const runRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;
    const artifactRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "artifact" }).ref;

    record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "doc-depends-on-entity",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: documentRef,
      upstreamRefs: [{ ref: entityRef, kind: "record-read" }],
      declaredAt: "2026-02-10T09:00:00.000Z",
    });
    record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "artifact-depends-on-doc",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: artifactRef,
      upstreamRefs: [{ ref: documentRef, kind: "record-read" }],
      declaredAt: "2026-02-10T09:01:00.000Z",
    });

    const edit = record.applyGovernedEdit({
      tenantId: "tenant-a",
      idempotencyKey: "edit-entity",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Update entity status from review.",
      occurredAt: "2026-02-10T09:02:00.000Z",
      value: {
        name: "Helios US",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });

    const dirtySet = record.getDirtySet({ tenantId: "tenant-a" });
    expect(dirtySet.flags).toHaveLength(2);
    expect(dirtySet.flags.map((flag) => stringifyRecordRef(flag.objectRef)).sort()).toEqual(
      [stringifyRecordRef(artifactRef), stringifyRecordRef(documentRef)].sort(),
    );
    expect(dirtySet.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectRef: documentRef,
          upstreamRef: entityRef,
          dirtiedByEvent: edit.event.seq,
          status: "active",
        }),
        expect.objectContaining({
          objectRef: artifactRef,
          upstreamRef: documentRef,
          dirtiedByEvent: edit.event.seq,
          status: "active",
        }),
      ]),
    );

    expect(dirtySet.proposals).toHaveLength(1);
    expect(dirtySet.proposals[0]).toMatchObject({
      status: "proposed",
      causeEvents: [edit.event.seq],
    });
    expect(dirtySet.proposals[0].targets.map((target) => stringifyRecordRef(target)).sort()).toEqual(
      [stringifyRecordRef(artifactRef), stringifyRecordRef(documentRef)].sort(),
    );
    expect(record.listEvents("tenant-a").map((event) => event.type)).toEqual(
      expect.arrayContaining(["edit.applied", "staleness.dirtied", "staleness.proposal_created"]),
    );
  });

  it("resolves rebuild proposals and clears their dirty flags", () => {
    const record = createRecordService();
    const runRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;

    record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "doc-depends-on-entity-resolve",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: documentRef,
      upstreamRefs: [{ ref: entityRef }],
    });
    record.applyGovernedEdit({
      tenantId: "tenant-a",
      idempotencyKey: "edit-entity-resolve",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Update entity name.",
      value: {
        name: "Helios Distribution US",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });
    const proposal = record.listRebuildProposals({ tenantId: "tenant-a", status: "proposed" })[0];

    const resolved = record.resolveRebuildProposal({
      tenantId: "tenant-a",
      idempotencyKey: "accept-rebuild",
      actor: { kind: "user", id: "manager-1" },
      proposalId: proposal.proposalId,
      decision: "accepted",
      reason: "Rebuild local file after entity update.",
      resolvedAt: "2026-02-10T10:00:00.000Z",
    });

    expect(resolved.proposal).toMatchObject({
      proposalId: proposal.proposalId,
      status: "accepted",
      resolvedBy: { kind: "user", id: "manager-1" },
      resolutionReason: "Rebuild local file after entity update.",
      resolvedAt: "2026-02-10T10:00:00.000Z",
    });
    expect(resolved.event).toMatchObject({
      type: "staleness.proposal_resolved",
      payload: {
        proposalId: proposal.proposalId,
        decision: "accepted",
        dirtyFlagIds: proposal.dirtyFlagIds,
      },
    });
    expect(record.getDirtySet({ tenantId: "tenant-a" }).flags).toEqual([]);
    expect(record.getDirtySet({ tenantId: "tenant-a", status: "resolved" }).flags).toHaveLength(1);
  });

  it("reports staleness propagation latency metrics", () => {
    const record = createRecordService();
    const runRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;

    record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "metric-dependency",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: documentRef,
      upstreamRefs: [{ ref: entityRef }],
    });
    record.applyGovernedEdit({
      tenantId: "tenant-a",
      idempotencyKey: "metric-edit",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Metric propagation sample.",
      occurredAt: "2026-02-10T11:00:00.000Z",
      value: {
        name: "Helios Metrics US",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });

    expect(record.getStalenessMetrics({ tenantId: "tenant-a" })).toMatchObject({
      tenantId: "tenant-a",
      propagationRuns: 1,
      dirtyFlagsCreated: 1,
      rebuildProposalsCreated: 1,
      p95PropagationLatencyMs: 0,
    });
  });

  it("queues propagation beyond the synchronous threshold and processes it later", () => {
    const record = createRecordService({ staleness: { synchronousEdgeLimit: 1 } });
    const runRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;
    const artifactRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "artifact" }).ref;

    record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "async-doc-depends-on-entity",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: documentRef,
      upstreamRefs: [{ ref: entityRef }],
    });
    record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "async-artifact-depends-on-doc",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: artifactRef,
      upstreamRefs: [{ ref: documentRef }],
    });

    const edit = record.applyGovernedEdit({
      tenantId: "tenant-a",
      idempotencyKey: "async-edit",
      actor: { kind: "user", id: "controller-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Async propagation sample.",
      occurredAt: "2026-02-10T12:00:00.000Z",
      value: {
        name: "Helios Async US",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });

    expect(record.getDirtySet({ tenantId: "tenant-a" }).flags).toEqual([]);
    expect(record.listStalenessPropagationJobs({ tenantId: "tenant-a", status: "queued" })).toEqual([
      expect.objectContaining({
        sourceEventSeq: edit.event.seq,
        sourceEventId: edit.event.eventId,
        changedRef: entityRef,
        targetCount: 2,
        status: "queued",
      }),
    ]);

    const processed = record.processStalenessPropagationQueue({
      tenantId: "tenant-a",
      processedAt: "2026-02-10T12:00:03.000Z",
    });

    expect(processed.jobs).toHaveLength(1);
    expect(processed.jobs[0]).toMatchObject({
      status: "completed",
      sourceEventSeq: edit.event.seq,
      targetCount: 2,
    });
    expect(processed.events.map((event) => event.type)).toEqual(["staleness.dirtied", "staleness.proposal_created"]);
    expect(record.getDirtySet({ tenantId: "tenant-a" }).flags).toHaveLength(2);
    expect(record.getStalenessMetrics({ tenantId: "tenant-a" })).toMatchObject({
      propagationRuns: 1,
      dirtyFlagsCreated: 2,
      rebuildProposalsCreated: 1,
      p95PropagationLatencyMs: 3000,
    });
  });
});
