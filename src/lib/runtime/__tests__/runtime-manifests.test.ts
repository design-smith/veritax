import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, createRecordUlid, stringifyRecordRef } from "../../record";
import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime traces and manifests", () => {
  it("turns Record reads into manifest pins and dependency edges when a run completes", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const entityRef = { objectType: "entity", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZA", version: 4 };
    const agreementRef = { objectType: "agreement", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZB", version: 2 };
    const outputRef = { objectType: "finding_candidate", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZC" };
    const stagedRef = { objectType: "staged_object", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZD" };

    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-manifest-run",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US"], period: "FY2026" },
      intentRestated: "Investigate the US distribution finding candidate.",
      steps: [
        { action: "Read the entity and agreement record.", toolClass: "read" },
        { action: "Stage a finding candidate.", toolClass: "staging-write" },
      ],
      estDurationMs: 900000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:mirror" },
    }).plan;
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-manifest-run",
      pins: {
        corpusVersion: 42,
        rulepackVersions: { transfer_pricing: "2026.2" },
        modelVersions: { examiner: "veritax-large-investigator@2026.06.19" },
      },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: approved.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: approved.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: approved.jobId,
      stepId: "step-read-record",
      type: "tool",
      toolName: "record.get",
      readRefs: [entityRef, agreementRef, entityRef],
      argsRef: { objectType: "trace_args", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZE" },
      resultRef: { objectType: "trace_result", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZF" },
      t0: "2026-06-19T20:00:00.000Z",
      t1: "2026-06-19T20:00:01.000Z",
      cost: { toolCalls: 1 },
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: approved.jobId, status: "producing" });
    runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: approved.jobId,
      idempotencyKey: "stage-finding-candidate",
      outputRef,
      stagedRef,
      outputHash: "sha256:finding-candidate-v1",
      writtenAt: "2026-06-19T20:02:00.000Z",
    });

    const completed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: approved.jobId,
      status: "completed",
      transitionedAt: "2026-06-19T20:03:00.000Z",
    });

    expect(completed.manifest?.manifest).toMatchObject({
      tenantId: "tenant-a",
      jobRef: { objectType: "run", objectId: approved.jobId },
      corpusVersion: 42,
      rulepackVersions: { transfer_pricing: "2026.2" },
      modelVersions: { examiner: "veritax-large-investigator@2026.06.19" },
      inputPins: [
        { ref: agreementRef, version: 2 },
        { ref: entityRef, version: 4 },
      ],
      outputHashes: {
        [stringifyRecordRef(outputRef)]: "sha256:finding-candidate-v1",
      },
      registeredBy: { kind: "system", id: "runtime" },
      registeredAt: "2026-06-19T20:03:00.000Z",
    });
    expect(record.getManifestPins({ tenantId: "tenant-a", manifestId: completed.manifest!.manifest.manifestId })).toEqual({
      tenantId: "tenant-a",
      manifestId: completed.manifest!.manifest.manifestId,
      corpusVersion: 42,
      inputPins: [
        { ref: agreementRef, version: 2 },
        { ref: entityRef, version: 4 },
      ],
      instructionRefs: [],
      gateRefs: [],
      rulepackVersions: { transfer_pricing: "2026.2" },
      modelVersions: { examiner: "veritax-large-investigator@2026.06.19" },
    });
    expect(record.listDependencies({ tenantId: "tenant-a", downstreamRef: outputRef })).toEqual([
      expect.objectContaining({
        downstreamRef: outputRef,
        upstreamRef: agreementRef,
        kind: "record-read",
        declaredByRun: { objectType: "run", objectId: approved.jobId },
        declaredAt: "2026-06-19T20:03:00.000Z",
      }),
      expect.objectContaining({
        downstreamRef: outputRef,
        upstreamRef: entityRef,
        kind: "record-read",
        declaredByRun: { objectType: "run", objectId: approved.jobId },
        declaredAt: "2026-06-19T20:03:00.000Z",
      }),
    ]);
    expect(completed.job.manifestRef).toEqual({
      objectType: "manifest",
      objectId: completed.manifest!.manifest.manifestId,
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: approved.jobId })).toEqual(completed.job);
  });

  it("declares completion dependency edges in one Record batch event", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const entityRef = { objectType: "entity", objectId: "01KVKCQ3VJYW8V3WGENH6YZ0GA", version: 2 };
    const agreementRef = { objectType: "agreement", objectId: "01KVKCQ3VJYW8V3WGENH6YZ0GB", version: 1 };
    const findingRef = { objectType: "finding_candidate", objectId: "01KVKCQ3VJYW8V3WGENH6YZ0GC" };
    const draftRef = { objectType: "document", objectId: "01KVKCQ3VJYW8V3WGENH6YZ0GD" };
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-batched-dependency-run",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["US"], period: "FY2026" },
      intentRestated: "Draft a finding candidate and supporting document from the same pinned inputs.",
      steps: [
        { action: "Read the entity and agreement.", toolClass: "read" },
        { action: "Stage the finding candidate and draft.", toolClass: "staging-write" },
      ],
      estDurationMs: 900000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:batch-deps" },
    }).plan;
    const job = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-batched-dependency-run",
      pins: { corpusVersion: 77 },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-read-batched-dependency-inputs",
      type: "tool",
      toolName: "record.get",
      readRefs: [entityRef, agreementRef],
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-batched-dependency-finding",
      outputRef: findingRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVKCQ3VJYW8V3WGENH6YZ0GE" },
      outputHash: "sha256:finding-from-batched-deps",
      writtenAt: "2026-06-20T04:00:00.000Z",
    });
    runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-batched-dependency-document",
      outputRef: draftRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVKCQ3VJYW8V3WGENH6YZ0GF" },
      outputHash: "sha256:draft-from-batched-deps",
      writtenAt: "2026-06-20T04:01:00.000Z",
    });

    const completed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "completed",
      transitionedAt: "2026-06-20T04:05:00.000Z",
    });
    const dependencyEvents = record.listEvents("tenant-a").filter((event) => event.type === "dependency.declared");

    expect(completed.manifest?.dependencies).toHaveLength(1);
    expect(completed.manifest?.dependencies[0].dependencies).toHaveLength(4);
    expect(dependencyEvents).toHaveLength(1);
    expect(dependencyEvents[0].payload).toMatchObject({
      dependencyIds: completed.manifest!.dependencies[0].dependencies.map((dependency) => dependency.dependencyId),
      downstreamRefs: [stringifyRecordRef(draftRef), stringifyRecordRef(findingRef)],
      upstreamRefs: [stringifyRecordRef(agreementRef), stringifyRecordRef(entityRef)],
      declaredByRun: stringifyRecordRef({ objectType: "run", objectId: job.jobId }),
    });
    expect(record.listDependencies({ tenantId: "tenant-a", downstreamRef: findingRef })).toHaveLength(2);
    expect(record.listDependencies({ tenantId: "tenant-a", downstreamRef: draftRef })).toHaveLength(2);
  });

  it("completes with a manifest when runtime dependency edges were already declared", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const upstreamRef = { objectType: "agreement", objectId: "01KVK1VVC3M6S67YHYQH51MQAD", version: 3 };
    const outputRef = { objectType: "finding_candidate", objectId: "01KVK1VVC3M6S67YHYQH51MQAE" };
    const stagedRef = { objectType: "staged_object", objectId: "01KVK1VVC3M6S67YHYQH51MQAF" };
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-manifest-existing-deps-run",
      kind: "agent",
      initiator: { kind: "system", ref: "pipeline:mirror" },
      scope: { jurisdictions: ["MX"], period: "FY2026" },
      intentRestated: "Refresh finding candidate dependencies.",
      steps: [
        { action: "Read the governing agreement.", toolClass: "read" },
        { action: "Stage the finding candidate.", toolClass: "staging-write" },
      ],
      estDurationMs: 300000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:mirror" },
    }).plan;
    const job = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-manifest-existing-deps-run",
      pins: { corpusVersion: 53 },
    }).job;
    const runRef = { objectType: "run", objectId: job.jobId };

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-read-existing-dependency",
      type: "tool",
      toolName: "record.get",
      readRefs: [upstreamRef],
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-existing-dependency-output",
      outputRef,
      stagedRef,
      outputHash: "sha256:finding-candidate-existing-deps",
      writtenAt: "2026-06-20T02:00:00.000Z",
    });
    const existingDependency = record.declareDependencies({
      tenantId: "tenant-a",
      idempotencyKey: "predeclared-runtime-dependency",
      actor: { kind: "system", id: "runtime" },
      declaredByRun: runRef,
      downstreamRef: outputRef,
      upstreamRefs: [{ ref: upstreamRef, kind: "record-read" }],
      declaredAt: "2026-06-20T02:01:00.000Z",
    }).dependencies[0];

    let completed: ReturnType<typeof runtime.transitionJob> | null = null;
    let error: unknown;
    try {
      completed = runtime.transitionJob({
        tenantId: "tenant-a",
        jobId: job.jobId,
        status: "completed",
        transitionedAt: "2026-06-20T02:05:00.000Z",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeUndefined();
    expect(completed?.job.status).toBe("completed");
    expect(completed?.manifest?.manifest).toMatchObject({
      jobRef: runRef,
      corpusVersion: 53,
      inputPins: [{ ref: upstreamRef, version: 3 }],
      outputHashes: {
        [stringifyRecordRef(outputRef)]: "sha256:finding-candidate-existing-deps",
      },
    });
    expect(record.listDependencies({ tenantId: "tenant-a", downstreamRef: outputRef })).toEqual([existingDependency]);
  });

  it("pins only the corrected approved gate when a prior gate was returned for changes", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const { ref: entityRef } = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" });
    const agreementRef = { objectType: "agreement", objectId: "01KVK6YEMEPVYWS8R1A8C2B7MA", version: 1 };

    record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "seed-manifest-gated-entity",
      actor: { kind: "user", id: "manager-1" },
      ref: entityRef,
      approvalRef: createRecordUlid(),
      occurredAt: "2026-06-20T03:00:00.000Z",
      value: {
        name: "Veritax Canada Inc.",
        jurisdiction: "CA",
        roleInGroup: "Distributor",
        status: "active",
      },
    });
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-manifest-gate-change-run",
      kind: "agent",
      initiator: { kind: "user", ref: "user:analyst-1" },
      scope: { jurisdictions: ["CA"], period: "FY2026" },
      intentRestated: "Refresh the Canada entity characterization with review.",
      steps: [
        { action: "Read the governing agreement.", toolClass: "read" },
        { action: "Stage the corrected entity characterization.", toolClass: "staging-write" },
      ],
      estDurationMs: 600000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:canada-entity" },
    }).plan;
    const job = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-manifest-gate-change-run",
      pins: { corpusVersion: 61 },
    }).job;

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-read-gate-change-agreement",
      type: "tool",
      toolName: "record.get",
      readRefs: [agreementRef],
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const initial = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-initial-manifest-gated-entity",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVK6YEMEPVYWS8R1A8C2B7MB" },
      outputHash: "sha256:entity-characterization-initial",
      writtenAt: "2026-06-20T03:05:00.000Z",
      promotion: {
        proposedValue: {
          name: "Veritax Canada Inc.",
          jurisdiction: "CA",
          roleInGroup: "Principal",
          status: "active",
        },
        lens: { validAt: "2026-01-01", knownAt: "2026-06-20T03:05:00.000Z" },
        slaDue: "2026-06-21T03:05:00.000Z",
      },
    });

    runtime.requestGateChanges({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: initial.gate!.gateId,
      idempotencyKey: "request-manifest-gate-correction",
      actor: { kind: "user", ref: "user:manager-1" },
      comments: [
        {
          anchorRef: { objectType: "doc_section", objectId: "01KVK6YEMEPVYWS8R1A8C2B7MD", version: 1 },
          text: "Show the agreement support before promotion.",
        },
      ],
      requestedAt: "2026-06-20T03:06:00.000Z",
    });
    const corrected = runtime.recordStagingWrite({
      tenantId: "tenant-a",
      jobId: job.jobId,
      idempotencyKey: "stage-corrected-manifest-gated-entity",
      outputRef: entityRef,
      stagedRef: { objectType: "staged_object", objectId: "01KVK6YEMEPVYWS8R1A8C2B7MC" },
      outputHash: "sha256:entity-characterization-corrected",
      writtenAt: "2026-06-20T03:07:00.000Z",
      promotion: {
        proposedValue: {
          name: "Veritax Canada Inc.",
          jurisdiction: "CA",
          roleInGroup: "Principal",
          supportRef: stringifyRecordRef(agreementRef),
          status: "active",
        },
        lens: { validAt: "2026-01-01", knownAt: "2026-06-20T03:07:00.000Z" },
        slaDue: "2026-06-21T03:07:00.000Z",
      },
    });

    runtime.decideGate({
      tenantId: "tenant-a",
      jobId: job.jobId,
      gateId: corrected.gate!.gateId,
      idempotencyKey: "approve-corrected-manifest-gate",
      actor: { kind: "user", ref: "user:manager-1" },
      decision: "approved",
      decidedAt: "2026-06-20T03:08:00.000Z",
    });
    const completed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "completed",
      transitionedAt: "2026-06-20T03:09:00.000Z",
    });

    expect(record.getManifestPins({ tenantId: "tenant-a", manifestId: completed.manifest!.manifest.manifestId })).toMatchObject({
      inputPins: [{ ref: agreementRef, version: 1 }],
      gateRefs: [corrected.gate!.gateId],
    });
    expect(completed.manifest?.manifest.outputHashes).toEqual({
      [stringifyRecordRef(entityRef)]: "sha256:entity-characterization-corrected",
    });
  });

  it("refuses unversioned Record reads because they cannot become replay pins", () => {
    const runtime = createRuntimeService({ record: createRecordService() });
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "unversioned-read-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
    }).job;

    expect(() =>
      runtime.recordStep({
        tenantId: "tenant-a",
        jobId: job.jobId,
        stepId: "step-unversioned-read",
        type: "tool",
        toolName: "record.get",
        readRefs: [{ objectType: "entity", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZG" }],
        t0: "2026-06-19T21:00:00.000Z",
        t1: "2026-06-19T21:00:01.000Z",
      }),
    ).toThrow(RuntimeError);
    try {
      runtime.recordStep({
        tenantId: "tenant-a",
        jobId: job.jobId,
        stepId: "step-unversioned-read",
        type: "tool",
        toolName: "record.get",
        readRefs: [{ objectType: "entity", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZG" }],
        t0: "2026-06-19T21:00:00.000Z",
        t1: "2026-06-19T21:00:01.000Z",
      });
      throw new Error("Expected unversioned read to be refused.");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeError);
      expect((error as RuntimeError).code).toBe("UNPINNED_RECORD_READ");
    }
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })?.steps).toEqual([]);
  });

  it("registers active instruction refs in the completion manifest", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });
    const instruction = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-manifest-style-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use concise phrasing for finding narratives.",
      scope: { kind: "org" },
      submittedAt: "2026-06-19T21:30:00.000Z",
    }).instruction!;
    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-instruction-manifest-run",
      kind: "agent",
      initiator: { kind: "user", ref: "user:manager-1" },
      scope: { jurisdictions: ["UK"], period: "FY2026" },
      intentRestated: "Draft a finding candidate with the current narrative instruction.",
      steps: [{ action: "Read evidence and stage a finding candidate.", toolClass: "read" }],
      estDurationMs: 600000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:findings" },
    }).plan;
    const job = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-instruction-manifest-run",
      pins: { corpusVersion: 7 },
    }).job;
    const documentRef = { objectType: "document", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZH", version: 1 };

    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "planning" });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "running" });
    runtime.recordStep({
      tenantId: "tenant-a",
      jobId: job.jobId,
      stepId: "step-read-document",
      type: "tool",
      toolName: "record.get",
      readRefs: [documentRef],
    });
    runtime.transitionJob({ tenantId: "tenant-a", jobId: job.jobId, status: "producing" });
    const completed = runtime.transitionJob({
      tenantId: "tenant-a",
      jobId: job.jobId,
      status: "completed",
      transitionedAt: "2026-06-19T21:40:00.000Z",
    });

    expect(completed.job.instructionSet).toEqual({
      setHash: job.instructionSet.setHash,
      refs: [instruction.instructionRef],
    });
    expect(record.getManifestPins({ tenantId: "tenant-a", manifestId: completed.manifest!.manifest.manifestId })).toMatchObject({
      instructionRefs: [instruction.instructionId],
      inputPins: [{ ref: documentRef, version: 1 }],
    });
  });
});
