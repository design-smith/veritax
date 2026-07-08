const CONTENT_KEYS = new Set([
  "answer",
  "body",
  "comment",
  "content",
  "description",
  "docname",
  "fieldvalue",
  "freeform",
  "freetext",
  "html",
  "label",
  "memo",
  "narrative",
  "prompt",
  "question",
  "raw",
  "reason",
  "snippet",
  "summary",
  "text",
  "title",
  "transcript",
  "value",
]);

export interface TelemetryObjectRef {
  objectType: string;
  objectId: string;
}

export type TelemetryMetadataValue =
  | string
  | number
  | boolean
  | null
  | TelemetryMetadataValue[]
  | { [key: string]: TelemetryMetadataValue };

export type TelemetryMetadata = Record<string, TelemetryMetadataValue>;

export interface CreateTelemetryEventInput {
  name: string;
  tenantId: string;
  actorId?: string;
  surface?: string;
  objectRef?: TelemetryObjectRef;
  metadata?: TelemetryMetadata;
  eventId?: string;
  occurredAt?: string;
}

export interface MetadataTelemetryEvent {
  schemaVersion: 1;
  eventId: string;
  name: string;
  tenantId: string;
  actorId?: string;
  surface?: string;
  objectRef?: TelemetryObjectRef;
  metadata: TelemetryMetadata;
  occurredAt: string;
}

export interface TrackTelemetryOptions {
  transport?: (event: MetadataTelemetryEvent) => Promise<void>;
  endpoint?: string;
}

export function createTelemetryEvent(input: CreateTelemetryEventInput): MetadataTelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: input.eventId ?? createEventId(),
    name: input.name,
    tenantId: input.tenantId,
    actorId: input.actorId,
    surface: input.surface,
    objectRef: input.objectRef,
    metadata: sanitizeTelemetryMetadata(input.metadata ?? {}),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}

export async function trackTelemetryEvent(
  event: MetadataTelemetryEvent,
  options: TrackTelemetryOptions = {},
) {
  const sanitized = {
    ...event,
    metadata: sanitizeTelemetryMetadata(event.metadata),
  };

  if (options.transport) {
    await options.transport(sanitized);
    return;
  }

  const body = JSON.stringify(sanitized);
  const endpoint = options.endpoint ?? "/telemetry";

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon(endpoint, body);
    return;
  }

  if (typeof fetch !== "undefined") {
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  }
}

export function sanitizeTelemetryMetadata(metadata: TelemetryMetadata): TelemetryMetadata {
  return sanitizeObject(metadata);
}

export function createTelemetryMemoryTransport() {
  const events: MetadataTelemetryEvent[] = [];

  return {
    events,
    send: async (event: MetadataTelemetryEvent) => {
      events.push({
        ...event,
        metadata: sanitizeTelemetryMetadata(event.metadata),
      });
    },
  };
}

export interface FrontendTelemetrySummary {
  activation: {
    timeToFirstCitationOpenedMs: number | null;
    onboardingRevealReachedWithin48h: boolean;
  };
  trust: {
    citationResolutionSuccessRate: number | null;
    provenancePopoverEngagements: number;
    quarantinedClaimCount: number;
  };
  throughput: {
    verificationAnswersBySession: Record<string, number>;
    gateLatencyP50Ms: number | null;
    gateLatencyP95Ms: number | null;
    rebuildProposalAcceptanceRate: number | null;
  };
  adoption: {
    wauBySurface: Record<string, number>;
    askAnswerAcceptedCount: number;
    savedViewCreationCount: number;
    commitmentsApprovedPlanCount: number;
  };
}

