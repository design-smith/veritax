import {
  createTelemetryEvent,
  type CreateTelemetryEventInput,
  type TelemetryMetadata,
  type TelemetryMetadataValue,
  type MetadataTelemetryEvent,
  type TelemetryObjectRef,
} from "@/lib/telemetry/metadata-telemetry";

export interface FrontendTelemetryContext {
  tenantId: string;
  actorId?: string;
  sessionId?: string;
}

export interface SurfaceTelemetryContext extends FrontendTelemetryContext {
  surface: string;
}

export interface ObjectTelemetryContext extends SurfaceTelemetryContext {
  objectRef?: TelemetryObjectRef;
}

export const DEMO_FRONTEND_TELEMETRY_CONTEXT: FrontendTelemetryContext = {
  tenantId: "veritax-demo",
  actorId: "u3",
  sessionId: "demo-session",
};

type CitationResolutionOutcome = "resolved" | "unresolved";
type GateDecision = "approved" | "changes-requested" | "rejected" | "delegated";
type RebuildProposalDecision = "accepted" | "skipped";
type AskConfidenceBand = "high" | "medium" | "low" | "refusal";

declare global {
  interface Window {
    __veritaxTelemetryEvents?: MetadataTelemetryEvent[];
  }
}

export function createFirstUploadReceivedEvent(input: FrontendTelemetryContext & {
  fileCount: number;
  sourceType: "drag-drop" | "email-forward" | "connector";
  uploadBatchId: string;
}) {
  return createProductEvent({
    name: "activation.first_upload_received",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: "onboarding",
    metadata: metadata({
      sessionId: input.sessionId,
      fileCount: input.fileCount,
      sourceType: input.sourceType,
      uploadBatchId: input.uploadBatchId,
    }),
  });
}

export function createOnboardingRevealReachedEvent(input: FrontendTelemetryContext & {
  firstUploadAt?: string;
  findingCount: number;
}) {
  return createProductEvent({
    name: "activation.onboarding_reveal_reached",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: "onboarding",
    metadata: metadata({
      sessionId: input.sessionId,
      firstUploadAt: input.firstUploadAt,
      findingCount: input.findingCount,
    }),
  });
}

export function createCitationOpenedEvent(input: ObjectTelemetryContext & {
  citationId: string;
}) {
  return createProductEvent({
    name: "trust.citation_opened",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    objectRef: input.objectRef,
    metadata: metadata({
      sessionId: input.sessionId,
      citationId: input.citationId,
    }),
  });
}

export function createCitationResolutionEvent(input: SurfaceTelemetryContext & {
  citationId: string;
  resolved: boolean;
}) {
  const outcome: CitationResolutionOutcome = input.resolved ? "resolved" : "unresolved";
  return createProductEvent({
    name: "trust.citation_resolution_observed",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    metadata: metadata({
      sessionId: input.sessionId,
      citationId: input.citationId,
      resolved: input.resolved,
      outcome,
    }),
  });
}

export function createProvenanceOpenedEvent(input: ObjectTelemetryContext & {
  hopCount: number;
}) {
  return createProductEvent({
    name: "trust.provenance_opened",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    objectRef: input.objectRef,
    metadata: metadata({
      sessionId: input.sessionId,
      hopCount: input.hopCount,
    }),
  });
}

export function createQuarantinedClaimRenderedEvent(input: ObjectTelemetryContext & {
  claimClass: string;
}) {
  return createProductEvent({
    name: "trust.quarantined_claim_rendered",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    objectRef: input.objectRef,
    metadata: metadata({
      sessionId: input.sessionId,
      claimClass: input.claimClass,
    }),
  });
}

export function createVerificationAnswerSubmittedEvent(input: FrontendTelemetryContext & {
  category: string;
  answerIndex: number;
}) {
  return createProductEvent({
    name: "throughput.verification_answer_submitted",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: "verification-queue",
    metadata: metadata({
      sessionId: input.sessionId,
      category: input.category,
      answerIndex: input.answerIndex,
    }),
  });
}

export function createGateDecisionEvent(input: FrontendTelemetryContext & {
  gateId: string;
  decision: GateDecision;
  latencyMs?: number;
}) {
  return createProductEvent({
    name: "throughput.gate_decision_observed",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: "gates",
    objectRef: { objectType: "gate", objectId: input.gateId },
    metadata: metadata({
      sessionId: input.sessionId,
      gateId: input.gateId,
      decision: input.decision,
      latencyMs: input.latencyMs,
    }),
  });
}

