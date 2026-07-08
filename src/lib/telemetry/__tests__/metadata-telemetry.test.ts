import { afterEach, describe, expect, it } from "vitest";

import {
  createTelemetryEvent,
  createTelemetryMemoryTransport,
  summarizeFrontendTelemetry,
  trackTelemetryEvent,
} from "../metadata-telemetry";
import {
  clearRecordedFrontendTelemetryEvents,
  createAskAnswerAcceptedEvent,
  createCitationOpenedEvent,
  createCitationResolutionEvent,
  createCommitmentPlanApprovedEvent,
  createFirstUploadReceivedEvent,
  createGateDecisionEvent,
  createOnboardingRevealReachedEvent,
  createProvenanceOpenedEvent,
  createQuarantinedClaimRenderedEvent,
  createRebuildProposalDecisionEvent,
  createSavedViewCreatedEvent,
  createSurfaceVisitedEvent,
  createVerificationAnswerSubmittedEvent,
  getRecordedFrontendTelemetryEvents,
  recordFrontendTelemetryEvent,
  recordSurfaceVisited,
} from "../product-telemetry";

describe("metadata telemetry", () => {
  afterEach(() => {
    clearRecordedFrontendTelemetryEvents();
  });

  it("keeps operational metadata and strips content-bearing fields", () => {
    const event = createTelemetryEvent({
      name: "citation.opened",
      tenantId: "tenant-1",
      actorId: "user-1",
      surface: "findings",
      objectRef: { objectType: "finding", objectId: "finding-1" },
      metadata: {
        citationCount: 2,
        status: "opened",
        snippet: "The royalty rate applied is 18%",
        question: "Explain the whole file",
        nested: {
          prompt: "Use the confidential meeting transcript",
          route: "viewer",
        },
      },
    });

    expect(event).toMatchObject({
      schemaVersion: 1,
      name: "citation.opened",
      tenantId: "tenant-1",
      actorId: "user-1",
      surface: "findings",
      objectRef: { objectType: "finding", objectId: "finding-1" },
      metadata: {
        citationCount: 2,
        status: "opened",
        nested: { route: "viewer" },
      },
    });
    expect(JSON.stringify(event)).not.toContain("royalty rate");
    expect(JSON.stringify(event)).not.toContain("Explain the whole file");
    expect(JSON.stringify(event)).not.toContain("confidential meeting");
  });

  it("sends sanitized events through a real in-memory transport", async () => {
    const transport = createTelemetryMemoryTransport();
    const event = createTelemetryEvent({
      name: "gate.latency.observed",
      tenantId: "tenant-1",
      actorId: "user-1",
      metadata: { latencyMs: 1200, comment: "This free text should not leave" },
    });

    await trackTelemetryEvent(event, { transport: transport.send });

    expect(transport.events).toHaveLength(1);
    expect(transport.events[0]).toMatchObject({
      name: "gate.latency.observed",
      metadata: { latencyMs: 1200 },
    });
    expect(JSON.stringify(transport.events[0])).not.toContain("free text");
  });

  it("creates activation and trust events without content payloads", () => {
    const common = { tenantId: "tenant-1", actorId: "user-1", sessionId: "session-1" };
    const events = [
      createFirstUploadReceivedEvent({ ...common, fileCount: 3, sourceType: "drag-drop", uploadBatchId: "batch-1" }),
      createOnboardingRevealReachedEvent({ ...common, firstUploadAt: "2026-06-18T10:00:00.000Z", findingCount: 15 }),
      createCitationOpenedEvent({ ...common, surface: "findings", objectRef: { objectType: "finding", objectId: "finding-1" }, citationId: "cite-1" }),
      createCitationResolutionEvent({ ...common, surface: "library", citationId: "cite-1", resolved: true }),
      createProvenanceOpenedEvent({ ...common, surface: "graph", objectRef: { objectType: "flow", objectId: "flow-1" }, hopCount: 4 }),
      createQuarantinedClaimRenderedEvent({ ...common, surface: "factory", objectRef: { objectType: "artifact", objectId: "draft-1" }, claimClass: "uncited" }),
    ];

    expect(events.map((event) => event.name)).toEqual([
      "activation.first_upload_received",
      "activation.onboarding_reveal_reached",
      "trust.citation_opened",
      "trust.citation_resolution_observed",
      "trust.provenance_opened",
      "trust.quarantined_claim_rendered",
    ]);
    expect(JSON.stringify(events)).not.toContain("Local File");
    expect(JSON.stringify(events)).not.toContain("question");
  });

  it("creates throughput and adoption events with session-safe metadata", () => {
    const common = { tenantId: "tenant-1", actorId: "user-1", sessionId: "session-1" };
    const events = [
      createVerificationAnswerSubmittedEvent({ ...common, category: "account-mapping", answerIndex: 1 }),
      createGateDecisionEvent({ ...common, gateId: "gate-1", decision: "approved", latencyMs: 3_600_000 }),
      createRebuildProposalDecisionEvent({ ...common, proposalId: "proposal-1", decision: "accepted" }),
      createSurfaceVisitedEvent({ ...common, surface: "findings" }),
      createAskAnswerAcceptedEvent({ ...common, surface: "ask", answerId: "answer-1", confidenceBand: "high" }),
      createSavedViewCreatedEvent({ ...common, surface: "findings", viewId: "view-1", filterCount: 2 }),
      createCommitmentPlanApprovedEvent({ ...common, surface: "commitments", commitmentId: "commitment-1" }),
    ];

    expect(events.map((event) => event.name)).toEqual([
      "throughput.verification_answer_submitted",
      "throughput.gate_decision_observed",
      "throughput.rebuild_proposal_decision",
      "adoption.surface_visited",
      "adoption.ask_answer_accepted",
      "adoption.saved_view_created",
      "adoption.commitment_plan_approved",
    ]);
    expect(JSON.stringify(events)).not.toContain("approved plan text");
  });

  it("summarizes PRD-01 frontend metrics from recorded events", () => {
    const common = { tenantId: "tenant-1", actorId: "user-1", sessionId: "session-1" };
    const events = [
      { ...createFirstUploadReceivedEvent({ ...common, fileCount: 1, sourceType: "drag-drop", uploadBatchId: "batch-1" }), occurredAt: "2026-06-18T10:00:00.000Z" },
      { ...createCitationOpenedEvent({ ...common, surface: "findings", objectRef: { objectType: "finding", objectId: "finding-1" }, citationId: "cite-1" }), occurredAt: "2026-06-18T10:30:00.000Z" },
      { ...createOnboardingRevealReachedEvent({ ...common, firstUploadAt: "2026-06-18T10:00:00.000Z", findingCount: 15 }), occurredAt: "2026-06-19T09:00:00.000Z" },
      createCitationResolutionEvent({ ...common, surface: "library", citationId: "cite-1", resolved: true }),
      createCitationResolutionEvent({ ...common, surface: "library", citationId: "cite-2", resolved: false }),
      createProvenanceOpenedEvent({ ...common, surface: "graph", objectRef: { objectType: "flow", objectId: "flow-1" }, hopCount: 4 }),
      createQuarantinedClaimRenderedEvent({ ...common, surface: "factory", objectRef: { objectType: "artifact", objectId: "draft-1" }, claimClass: "uncited" }),
      createVerificationAnswerSubmittedEvent({ ...common, category: "account-mapping", answerIndex: 1 }),
      createVerificationAnswerSubmittedEvent({ ...common, category: "entity-merge", answerIndex: 2 }),
      createGateDecisionEvent({ ...common, gateId: "gate-1", decision: "approved", latencyMs: 3_600_000 }),
      createGateDecisionEvent({ ...common, gateId: "gate-2", decision: "rejected", latencyMs: 7_200_000 }),
      createRebuildProposalDecisionEvent({ ...common, proposalId: "proposal-1", decision: "accepted" }),
      createRebuildProposalDecisionEvent({ ...common, proposalId: "proposal-2", decision: "skipped" }),
      createSurfaceVisitedEvent({ ...common, surface: "findings" }),
      createSurfaceVisitedEvent({ tenantId: "tenant-1", actorId: "user-2", sessionId: "session-2", surface: "findings" }),
      createAskAnswerAcceptedEvent({ ...common, surface: "ask", answerId: "answer-1", confidenceBand: "high" }),
      createSavedViewCreatedEvent({ ...common, surface: "findings", viewId: "view-1", filterCount: 2 }),
      createCommitmentPlanApprovedEvent({ ...common, surface: "commitments", commitmentId: "commitment-1" }),
    ];

    expect(summarizeFrontendTelemetry(events)).toMatchObject({
      activation: {
        timeToFirstCitationOpenedMs: 1_800_000,
        onboardingRevealReachedWithin48h: true,
      },
      trust: {
        citationResolutionSuccessRate: 0.5,
        provenancePopoverEngagements: 1,
        quarantinedClaimCount: 1,
      },
      throughput: {
        verificationAnswersBySession: { "session-1": 2 },
        gateLatencyP50Ms: 3_600_000,
        gateLatencyP95Ms: 7_200_000,
        rebuildProposalAcceptanceRate: 0.5,
      },
      adoption: {
        wauBySurface: { findings: 2 },
        askAnswerAcceptedCount: 1,
        savedViewCreationCount: 1,
        commitmentsApprovedPlanCount: 1,
      },
    });
  });

  it("records sanitized frontend telemetry for browser consumers", () => {
    const captured: string[] = [];
    const onTelemetry = (event: Event) => {
      captured.push((event as CustomEvent<{ name: string }>).detail.name);
    };

    window.addEventListener("veritax:telemetry", onTelemetry);
    recordFrontendTelemetryEvent({
      name: "trust.citation_opened",
      tenantId: "tenant-1",
      actorId: "user-1",
      surface: "findings",
      metadata: {
        citationId: "citation-1",
        snippet: "Do not capture source text",
      },
    });
    window.removeEventListener("veritax:telemetry", onTelemetry);

    expect(captured).toEqual(["trust.citation_opened"]);
    expect(getRecordedFrontendTelemetryEvents()).toHaveLength(1);
    expect(getRecordedFrontendTelemetryEvents()[0]).toMatchObject({
      name: "trust.citation_opened",
      metadata: { citationId: "citation-1" },
    });
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("source text");
  });

  it("records surface visits from app pathnames", () => {
    recordSurfaceVisited("/findings/fn-1");
    recordSurfaceVisited("/portal/advisor");

    expect(getRecordedFrontendTelemetryEvents()).toMatchObject([
      { name: "adoption.surface_visited", surface: "findings" },
      { name: "adoption.surface_visited", surface: "portal-advisor" },
    ]);
  });
});
