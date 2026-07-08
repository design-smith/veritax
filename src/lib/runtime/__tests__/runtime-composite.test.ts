import { describe, expect, it } from "vitest";

import { createRuntimeService } from "../index";

describe("Runtime composite jobs", () => {
  it("submits a composite job as a DAG of real child jobs with an aggregate manifest", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-dossier-plan",
      kind: "composite",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["DE", "UK"], period: "FY2026" },
      intentRestated: "Build the annual dossier sections for Germany and the United Kingdom.",
      steps: [
        { action: "Run the German local file engine.", toolClass: "engine-call", scope: { jurisdictions: ["DE"] } },
        { action: "Run the UK benchmark pipeline.", toolClass: "engine-call", scope: { jurisdictions: ["UK"] } },
      ],
      invalidationsPreview: [],
      produces: [{ objectType: "artifact", label: "Annual dossier workpack" }],
      estDurationMs: 3600000,
      costClass: "heavy",
      instructionEcho: "Use signed FY2026 agreements only.",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "make:all" },
    }).plan;

    const submitted = runtime.submitCompositeJob({
      tenantId: "tenant-a",
      idempotencyKey: "submit-dossier-composite",
      planRef: plan.planRef,
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["DE", "UK"], period: "FY2026" },
      priorityLane: "batch",
      childJobs: [
        {
          key: "de-local-file",
          kind: "engine",
          scope: { jurisdictions: ["DE"], period: "FY2026" },
          dependsOn: [],
        },
        {
          key: "uk-benchmark",
          kind: "pipeline",
          scope: { jurisdictions: ["UK"], period: "FY2026" },
          dependsOn: ["de-local-file"],
        },
      ],
    });
    const replay = runtime.submitCompositeJob({
      tenantId: "tenant-a",
      idempotencyKey: "submit-dossier-composite",
      planRef: plan.planRef,
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["DE", "UK"], period: "FY2026" },
      priorityLane: "batch",
      childJobs: [
        {
          key: "de-local-file",
          kind: "engine",
          scope: { jurisdictions: ["DE"], period: "FY2026" },
          dependsOn: [],
        },
        {
          key: "uk-benchmark",
          kind: "pipeline",
          scope: { jurisdictions: ["UK"], period: "FY2026" },
          dependsOn: ["de-local-file"],
        },
      ],
    });

    expect(replay).toEqual(submitted);
    expect(submitted.job).toMatchObject({
      tenantId: "tenant-a",
      kind: "composite",
      parentJobId: null,
      planRef: plan.planRef,
      priorityLane: "batch",
      status: "queued",
    });
    expect(submitted.children).toHaveLength(2);
    expect(submitted.children.map((child) => child.job.kind)).toEqual(["engine", "pipeline"]);
    expect(submitted.children.map((child) => child.key)).toEqual(["de-local-file", "uk-benchmark"]);
    expect(submitted.children[0].job.parentJobId).toBe(submitted.job.jobId);
    expect(submitted.children[1].dependsOn).toEqual(["de-local-file"]);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: submitted.children[0].job.jobId })).toEqual(
      submitted.children[0].job,
    );
    expect(runtime.getCompositeManifest({ tenantId: "tenant-a", jobId: submitted.job.jobId })).toEqual({
      parentJobId: submitted.job.jobId,
      failFast: false,
      childJobs: [
        { key: "de-local-file", jobId: submitted.children[0].job.jobId, dependsOn: [] },
        { key: "uk-benchmark", jobId: submitted.children[1].job.jobId, dependsOn: ["de-local-file"] },
      ],
      statusByKey: {
        "de-local-file": "queued",
        "uk-benchmark": "queued",
      },
      completedChildKeys: [],
      failedChildKeys: [],
      cancelledChildKeys: [],
      terminal: false,
    });
  });

  it("dispatches only ready composite leaf jobs after their dependencies complete", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-composite-dispatch-plan",
      kind: "composite",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["DE", "UK"], period: "FY2026" },
      intentRestated: "Run dependent dossier branches in dependency order.",
      steps: [
        { action: "Build the German local file first.", toolClass: "engine-call", scope: { jurisdictions: ["DE"] } },
        { action: "Run the UK benchmark after Germany completes.", toolClass: "engine-call", scope: { jurisdictions: ["UK"] } },
      ],
      invalidationsPreview: [],
      produces: [
        {
          objectType: "artifact",
          label: "Ordered dossier branches",
          reason: "Both branches are required for the ordered dossier package.",
        },
      ],
      estDurationMs: 1800000,
      costClass: "heavy",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "make:ordered-branches" },
    }).plan;
    const submitted = runtime.submitCompositeJob({
      tenantId: "tenant-a",
      idempotencyKey: "submit-composite-dispatch-order",
      planRef: plan.planRef,
      initiator: { kind: "user", ref: "user:manager-1" },
      priorityLane: "standard",
      childJobs: [
        { key: "de-local-file", kind: "engine", priorityLane: "standard" },
        { key: "uk-benchmark", kind: "pipeline", priorityLane: "interactive", dependsOn: ["de-local-file"] },
      ],
    });
    const firstChild = submitted.children[0].job;
    const dependentChild = submitted.children[1].job;

    const firstClaim = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-first-ready-composite-child",
      workerId: "worker-a",
      lanes: ["interactive", "standard"],
      claimedAt: "2026-06-20T05:00:00.000Z",
    });
    const blockedClaim = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-before-composite-dependency-completes",
      workerId: "worker-b",
      lanes: ["interactive", "standard"],
      claimedAt: "2026-06-20T05:01:00.000Z",
    });

    expect(firstClaim.job?.jobId).toBe(firstChild.jobId);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: submitted.job.jobId })?.status).toBe("queued");
    expect(blockedClaim).toEqual({ job: null, claim: null });

    runtime.transitionJob({ tenantId: "tenant-a", jobId: firstChild.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: firstChild.jobId,
      stepId: "step-run-de-local-file-engine",
      type: "engine",
      toolName: "engine.local_file",
      resultRef: { objectType: "engine_result", objectId: "01KVKH6GZ85CKWWV3GEGB9JQ0A" },
      t0: "2026-06-20T05:02:00.000Z",
      t1: "2026-06-20T05:03:00.000Z",
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: firstChild.jobId, status: "producing" });
    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: firstChild.jobId,
      status: "completed",
      transitionedAt: "2026-06-20T05:04:00.000Z",
    });

    const secondClaim = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-dependent-composite-child",
      workerId: "worker-b",
      lanes: ["interactive", "standard"],
      claimedAt: "2026-06-20T05:05:00.000Z",
    });

    expect(secondClaim.job?.jobId).toBe(dependentChild.jobId);
    expect(runtime.getCompositeManifest({ tenantId: "tenant-a", jobId: submitted.job.jobId })).toMatchObject({
      statusByKey: {
        "de-local-file": "completed",
        "uk-benchmark": "planning",
      },
      completedChildKeys: ["de-local-file"],
      terminal: false,
    });
  });

  it("cancels descendants blocked by a failed prerequisite while independent siblings continue", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-partial-composite-failure-plan",
      kind: "composite",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["DE", "UK", "FR"], period: "FY2026" },
      intentRestated: "Run a dossier DAG while preserving independent work after a branch failure.",
      steps: [
        { action: "Build the German source branch.", toolClass: "engine-call" },
        { action: "Build the UK branch from the German result.", toolClass: "engine-call" },
        { action: "Build the independent French branch.", toolClass: "engine-call" },
      ],
      invalidationsPreview: [],
      produces: [
        {
          objectType: "artifact",
          label: "Partially independent dossier DAG",
          reason: "The package contains one dependent branch and one independent branch.",
        },
      ],
      estDurationMs: 1800000,
      costClass: "heavy",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "make:partial-failure" },
    }).plan;
    const submitted = runtime.submitCompositeJob({
      tenantId: "tenant-a",
      idempotencyKey: "submit-partial-composite-failure",
      planRef: plan.planRef,
      initiator: { kind: "user", ref: "user:manager-1" },
      failFast: false,
      priorityLane: "standard",
      childJobs: [
        { key: "de-source", kind: "engine" },
        { key: "uk-dependent", kind: "pipeline", dependsOn: ["de-source"] },
        { key: "fr-independent", kind: "engine" },
      ],
    });
    const failedSource = submitted.children[0].job;
    const blockedDependent = submitted.children[1].job;
    const independentSibling = submitted.children[2].job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: failedSource.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: failedSource.jobId, status: "running" });
    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: failedSource.jobId,
      status: "failed",
      transitionedAt: "2026-06-20T06:00:00.000Z",
      failure: {
        class: "validation",
        detailRef: { objectType: "run_failure", objectId: "01KVKH6GZ85CKWWV3GEGB9JQ0B" },
      },
    });

    expect(runtime.getRun({ tenantId: "tenant-a", jobId: blockedDependent.jobId })?.status).toBe("cancelled");
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: independentSibling.jobId })?.status).toBe("queued");

    const claim = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-independent-after-prerequisite-failure",
      workerId: "worker-independent",
      lanes: ["standard"],
      claimedAt: "2026-06-20T06:01:00.000Z",
    });

    expect(claim.job?.jobId).toBe(independentSibling.jobId);
    expect(runtime.getCompositeManifest({ tenantId: "tenant-a", jobId: submitted.job.jobId })).toMatchObject({
      statusByKey: {
        "de-source": "failed",
        "uk-dependent": "cancelled",
        "fr-independent": "planning",
      },
      failedChildKeys: ["de-source"],
      cancelledChildKeys: ["uk-dependent"],
      terminal: false,
    });
  });
  it("cancels blocked descendants transitively regardless of child declaration order", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-transitive-composite-failure-plan",
      kind: "composite",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["DE", "UK", "FR"], period: "FY2026" },
      intentRestated: "Run a three-stage dossier dependency chain.",
      steps: [
        { action: "Build the source branch.", toolClass: "engine-call" },
        { action: "Build the intermediate branch.", toolClass: "engine-call" },
        { action: "Build the final branch.", toolClass: "engine-call" },
      ],
      invalidationsPreview: [],
      produces: [
        {
          objectType: "artifact",
          label: "Three-stage dossier chain",
          reason: "The final artifact requires every stage in the dependency chain.",
        },
      ],
      estDurationMs: 1800000,
      costClass: "heavy",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "make:transitive-failure" },
    }).plan;
    const submitted = runtime.submitCompositeJob({
      tenantId: "tenant-a",
      idempotencyKey: "submit-transitive-composite-failure",
      planRef: plan.planRef,
      initiator: { kind: "user", ref: "user:manager-1" },
      failFast: false,
      childJobs: [
        { key: "fr-final", kind: "pipeline", dependsOn: ["uk-intermediate"] },
        { key: "uk-intermediate", kind: "pipeline", dependsOn: ["de-source"] },
        { key: "de-source", kind: "engine" },
      ],
    });
    const failedSource = submitted.children[2].job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: failedSource.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: failedSource.jobId, status: "running" });
    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: failedSource.jobId,
      status: "failed",
      transitionedAt: "2026-06-20T07:00:00.000Z",
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVKH6GZ85CKWWV3GEGB9JQ0C" },
      },
    });

    expect(runtime.getCompositeManifest({ tenantId: "tenant-a", jobId: submitted.job.jobId })).toMatchObject({
      statusByKey: {
        "fr-final": "cancelled",
        "uk-intermediate": "cancelled",
        "de-source": "failed",
      },
      failedChildKeys: ["de-source"],
      cancelledChildKeys: ["fr-final", "uk-intermediate"],
      terminal: true,
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: submitted.job.jobId })?.status).toBe("failed");
  });

  it("continues independent siblings by default when one child fails", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-continuation-plan",
      kind: "composite",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["DE", "UK"], period: "FY2026" },
      intentRestated: "Run two independent dossier branches.",
      steps: [
        { action: "Run Germany branch.", toolClass: "engine-call" },
        { action: "Run UK branch.", toolClass: "engine-call" },
      ],
      invalidationsPreview: [],
      produces: [{ objectType: "artifact", label: "Dossier branches" }],
      estDurationMs: 1800000,
      costClass: "heavy",
      instructionEcho: "",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "make:branches" },
    }).plan;
    const submitted = runtime.submitCompositeJob({
      tenantId: "tenant-a",
      idempotencyKey: "submit-continuing-composite",
      planRef: plan.planRef,
      initiator: { kind: "user", ref: "user:manager-1" },
      failFast: false,
      childJobs: [
        { key: "de-local-file", kind: "engine" },
        { key: "uk-benchmark", kind: "pipeline" },
      ],
    });
    const failingChild = submitted.children[0].job;
    const sibling = submitted.children[1].job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: failingChild.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: failingChild.jobId, status: "running" });
    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: failingChild.jobId,
      status: "failed",
      failure: {
        class: "tool_error",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YF" },
      },
    });

    expect(runtime.getRun({ tenantId: "tenant-a", jobId: sibling.jobId })?.status).toBe("queued");
    expect(runtime.getCompositeManifest({ tenantId: "tenant-a", jobId: submitted.job.jobId })).toMatchObject({
      statusByKey: {
        "de-local-file": "failed",
        "uk-benchmark": "queued",
      },
      failedChildKeys: ["de-local-file"],
      completedChildKeys: [],
      cancelledChildKeys: [],
      terminal: false,
    });
  });

  it("cancels unfinished siblings when fail-fast composite child fails", () => {
    const runtime = createRuntimeService();
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-fail-fast-plan",
      kind: "composite",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US", "CA"], period: "FY2026" },
      intentRestated: "Run a fail-fast North America package.",
      steps: [
        { action: "Run US branch.", toolClass: "engine-call" },
        { action: "Run Canada branch.", toolClass: "engine-call" },
      ],
      invalidationsPreview: [],
      produces: [{ objectType: "artifact", label: "North America package" }],
      estDurationMs: 1800000,
      costClass: "heavy",
      instructionEcho: "",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "make:north-america" },
    }).plan;
    const submitted = runtime.submitCompositeJob({
      tenantId: "tenant-a",
      idempotencyKey: "submit-fail-fast-composite",
      planRef: plan.planRef,
      initiator: { kind: "user", ref: "user:manager-1" },
      failFast: true,
      childJobs: [
        { key: "us-local-file", kind: "engine" },
        { key: "ca-local-file", kind: "engine" },
      ],
    });
    const failingChild = submitted.children[0].job;
    const sibling = submitted.children[1].job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: failingChild.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: failingChild.jobId, status: "running" });
    runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: failingChild.jobId,
      status: "failed",
      failure: {
        class: "validation",
        detailRef: { objectType: "run_failure", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0YG" },
      },
    });

    expect(runtime.getRun({ tenantId: "tenant-a", jobId: sibling.jobId })?.status).toBe("cancelled");
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: submitted.job.jobId })).toMatchObject({
      status: "failed",
      failure: { class: "tool_error", detailRef: null },
    });
    expect(runtime.getCompositeManifest({ tenantId: "tenant-a", jobId: submitted.job.jobId })).toMatchObject({
      failFast: true,
      statusByKey: {
        "us-local-file": "failed",
        "ca-local-file": "cancelled",
      },
      failedChildKeys: ["us-local-file"],
      cancelledChildKeys: ["ca-local-file"],
      terminal: true,
    });
  });
});
