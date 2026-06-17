// ── Domain types ────────────────────────────────────────────────────────────

export type Role = "vp" | "manager" | "analyst" | "adjacent" | "admin";
export type Permission = "allowed" | "visible-disabled" | "hidden";
export type Capability =
  | "see_sensitive_tier"
  | "promote_gates"
  | "methodology_instructions"
  | "run_stages"
  | "verification_answers"
  | "connector_policy"
  | "content_access"
  | "view_admin";

export type CapabilityMap = Record<Capability, Permission>;
export type RoleCapabilityMap = Record<Role, CapabilityMap>;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
}

export interface Entity {
  id: string;
  name: string;
  role: "principal" | "limited-risk" | "commissionnaire" | "services-hub";
  jurisdiction: string;
  jurisdictionCode: string;
  status: "active" | "dormant" | "liquidating";
  taxResidency: string;
  functionalProfile: string;
  asOf: string;
}

export interface Flow {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  kind: "royalty" | "service" | "loan" | "goods" | "guarantee";
  method: string;
  status: "verified" | "exception" | "drift";
  exposure: number;
  currency: string;
  policyRate: number;
  observedRate: number;
  agreementId?: string;
}

export interface Finding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  status:
    | "detected"
    | "triaged"
    | "in-remediation"
    | "reviewed"
    | "resolved"
    | "verify-next-cycle";
  exposure: number;
  currency: string;
  assigneeId?: string;
  reviewerState: "unreviewed" | "confirmed" | "dismissed";
  flowId: string;
  age: number;
  ruleId: string;
  confidence: number;
}

export interface Document {
  id: string;
  name: string;
  type: "local-file" | "master-file" | "ica" | "benchmark" | "memo" | "board-pack";
  custody: "materialized" | "extract-only" | "reference";
  sensitivity: "standard" | "sensitive" | "privileged";
  jurisdiction: string;
  fy: string;
  version: number;
  hash: string;
  sourcePath: string;
  entityIds: string[];
}

export interface ToolCall {
  tool: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

export interface RunStep {
  id: string;
  name: string;
  status: "queued" | "running" | "done" | "failed";
  durationMs?: number;
  toolCalls?: ToolCall[];
}

export interface RunOutput {
  id: string;
  type: string;
  name: string;
  objectRef: string;
}

export interface Run {
  id: string;
  stage: string;
  scope: string;
  initiator: "user" | "watcher" | "system";
  initiatorId: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  steps: RunStep[];
  outputs: RunOutput[];
  corpusVersion: string;
  rulepackVersion: string;
  modelVersion: string;
  costClass: "instant" | "fast" | "standard" | "batch";
  startedAt: string;
}

export interface Obligation {
  id: string;
  name: string;
  entityId: string;
  jurisdiction: string;
  due: string;
  status: "upcoming" | "filed" | "overdue" | "snoozed";
  ownerId: string;
  linkedArtifactId?: string;
}

export interface Commitment {
  id: string;
  text: string;
  source: "meeting" | "email";
  sourceRef: string;
  due: string;
  ownerId: string;
  linkedObjectId?: string;
  planState: "pending" | "approved" | "dismissed" | "completed" | "external";
}

export interface GateRequest {
  id: string;
  objectId: string;
  objectType: string;
  objectName: string;
  requesterId: string;
  slaHours: number;
  slaStarted: string;
  escalationPath: string;
  delegateId?: string;
}

export type EventType =
  | "finding_created"
  | "finding_resolved"
  | "run_completed"
  | "gate_requested"
  | "document_ingested"
  | "staleness_detected"
  | "obligation_due";

export interface Event {
  id: string;
  type: EventType;
  timestamp: string;
  actorId: string;
  description: string;
  objectRef: string;
  objectType: string;
}
