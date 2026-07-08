import { describe, expect, it } from "vitest";

import { createRuntimeService, RuntimeError } from "../index";

const fullOwnerCapability = {
  toolClasses: ["read" as const, "engine-call" as const, "staging-write" as const],
  entityIds: ["entity-us", "entity-ca"],
  jurisdictions: ["US", "CA"],
  objectRefs: [
    { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" },
    { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RB" },
  ],
  sensitivityCeiling: "confidential" as const,
};

describe("Runtime scheduler and watcher ownership", () => {
  it("registers a schedule and fires it into an auto-approved watcher run inside the owner scope", () => {
    const runtime = createRuntimeService();
    const registered = runtime.registerSchedule({
      tenantId: "tenant-a",
      idempotencyKey: "register-pre-close-watch",
      owner: { kind: "user", ref: "user:tp-manager" },
      trigger: {
        kind: "calendar",
        ref: "calendar:pre-close",
        cadence: "monthly",
        timezone: "America/Chicago",
        nextFireAt: "2026-06-30T14:00:00.000Z",
      },
      planTemplate: {
        kind: "agent",
        scope: {
          entityIds: ["entity-us"],
          jurisdictions: ["US"],
          objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" }],
          period: "FY2026",
        },
        intentRestated: "Run the pre-close Mirror check for US intercompany flows.",
        steps: [
          {
            action: "Read scoped US record evidence.",
            scope: { objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" }] },
            toolClass: "read",
          },
          { action: "Run range and conflict checks.", scope: { jurisdictions: ["US"] }, toolClass: "engine-call" },
        ],
        invalidationsPreview: [
          { objectType: "finding", label: "US pre-close findings", reason: "Fresh runs can dirty findings." },
        ],
        produces: [{ objectType: "finding_candidate", label: "US pre-close finding candidates" }],
        estDurationMs: 900000,
        costClass: "standard",
        instructionEcho: "Stay inside the pre-close scope.",
        permissionVerdict: { allowed: true, reason: null },
        priorityLane: "background",
      },
      registeredAt: "2026-06-19T21:00:00.000Z",
    });

    const fired = runtime.fireSchedule({
      tenantId: "tenant-a",
      scheduleId: registered.schedule.scheduleId,
      idempotencyKey: "fire-pre-close-watch",
      firedAt: "2026-06-30T14:00:00.000Z",
      ownerCapabilityMap: fullOwnerCapability,
      pins: {
        corpusVersion: 512,
        rulepackVersions: { transfer_pricing: "2026.6" },
        modelVersions: { examiner: "gpt-5.0-2026-06-01" },
      },
    });
    const replay = runtime.fireSchedule({
      tenantId: "tenant-a",
      scheduleId: registered.schedule.scheduleId,
      idempotencyKey: "fire-pre-close-watch",
      firedAt: "2026-06-30T14:00:00.000Z",
      ownerCapabilityMap: fullOwnerCapability,
      pins: {
        corpusVersion: 512,
        rulepackVersions: { transfer_pricing: "2026.6" },
        modelVersions: { examiner: "gpt-5.0-2026-06-01" },
      },
    });

    expect(replay).toEqual(fired);
    expect(registered.schedule).toMatchObject({
      tenantId: "tenant-a",
      owner: { kind: "user", ref: "user:tp-manager" },
      status: "active",
      trigger: {
        kind: "calendar",
        ref: "calendar:pre-close",
        cadence: "monthly",
        timezone: "America/Chicago",
        nextFireAt: "2026-06-30T14:00:00.000Z",
      },
    });
    expect(fired).toMatchObject({
      decision: "scheduled",
      orphan: null,
      schedule: {
        scheduleId: registered.schedule.scheduleId,
        status: "active",
        lastFiredAt: "2026-06-30T14:00:00.000Z",
        lastJobId: fired.job!.jobId,
      },
      plan: {
        status: "approved",
        source: { kind: "schedule_ref", ref: registered.schedule.scheduleId },
        approvedJobId: fired.job!.jobId,
      },
      job: {
        kind: "agent",
        initiator: { kind: "watcher", ref: `schedule:${registered.schedule.scheduleId}` },
        scope: {
          entityIds: ["entity-us"],
          jurisdictions: ["US"],
          objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" }],
          period: "FY2026",
        },
        priorityLane: "background",
        status: "queued",
        pins: {
          corpusVersion: 512,
          rulepackVersions: { transfer_pricing: "2026.6" },
          modelVersions: { examiner: "gpt-5.0-2026-06-01" },
        },
      },
    });
    expect(runtime.getSchedule({ tenantId: "tenant-a", scheduleId: registered.schedule.scheduleId })).toEqual(
      fired.schedule,
    );
    expect(runtime.getPlan({ tenantId: "tenant-a", planId: fired.plan!.planId })).toEqual(fired.plan);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: fired.job!.jobId })).toEqual(fired.job);
  });

  it("orphan-pauses a watcher when the live owner capability map no longer covers the template scope", () => {
    const runtime = createRuntimeService();
    const schedule = runtime.registerSchedule({
      tenantId: "tenant-a",
      idempotencyKey: "register-na-watch",
      owner: { kind: "user", ref: "user:tp-manager" },
      trigger: {
        kind: "record-change",
        ref: "record:flow-changed",
        cadence: "event",
        timezone: "UTC",
      },
      planTemplate: {
        kind: "agent",
        scope: {
          entityIds: ["entity-us", "entity-ca"],
          jurisdictions: ["US", "CA"],
          objectRefs: [
            { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" },
            { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RB" },
          ],
          period: "FY2026",
        },
        intentRestated: "Watch North America flows for fresh conflicts.",
        steps: [{ action: "Read North America scoped records.", toolClass: "read" }],
        invalidationsPreview: [],
        produces: [{ objectType: "finding_candidate", label: "North America conflict candidates" }],
        estDurationMs: 600000,
        costClass: "standard",
        instructionEcho: "",
        permissionVerdict: { allowed: true, reason: null },
      },
    }).schedule;

    const orphaned = runtime.fireSchedule({
      tenantId: "tenant-a",
      scheduleId: schedule.scheduleId,
      idempotencyKey: "fire-na-watch-with-lost-scope",
      firedAt: "2026-06-19T21:30:00.000Z",
      ownerCapabilityMap: {
        ...fullOwnerCapability,
        entityIds: ["entity-us"],
        jurisdictions: ["US"],
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" }],
      },
    });

    expect(orphaned).toMatchObject({
      decision: "orphaned",
      plan: null,
      job: null,
      orphan: {
        reason: "owner_scope_lost",
        previousOwner: { kind: "user", ref: "user:tp-manager" },
        reassignmentPrompt: {
          target: "workspace-owner",
          message: "Watcher owner no longer has the scope required by this schedule.",
        },
      },
      schedule: {
        scheduleId: schedule.scheduleId,
        status: "orphaned",
        orphanedAt: "2026-06-19T21:30:00.000Z",
        lastJobId: null,
      },
    });
    expect(runtime.listSchedules({ tenantId: "tenant-a", status: "orphaned" })).toEqual([orphaned.schedule]);
    expect(runtime.listRuns({ tenantId: "tenant-a" })).toEqual([]);
  });

  it("reassigns an orphaned watcher after the new owner capability map covers the template scope", () => {
    const runtime = createRuntimeService();
    const schedule = runtime.registerSchedule({
      tenantId: "tenant-a",
      idempotencyKey: "register-reassignable-watch",
      owner: { kind: "user", ref: "user:departing-manager" },
      trigger: {
        kind: "calendar",
        ref: "calendar:safe-harbour-retest",
        cadence: "quarterly",
        timezone: "America/Chicago",
      },
      planTemplate: {
        kind: "agent",
        scope: {
          jurisdictions: ["US"],
          objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" }],
          period: "FY2026",
        },
        intentRestated: "Retest US safe-harbour support.",
        steps: [
          {
            action: "Read the US safe-harbour evidence.",
            scope: { objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0RA" }] },
            toolClass: "read",
          },
        ],
        invalidationsPreview: [],
        produces: [{ objectType: "finding_candidate", label: "US safe-harbour retest candidate" }],
        estDurationMs: 600000,
        costClass: "standard",
        instructionEcho: "",
        permissionVerdict: { allowed: true, reason: null },
      },
    }).schedule;

    runtime.fireSchedule({
      tenantId: "tenant-a",
      scheduleId: schedule.scheduleId,
      idempotencyKey: "orphan-before-reassign",
      firedAt: "2026-06-19T21:30:00.000Z",
      ownerCapabilityMap: {
        toolClasses: ["read"],
        entityIds: [],
        jurisdictions: [],
        objectRefs: [],
        sensitivityCeiling: "confidential",
      },
    });

    expect(() =>
      runtime.reassignSchedule({
        tenantId: "tenant-a",
        scheduleId: schedule.scheduleId,
        idempotencyKey: "bad-reassign",
        actor: { kind: "user", ref: "user:workspace-owner" },
        newOwner: { kind: "user", ref: "user:tp-manager-2" },
        ownerCapabilityMap: {
          toolClasses: ["read"],
          entityIds: [],
          jurisdictions: [],
          objectRefs: [],
          sensitivityCeiling: "confidential",
        },
      }),
    ).toThrow(RuntimeError);

    const reassigned = runtime.reassignSchedule({
      tenantId: "tenant-a",
      scheduleId: schedule.scheduleId,
      idempotencyKey: "good-reassign",
      actor: { kind: "user", ref: "user:workspace-owner" },
      newOwner: { kind: "user", ref: "user:tp-manager-2" },
      ownerCapabilityMap: fullOwnerCapability,
      reassignedAt: "2026-06-19T22:00:00.000Z",
    });
    const fired = runtime.fireSchedule({
      tenantId: "tenant-a",
      scheduleId: schedule.scheduleId,
      idempotencyKey: "fire-reassigned-watch",
      firedAt: "2026-06-19T22:05:00.000Z",
      ownerCapabilityMap: fullOwnerCapability,
    });

    expect(reassigned.schedule).toMatchObject({
      status: "active",
      owner: { kind: "user", ref: "user:tp-manager-2" },
      orphanedAt: null,
      orphan: null,
      updatedAt: "2026-06-19T22:00:00.000Z",
    });
    expect(fired.decision).toBe("scheduled");
    expect(fired.job).toMatchObject({
      initiator: { kind: "watcher", ref: `schedule:${schedule.scheduleId}` },
      status: "queued",
    });
  });
});
