import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, stringifyRecordRef } from "../index";

describe("Record resolution and corpus versioning", () => {
  it("adds permanent entity aliases with provenance and a resolution event", () => {
    const record = createRecordService();
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;

    const result = record.addEntityAlias({
      tenantId: "tenant-a",
      idempotencyKey: "alias-helios-us",
      actor: { kind: "user", id: "analyst-1" },
      entityRef,
      aliasText: "Helios US",
      sourceRef: docRef,
      resolvedAt: "2026-02-02T09:00:00.000Z",
    });

    expect(result.alias).toMatchObject({
      tenantId: "tenant-a",
      aliasText: "Helios US",
      entityId: entityRef.objectId,
      entityRef,
      sourceRef: docRef,
      resolvedBy: { kind: "user", id: "analyst-1" },
      resolvedAt: "2026-02-02T09:00:00.000Z",
    });
    expect(result.event).toMatchObject({
      type: "resolution.alias_added",
      payload: {
        aliasId: result.alias.aliasId,
        aliasText: "Helios US",
        entityRef: stringifyRecordRef(entityRef),
        sourceRef: stringifyRecordRef(docRef),
      },
    });
    expect(record.listEntityAliases({ tenantId: "tenant-a", entityRef })).toEqual([result.alias]);
    expect(record.resolveEntityAlias({ tenantId: "tenant-a", aliasText: "helios us" })).toMatchObject({
      entityRef,
      alias: result.alias,
    });
  });

  it("keeps source aliases permanent while resolving them to the merge target", () => {
    const record = createRecordService();
    const sourceEntityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const targetEntityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const alias = record.addEntityAlias({
      tenantId: "tenant-a",
      idempotencyKey: "alias-helios-gmbh",
      actor: { kind: "user", id: "analyst-1" },
      entityRef: sourceEntityRef,
      aliasText: "Helios GmbH",
      resolvedAt: "2026-02-02T09:00:00.000Z",
    }).alias;

    const merge = record.mergeEntities({
      tenantId: "tenant-a",
      idempotencyKey: "merge-helios-gmbh-into-parent",
      actor: { kind: "user", id: "reviewer-1" },
      sourceEntityRef,
      targetEntityRef,
      reason: "Duplicate legal entity after connector reconciliation.",
      mergedAt: "2026-02-03T10:00:00.000Z",
    });

    expect(merge.event).toMatchObject({
      type: "resolution.merged",
      payload: {
        sourceEntityRef: stringifyRecordRef(sourceEntityRef),
        targetEntityRef: stringifyRecordRef(targetEntityRef),
        reason: "Duplicate legal entity after connector reconciliation.",
      },
    });
    expect(record.listEntityAliases({ tenantId: "tenant-a", entityRef: sourceEntityRef })).toEqual([alias]);
    expect(record.resolveEntityAlias({ tenantId: "tenant-a", aliasText: "HELIOS GMBH" })).toMatchObject({
      alias,
      entityRef: targetEntityRef,
    });
  });

  it("adds split aliases without deleting the source entity provenance", () => {
    const record = createRecordService();
    const sourceEntityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const newEntityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const retainedAlias = record.addEntityAlias({
      tenantId: "tenant-a",
      idempotencyKey: "alias-helios-parent",
      actor: { kind: "user", id: "analyst-1" },
      entityRef: sourceEntityRef,
      aliasText: "Helios Parent",
      resolvedAt: "2026-02-02T09:00:00.000Z",
    }).alias;

    const split = record.splitEntity({
      tenantId: "tenant-a",
      idempotencyKey: "split-helios-ip",
      actor: { kind: "user", id: "reviewer-1" },
      sourceEntityRef,
      newEntityRef,
      aliasTexts: ["Helios IP"],
      reason: "IP holding company was embedded in the parent source feed.",
      splitAt: "2026-02-04T11:00:00.000Z",
    });

    expect(split.event).toMatchObject({
      type: "resolution.split",
      payload: {
        sourceEntityRef: stringifyRecordRef(sourceEntityRef),
        newEntityRef: stringifyRecordRef(newEntityRef),
        reason: "IP holding company was embedded in the parent source feed.",
      },
    });
    expect(record.listEntityAliases({ tenantId: "tenant-a", entityRef: sourceEntityRef })).toEqual([retainedAlias]);
    expect(record.listEntityAliases({ tenantId: "tenant-a", entityRef: newEntityRef })).toHaveLength(1);
    expect(record.resolveEntityAlias({ tenantId: "tenant-a", aliasText: "helios ip" })).toMatchObject({
      entityRef: newEntityRef,
      alias: split.aliases[0],
    });
  });

  it("preserves every alias row across merge and split maintenance", () => {
    const record = createRecordService();
    const sourceEntityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const mergedEntityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const splitEntityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const originalAliases = ["Helios US", "Helios United States", "Helios-USA"];
    const storedOriginalAliases = originalAliases.map(
      (aliasText, index) =>
        record.addEntityAlias({
          tenantId: "tenant-a",
          idempotencyKey: `alias-${index}`,
          actor: { kind: "user", id: "analyst-1" },
          entityRef: sourceEntityRef,
          aliasText,
          resolvedAt: `2026-02-02T09:0${index}:00.000Z`,
        }).alias,
    );

    record.mergeEntities({
      tenantId: "tenant-a",
      idempotencyKey: "merge-original-aliases",
      actor: { kind: "user", id: "reviewer-1" },
      sourceEntityRef,
      targetEntityRef: mergedEntityRef,
      reason: "Consolidated duplicate entity rows.",
      mergedAt: "2026-02-03T10:00:00.000Z",
    });
    const split = record.splitEntity({
      tenantId: "tenant-a",
      idempotencyKey: "split-services-aliases",
      actor: { kind: "user", id: "reviewer-1" },
      sourceEntityRef: mergedEntityRef,
      newEntityRef: splitEntityRef,
      aliasTexts: ["Helios Services", "Helios Shared Services"],
      reason: "Services entity was separated from the merged parent.",
      splitAt: "2026-02-04T11:00:00.000Z",
    });

    expect(record.listEntityAliases({ tenantId: "tenant-a", entityRef: sourceEntityRef })).toEqual(storedOriginalAliases);
    originalAliases.forEach((aliasText) => {
      expect(record.resolveEntityAlias({ tenantId: "tenant-a", aliasText })).toMatchObject({
        entityRef: mergedEntityRef,
      });
    });
    split.aliases.forEach((alias) => {
      expect(record.resolveEntityAlias({ tenantId: "tenant-a", aliasText: alias.aliasText })).toMatchObject({
        alias,
        entityRef: splitEntityRef,
      });
    });
  });

  it("proposes and applies account mappings through resolution events", () => {
    const record = createRecordService();

    const proposal = record.proposeAccountMapping({
      tenantId: "tenant-a",
      idempotencyKey: "proposal-cash-main",
      actor: { kind: "agent", id: "connector-ledger" },
      sourceAccount: "1000-CASH",
      canonicalAccount: "cash_and_cash_equivalents",
      scope: { jurisdiction: "US", ledger: "sap-us" },
      confidence: 0.94,
      proposedAt: "2026-02-05T12:00:00.000Z",
    });

    expect(proposal.event).toMatchObject({
      type: "resolution.mapping_proposed",
      payload: {
        mappingProposalId: proposal.proposal.mappingProposalId,
        sourceAccount: "1000-CASH",
        canonicalAccount: "cash_and_cash_equivalents",
      },
    });
    expect(record.listAccountMappingProposals({ tenantId: "tenant-a" })).toEqual([proposal.proposal]);

    const applied = record.applyAccountMapping({
      tenantId: "tenant-a",
      idempotencyKey: "apply-cash-main",
      actor: { kind: "user", id: "controller-1" },
      mappingProposalId: proposal.proposal.mappingProposalId,
      approvalRef: createRecordIdentity({ tenantId: "tenant-a", objectType: "gate" }).ref.objectId,
      appliedAt: "2026-02-05T13:00:00.000Z",
    });

    expect(applied.event).toMatchObject({
      type: "resolution.mapping_applied",
      payload: {
        mappingProposalId: proposal.proposal.mappingProposalId,
        mappingId: applied.mapping.mappingId,
      },
    });
    expect(record.listAccountMappings({ tenantId: "tenant-a" })).toEqual([applied.mapping]);
    expect(record.listAccountMappingProposals({ tenantId: "tenant-a" })[0]).toMatchObject({
      mappingProposalId: proposal.proposal.mappingProposalId,
      status: "applied",
      appliedMappingId: applied.mapping.mappingId,
    });
  });

  it("increments corpus version once per committed ingestion batch", () => {
    const record = createRecordService();
    const batchRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "ingestion_batch" }).ref;
    const firstDocumentRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;
    const secondDocumentRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;

    expect(record.getCorpusVersion({ tenantId: "tenant-a" })).toEqual({
      tenantId: "tenant-a",
      version: 0,
      lastBatchRef: null,
      updatedAt: null,
    });

    const committed = record.commitIngestionBatch({
      tenantId: "tenant-a",
      idempotencyKey: "batch-feb-05",
      actor: { kind: "system", id: "ingestion-worker" },
      batchRef,
      documentRefs: [firstDocumentRef, secondDocumentRef],
      committedAt: "2026-02-05T14:00:00.000Z",
    });

    expect(committed).toMatchObject({
      corpusVersion: {
        tenantId: "tenant-a",
        version: 1,
        lastBatchRef: batchRef,
        updatedAt: "2026-02-05T14:00:00.000Z",
      },
      event: {
        type: "ingestion.versioned",
        payload: {
          corpusVersion: 1,
          batchRef: stringifyRecordRef(batchRef),
          documentCount: 2,
        },
      },
    });

    const replay = record.commitIngestionBatch({
      tenantId: "tenant-a",
      idempotencyKey: "batch-feb-05",
      actor: { kind: "system", id: "ingestion-worker" },
      batchRef,
      documentRefs: [firstDocumentRef, secondDocumentRef],
      committedAt: "2026-02-05T14:00:00.000Z",
    });
    const secondBatchRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "ingestion_batch" }).ref;
    const secondCommit = record.commitIngestionBatch({
      tenantId: "tenant-a",
      idempotencyKey: "batch-feb-06",
      actor: { kind: "system", id: "ingestion-worker" },
      batchRef: secondBatchRef,
      documentRefs: [firstDocumentRef],
      committedAt: "2026-02-06T14:00:00.000Z",
    });

    expect(replay.corpusVersion.version).toBe(1);
    expect(secondCommit.corpusVersion.version).toBe(2);
    expect(record.getCorpusVersion({ tenantId: "tenant-a" })).toMatchObject({
      version: 2,
      lastBatchRef: secondBatchRef,
    });
  });
});
