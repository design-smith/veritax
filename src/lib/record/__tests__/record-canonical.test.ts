import { describe, expect, it } from "vitest";

import {
  createRecordIdentity,
  createRecordService,
  createRecordUlid,
  isRecordError,
  RecordError,
  stringifyRecordRef,
} from "../index";

describe("Record canonical tables", () => {
  it("promotes canonical entity rows with approval, last_change_event, and lens reads", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const approvalRef = createRecordUlid();

    const result = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-helios-us",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef,
      occurredAt: "2026-02-10T15:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Limited-risk distributor",
        elections: { sbc: true },
        status: "active",
        sensitivity: 1,
      },
    });

    expect(result.event).toMatchObject({
      seq: 1,
      type: "canonical.promoted",
      occurredAt: "2026-02-10T15:00:00.000Z",
      payload: {
        objectRef: stringifyRecordRef(entityRef),
        approvalRef,
      },
    });
    expect(result.row).toMatchObject({
      tenantId: "tenant-a",
      objectType: "entity",
      ref: entityRef,
      entityId: entityRef.objectId,
      name: "Helios US Inc.",
      jurisdiction: "US",
      roleInGroup: "Limited-risk distributor",
      elections: { sbc: true },
      status: "active",
      sensitivity: 1,
      approvalKind: "gate",
      approvalRef,
      lastChangeEvent: 1,
      lastChangeEventId: result.event.eventId,
      lastChangedAt: "2026-02-10T15:00:00.000Z",
    });

    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-09T12:00:00.000Z" },
      }),
    ).toBeNull();
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      }),
    ).toEqual(result.row);
    expect(
      record.listCanonical({
        tenantId: "tenant-a",
        objectType: "entity",
        lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      }),
    ).toEqual([result.row]);
  });

  it("promotes the PRD canonical object table shapes", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const manager = { kind: "user" as const, id: "manager-1" };
    const fromEntity = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const toEntity = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const agreementRef = createRecordIdentity({ tenantId, objectType: "agreement" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document" }).ref;
    const periodRef = createRecordIdentity({ tenantId, objectType: "period" }).ref;
    const flowRef = createRecordIdentity({ tenantId, objectType: "flow" }).ref;

    const cases = [
      {
        ref: flowRef,
        value: {
          fromEntity,
          toEntity,
          kind: "royalty",
          method: "CUT",
          policy: { rate: 0.05 },
          agreementIds: [agreementRef.objectId],
          status: "active",
        },
        expected: {
          flowId: flowRef.objectId,
          fromEntity: stringifyRecordRef(fromEntity),
          toEntity: stringifyRecordRef(toEntity),
          kind: "royalty",
        },
      },
      {
        ref: agreementRef,
        value: {
          parties: [fromEntity, toEntity],
          kind: "license",
          effective: "2026-01-01",
          terminates: null,
          execStatus: "executed",
          docRef: documentRef,
          terms: { royaltyRate: 0.05 },
        },
        expected: {
          agreementId: agreementRef.objectId,
          parties: [stringifyRecordRef(fromEntity), stringifyRecordRef(toEntity)],
          execStatus: "executed",
        },
      },
      {
        ref: documentRef,
        value: {
          docType: "local_file",
          jurisdiction: "US",
          periodId: periodRef,
          lang: "en",
          status: "generated",
          outline: { sections: ["Executive summary"] },
        },
        expected: {
          docId: documentRef.objectId,
          docType: "local_file",
          periodId: stringifyRecordRef(periodRef),
        },
      },
      {
        ref: createRecordIdentity({ tenantId, objectType: "doc_section" }).ref,
        value: {
          docId: documentRef,
          position: 1,
          contentBlobRef: "blob://local-file/section-1",
          contentHash: "sha256:abc123",
          inputChips: [stringifyRecordRef(agreementRef)],
          version: 1,
          status: "generated",
        },
        expected: {
          docId: stringifyRecordRef(documentRef),
          position: 1,
          version: 1,
          status: "generated",
        },
      },
      {
        ref: createRecordIdentity({ tenantId, objectType: "finding" }).ref,
        value: {
          severity: "material",
          ruleId: "R-201",
          state: "open",
          flowRef,
          exposure: { amount: 1200000, currency: "USD" },
          exhibitRefs: [documentRef],
          confidence: 0.83,
          assignee: "analyst-1",
          reviewer: { userId: "manager-1" },
        },
        expected: {
          severity: "material",
          ruleId: "R-201",
          flowRef: stringifyRecordRef(flowRef),
          confidence: 0.83,
        },
      },
      {
        ref: createRecordIdentity({ tenantId, objectType: "obligation" }).ref,
        value: {
          entityId: fromEntity,
          jurisdiction: "US",
          dueAt: "2026-09-15T04:59:59.000Z",
          dueTz: "America/Chicago",
          owner: "manager-1",
          status: "open",
          artifactRef: documentRef,
          filingEvidenceRef: null,
          source: "rulepack",
        },
        expected: {
          entityId: stringifyRecordRef(fromEntity),
          jurisdiction: "US",
          dueAt: "2026-09-15T04:59:59.000Z",
          source: "rulepack",
        },
      },
      {
        ref: periodRef,
        value: {
          fy: "FY2026",
          quarter: null,
          status: "open",
          sealedEvent: null,
        },
        expected: {
          periodId: periodRef.objectId,
          fy: "FY2026",
          status: "open",
        },
      },
      {
        ref: createRecordIdentity({ tenantId, objectType: "instruction" }).ref,
        value: {
          tier: 2,
          scope: { jurisdictions: ["US"], entities: [fromEntity.objectId] },
          text: "Apply the SBC election for Ireland where the rulepack allows it.",
          compiled: { engineFlags: ["sbc-election"] },
          status: "approved",
          author: "manager-1",
          approvedBy: "vp-tax",
        },
        expected: {
          tier: 2,
          status: "approved",
          author: "manager-1",
        },
      },
    ];

    const rows = cases.map((canonicalCase, index) => {
      const result = record.promoteCanonical({
        tenantId,
        idempotencyKey: `promote-${canonicalCase.ref.objectType}-${index}`,
        actor: manager,
        ref: canonicalCase.ref,
        approvalRef: createRecordUlid(),
        occurredAt: `2026-02-10T15:${String(index).padStart(2, "0")}:00.000Z`,
        value: canonicalCase.value,
      });

      expect(result.row).toMatchObject(canonicalCase.expected);
      return result.row;
    });

    expect(
      record.listCanonical({
        tenantId,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-10T16:00:00.000Z" },
      }),
    ).toEqual(expect.arrayContaining(rows));
  });

  it("applies governed edits with approval refs while preserving historical canonical lenses", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    const promoted = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-10T10:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });

    const editCommand = {
      tenantId: "tenant-a",
      idempotencyKey: "edit-role",
      actor: { kind: "user" as const, id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "approved entity-resolution correction",
      occurredAt: "2026-02-12T10:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Principal",
        status: "active",
      },
    };

    const edited = record.applyGovernedEdit(editCommand);
    const replay = record.applyGovernedEdit(editCommand);

    expect(replay).toEqual(edited);
    expect(edited.event).toMatchObject({
      seq: 2,
      type: "edit.applied",
      payload: {
        objectRef: stringifyRecordRef(entityRef),
        approvalRef: editCommand.approvalRef,
        reason: "approved entity-resolution correction",
      },
    });
    expect(edited.row).toMatchObject({
      roleInGroup: "Principal",
      approvalKind: "governed_edit",
      approvalRef: editCommand.approvalRef,
      lastChangeEvent: 2,
      lastChangeEventId: edited.event.eventId,
    });

    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      }),
    ).toEqual(promoted.row);
    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-13T12:00:00.000Z" },
      }),
    ).toEqual(edited.row);
  });

  it("refuses canonical mutations and canonical events without approval refs", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });

    try {
      record.promoteCanonical({
        tenantId: "tenant-a",
        idempotencyKey: "missing-approval",
        actor: { kind: "user", id: "manager-1" },
        ref: entityRef,
        approvalRef: "",
        value: {
          name: "Helios US Inc.",
          jurisdiction: "US",
          roleInGroup: "Distributor",
          status: "active",
        },
      });
      throw new Error("expected missing approval ref to fail");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      expect(error).toBeInstanceOf(RecordError);
      expect((error as RecordError).code).toBe("CANONICAL_APPROVAL_REQUIRED");
    }

    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-13T12:00:00.000Z" },
      }),
    ).toBeNull();
    expect(record.listEvents("tenant-a")).toEqual([]);
    expect(record.readOutbox("tenant-a")).toEqual([]);

    expect(() =>
      record.appendEvent({
        tenantId: "tenant-a",
        idempotencyKey: "raw-canonical",
        actor: { kind: "system", id: "record-seed" },
        type: "canonical.promoted",
        payload: {
          objectRef: stringifyRecordRef(entityRef),
        },
      }),
    ).toThrow(/approvalRef/i);
    expect(record.listEvents("tenant-a")).toEqual([]);
  });

  it("refuses governed edits without a reason before mutating canonical state", () => {
    const record = createRecordService();
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const promoted = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-10T10:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        status: "active",
      },
    });

    expect(() =>
      record.applyGovernedEdit({
        tenantId: "tenant-a",
        idempotencyKey: "edit-no-reason",
        actor: { kind: "user", id: "manager-1" },
        ref: entityRef,
        approvalRef: createRecordUlid(),
        reason: "",
        value: {
          name: "Helios US Inc.",
          jurisdiction: "US",
          roleInGroup: "Principal",
          status: "active",
        },
      }),
    ).toThrow(RecordError);

    expect(
      record.getCanonical({
        tenantId: "tenant-a",
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-12T12:00:00.000Z" },
      }),
    ).toEqual(promoted.row);
    expect(record.listEvents("tenant-a").map((event) => event.type)).toEqual(["canonical.promoted"]);
  });
});
