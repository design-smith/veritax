import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, createRecordUlid } from "../../record";
import { createRuntimeService } from "../index";

describe("Runtime operational metrics", () => {
  it("requires a kill-switch drill to recover before reporting it as passed", () => {
    const runtime = createRuntimeService();

    runtime.setKillSwitch({
      tenantId: "tenant-a",
      idempotencyKey: "start-quarterly-drill",
      actor: { kind: "user", ref: "user:ops-lead" },
      scope: { kind: "tenant" },
      enabled: true,
      reason: "Quarterly kill-switch drill started.",
      changedAt: "2026-06-01T12:00:00.000Z",
    });

    expect(
      runtime.getOperationalMetrics({
        tenantId: "tenant-a",
        asOf: "2026-06-01T12:04:00.000Z",
        killSwitchDrillWindowDays: 90,
      }).killSwitchDrill,
    ).toEqual({
      windowDays: 90,
      lastDrillAt: null,
      passed: false,
    });

    runtime.setKillSwitch({
      tenantId: "tenant-a",
      idempotencyKey: "recover-quarterly-drill",
      actor: { kind: "user", ref: "user:ops-lead" },
      scope: { kind: "tenant" },
      enabled: false,
      reason: "Quarterly kill-switch drill recovered.",
      changedAt: "2026-06-01T12:05:00.000Z",
    });

    expect(
      runtime.getOperationalMetrics({
        tenantId: "tenant-a",
        asOf: "2026-06-01T12:06:00.000Z",
        killSwitchDrillWindowDays: 90,
      }).killSwitchDrill,
    ).toEqual({
      windowDays: 90,
      lastDrillAt: "2026-06-01T12:05:00.000Z",
      passed: true,
    });
  });

  it("reports PRD-05 operational metrics from real runtime state", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });

    const original = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "metrics-original-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US"], period: "FY2026" },
      intentRestated: "Scan US support.",
      steps: [{ action: "Read US evidence.", toolClass: "read" }],
      estDurationMs: 600000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:metrics" },
    }).plan;
    const edited = runtime.editPlan({
      tenantId: "tenant-a",
      planId: original.planId,
      idempotencyKey: "metrics-edited-plan",
      scope: { jurisdictions: ["US", "CA"], period: "FY2026" },
      intentRestated: "Scan US and Canada support.",
      steps: [{ action: "Read North America evidence.", toolClass: "read" }],
      estDurationMs: 900000,
      costClass: "heavy",
      permissionVerdict: { allowed: true, reason: null },
    }).plan;
    const editedJob = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: edited.planId,
      idempotencyKey: "metrics-approve-edited-plan",
    }).job;
    const directPlan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "metrics-direct-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["GB"], period: "FY2026" },
      intentRestated: "Scan UK support.",
      steps: [{ action: "Read UK evidence.", toolClass: "read" }],
      estDurationMs: 300000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:metrics" },
    }).plan;
    const directJob = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: directPlan.planId,
      idempotencyKey: "metrics-approve-direct-plan",
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: editedJob.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: editedJob.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: editedJob.jobId,
      stepId: "step-heavy-metrics",
      type: "tool",
      t0: "2026-06-19T18:00:00.000Z",
      t1: "2026-06-19T18:00:02.000Z",
      cost: { tokens: 400, toolCalls: 1, costWeight: 3 },
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: editedJob.jobId, status: "producing" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: editedJob.jobId, status: "completed" });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: directJob.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: directJob.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: directJob.jobId,
      stepId: "step-standard-metrics",
      type: "engine",
      t0: "2026-06-19T18:05:00.000Z",
      t1: "2026-06-19T18:05:01.500Z",
      cost: { tokens: 100, toolCalls: 1, engineCalls: 1, costWeight: 1 },
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: directJob.jobId, status: "producing" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: directJob.jobId, status: "completed" });

    const { ref: approvedRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const { ref: escalatedRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    [approvedRef, escalatedRef].forEach((ref, index) => {
      record.promoteCanonical({
        tenantId: "tenant-a",
        idempotencyKey: `seed-metrics-entity-${index}`,
        actor: { kind: "user", id: "manager-1" },
        ref,
        approvalRef: createRecordUlid(),
        occurredAt: "2026-06-19T19:00:00.000Z",
        value: {
          name: `Metrics Entity ${index}`,
          jurisdiction: "US",
          roleInGroup: "Distributor",
          status: "active",
        },
      });
    });
    const gateJob = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "metrics-gate-job",
      kind: "pipeline",
      initiator: { kind: "user", ref: "user:analyst-1" },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: gateJob.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: gateJob.jobId, status: "running" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: gateJob.jobId, status: "producing" });
    const approvedGate = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: gateJob.jobId,
      idempotencyKey: "metrics-stage-approved-gate",
      outputRef: approvedRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0SA" },
      writtenAt: "2026-06-19T19:10:00.000Z",
      promotion: {
        proposedValue: { name: "Metrics Entity 0", jurisdiction: "US", status: "active", roleInGroup: "Principal" },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T19:10:00.000Z" },
        slaDue: "2026-06-20T19:10:00.000Z",
      },
    }).gate!;
    runtime.decideGate({
      tenantId: "tenant-a",
      jobId: gateJob.jobId,
      gateId: approvedGate.gateId,
      idempotencyKey: "metrics-approve-gate",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-19T20:10:00.000Z",
    });
    const escalatedGate = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: gateJob.jobId,
      idempotencyKey: "metrics-stage-escalated-gate",
      outputRef: escalatedRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0SB" },
      writtenAt: "2026-06-19T21:00:00.000Z",
      promotion: {
        proposedValue: { name: "Metrics Entity 1", jurisdiction: "US", status: "active", roleInGroup: "Principal" },
        lens: { validAt: "2026-06-19", knownAt: "2026-06-19T21:00:00.000Z" },
        slaDue: "2026-06-20T21:00:00.000Z",
      },
    }).gate!;
    runtime.escalateGate({
      tenantId: "tenant-a",
      jobId: gateJob.jobId,
      gateId: escalatedGate.gateId,
      idempotencyKey: "metrics-escalate-gate",
      actor: { kind: "system", ref: "gate-sla" },
      escalatedTo: "vp-tax",
      escalatedAt: "2026-06-20T22:00:00.000Z",
      reason: "SLA breached.",
    });

    const schedule = runtime.registerSchedule({
      tenantId: "tenant-a",
      idempotencyKey: "metrics-register-schedule",
      owner: { kind: "user", ref: "user:departing-manager" },
      trigger: {
        kind: "calendar",
        ref: "period-close",
        cadence: "quarterly",
        timezone: "America/Chicago",
        nextFireAt: "2026-06-19T14:00:00.000Z",
      },
      planTemplate: {
        kind: "agent",
        scope: { jurisdictions: ["DE"], period: "FY2026" },
        intentRestated: "Run German close watcher.",
        steps: [{ action: "Read German close evidence.", toolClass: "read", scope: { jurisdictions: ["DE"] } }],
        estDurationMs: 600000,
        costClass: "standard",
        priorityLane: "batch",
      },
      registeredAt: "2026-06-18T14:00:00.000Z",
    }).schedule;
    runtime.fireSchedule({
      tenantId: "tenant-a",
      scheduleId: schedule.scheduleId,
      idempotencyKey: "metrics-orphan-schedule",
      ownerCapabilityMap: {
        toolClasses: ["read"],
        entityIds: [],
        jurisdictions: ["US"],
        objectRefs: [],
        sensitivityCeiling: "confidential",
      },
      firedAt: "2026-06-19T14:00:00.000Z",
    });
    runtime.reassignSchedule({
      tenantId: "tenant-a",
      scheduleId: schedule.scheduleId,
      idempotencyKey: "metrics-reassign-schedule",
      actor: { kind: "user", ref: "user:workspace-owner" },
      newOwner: { kind: "user", ref: "user:tp-manager-2" },
      ownerCapabilityMap: {
        toolClasses: ["read"],
        entityIds: [],
        jurisdictions: ["DE"],
        objectRefs: [],
        sensitivityCeiling: "confidential",
      },
      reassignedAt: "2026-06-19T15:30:00.000Z",
    });

    runtime.setKillSwitch({
      tenantId: "tenant-a",
      idempotencyKey: "metrics-kill-switch-drill-start",
      actor: { kind: "user", ref: "user:ops-lead" },
      scope: { kind: "tenant" },
      enabled: true,
      reason: "Quarterly kill-switch drill started.",
      changedAt: "2026-06-01T12:00:00.000Z",
    });
    runtime.setKillSwitch({
      tenantId: "tenant-a",
      idempotencyKey: "metrics-kill-switch-drill-recovered",
      actor: { kind: "user", ref: "user:ops-lead" },
      scope: { kind: "tenant" },
      enabled: false,
      reason: "Quarterly kill-switch drill recovered.",
      changedAt: "2026-06-01T12:05:00.000Z",
    });

    expect(
      runtime.getOperationalMetrics({
        tenantId: "tenant-a",
        asOf: "2026-06-19T23:00:00.000Z",
        killSwitchDrillWindowDays: 90,
      }),
    ).toMatchObject({
      planFidelity: {
        approvedPlanCount: 2,
        editedBeforeApprovalCount: 1,
        editedBeforeApprovalRate: 0.5,
      },
      traceCompleteness: {
        completedExecutableRunCount: 2,
        completedWithTraceCount: 2,
        violationCount: 0,
        rate: 1,
      },
      gateLatency: {
        requestedGateCount: 2,
        decidedGateCount: 1,
        p50Ms: 3600000,
        p95Ms: 3600000,
        escalatedGateCount: 1,
        escalationRate: 0.5,
      },
      costByClass: {
        heavy: {
          jobCount: 1,
          tokens: 400,
          toolCalls: 1,
          engineCalls: 0,
          modelCalls: 0,
          wallclockMs: 2000,
          costWeight: 3,
        },
        standard: {
          jobCount: 1,
          tokens: 100,
          toolCalls: 1,
          engineCalls: 1,
          modelCalls: 0,
          wallclockMs: 1500,
          costWeight: 1,
        },
      },
      watcherOrphans: {
        orphanedCount: 1,
        reassignedCount: 1,
        averageResolutionMs: 5400000,
      },
      killSwitchDrill: {
        windowDays: 90,
        lastDrillAt: "2026-06-01T12:05:00.000Z",
        passed: true,
      },
      canonicalWriteGuard: {
        outsidePromotePathViolations: 0,
      },
    });
  });
});