export function createRebuildProposalDecisionEvent(input: FrontendTelemetryContext & {
  proposalId: string;
  decision: RebuildProposalDecision;
}) {
  return createProductEvent({
    name: "throughput.rebuild_proposal_decision",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: "staleness",
    objectRef: { objectType: "rebuild-proposal", objectId: input.proposalId },
    metadata: metadata({
      sessionId: input.sessionId,
      proposalId: input.proposalId,
      decision: input.decision,
    }),
  });
}

export function createSurfaceVisitedEvent(input: SurfaceTelemetryContext) {
  return createProductEvent({
    name: "adoption.surface_visited",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    metadata: metadata({
      sessionId: input.sessionId,
      surface: input.surface,
    }),
  });
}

export function createAskAnswerAcceptedEvent(input: SurfaceTelemetryContext & {
  answerId: string;
  confidenceBand: AskConfidenceBand;
}) {
  return createProductEvent({
    name: "adoption.ask_answer_accepted",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    objectRef: { objectType: "ask-answer", objectId: input.answerId },
    metadata: metadata({
      sessionId: input.sessionId,
      answerId: input.answerId,
      confidenceBand: input.confidenceBand,
    }),
  });
}

export function createSavedViewCreatedEvent(input: SurfaceTelemetryContext & {
  viewId: string;
  filterCount: number;
}) {
  return createProductEvent({
    name: "adoption.saved_view_created",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    objectRef: { objectType: "saved-view", objectId: input.viewId },
    metadata: metadata({
      sessionId: input.sessionId,
      viewId: input.viewId,
      filterCount: input.filterCount,
    }),
  });
}

export function createCommitmentPlanApprovedEvent(input: SurfaceTelemetryContext & {
  commitmentId: string;
}) {
  return createProductEvent({
    name: "adoption.commitment_plan_approved",
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    objectRef: { objectType: "commitment", objectId: input.commitmentId },
    metadata: metadata({
      sessionId: input.sessionId,
      commitmentId: input.commitmentId,
    }),
  });
}

export function recordFrontendTelemetryEvent(
  input: CreateTelemetryEventInput | MetadataTelemetryEvent,
): MetadataTelemetryEvent {
  const event = createProductEvent({
    name: input.name,
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    objectRef: input.objectRef,
    metadata: input.metadata,
    eventId: "eventId" in input ? input.eventId : undefined,
    occurredAt: "occurredAt" in input ? input.occurredAt : undefined,
  });

  if (typeof window === "undefined") {
    return event;
  }

  window.__veritaxTelemetryEvents = window.__veritaxTelemetryEvents ?? [];
  window.__veritaxTelemetryEvents.push(event);
  window.dispatchEvent(new CustomEvent("veritax:telemetry", { detail: event }));

  return event;
}

export function getRecordedFrontendTelemetryEvents(): MetadataTelemetryEvent[] {
  if (typeof window === "undefined") return [];
  return [...(window.__veritaxTelemetryEvents ?? [])];
}

export function clearRecordedFrontendTelemetryEvents() {
  if (typeof window !== "undefined") {
    window.__veritaxTelemetryEvents = [];
  }
}

export function recordSurfaceVisited(
  pathname: string,
  context: FrontendTelemetryContext = DEMO_FRONTEND_TELEMETRY_CONTEXT,
): MetadataTelemetryEvent {
  return recordFrontendTelemetryEvent(
    createSurfaceVisitedEvent({
      ...context,
      surface: surfaceFromPathname(pathname),
    }),
  );
}

export function surfaceFromPathname(pathname: string) {
  const [first = "", second = ""] = pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);

  if (!first) return "home";
  if (first === "portal" && second) return `portal-${second}`;
  if (first === "ask" && second) return "ask";
  if (first === "graph" && second === "flows") return "graph";
  if (first === "commitments" && second === "meetings") return "commitments";

  return first;
}

function metadata(values: Record<string, TelemetryMetadataValue | undefined>): TelemetryMetadata {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, TelemetryMetadataValue] => entry[1] !== undefined),
  );
}

function createProductEvent(input: Parameters<typeof createTelemetryEvent>[0]): MetadataTelemetryEvent {
  return createTelemetryEvent(input);
}
