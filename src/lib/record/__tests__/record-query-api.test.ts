import { describe, expect, it } from "vitest";

import {
  createRecordIdentity,
  createRecordService,
  createRecordUlid,
  isRecordError,
  recordMatchesScope,
  recordMatchesSensitivity,
  stringifyRecordRef,
} from "../index";

describe("Record query API", () => {
  it("gets a canonical ref through a tenant-scoped lens without emitting read events", () => {
    const record = createRecordService();
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const row = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-query-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-10T15:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 1,
      },
    }).row;
    const eventCountBeforeRead = record.listEvents("tenant-a").length;

    expect(
      record.getRef({
        tenantId: "tenant-a",
        access: { tenantId: "tenant-a" },
        ref: entityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      }),
    ).toEqual({
      tenantId: "tenant-a",
      ref: entityRef,
      kind: "canonical",
      lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      value: row,
    });
    expect(record.getRef({ tenantId: "tenant-b", ref: entityRef, lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" } })).toBeNull();
    expect(record.listEvents("tenant-a")).toHaveLength(eventCountBeforeRead);

    try {
      record.getRef({ tenantId: "tenant-a", access: { tenantId: "tenant-b" }, ref: entityRef, lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" } });
      throw new Error("Expected cross-tenant read to fail.");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      if (isRecordError(error)) {
        expect(error.code).toBe("TENANT_ACCESS_DENIED");
        expect(error.details).toMatchObject({
          tenantId: "tenant-a",
          accessTenantId: "tenant-b",
        });
      }
    }

    try {
      record.appendEvent({
        tenantId: "tenant-a",
        idempotencyKey: "read-event",
        actor: { kind: "system", id: "audit" },
        type: "get.read",
        payload: { objectRef: stringifyRecordRef(entityRef) },
      });
      throw new Error("Expected domain read event to fail.");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      if (isRecordError(error)) {
        expect(error.code).toBe("INVALID_EVENT_TYPE");
      }
    }
  });

  it("returns the timeline of events touching a ref without adding read events to the domain log", () => {
    const record = createRecordService();
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;
    const promoted = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "promote-timeline-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-10T15:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });
    const edited = record.applyGovernedEdit({
      tenantId: "tenant-a",
      idempotencyKey: "edit-timeline-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      reason: "Update role after review.",
      occurredAt: "2026-02-12T15:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Principal",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });
    const beforeTimelineRead = record.listEvents("tenant-a");

    expect(record.getTimeline({ tenantId: "tenant-a", access: { tenantId: "tenant-a" }, ref: entityRef })).toEqual({
      tenantId: "tenant-a",
      ref: entityRef,
      events: [promoted.event, edited.event],
    });
    expect(record.getTimeline({ tenantId: "tenant-b", ref: entityRef })).toEqual({
      tenantId: "tenant-b",
      ref: entityRef,
      events: [],
    });
    expect(record.listEvents("tenant-a")).toEqual(beforeTimelineRead);
  });

  it("returns a tenant-scoped dependency subgraph with lens-resolved node values", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const rootEntityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const counterpartyRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const flowRef = createRecordIdentity({ tenantId, objectType: "flow" }).ref;
    const approvalRef = createRecordUlid();
    const rootRow = record.promoteCanonical({
      tenantId,
      idempotencyKey: "promote-root-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: rootEntityRef,
      approvalRef,
      occurredAt: "2026-02-10T15:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    }).row;
    record.promoteCanonical({
      tenantId,
      idempotencyKey: "promote-counterparty",
      actor: { kind: "user", id: "manager-1" },
      ref: counterpartyRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-10T15:01:00.000Z",
      value: {
        name: "Helios Ireland Ltd.",
        jurisdiction: "IE",
        roleInGroup: "Principal",
        elections: {},
        status: "active",
        sensitivity: 0,
      },
    });
    const flowRow = record.promoteCanonical({
      tenantId,
      idempotencyKey: "promote-flow",
      actor: { kind: "user", id: "manager-1" },
      ref: flowRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-10T15:02:00.000Z",
      value: {
        fromEntity: rootEntityRef,
        toEntity: counterpartyRef,
        kind: "royalty",
        method: "CUT",
        policy: { rate: 0.05 },
        agreementIds: [],
        status: "active",
        sensitivity: 1,
      },
    }).row;
    const dependency = record.declareDependencies({
      tenantId,
      idempotencyKey: "flow-depends-on-root",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: createRecordIdentity({ tenantId, objectType: "run" }).ref,
      downstreamRef: flowRef,
      upstreamRefs: [{ ref: rootEntityRef, kind: "record-read" }],
      declaredAt: "2026-02-10T16:00:00.000Z",
    }).dependencies[0];
    const beforeSubgraphRead = record.listEvents(tenantId);

    expect(
      record.getSubgraph({
        tenantId,
        access: { tenantId },
        root: rootEntityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
        direction: "downstream",
        depth: 1,
      }),
    ).toEqual({
      tenantId,
      root: rootEntityRef,
      lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      nodes: [
        { ref: rootEntityRef, value: rootRow },
        { ref: flowRef, value: flowRow },
      ],
      edges: [
        {
          dependencyId: dependency.dependencyId,
          upstreamRef: rootEntityRef,
          downstreamRef: flowRef,
          kind: "record-read",
        },
      ],
    });
    expect(
      record.getSubgraph({
        tenantId: "tenant-b",
        root: rootEntityRef,
        lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      }),
    ).toMatchObject({ tenantId: "tenant-b", nodes: [], edges: [] });
    expect(record.listEvents(tenantId)).toEqual(beforeSubgraphRead);
  });

  it("exposes scope and sensitivity predicates for policy layers", () => {
    const record = createRecordService();
    const tenantId = "tenant-a";
    const entityRef = createRecordIdentity({ tenantId, objectType: "entity" }).ref;
    const documentRef = createRecordIdentity({ tenantId, objectType: "document" }).ref;
    const entityRow = record.promoteCanonical({
      tenantId,
      idempotencyKey: "promote-predicate-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-02-10T15:00:00.000Z",
      value: {
        name: "Helios US Inc.",
        jurisdiction: "US",
        roleInGroup: "Distributor",
        elections: {},
        status: "active",
        sensitivity: 1,
      },
    }).row;
    const assertion = record.submitAssertions({
      tenantId,
      idempotencyKey: "predicate-assertion",
      actor: { kind: "agent", id: "extractor" },
      assertions: [
        {
          subject: { objectRef: entityRef, field: "jurisdiction" },
          value: "US",
          validFrom: "2026-01-01",
          assertedAt: "2026-02-10T15:00:00.000Z",
          source: {
            kind: "extraction",
            docRef: documentRef,
            span: { start: 10, end: 20 },
            extractorVersion: "extractor-1",
          },
          sensitivity: 2,
          scopeKeys: {
            entityIds: [entityRef.objectId],
            jurisdictions: ["US"],
          },
        },
      ],
    }).assertions[0];

    expect(recordMatchesScope(entityRow, { entityIds: [entityRef.objectId], jurisdictions: ["US"] })).toBe(true);
    expect(recordMatchesScope(entityRow, { jurisdictions: ["IE"] })).toBe(false);
    expect(recordMatchesScope(assertion, { entityIds: [entityRef.objectId], jurisdictions: ["US"] })).toBe(true);
    expect(recordMatchesSensitivity(entityRow, { maxSensitivity: 1 })).toBe(true);
    expect(recordMatchesSensitivity(entityRow, { maxSensitivity: 0 })).toBe(false);
    expect(recordMatchesSensitivity(assertion, { maxSensitivity: 1 })).toBe(false);
    expect(recordMatchesSensitivity(assertion, { maxSensitivity: 2 })).toBe(true);
  });
});
