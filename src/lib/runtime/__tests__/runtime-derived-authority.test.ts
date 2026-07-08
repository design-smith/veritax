import { describe, expect, it } from "vitest";

import { createRuntimeService } from "../index";

describe("Runtime derived authority", () => {
  it("allows a tool only inside the initiator capability map and declared job scope", () => {
    const runtime = createRuntimeService();
    const compiled = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "authority-check",
      kind: "agent",
      initiator: { kind: "user", ref: "user:tp-manager" },
      scope: {
        entityIds: ["entity-us"],
        jurisdictions: ["US"],
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
      },
      intentRestated: "Read the scoped record.",
      steps: [{ action: "Read the record", toolClass: "read" }],
      estDurationMs: 500,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command" },
    });
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: compiled.plan.planId,
      idempotencyKey: "authority-check-approved",
    });

    expect(
      runtime.authorizeToolUse({
        tenantId: "tenant-a",
        jobId: approved.job.jobId,
        toolName: "record.get",
        requestedScope: {
          entityIds: ["entity-us"],
          jurisdictions: ["US"],
          objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
        },
        requestedSensitivity: "confidential",
        capabilityMap: {
          toolClasses: ["read", "engine-call", "staging-write"],
          entityIds: ["entity-us", "entity-gb"],
          jurisdictions: ["US", "GB"],
          objectRefs: [
            { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" },
            { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ" },
          ],
          sensitivityCeiling: "confidential",
        },
      }),
    ).toMatchObject({
      allowed: true,
      reason: null,
      tool: { name: "record.get", capabilityClass: "read" },
    });
  });

  it("hides privileged-vault tools from non-vault capability maps", () => {
    const runtime = createRuntimeService();
    const compiled = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "vault-filter",
      kind: "agent",
      initiator: { kind: "user", ref: "user:analyst" },
      scope: {
        objectRefs: [
          { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" },
          { objectType: "blob", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ" },
        ],
      },
      intentRestated: "Review scoped evidence.",
      steps: [{ action: "Read evidence", toolClass: "read" }],
      estDurationMs: 500,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command" },
    });
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: compiled.plan.planId,
      idempotencyKey: "vault-filter-approved",
    });

    expect(
      runtime
        .listAvailableToolsForJob({
          tenantId: "tenant-a",
          jobId: approved.job.jobId,
          capabilityMap: {
            toolClasses: ["read"],
            entityIds: [],
            jurisdictions: [],
            objectRefs: [
              { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" },
              { objectType: "blob", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ" },
            ],
            sensitivityCeiling: "confidential",
          },
        })
        .map((tool) => tool.name),
    ).toContain("record.get");
    expect(
      runtime
        .listAvailableToolsForJob({
          tenantId: "tenant-a",
          jobId: approved.job.jobId,
          capabilityMap: {
            toolClasses: ["read"],
            entityIds: [],
            jurisdictions: [],
            objectRefs: [
              { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" },
              { objectType: "blob", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ" },
            ],
            sensitivityCeiling: "confidential",
          },
        })
        .map((tool) => tool.name),
    ).not.toContain("blob.read");
  });

  it("returns denial reasons for each side of the derived-authority intersection", () => {
    const runtime = createRuntimeService();
    const compiled = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "authority-denials",
      kind: "agent",
      initiator: { kind: "user", ref: "user:tp-manager" },
      scope: {
        objectRefs: [
          { objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" },
          { objectType: "blob", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ" },
        ],
      },
      intentRestated: "Review scoped records.",
      steps: [{ action: "Read evidence", toolClass: "read" }],
      estDurationMs: 500,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command" },
    });
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: compiled.plan.planId,
      idempotencyKey: "authority-denials-approved",
    });

    const outsideJob = runtime.authorizeToolUse({
      tenantId: "tenant-a",
      jobId: approved.job.jobId,
      toolName: "record.get",
      requestedScope: {
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XX" }],
      },
      requestedSensitivity: "confidential",
      capabilityMap: {
        toolClasses: ["read"],
        entityIds: [],
        jurisdictions: [],
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XX" }],
        sensitivityCeiling: "confidential",
      },
    });

    expect(outsideJob).toMatchObject({ allowed: false, reason: "scope_outside_job" });

    const capabilityMissing = runtime.authorizeToolUse({
      tenantId: "tenant-a",
      jobId: approved.job.jobId,
      toolName: "record.get",
      requestedScope: {
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
      },
      requestedSensitivity: "confidential",
      capabilityMap: {
        toolClasses: ["engine-call"],
        entityIds: [],
        jurisdictions: [],
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
        sensitivityCeiling: "confidential",
      },
    });

    expect(capabilityMissing).toMatchObject({ allowed: false, reason: "capability_missing" });

    const outsideInitiator = runtime.authorizeToolUse({
      tenantId: "tenant-a",
      jobId: approved.job.jobId,
      toolName: "record.get",
      requestedScope: {
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
      },
      requestedSensitivity: "confidential",
      capabilityMap: {
        toolClasses: ["read"],
        entityIds: [],
        jurisdictions: [],
        objectRefs: [],
        sensitivityCeiling: "confidential",
      },
    });

    expect(outsideInitiator).toMatchObject({ allowed: false, reason: "scope_outside_initiator" });

    const beyondSensitivity = runtime.authorizeToolUse({
      tenantId: "tenant-a",
      jobId: approved.job.jobId,
      toolName: "blob.read",
      requestedScope: {
        objectRefs: [{ objectType: "blob", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ" }],
      },
      requestedSensitivity: "privileged-vault",
      capabilityMap: {
        toolClasses: ["read"],
        entityIds: [],
        jurisdictions: [],
        objectRefs: [{ objectType: "blob", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XZ" }],
        sensitivityCeiling: "confidential",
      },
    });

    expect(beyondSensitivity).toMatchObject({ allowed: false, reason: "sensitivity_exceeds_capability" });

    const engine = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "engine-tool-set-denial",
      kind: "engine",
      initiator: { kind: "system", ref: "system:range-engine" },
      scope: {
        objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
      },
    });

    expect(
      runtime.authorizeToolUse({
        tenantId: "tenant-a",
        jobId: engine.job.jobId,
        toolName: "record.get",
        requestedScope: {
          objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
        },
        requestedSensitivity: "confidential",
        capabilityMap: {
          toolClasses: ["read"],
          entityIds: [],
          jurisdictions: [],
          objectRefs: [{ objectType: "record", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0XY" }],
          sensitivityCeiling: "confidential",
        },
      }),
    ).toMatchObject({ allowed: false, reason: "tool_not_allowed_for_job_kind" });
  });
});