export function summarizeFrontendTelemetry(events: MetadataTelemetryEvent[]): FrontendTelemetrySummary {
  const sorted = [...events].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const firstUpload = sorted.find((event) => event.name === "activation.first_upload_received");
  const firstCitationOpened = sorted.find((event) => event.name === "trust.citation_opened");
  const revealReached = sorted.find((event) => event.name === "activation.onboarding_reveal_reached");

  const timeToFirstCitationOpenedMs =
    firstUpload && firstCitationOpened
      ? Math.max(0, Date.parse(firstCitationOpened.occurredAt) - Date.parse(firstUpload.occurredAt))
      : null;

  const revealWithin48h =
    Boolean(firstUpload && revealReached) &&
    Math.max(0, Date.parse(revealReached!.occurredAt) - Date.parse(firstUpload!.occurredAt)) <= 48 * 60 * 60 * 1000;

  const citationResolutionEvents = sorted.filter((event) => event.name === "trust.citation_resolution_observed");
  const resolvedCitationCount = citationResolutionEvents.filter((event) => event.metadata.resolved === true).length;
  const citationResolutionSuccessRate =
    citationResolutionEvents.length > 0 ? resolvedCitationCount / citationResolutionEvents.length : null;

  const verificationAnswersBySession: Record<string, number> = {};
  sorted
    .filter((event) => event.name === "throughput.verification_answer_submitted")
    .forEach((event) => {
      const sessionId = typeof event.metadata.sessionId === "string" ? event.metadata.sessionId : "unknown";
      verificationAnswersBySession[sessionId] = (verificationAnswersBySession[sessionId] ?? 0) + 1;
    });

  const gateLatencies = sorted
    .filter((event) => event.name === "throughput.gate_decision_observed")
    .map((event) => event.metadata.latencyMs)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  const rebuildProposalEvents = sorted.filter((event) => event.name === "throughput.rebuild_proposal_decision");
  const acceptedRebuildProposalCount = rebuildProposalEvents.filter((event) => event.metadata.decision === "accepted").length;
  const rebuildProposalAcceptanceRate =
    rebuildProposalEvents.length > 0 ? acceptedRebuildProposalCount / rebuildProposalEvents.length : null;

  const visitorsBySurface = new Map<string, Set<string>>();
  sorted
    .filter((event) => event.name === "adoption.surface_visited")
    .forEach((event) => {
      const surface = event.surface ?? (typeof event.metadata.surface === "string" ? event.metadata.surface : "unknown");
      const actor = event.actorId ?? "anonymous";
      if (!visitorsBySurface.has(surface)) {
        visitorsBySurface.set(surface, new Set());
      }
      visitorsBySurface.get(surface)!.add(actor);
    });

  const wauBySurface: Record<string, number> = {};
  visitorsBySurface.forEach((actors, surface) => {
    wauBySurface[surface] = actors.size;
  });

  return {
    activation: {
      timeToFirstCitationOpenedMs,
      onboardingRevealReachedWithin48h: revealWithin48h,
    },
    trust: {
      citationResolutionSuccessRate,
      provenancePopoverEngagements: sorted.filter((event) => event.name === "trust.provenance_opened").length,
      quarantinedClaimCount: sorted.filter((event) => event.name === "trust.quarantined_claim_rendered").length,
    },
    throughput: {
      verificationAnswersBySession,
      gateLatencyP50Ms: percentileNearestRank(gateLatencies, 0.5),
      gateLatencyP95Ms: percentileNearestRank(gateLatencies, 0.95),
      rebuildProposalAcceptanceRate,
    },
    adoption: {
      wauBySurface,
      askAnswerAcceptedCount: sorted.filter((event) => event.name === "adoption.ask_answer_accepted").length,
      savedViewCreationCount: sorted.filter((event) => event.name === "adoption.saved_view_created").length,
      commitmentsApprovedPlanCount: sorted.filter((event) => event.name === "adoption.commitment_plan_approved").length,
    },
  };
}

function sanitizeObject(value: Record<string, TelemetryMetadataValue>): TelemetryMetadata {
  const result: TelemetryMetadata = {};

  for (const [key, child] of Object.entries(value)) {
    if (CONTENT_KEYS.has(key.toLowerCase())) {
      continue;
    }

    const sanitized = sanitizeValue(child);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }

  return result;
}

function sanitizeValue(value: TelemetryMetadataValue): TelemetryMetadataValue | undefined {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item): item is TelemetryMetadataValue => item !== undefined);
  }

  if (value && typeof value === "object") {
    const sanitized = sanitizeObject(value);
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  return value;
}

function percentileNearestRank(values: number[], percentile: number) {
  if (values.length === 0) return null;
  const index = Math.max(0, Math.ceil(values.length * percentile) - 1);
  return values[Math.min(index, values.length - 1)];
}

function createEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
