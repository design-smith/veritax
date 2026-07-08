import { describe, expect, it } from "vitest";

import { createRecordService } from "../../record";
import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime instructions and compiler", () => {
  it("submits style instructions as active generation constraints and pins them to approved jobs", () => {
    const runtime = createRuntimeService();

    const submitted = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-style-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use concise plain English in local file section narratives.",
      scope: { kind: "section", section: "local-file:functions" },
      submittedAt: "2026-06-19T20:00:00.000Z",
    });
    const replay = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-style-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use concise plain English in local file section narratives.",
      scope: { kind: "section", section: "local-file:functions" },
      submittedAt: "2026-06-19T20:00:00.000Z",
    });

    expect(replay).toEqual(submitted);
    expect(submitted.refusal).toBeNull();
    expect(submitted.instruction).toMatchObject({
      tenantId: "tenant-a",
      instructionRef: `instruction:${submitted.instruction?.instructionId}`,
      tier: "style",
      status: "active",
      scope: {
        kind: "section",
        section: "local-file:functions",
        jurisdictions: [],
        objectRefs: [],
      },
      text: "Use concise plain English in local file section narratives.",
      compiled: {
        target: "generation-constraints",
        directives: [
          {
            key: "style.text",
            value: "Use concise plain English in local file section narratives.",
          },
        ],
        confidence: 0.92,
      },
      author: { kind: "user", ref: "user:preparer-1" },
      approvals: [],
      supersedesInstructionId: null,
      refusal: null,
    });
    expect(submitted.event).toMatchObject({
      type: "instruction.submitted",
      occurredAt: "2026-06-19T20:00:00.000Z",
      payload: {
        instructionRef: submitted.instruction?.instructionRef,
        tier: "style",
        status: "active",
      },
    });

    const plan = runtime.compilePlan({
      tenantId: "tenant-a",
      idempotencyKey: "compile-style-instruction-plan",
      kind: "agent",
      initiator: { kind: "user", ref: "user:preparer-1" },
      scope: { period: "FY2026" },
      intentRestated: "Draft the functions section with house style.",
      steps: [{ action: "Draft the functions section.", toolClass: "read" }],
      estDurationMs: 300000,
      costClass: "standard",
      permissionVerdict: { allowed: true, reason: null },
      source: { kind: "user_command", ref: "ask:factory" },
    }).plan;
    const approved = runtime.approvePlan({
      tenantId: "tenant-a",
      planId: plan.planId,
      idempotencyKey: "approve-style-instruction-plan",
    });

    expect(runtime.listInstructions({ tenantId: "tenant-a", status: "active" })).toEqual([
      submitted.instruction,
    ]);
    expect(approved.job.instructionSet).toEqual({
      setHash: runtime.composeInstructionSet({ tenantId: "tenant-a", scope: plan.scope }).setHash,
      refs: [submitted.instruction?.instructionRef],
    });
  });

  it("keeps methodology instructions in draft until approved and then composes engine parameters", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });

    const submitted = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-methodology-instruction",
      author: { kind: "user", ref: "user:manager-1" },
      text: "Apply the Irish SBC election when running the deterministic range method.",
      scope: { kind: "jurisdiction", jurisdictions: ["ie"] },
      submittedAt: "2026-06-19T21:00:00.000Z",
      approvalSlaDue: "2026-06-20T21:00:00.000Z",
    });

    expect(submitted.instruction).toMatchObject({
      tier: "methodology",
      status: "draft",
      approvalGateRef: { objectType: "gate", objectId: submitted.approvalGate?.gateId },
      approvalStagingRef: { objectType: "staging_object", objectId: submitted.approvalStagingObject?.stagingId },
      compiled: {
        target: "engine-parameters",
        directives: [
          {
            key: "methodology.text",
            value: "Apply the Irish SBC election when running the deterministic range method.",
          },
        ],
      },
    });
    expect(submitted.approvalGate).toMatchObject({
      objectRef: { objectType: "instruction", objectId: submitted.instruction!.instructionId },
      requestedBy: { kind: "user", id: "manager-1" },
      requestedAt: "2026-06-19T21:00:00.000Z",
      slaDue: "2026-06-20T21:00:00.000Z",
      decision: null,
      status: "pending",
    });
    expect(submitted.approvalStagingObject).toMatchObject({
      objectRef: { objectType: "instruction", objectId: submitted.instruction!.instructionId },
      gateId: submitted.approvalGate!.gateId,
      status: "gate_requested",
      proposedValue: {
        instrId: submitted.instruction!.instructionId,
        tier: 3,
        status: "active",
        text: "Apply the Irish SBC election when running the deterministic range method.",
      },
    });
    expect(record.listGates({ tenantId: "tenant-a", status: "pending" })).toEqual([submitted.approvalGate]);
    expect(runtime.composeInstructionSet({ tenantId: "tenant-a", scope: { jurisdictions: ["IE"] } })).toMatchObject({
      refs: [],
      instructions: [],
    });

    const approved = runtime.approveInstruction({
      tenantId: "tenant-a",
      instructionId: submitted.instruction!.instructionId,
      idempotencyKey: "approve-methodology-instruction",
      approvedBy: { kind: "user", ref: "user:vp-tax-1" },
      approvedAt: "2026-06-19T21:05:00.000Z",
      gateId: submitted.approvalGate!.gateId,
    });
    const replay = runtime.approveInstruction({
      tenantId: "tenant-a",
      instructionId: submitted.instruction!.instructionId,
      idempotencyKey: "approve-methodology-instruction",
      approvedBy: { kind: "user", ref: "user:vp-tax-1" },
      approvedAt: "2026-06-19T21:05:00.000Z",
      gateId: submitted.approvalGate!.gateId,
    });

    expect(replay).toEqual(approved);
    expect(approved.instruction).toMatchObject({
      status: "active",
      approvals: [
        {
          approvedBy: { kind: "user", ref: "user:vp-tax-1" },
          approvedAt: "2026-06-19T21:05:00.000Z",
        },
      ],
      approvalGateRef: { objectType: "gate", objectId: submitted.approvalGate!.gateId },
      updatedAt: "2026-06-19T21:05:00.000Z",
    });
    expect(approved.approvalGate).toMatchObject({
      gateId: submitted.approvalGate!.gateId,
      decision: "approved",
      decider: { kind: "user", id: "vp-tax-1" },
      decidedAt: "2026-06-19T21:05:00.000Z",
      status: "approved",
    });
    expect(approved.event).toMatchObject({
      type: "instruction.approved",
      occurredAt: "2026-06-19T21:05:00.000Z",
      payload: {
        instructionRef: submitted.instruction!.instructionRef,
        tier: "methodology",
        gate: {
          class: "methodology-instruction",
          verdict: "approved",
          gateId: submitted.approvalGate!.gateId,
        },
      },
    });

    const set = runtime.composeInstructionSet({ tenantId: "tenant-a", scope: { jurisdictions: ["IE"] } });
    expect(set.refs).toEqual([submitted.instruction!.instructionRef]);
    expect(set.instructions[0]).toEqual(approved.instruction);
  });

  it("enforces four-eyes policy on methodology instruction approval gates", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });

    runtime.configureGatePolicy({
      tenantId: "tenant-a",
      objectType: "instruction",
      fourEyes: true,
      configuredBy: { kind: "user", ref: "user:policy-admin" },
      configuredAt: "2026-06-19T21:30:00.000Z",
    });
    const submitted = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-four-eyes-methodology-instruction",
      author: { kind: "user", ref: "user:manager-1" },
      text: "Apply the Irish SBC election when running the deterministic range method.",
      scope: { kind: "jurisdiction", jurisdictions: ["ie"] },
      submittedAt: "2026-06-19T21:31:00.000Z",
      approvalSlaDue: "2026-06-20T21:31:00.000Z",
    });

    let error: unknown;
    try {
      runtime.approveInstruction({
        tenantId: "tenant-a",
        instructionId: submitted.instruction!.instructionId,
        idempotencyKey: "self-approve-four-eyes-methodology-instruction",
        approvedBy: { kind: "user", ref: "user:manager-1" },
        approvedAt: "2026-06-19T21:35:00.000Z",
        gateId: submitted.approvalGate!.gateId,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(RuntimeError);
    expect(error).toMatchObject({
      code: "GATE_FOUR_EYES_REQUIRED",
      details: {
        gateId: submitted.approvalGate!.gateId,
        objectType: "instruction",
        requester: { kind: "user", id: "manager-1" },
        decider: { kind: "user", id: "manager-1" },
      },
    });
    expect(record.listGates({ tenantId: "tenant-a", status: "pending" })).toEqual([submitted.approvalGate]);
    expect(runtime.getInstruction({ tenantId: "tenant-a", instructionId: submitted.instruction!.instructionId }))
      .toMatchObject({ status: "draft", approvals: [] });

    const approved = runtime.approveInstruction({
      tenantId: "tenant-a",
      instructionId: submitted.instruction!.instructionId,
      idempotencyKey: "manager-two-approves-four-eyes-methodology-instruction",
      approvedBy: { kind: "user", ref: "user:manager-2" },
      approvedAt: "2026-06-19T21:40:00.000Z",
      gateId: submitted.approvalGate!.gateId,
    });

    expect(approved.instruction).toMatchObject({
      status: "active",
      approvals: [{ approvedBy: { kind: "user", ref: "user:manager-2" } }],
    });
    expect(approved.approvalGate).toMatchObject({
      gateId: submitted.approvalGate!.gateId,
      status: "approved",
      decider: { kind: "user", id: "manager-2" },
    });
  });

  it("previews a methodology replacement without superseding the active instruction before gate approval", () => {
    const record = createRecordService();
    const runtime = createRuntimeService({ record });

    const original = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-original-methodology",
      author: { kind: "user", ref: "user:manager-1" },
      text: "Apply the Irish SBC election when running the deterministic range method.",
      scope: { kind: "jurisdiction", jurisdictions: ["ie"] },
      submittedAt: "2026-06-19T21:00:00.000Z",
      approvalSlaDue: "2026-06-20T21:00:00.000Z",
    });
    const approvedOriginal = runtime.approveInstruction({
      tenantId: "tenant-a",
      instructionId: original.instruction!.instructionId,
      idempotencyKey: "approve-original-methodology",
      approvedBy: { kind: "user", ref: "user:vp-tax-1" },
      approvedAt: "2026-06-19T21:05:00.000Z",
      gateId: original.approvalGate!.gateId,
    });

    const replacement = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-replacement-methodology",
      author: { kind: "user", ref: "user:manager-2" },
      text: "Apply the Irish SBC election and use the deterministic interquartile range method.",
      scope: { kind: "jurisdiction", jurisdictions: ["IE"] },
      submittedAt: "2026-06-19T22:00:00.000Z",
      approvalSlaDue: "2026-06-20T22:00:00.000Z",
    });

    expect(replacement.shadowedInstructions).toEqual([approvedOriginal.instruction]);
    expect(replacement.event.payload).toMatchObject({
      shadowedInstructionRefs: [approvedOriginal.instruction.instructionRef],
    });
    expect(runtime.getInstruction({ tenantId: "tenant-a", instructionId: approvedOriginal.instruction.instructionId }))
      .toMatchObject({ status: "active" });
    expect(runtime.composeInstructionSet({ tenantId: "tenant-a", scope: { jurisdictions: ["IE"] } }).refs).toEqual([
      approvedOriginal.instruction.instructionRef,
    ]);

    const approvedReplacement = runtime.approveInstruction({
      tenantId: "tenant-a",
      instructionId: replacement.instruction!.instructionId,
      idempotencyKey: "approve-replacement-methodology",
      approvedBy: { kind: "user", ref: "user:vp-tax-1" },
      approvedAt: "2026-06-19T22:05:00.000Z",
      gateId: replacement.approvalGate!.gateId,
    });

    expect(approvedReplacement.instruction.supersedesInstructionId).toBe(approvedOriginal.instruction.instructionId);
    expect(runtime.getInstruction({ tenantId: "tenant-a", instructionId: approvedOriginal.instruction.instructionId }))
      .toMatchObject({ status: "superseded" });
    expect(runtime.composeInstructionSet({ tenantId: "tenant-a", scope: { jurisdictions: ["IE"] } }).refs).toEqual([
      approvedReplacement.instruction.instructionRef,
    ]);
  });

  it("previews broader active instructions shadowed by a narrower same-tier submission", () => {
    const runtime = createRuntimeService();
    const orgStyle = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-org-style-preview",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use concise phrasing for review notes.",
      scope: { kind: "org" },
      submittedAt: "2026-06-19T21:00:00.000Z",
    }).instruction!;

    const irelandStyle = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-ireland-style-preview",
      author: { kind: "user", ref: "user:preparer-2" },
      text: "Use concise phrasing and lead with local filing status for Irish review notes.",
      scope: { kind: "jurisdiction", jurisdictions: ["ie"] },
      submittedAt: "2026-06-19T21:10:00.000Z",
    });

    expect(irelandStyle.shadowedInstructions).toEqual([orgStyle]);
    expect(irelandStyle.event.payload).toMatchObject({
      shadowedInstructionRefs: [orgStyle.instructionRef],
    });
    expect(runtime.getInstruction({ tenantId: "tenant-a", instructionId: orgStyle.instructionId })).toMatchObject({
      status: "active",
    });
    expect(runtime.composeInstructionSet({ tenantId: "tenant-a", scope: { jurisdictions: ["IE"] } }).refs).toEqual([
      irelandStyle.instruction!.instructionRef,
      orgStyle.instructionRef,
    ]);
  });

  it("refuses ambiguous low-confidence instructions before they can become active", () => {
    const runtime = createRuntimeService();

    const refused = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-ambiguous-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use the usual approach for this work.",
      scope: { kind: "org" },
      submittedAt: "2026-06-19T22:00:00.000Z",
    });

    expect(refused.instruction).toBeNull();
    expect(refused.refusal).toEqual({
      reason: "low-confidence",
      conflictingAssertions: [],
      remedy: "Clarify the instruction so the compiler can assign a typed target before approval.",
    });
    expect(refused.event).toMatchObject({
      type: "instruction.refused",
      occurredAt: "2026-06-19T22:00:00.000Z",
      payload: {
        tier: "run",
        text: "Use the usual approach for this work.",
        refusal: refused.refusal,
      },
    });
    expect(runtime.listInstructions({ tenantId: "tenant-a" })).toEqual([]);
  });

  it("refuses fact-conflicting instructions with the conflicting assertions attached", () => {
    const runtime = createRuntimeService();
    const conflictingAssertion = {
      objectType: "assertion",
      objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0ZA",
      version: 3,
    };

    const refused = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-fact-conflicting-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Treat the French distributor as low risk even though the Record says high risk.",
      scope: { kind: "jurisdiction", jurisdictions: ["fr"] },
      conflictingAssertions: [conflictingAssertion],
      submittedAt: "2026-06-19T22:30:00.000Z",
    });

    expect(refused.instruction).toBeNull();
    expect(refused.refusal).toEqual({
      reason: "fact-conflict",
      conflictingAssertions: [conflictingAssertion],
      remedy: "To state this, the Record must change through a governed edit.",
    });
    expect(refused.event).toMatchObject({
      type: "instruction.refused",
      payload: {
        tier: "run",
        refusal: refused.refusal,
      },
    });
    expect(runtime.composeInstructionSet({ tenantId: "tenant-a", scope: { jurisdictions: ["FR"] } })).toMatchObject({
      setHash: null,
      refs: [],
    });
  });

  it("composes run scope definitions and orders narrower active instructions before broader ones", () => {
    const runtime = createRuntimeService();

    const runScope = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-run-scope-instruction",
      author: { kind: "user", ref: "user:manager-1" },
      text: "Only include US and CA flows in the watcher scope.",
      scope: { kind: "org" },
      submittedAt: "2026-06-19T23:00:00.000Z",
    }).instruction!;
    const orgStyle = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-org-style-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use concise phrasing for all review notes.",
      scope: { kind: "org" },
      submittedAt: "2026-06-19T23:01:00.000Z",
    }).instruction!;
    const firstSectionStyle = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-first-section-style-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use concise phrasing for functions section notes.",
      scope: { kind: "section", section: "local-file:functions" },
      submittedAt: "2026-06-19T23:02:00.000Z",
    }).instruction!;
    const laterSectionStyle = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-later-section-style-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use concise phrasing and lead with citations in functions section notes.",
      scope: { kind: "section", section: "local-file:functions" },
      submittedAt: "2026-06-19T23:03:00.000Z",
    }).instruction!;

    expect(runScope).toMatchObject({
      tier: "run",
      status: "active",
      compiled: {
        target: "scope-definition",
        directives: [
          {
            key: "scope.text",
            value: "Only include US and CA flows in the watcher scope.",
          },
        ],
      },
    });
    expect(runtime.getInstruction({ tenantId: "tenant-a", instructionId: firstSectionStyle.instructionId })).toMatchObject(
      {
        status: "superseded",
      },
    );
    expect(laterSectionStyle.supersedesInstructionId).toBe(firstSectionStyle.instructionId);

    const set = runtime.composeInstructionSet({ tenantId: "tenant-a", scope: { jurisdictions: ["US"] } });

    expect(set.refs).toEqual([runScope.instructionRef, laterSectionStyle.instructionRef, orgStyle.instructionRef]);
    expect(set.instructions.map((instruction) => instruction.text)).toEqual([
      "Only include US and CA flows in the watcher scope.",
      "Use concise phrasing and lead with citations in functions section notes.",
      "Use concise phrasing for all review notes.",
    ]);
    expect(runtime.listInstructions({ tenantId: "tenant-a", status: "superseded" })).toEqual([
      expect.objectContaining({ instructionId: firstSectionStyle.instructionId }),
    ]);
  });

  it("retires active instructions without losing the audit event", () => {
    const runtime = createRuntimeService();
    const instruction = runtime.submitInstruction({
      tenantId: "tenant-a",
      idempotencyKey: "submit-retirable-instruction",
      author: { kind: "user", ref: "user:preparer-1" },
      text: "Use concise notes for the review queue.",
      scope: { kind: "org" },
      submittedAt: "2026-06-19T23:30:00.000Z",
    }).instruction!;

    const retired = runtime.retireInstruction({
      tenantId: "tenant-a",
      instructionId: instruction.instructionId,
      idempotencyKey: "retire-instruction",
      retiredBy: { kind: "user", ref: "user:manager-1" },
      retiredAt: "2026-06-19T23:35:00.000Z",
      reason: "House style moved into the dossier template.",
    });
    const replay = runtime.retireInstruction({
      tenantId: "tenant-a",
      instructionId: instruction.instructionId,
      idempotencyKey: "retire-instruction",
      retiredBy: { kind: "user", ref: "user:manager-1" },
      retiredAt: "2026-06-19T23:35:00.000Z",
      reason: "House style moved into the dossier template.",
    });

    expect(replay).toEqual(retired);
    expect(retired.instruction).toMatchObject({
      instructionId: instruction.instructionId,
      status: "retired",
      updatedAt: "2026-06-19T23:35:00.000Z",
    });
    expect(retired.event).toMatchObject({
      type: "instruction.retired",
      occurredAt: "2026-06-19T23:35:00.000Z",
      payload: {
        instructionRef: instruction.instructionRef,
        retiredBy: { kind: "user", ref: "user:manager-1" },
        reason: "House style moved into the dossier template.",
      },
    });
    expect(runtime.listInstructions({ tenantId: "tenant-a", status: "retired" })).toEqual([retired.instruction]);
    expect(runtime.composeInstructionSet({ tenantId: "tenant-a", scope: { period: "FY2026" } })).toMatchObject({
      setHash: null,
      refs: [],
      instructions: [],
    });
  });
});
