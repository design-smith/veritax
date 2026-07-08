import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, isRecordError, stringifyRecordRef } from "../index";

describe("Record runtime mirrors and instructions", () => {
  it("mirrors run started as an idempotent domain event", () => {
    const record = createRecordService();
    const runRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;

    const started = record.mirrorRunStarted({
      tenantId: "tenant-a",
      idempotencyKey: "run-started",
      actor: { kind: "agent", id: "runtime" },
      runRef,
      kind: "agent",
      status: "running",
      scope: {
        entityIds: [entityRef.objectId],
        jurisdictions: ["US"],
        objectRefs: [entityRef],
      },
      planRef: createRecordIdentity({ tenantId: "tenant-a", objectType: "plan" }).ref,
      startedAt: "2026-02-10T12:00:00.000Z",
    });
    const replay = record.mirrorRunStarted({
      tenantId: "tenant-a",
      idempotencyKey: "run-started",
      actor: { kind: "agent", id: "runtime" },
      runRef,
      kind: "agent",
      status: "running",
      scope: {
        entityIds: [entityRef.objectId],
        jurisdictions: ["US"],
        objectRefs: [entityRef],
      },
      planRef: started.planRef,
      startedAt: "2026-02-10T12:00:00.000Z",
    });

    expect(replay).toEqual(started);
    expect(started.event).toMatchObject({
      type: "run.started",
      occurredAt: "2026-02-10T12:00:00.000Z",
      payload: {
        runRef: stringifyRecordRef(runRef),
        kind: "agent",
        status: "running",
        scope: {
          entityIds: [entityRef.objectId],
          jurisdictions: ["US"],
          objectRefs: [stringifyRecordRef(entityRef)],
        },
      },
    });
    expect(record.readOutbox("tenant-a")).toMatchObject([{ event: started.event, delivered: false }]);
    expect(record.getTimeline({ tenantId: "tenant-a", ref: runRef }).events).toEqual([started.event]);
  });

  it("mirrors run steps with argument and result refs", () => {
    const record = createRecordService();
    const runRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const argsRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "blob" }).ref;
    const resultRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "artifact" }).ref;

    const step = record.mirrorRunStep({
      tenantId: "tenant-a",
      idempotencyKey: "run-step-1",
      actor: { kind: "agent", id: "runtime" },
      runRef,
      stepId: "step-001",
      type: "tool",
      toolName: "record.get",
      argsRef,
      resultRef,
      startedAt: "2026-02-10T12:01:00.000Z",
      completedAt: "2026-02-10T12:01:04.000Z",
      cost: { tokens: 1200, cents: 18 },
    });

    expect(step.event).toMatchObject({
      type: "run.step",
      payload: {
        runRef: stringifyRecordRef(runRef),
        stepId: "step-001",
        type: "tool",
        toolName: "record.get",
        argsRef: stringifyRecordRef(argsRef),
        resultRef: stringifyRecordRef(resultRef),
        cost: { tokens: 1200, cents: 18 },
      },
    });
    expect(record.getTimeline({ tenantId: "tenant-a", ref: runRef }).events).toEqual([step.event]);
  });

  it("mirrors terminal run outcomes for completed, failed, and cancelled runs", () => {
    const record = createRecordService();
    const completedRunRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const failedRunRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const cancelledRunRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const manifestRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "manifest" }).ref.objectId;
    const failureDetailRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "blob" }).ref;

    const completed = record.mirrorRunCompleted({
      tenantId: "tenant-a",
      idempotencyKey: "completed-run",
      actor: { kind: "agent", id: "runtime" },
      runRef: completedRunRef,
      status: "completed",
      manifestRef,
      outputRefs: [createRecordIdentity({ tenantId: "tenant-a", objectType: "artifact" }).ref],
      completedAt: "2026-02-10T12:05:00.000Z",
    });
    const failed = record.mirrorRunFailed({
      tenantId: "tenant-a",
      idempotencyKey: "failed-run",
      actor: { kind: "agent", id: "runtime" },
      runRef: failedRunRef,
      status: "failed",
      failure: {
        class: "validation",
        detailRef: failureDetailRef,
      },
      failedAt: "2026-02-10T12:06:00.000Z",
    });
    const cancelled = record.mirrorRunCancelled({
      tenantId: "tenant-a",
      idempotencyKey: "cancelled-run",
      actor: { kind: "user", id: "manager-1" },
      runRef: cancelledRunRef,
      status: "cancelled",
      reason: "User stopped stale scope.",
      cancelledAt: "2026-02-10T12:07:00.000Z",
    });

    expect(completed.event).toMatchObject({
      type: "run.completed",
      manifestRef,
      payload: {
        runRef: stringifyRecordRef(completedRunRef),
        status: "completed",
      },
    });
    expect(failed.event).toMatchObject({
      type: "run.failed",
      payload: {
        runRef: stringifyRecordRef(failedRunRef),
        status: "failed",
        failure: {
          class: "validation",
          detailRef: stringifyRecordRef(failureDetailRef),
        },
      },
    });
    expect(cancelled.event).toMatchObject({
      type: "run.cancelled",
      payload: {
        runRef: stringifyRecordRef(cancelledRunRef),
        status: "cancelled",
        reason: "User stopped stale scope.",
      },
    });
    expect(record.getTimeline({ tenantId: "tenant-a", ref: completedRunRef }).events).toEqual([completed.event]);
    expect(record.getTimeline({ tenantId: "tenant-a", ref: failedRunRef }).events).toEqual([failed.event]);
    expect(record.getTimeline({ tenantId: "tenant-a", ref: cancelledRunRef }).events).toEqual([cancelled.event]);
  });

  it("submits, approves, and retires instructions with lifecycle events", () => {
    const record = createRecordService();
    const scopeRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity" }).ref;

    const submitted = record.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-instruction",
      actor: { kind: "user", id: "manager-1" },
      tier: 2,
      scope: {
        kind: "jurisdiction",
        jurisdictions: ["US"],
        objectRefs: [scopeRef],
      },
      text: "Use the approved comparable set for US distributor files.",
      compiled: { target: "engine-parameters", flags: ["us-distributor-comps"] },
      submittedAt: "2026-02-10T13:00:00.000Z",
    });
    const approved = record.approveInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "approve-instruction",
      actor: { kind: "user", id: "vp-tax" },
      instructionId: submitted.instruction.instructionId,
      approvedAt: "2026-02-10T14:00:00.000Z",
    });
    const retired = record.retireInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "retire-instruction",
      actor: { kind: "user", id: "vp-tax" },
      instructionId: submitted.instruction.instructionId,
      reason: "Replaced by FY2027 method.",
      retiredAt: "2026-12-31T20:00:00.000Z",
    });

    expect(submitted.event).toMatchObject({
      type: "instruction.submitted",
      payload: {
        instructionRef: submitted.instruction.instructionRef,
        tier: 2,
      },
    });
    expect(approved.event).toMatchObject({
      type: "instruction.approved",
      payload: {
        instructionRef: submitted.instruction.instructionRef,
        approvedBy: "vp-tax",
      },
    });
    expect(retired.event).toMatchObject({
      type: "instruction.retired",
      payload: {
        instructionRef: submitted.instruction.instructionRef,
        reason: "Replaced by FY2027 method.",
      },
    });
    expect(record.getInstruction({ tenantId: "tenant-a", instructionId: submitted.instruction.instructionId })).toEqual(
      retired.instruction,
    );
    expect(record.listInstructions({ tenantId: "tenant-a", status: "retired" })).toEqual([retired.instruction]);
  });

  it("stores document section content only as blob refs and hashes", () => {
    const record = createRecordService();
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;
    const sectionRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "doc_section" }).ref;

    try {
      record.promoteCanonical({
        tenantId: "tenant-a",
        idempotencyKey: "inline-section-content",
        actor: { kind: "user", id: "manager-1" },
        ref: sectionRef,
        approvalRef: createRecordIdentity({ tenantId: "tenant-a", objectType: "gate" }).ref.objectId,
        value: {
          docId: docRef,
          position: 1,
          content: "Inline content must not be stored in canonical doc_sections.",
          contentBlobRef: "blob://tenant-a/doc-sections/section-1",
          contentHash: "sha256:section-v1",
          inputChips: [],
          version: 1,
          status: "generated",
        },
      });
      throw new Error("Expected inline section content to fail.");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      if (isRecordError(error)) {
        expect(error.code).toBe("INVALID_CANONICAL_OBJECT");
      }
    }

    const promoted = record.promoteCanonical({
      tenantId: "tenant-a",
      idempotencyKey: "blob-section-content",
      actor: { kind: "user", id: "manager-1" },
      ref: sectionRef,
      approvalRef: createRecordIdentity({ tenantId: "tenant-a", objectType: "gate" }).ref.objectId,
      value: {
        docId: docRef,
        position: 1,
        contentBlobRef: "blob://tenant-a/doc-sections/section-1",
        contentHash: "sha256:section-v1",
        inputChips: [],
        version: 1,
        status: "generated",
      },
    });

    expect(promoted.row).toMatchObject({
      sectionId: sectionRef.objectId,
      docId: stringifyRecordRef(docRef),
      contentBlobRef: "blob://tenant-a/doc-sections/section-1",
      contentHash: "sha256:section-v1",
    });
    expect(promoted.row).not.toHaveProperty("content");
  });

  it("records finding candidates as observation-tier assertions instead of canonical findings", () => {
    const record = createRecordService();
    const flowRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "flow" }).ref;
    const docRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document" }).ref;

    const result = record.recordFindingCandidate({
      tenantId: "tenant-a",
      idempotencyKey: "candidate-rate-mismatch",
      actor: { kind: "agent", id: "mirror-examiner" },
      subjectRef: flowRef,
      candidate: {
        ruleId: "R-201",
        severity: "material",
        narrative: "Observed royalty rate is outside the policy range.",
        exhibits: [{ docRef, span: { start: 40, end: 90 } }],
        exposure: { amount: 1250000, currency: "USD" },
      },
      source: {
        kind: "engine",
        engineId: "mirror-examiner",
        rulepackVersion: "mirror-2026.1",
      },
      confidence: 0.82,
      validFrom: "2026-01-01",
      assertedAt: "2026-02-10T17:00:00.000Z",
      scopeKeys: {
        jurisdictions: ["US"],
      },
      sensitivity: 1,
    });

    expect(result.assertion).toMatchObject({
      subject: {
        objectRef: flowRef,
        field: "finding.candidate",
      },
      value: {
        ruleId: "R-201",
        severity: "material",
      },
      confidence: 0.82,
      sensitivity: 1,
    });
    expect(result.event).toMatchObject({
      type: "assertion.recorded",
      payload: {
        assertionId: result.assertion.assertionId,
      },
    });
    expect(record.listFindingCandidates({ tenantId: "tenant-a", subjectRef: flowRef })).toEqual([result.assertion]);
    expect(
      record.listCanonical({
        tenantId: "tenant-a",
        objectType: "finding",
        lens: { validAt: "2026-03-01", knownAt: "2026-02-11T12:00:00.000Z" },
      }),
    ).toEqual([]);
  });
});
