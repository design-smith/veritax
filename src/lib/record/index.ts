import { createHash } from "node:crypto";

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const OBJECT_TYPE_PATTERN = /^[a-z][a-z0-9_]*$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type RecordErrorCode =
  | "INVALID_TENANT"
  | "INVALID_REF"
  | "INVALID_LENS"
  | "INVALID_ASSERTION"
  | "ASSERTION_NOT_FOUND"
  | "PROVENANCE_INCOMPLETE"
  | "INVALID_CANONICAL_OBJECT"
  | "CANONICAL_APPROVAL_REQUIRED"
  | "INVALID_STAGING_OBJECT"
  | "STAGING_OBJECT_NOT_FOUND"
  | "INVALID_GATE"
  | "GATE_NOT_FOUND"
  | "INVALID_PRECEDENCE_POLICY"
  | "PRECEDENCE_POLICY_NOT_FOUND"
  | "INVALID_ENTITY_ALIAS"
  | "ENTITY_ALIAS_NOT_FOUND"
  | "INVALID_ACCOUNT_MAPPING"
  | "ACCOUNT_MAPPING_NOT_FOUND"
  | "INVALID_INGESTION_BATCH"
  | "INVALID_MANIFEST"
  | "MANIFEST_NOT_FOUND"
  | "INVALID_ARTIFACT"
  | "ARTIFACT_NOT_FOUND"
  | "INVALID_DEPENDENCY"
  | "INVALID_STALENESS"
  | "INVALID_PERIOD"
  | "PERIOD_NOT_FOUND"
  | "PERIOD_SEALED"
  | "INVALID_INSTRUCTION"
  | "INSTRUCTION_NOT_FOUND"
  | "TENANT_ACCESS_DENIED"
  | "LENS_REQUIRED"
  | "INVALID_ACTOR"
  | "INVALID_EVENT_TYPE"
  | "INVALID_EVENT_PAYLOAD"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "EVENT_CHAIN_INVALID"
  | "TRANSACTION_ROLLED_BACK";

export class RecordError extends Error {
  readonly code: RecordErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: RecordErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RecordError";
    this.code = code;
    this.details = details;
  }
}

export interface RecordRef {
  objectType: string;
  objectId: string;
  version?: number;
}

export interface TenantScopedRecordRef {
  tenantId: string;
  ref: RecordRef;
}

export interface RecordLens {
  validAt: string;
  knownAt: string;
}

export interface CreateRecordLensInput {
  validAt: string | Date;
  knownAt: string | Date;
}

export interface CreateRecordIdentityInput {
  tenantId: string;
  objectType: string;
  version?: number;
}

export interface CreateRecordServiceOptions {
  staleness?: {
    synchronousEdgeLimit?: number;
  };
}

export interface GetCanonicalInput {
  tenantId: string;
  ref: RecordRef;
  lens?: RecordLens;
}

export interface RecordReadAccess {
  tenantId: string;
  allowedTenantIds?: string[];
}

export type RecordRefQueryKind = "canonical";

export interface GetRefInput {
  tenantId: string;
  ref: RecordRef;
  lens?: RecordLens;
  access?: RecordReadAccess;
}

export interface GetRefResult {
  tenantId: string;
  ref: RecordRef;
  kind: RecordRefQueryKind;
  lens: RecordLens;
  value: CanonicalRecordRow;
}

export interface GetTimelineInput {
  tenantId: string;
  ref: RecordRef;
  access?: RecordReadAccess;
}

export interface GetTimelineResult {
  tenantId: string;
  ref: RecordRef;
  events: RecordEvent[];
}

export type RecordSubgraphDirection = "upstream" | "downstream" | "both";

export interface GetSubgraphInput {
  tenantId: string;
  root: RecordRef;
  lens?: RecordLens;
  access?: RecordReadAccess;
  direction?: RecordSubgraphDirection;
  depth?: number;
}

export interface RecordSubgraphNode {
  ref: RecordRef;
  value: CanonicalRecordRow | null;
}

export interface RecordSubgraphEdge {
  dependencyId: string;
  upstreamRef: RecordRef;
  downstreamRef: RecordRef;
  kind: string;
}

export interface RecordSubgraphResult {
  tenantId: string;
  root: RecordRef;
  lens: RecordLens;
  nodes: RecordSubgraphNode[];
  edges: RecordSubgraphEdge[];
}

export type RecordActor =
  | { kind: "user"; id: string; onBehalfOf?: string }
  | { kind: "agent"; id: string; onBehalfOf?: string }
  | { kind: "system"; id: string };

export interface RecordAssertionSubject {
  objectRef: RecordRef;
  field: string;
}

export interface RecordAssertionScopeKeys {
  entityIds: string[];
  jurisdictions: string[];
}

export interface RecordScopePredicate {
  entityIds?: string[];
  jurisdictions?: string[];
  objectRefs?: RecordRef[];
}

export interface RecordSensitivityPredicate {
  maxSensitivity: 0 | 1 | 2;
}

export type RecordAssertionSource =
  | {
      kind: "extraction";
      docRef: RecordRef;
      span: { start: number; end: number };
      extractorVersion: string;
    }
  | {
      kind: "engine";
      rulepackVersion: string;
      engineId: string;
    }
  | {
      kind: "human";
      userId: string;
    }
  | {
      kind: "reviewer";
      userId: string;
      reviewRef?: RecordRef;
    };

export interface RecordAssertionInput {
  subject: RecordAssertionSubject;
  value: unknown;
  validFrom: string | Date;
  validTo?: string | Date | null;
  assertedAt?: string | Date;
  source: RecordAssertionSource;
  confidence?: number | null;
  supersedes?: string | null;
  sensitivity?: 0 | 1 | 2;
  scopeKeys?: Partial<RecordAssertionScopeKeys>;
}

export interface RecordAssertion {
  tenantId: string;
  assertionId: string;
  subject: RecordAssertionSubject;
  value: unknown;
  validFrom: string;
  validTo: string | null;
  assertedAt: string;
  retractedAt: string | null;
  source: RecordAssertionSource;
  confidence: number | null;
  supersedes: string | null;
  sensitivity: 0 | 1 | 2;
  scopeKeys: RecordAssertionScopeKeys;
}

export interface RecordEvent {
  tenantId: string;
  eventId: string;
  seq: number;
  type: string;
  actor: RecordActor;
  payload: Record<string, unknown>;
  occurredAt: string;
  manifestRef?: string;
  prevHash: string | null;
  hash: string;
}

export interface EventChainVerification {
  ok: boolean;
  checkedEvents: number;
  lastHash: string | null;
  brokenAtSeq?: number;
  reason?: string;
}

export interface DomainOutboxEntry {
  tenantId: string;
  offset: number;
  event: RecordEvent;
  delivered: boolean;
  committedAt: string;
  enqueuedAt: string;
}

export type RecordArchitectureDecisionId =
  | "event-sourcing-live-v0"
  | "postgres-log-scale-out-trigger"
  | "event-log-partitioning-baseline";

export interface RecordArchitectureDecision {
  id: RecordArchitectureDecisionId;
  title: string;
  status: "accepted";
  source: string;
  decidedAt: string;
  implementation: Record<string, unknown>;
  rationale: string;
}

export type RecordMigrationWave = "v0" | "v1" | "v2";
export type RecordMigrationStatus = "active" | "planned";

export interface RecordMigrationPlan {
  wave: RecordMigrationWave;
  title: string;
  source: string;
  status: RecordMigrationStatus;
  capabilities: string[];
  releaseGates: string[];
  exitCriteria: string[];
}

export interface EventLogPartitionsInput {
  tenantId?: string;
}

export interface EventLogPartition {
  tenantId: string;
  partitionKey: string;
  partitionBy: "tenant_id";
  eventCount: number;
  firstSeq: number | null;
  lastSeq: number | null;
  lastHash: string | null;
  scaleOutReviewDue: boolean;
  scaleOutTriggerEventsPerTenant: number;
}

export interface EventLagMetricsInput {
  tenantId: string;
}

export interface EventLagMetrics {
  tenantId: string;
  sampleCount: number;
  lastEnqueuedOffset: number;
  targetP95Ms: number;
  p95CommitToConsumerMs: number;
  maxCommitToConsumerMs: number;
  withinTarget: boolean;
}

export type RecordMetricStatus = "pass" | "fail";

export interface RecordReplaySampleInput {
  artifactId: string;
  renderedContent: string | Uint8Array;
}

export interface RecordMetricsDashboardInput {
  tenantId: string;
  generatedAt?: string | Date;
  replaySamples?: RecordReplaySampleInput[];
}

export interface RecordReleaseGateSummary {
  status: RecordMetricStatus;
  invariantFailures: number;
  blockingMetrics: string[];
}

export interface RecordInvariantDashboardSummary {
  status: RecordMetricStatus;
  total: number;
  failed: number;
  results: RecordInvariantGateResult[];
}

export interface RecordProvenanceDashboardMetric extends AssertionProvenanceAudit {
  targetCompletenessRate: number;
  withinTarget: boolean;
  status: RecordMetricStatus;
}

export interface RecordReplayDashboardMetric {
  sampleCount: number;
  passed: number;
  failed: number;
  status: RecordMetricStatus;
  failures: string[];
}

export interface RecordEventLagDashboardMetric extends EventLagMetrics {
  status: RecordMetricStatus;
}

export interface RecordStalenessDashboardMetric extends StalenessMetrics {
  targetP95Ms: number;
  withinTarget: boolean;
  status: RecordMetricStatus;
}

export interface RecordGateDecisionLatencyMetric {
  decidedGates: number;
  p50DecisionLatencyMs: number;
  targetP50Ms: number;
  withinTarget: boolean;
  status: RecordMetricStatus;
}

export interface RecordTenantCanaryMetric {
  checkedRefs: number;
  crossTenantHits: number;
  status: RecordMetricStatus;
  failures: string[];
}

export interface RecordMetricsDashboard {
  tenantId: string;
  generatedAt: string;
  releaseGate: RecordReleaseGateSummary;
  invariants: RecordInvariantDashboardSummary;
  provenance: RecordProvenanceDashboardMetric;
  replayDeterminism: RecordReplayDashboardMetric;
  eventLag: RecordEventLagDashboardMetric;
  stalenessPropagation: RecordStalenessDashboardMetric;
  gateDecisionLatency: RecordGateDecisionLatencyMetric;
  tenantCanaries: RecordTenantCanaryMetric;
  eventLogPartitions: EventLogPartition[];
}

export type RecordInvariantGate =
  | "append-only-events"
  | "canonical-change-approval"
  | "assertion-provenance"
  | "sealed-write-rejection"
  | "manifest-and-pins"
  | "alias-survival"
  | "staleness-false-clean"
  | "tenant-isolation";
export type RecordInvariantGateStatus = "pass" | "fail";

export interface RecordInvariantGateResult {
  gate: RecordInvariantGate;
  status: RecordInvariantGateStatus;
  checkedRecords: number;
  failures: string[];
}

export interface RecordInvariantGateReport {
  tenantId: string;
  status: RecordInvariantGateStatus;
  results: RecordInvariantGateResult[];
}

export interface RunRecordInvariantGatesInput {
  tenantId: string;
  gates?: RecordInvariantGate[];
}

export interface AppendRecordEventCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  type: string;
  payload?: Record<string, unknown>;
  manifestRef?: string;
  occurredAt?: string | Date;
}

export interface AppendRecordEventOperation {
  kind: "append_event";
  actor: RecordActor;
  type: string;
  payload?: Record<string, unknown>;
  manifestRef?: string;
  occurredAt?: string | Date;
}

export interface RecordTransactionCommand {
  tenantId: string;
  idempotencyKey: string;
  operations: AppendRecordEventOperation[];
}

export interface RecordTransactionResult {
  events: RecordEvent[];
}

export type RecordRunKind = "agent" | "engine" | "pipeline" | "composite";

export interface RecordRunScope {
  entityIds: string[];
  jurisdictions: string[];
  objectRefs: RecordRef[];
}

export interface MirrorRunStartedCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  runRef: RecordRef;
  kind: RecordRunKind;
  status: string;
  scope?: Partial<RecordRunScope>;
  planRef?: RecordRef | null;
  startedAt?: string | Date;
}

export interface MirrorRunEventResult {
  runRef: RecordRef;
  planRef: RecordRef | null;
  event: RecordEvent;
}

export type RecordRunStepType = "tool" | "engine" | "model" | "subjob";

export interface MirrorRunStepCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  runRef: RecordRef;
  stepId: string;
  type: RecordRunStepType;
  toolName?: string | null;
  argsRef?: RecordRef | null;
  resultRef?: RecordRef | null;
  startedAt: string | Date;
  completedAt?: string | Date | null;
  cost?: Record<string, unknown>;
}

export interface MirrorRunStepResult {
  runRef: RecordRef;
  stepId: string;
  event: RecordEvent;
}

export interface MirrorRunCompletedCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  runRef: RecordRef;
  status: string;
  manifestRef?: string;
  outputRefs?: RecordRef[];
  completedAt?: string | Date;
}

export interface MirrorRunFailedCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  runRef: RecordRef;
  status: string;
  failure: {
    class: string;
    detailRef?: RecordRef | null;
  };
  failedAt?: string | Date;
}

export interface MirrorRunCancelledCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  runRef: RecordRef;
  status: string;
  reason: string;
  cancelledAt?: string | Date;
}

export interface SubmitAssertionsCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  assertions: RecordAssertionInput[];
  manifestRef?: string;
}

export interface SubmitAssertionsResult {
  assertions: RecordAssertion[];
  events: RecordEvent[];
}

export interface RecordFindingCandidateCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  subjectRef: RecordRef;
  candidate: Record<string, unknown>;
  source: RecordAssertionSource;
  confidence?: number | null;
  validFrom: string | Date;
  validTo?: string | Date | null;
  assertedAt?: string | Date;
  scopeKeys?: Partial<RecordAssertionScopeKeys>;
  sensitivity?: 0 | 1 | 2;
  manifestRef?: string;
}

export interface RecordFindingCandidateResult {
  assertion: RecordAssertion;
  event: RecordEvent;
}

export interface ListFindingCandidatesInput {
  tenantId: string;
  subjectRef?: RecordRef;
  lens?: RecordLens;
}

export interface RetractAssertionCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  assertionId: string;
  reason: string;
  retractedAt?: string | Date;
}

export interface RetractAssertionResult {
  assertion: RecordAssertion;
  event: RecordEvent;
}

export interface SupersedeAssertionCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  assertionId: string;
  replacement: RecordAssertionInput;
  reason?: string;
  supersededAt?: string | Date;
}

export interface SupersedeAssertionResult {
  superseded: RecordAssertion;
  replacement: RecordAssertion;
  events: RecordEvent[];
}

export interface AuditAssertionProvenanceInput {
  tenantId: string;
}

export interface AssertionProvenanceGap {
  assertionId: string;
  sourceKind: string;
  reasons: string[];
}

export interface AssertionProvenanceAudit {
  tenantId: string;
  totalAssertions: number;
  completeAssertions: number;
  incompleteAssertions: AssertionProvenanceGap[];
  completenessRate: number;
  sourceKinds: {
    engine: number;
    extraction: number;
    human: number;
    reviewer: number;
  };
}

export type CanonicalObjectType =
  | "entity"
  | "flow"
  | "agreement"
  | "document"
  | "doc_section"
  | "finding"
  | "obligation"
  | "period"
  | "instruction";

export type CanonicalApprovalKind = "gate" | "governed_edit";

export interface CanonicalRecordRow {
  tenantId: string;
  objectType: CanonicalObjectType;
  ref: RecordRef;
  approvalKind: CanonicalApprovalKind;
  approvalRef: string;
  lastChangeEvent: number;
  lastChangeEventId: string;
  lastChangedAt: string;
  [key: string]: unknown;
}

export interface PromoteCanonicalCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  ref: RecordRef;
  value: Record<string, unknown>;
  approvalRef: string;
  occurredAt?: string | Date;
}

export interface ApplyGovernedEditCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  ref: RecordRef;
  value: Record<string, unknown>;
  approvalRef: string;
  reason: string;
  occurredAt?: string | Date;
}

export interface CanonicalMutationResult {
  row: CanonicalRecordRow;
  event: RecordEvent;
}

export interface ListCanonicalInput {
  tenantId: string;
  objectType?: CanonicalObjectType;
  lens?: RecordLens;
}

export type StagingObjectStatus = "staged" | "gate_requested" | "promoted" | "rejected";
export type GateStatus = "pending" | "delegated" | "escalated" | "approved" | "rejected";
export type GateDecision = "approved" | "rejected";

export interface CanonicalDiffChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface CanonicalDiffSnapshot {
  current: Record<string, unknown> | null;
  proposed: Record<string, unknown>;
  changes: CanonicalDiffChange[];
}

export interface RecordStagingObject {
  tenantId: string;
  stagingId: string;
  objectRef: RecordRef;
  proposedValue: Record<string, unknown>;
  producedByRun: string | null;
  gateId: string | null;
  status: StagingObjectStatus;
  stagedBy: RecordActor;
  stagedAt: string;
  diffSnapshot: CanonicalDiffSnapshot;
}

export interface RecordGateDelegate {
  delegatedTo: string;
  delegatedBy: RecordActor;
  delegatedAt: string;
  expiresAt: string | null;
  reason: string | null;
}

export interface RecordGateEscalation {
  escalatedTo: string;
  escalatedBy: RecordActor;
  escalatedAt: string;
  reason: string;
}

export interface RecordGate {
  tenantId: string;
  gateId: string;
  objectRef: RecordRef;
  stagingId: string;
  requestedBy: RecordActor;
  requestedAt: string;
  slaDue: string;
  decision: GateDecision | null;
  decider: RecordActor | null;
  decidedAt: string | null;
  decisionReason: string | null;
  status: GateStatus;
  delegateChain: RecordGateDelegate[];
  escalations: RecordGateEscalation[];
  diffSnapshot: CanonicalDiffSnapshot;
}

export interface StageObjectCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  ref: RecordRef;
  proposedValue: Record<string, unknown>;
  producedByRun?: string | null;
  lens: RecordLens;
  stagedAt?: string | Date;
}

export interface StageObjectResult {
  stagingObject: RecordStagingObject;
}

export interface RequestGateCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  stagingId: string;
  requestedAt?: string | Date;
  slaDue: string | Date;
}

export interface RequestGateResult {
  gate: RecordGate;
  stagingObject: RecordStagingObject;
  event: RecordEvent;
}

export interface DecideGateCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  gateId: string;
  decision: GateDecision;
  reason?: string;
  decidedAt?: string | Date;
}

export interface DecideGateResult {
  gate: RecordGate;
  stagingObject: RecordStagingObject;
  events: RecordEvent[];
  row: CanonicalRecordRow | null;
}

export interface DelegateGateCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  gateId: string;
  delegatedTo: string;
  delegatedAt?: string | Date;
  expiresAt?: string | Date | null;
  reason?: string | null;
}

export interface DelegateGateResult {
  gate: RecordGate;
  event: RecordEvent;
}

export interface EscalateGateCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  gateId: string;
  escalatedTo: string;
  reason: string;
  escalatedAt?: string | Date;
}

export interface EscalateGateResult {
  gate: RecordGate;
  event: RecordEvent;
}

export interface ListStagingObjectsInput {
  tenantId: string;
  status?: StagingObjectStatus;
  objectRef?: RecordRef;
}

export interface ListGatesInput {
  tenantId: string;
  status?: GateStatus;
  objectRef?: RecordRef;
}

export type AssertionSourceKind = RecordAssertionSource["kind"];

export interface PrecedencePolicyEntry {
  fieldClass: string;
  fields: string[];
  sourcePrecedence: AssertionSourceKind[];
}

export interface PrecedencePolicy {
  tenantId: string;
  policyId: string;
  version: number;
  name: string;
  effectiveFrom: string;
  changedAt: string;
  changedBy: RecordActor;
  entries: PrecedencePolicyEntry[];
  changeEvent: number;
  changeEventId: string;
}

export interface RegisterPrecedencePolicyCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  name: string;
  effectiveFrom: string | Date;
  entries: PrecedencePolicyEntry[];
  changedAt?: string | Date;
}

export interface RegisterPrecedencePolicyResult {
  policy: PrecedencePolicy;
  event: RecordEvent;
}

export interface CurrentValueInput {
  tenantId: string;
  subject: RecordAssertionSubject;
  lens: RecordLens;
  policyVersion?: number;
}

export interface ListCurrentValuesInput {
  tenantId: string;
  lens: RecordLens;
  policyVersion?: number;
}

export interface CurrentValueCandidate {
  assertionId: string;
  value: unknown;
  normalizedValue: string;
  source: RecordAssertionSource;
  confidence: number | null;
  assertedAt: string;
  rank: number;
}

export interface CurrentValueProvenance {
  assertionId: string;
  source: RecordAssertionSource;
  confidence: number | null;
  assertedAt: string;
  validFrom: string;
  validTo: string | null;
}

export interface CurrentValueResult {
  tenantId: string;
  subject: RecordAssertionSubject;
  lens: RecordLens;
  status: "empty" | "resolved";
  value: unknown | null;
  policyVersion: number | null;
  fieldClass: string | null;
  provenance: CurrentValueProvenance | null;
  candidates: CurrentValueCandidate[];
}

export interface ConflictsInput {
  tenantId: string;
  subject: RecordAssertionSubject;
  lens: RecordLens;
}

export interface ConflictGroup {
  normalizedValue: string;
  value: unknown;
  assertions: CurrentValueCandidate[];
}

export interface ConflictsResult {
  tenantId: string;
  subject: RecordAssertionSubject;
  lens: RecordLens;
  status: "clear" | "conflict";
  totalAssertions: number;
  groups: ConflictGroup[];
}

export interface EntityAlias {
  tenantId: string;
  aliasId: string;
  aliasText: string;
  aliasKey: string;
  entityId: string;
  entityRef: RecordRef;
  sourceRef: RecordRef | null;
  resolvedBy: RecordActor;
  resolvedAt: string;
}

export interface AddEntityAliasCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  entityRef: RecordRef;
  aliasText: string;
  sourceRef?: RecordRef | null;
  resolvedAt?: string | Date;
}

export interface AddEntityAliasResult {
  alias: EntityAlias;
  event: RecordEvent;
}

export interface ListEntityAliasesInput {
  tenantId: string;
  entityRef?: RecordRef;
  aliasText?: string;
}

export interface ResolveEntityAliasInput {
  tenantId: string;
  aliasText: string;
}

export interface ResolveEntityAliasResult {
  alias: EntityAlias;
  entityRef: RecordRef;
}

export interface MergeEntitiesCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  sourceEntityRef: RecordRef;
  targetEntityRef: RecordRef;
  reason: string;
  mergedAt?: string | Date;
}

export interface MergeEntitiesResult {
  sourceEntityRef: RecordRef;
  targetEntityRef: RecordRef;
  aliases: EntityAlias[];
  event: RecordEvent;
}

export interface SplitEntityCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  sourceEntityRef: RecordRef;
  newEntityRef: RecordRef;
  aliasTexts: string[];
  reason: string;
  sourceRef?: RecordRef | null;
  splitAt?: string | Date;
}

export interface SplitEntityResult {
  sourceEntityRef: RecordRef;
  newEntityRef: RecordRef;
  aliases: EntityAlias[];
  event: RecordEvent;
}

export type AccountMappingProposalStatus = "proposed" | "applied";

export interface AccountMappingProposal {
  tenantId: string;
  mappingProposalId: string;
  sourceAccount: string;
  canonicalAccount: string;
  scope: Record<string, string>;
  confidence: number | null;
  proposedBy: RecordActor;
  proposedAt: string;
  status: AccountMappingProposalStatus;
  appliedMappingId: string | null;
}

export interface AccountMapping {
  tenantId: string;
  mappingId: string;
  mappingProposalId: string;
  sourceAccount: string;
  canonicalAccount: string;
  scope: Record<string, string>;
  approvedBy: RecordActor;
  approvalRef: string;
  appliedAt: string;
}

export interface ProposeAccountMappingCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  sourceAccount: string;
  canonicalAccount: string;
  scope?: Record<string, string>;
  confidence?: number | null;
  proposedAt?: string | Date;
}

export interface ProposeAccountMappingResult {
  proposal: AccountMappingProposal;
  event: RecordEvent;
}

export interface ApplyAccountMappingCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  mappingProposalId: string;
  approvalRef: string;
  appliedAt?: string | Date;
}

export interface ApplyAccountMappingResult {
  proposal: AccountMappingProposal;
  mapping: AccountMapping;
  event: RecordEvent;
}

export interface ListAccountMappingProposalsInput {
  tenantId: string;
  status?: AccountMappingProposalStatus;
}

export interface ListAccountMappingsInput {
  tenantId: string;
}

export interface CorpusVersion {
  tenantId: string;
  version: number;
  lastBatchRef: RecordRef | null;
  updatedAt: string | null;
}

export interface CommitIngestionBatchCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  batchRef: RecordRef;
  documentRefs: RecordRef[];
  committedAt?: string | Date;
}

export interface CommitIngestionBatchResult {
  corpusVersion: CorpusVersion;
  event: RecordEvent;
}

export interface GetCorpusVersionInput {
  tenantId: string;
}

export interface ManifestInputPin {
  ref: RecordRef;
  version: number;
}

export interface RecordManifest {
  tenantId: string;
  manifestId: string;
  jobRef: RecordRef;
  corpusVersion: number;
  rulepackVersions: Record<string, string>;
  modelVersions: Record<string, string>;
  instructionRefs: string[];
  gateRefs: string[];
  inputPins: ManifestInputPin[];
  outputHashes: Record<string, string>;
  registeredBy: RecordActor;
  registeredAt: string;
  eventSeq: number;
  eventId: string;
}

export interface RegisterManifestCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  jobRef: RecordRef;
  corpusVersion: number;
  rulepackVersions?: Record<string, string>;
  modelVersions?: Record<string, string>;
  instructionRefs?: string[];
  gateRefs?: string[];
  inputPins: ManifestInputPin[];
  outputHashes?: Record<string, string>;
  registeredAt?: string | Date;
}

export interface RegisterManifestResult {
  manifest: RecordManifest;
  event: RecordEvent;
}

export interface GetManifestInput {
  tenantId: string;
  manifestId: string;
}

export interface ManifestPinsResult {
  tenantId: string;
  manifestId: string;
  corpusVersion: number;
  inputPins: ManifestInputPin[];
  instructionRefs: string[];
  gateRefs: string[];
  rulepackVersions: Record<string, string>;
  modelVersions: Record<string, string>;
}

export interface RecordArtifact {
  tenantId: string;
  artifactId: string;
  manifestId: string;
  format: string;
  blobRef: string;
  contentHash: string;
  sealed: boolean;
  sealedEvent: number | null;
  supersededCandidate: boolean;
  supersededByEvent: number | null;
  supersededAt: string | null;
  renderedBy: RecordActor;
  renderedAt: string;
}

export interface RegisterArtifactCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  manifestId: string;
  format: string;
  blobRef: string;
  contentHash: string;
  renderedAt?: string | Date;
}

export interface RegisterArtifactResult {
  artifact: RecordArtifact;
  event: RecordEvent;
}

export interface SealArtifactCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  artifactId: string;
  sealedAt?: string | Date;
}

export interface SealArtifactResult {
  artifact: RecordArtifact;
  event: RecordEvent;
}

export interface GetArtifactInput {
  tenantId: string;
  artifactId: string;
}

export interface ListArtifactsInput {
  tenantId: string;
  manifestId?: string;
}

export interface VerifyArtifactReplayInput {
  tenantId: string;
  artifactId: string;
  renderedContent: string | Uint8Array;
}

export interface ArtifactReplayVerification {
  ok: boolean;
  artifactId: string;
  manifestId: string;
  expectedHash: string;
  actualHash: string;
  manifestOutputPinned: boolean;
  corpusVersion: number;
  inputPins: ManifestInputPin[];
}

export interface RecordDependency {
  tenantId: string;
  dependencyId: string;
  downstreamRef: RecordRef;
  upstreamRef: RecordRef;
  kind: string;
  declaredByRun: RecordRef;
  declaredAt: string;
}

export interface DeclareDependencyInput {
  ref: RecordRef;
  kind?: string;
}

export interface DeclareDependenciesCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  declaredByRun: RecordRef;
  downstreamRef: RecordRef;
  upstreamRefs: DeclareDependencyInput[];
  declaredAt?: string | Date;
}

export interface DeclareDependenciesBatchEdgeInput {
  downstreamRef: RecordRef;
  upstreamRefs: DeclareDependencyInput[];
}

export interface DeclareDependenciesBatchCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  declaredByRun: RecordRef;
  edges: DeclareDependenciesBatchEdgeInput[];
  declaredAt?: string | Date;
}

export interface DeclareDependenciesResult {
  dependencies: RecordDependency[];
  event: RecordEvent;
}

export interface ListDependenciesInput {
  tenantId: string;
  upstreamRef?: RecordRef;
  downstreamRef?: RecordRef;
}

export type DirtyFlagStatus = "active" | "resolved";
export type RebuildProposalStatus = "proposed" | "accepted" | "skipped";

export interface RecordDirtyFlag {
  tenantId: string;
  dirtyFlagId: string;
  objectRef: RecordRef;
  upstreamRef: RecordRef;
  dirtiedByEvent: number;
  reason: Record<string, unknown>;
  propagationPath: RecordRef[];
  status: DirtyFlagStatus;
  createdAt: string;
}

export interface RebuildProposal {
  tenantId: string;
  proposalId: string;
  targets: RecordRef[];
  causeEvents: number[];
  dirtyFlagIds: string[];
  status: RebuildProposalStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: RecordActor | null;
  resolutionReason: string | null;
}

export interface DirtySetInput {
  tenantId: string;
  objectRef?: RecordRef;
  status?: DirtyFlagStatus;
}

export interface DirtySetResult {
  tenantId: string;
  flags: RecordDirtyFlag[];
  proposals: RebuildProposal[];
}

export interface ListRebuildProposalsInput {
  tenantId: string;
  status?: RebuildProposalStatus;
  targetRef?: RecordRef;
}

export interface ResolveRebuildProposalCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  proposalId: string;
  decision: Exclude<RebuildProposalStatus, "proposed">;
  reason: string;
  resolvedAt?: string | Date;
}

export interface ResolveRebuildProposalResult {
  proposal: RebuildProposal;
  event: RecordEvent;
}

export interface StalenessMetricsInput {
  tenantId: string;
}

export interface StalenessMetrics {
  tenantId: string;
  propagationRuns: number;
  dirtyFlagsCreated: number;
  rebuildProposalsCreated: number;
  p95PropagationLatencyMs: number;
}

export type StalenessPropagationJobStatus = "queued" | "completed";

export interface StalenessPropagationJob {
  tenantId: string;
  jobId: string;
  sourceEventSeq: number;
  sourceEventId: string;
  sourceEventType: string;
  changedRef: RecordRef;
  targetCount: number;
  status: StalenessPropagationJobStatus;
  queuedAt: string;
  processedAt: string | null;
  dirtyFlagIds: string[];
  proposalId: string | null;
}

interface StalenessPropagationJobRecord extends StalenessPropagationJob {
  sourceEvent: RecordEvent;
  dirtyTargets: DirtyTarget[];
}

export interface ListStalenessPropagationJobsInput {
  tenantId: string;
  status?: StalenessPropagationJobStatus;
}

export interface ProcessStalenessPropagationQueueInput {
  tenantId: string;
  maxJobs?: number;
  processedAt?: string | Date;
}

export interface ProcessStalenessPropagationQueueResult {
  jobs: StalenessPropagationJob[];
  events: RecordEvent[];
}

export type RecordPeriodStatus = "open" | "closing" | "sealed";

export interface RecordPeriod {
  tenantId: string;
  periodId: string;
  periodRef: RecordRef;
  fy: string;
  quarter: string | null;
  validFrom: string;
  validTo: string;
  status: RecordPeriodStatus;
  openedEvent: number;
  closingEvent: number | null;
  sealedEvent: number | null;
  openedAt: string;
  closingAt: string | null;
  sealedAt: string | null;
  sealedBy: RecordActor | null;
}

export interface OpenPeriodCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  fy: string;
  quarter?: string | null;
  validFrom: string | Date;
  validTo: string | Date;
  openedAt?: string | Date;
}

export interface OpenPeriodResult {
  period: RecordPeriod;
  event: RecordEvent;
}

export interface ClosePeriodCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  periodId: string;
  closingAt?: string | Date;
}

export interface ClosePeriodResult {
  period: RecordPeriod;
  event: RecordEvent;
}

export interface PeriodSnapshot {
  tenantId: string;
  snapshotId: string;
  periodId: string;
  periodRef: RecordRef;
  cadence: "per-seal";
  sealedEvent: number;
  capturedAt: string;
  rows: CanonicalRecordRow[];
}

export interface SealPeriodCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  periodId: string;
  sealedAt?: string | Date;
}

export interface SealPeriodResult {
  period: RecordPeriod;
  event: RecordEvent;
  snapshot: PeriodSnapshot;
  sealedArtifacts: RecordArtifact[];
  artifactEvents: RecordEvent[];
}

export interface GetPeriodInput {
  tenantId: string;
  periodId: string;
}

export interface ListPeriodsInput {
  tenantId: string;
  status?: RecordPeriodStatus;
}

export interface GetPeriodSnapshotInput {
  tenantId: string;
  periodId: string;
}

export interface GetAsFiledInput {
  tenantId: string;
  periodId: string;
  ref: RecordRef;
}

export interface GetAsKnownTodayInput {
  tenantId: string;
  ref: RecordRef;
}

export type RecordInstructionStatus = "submitted" | "active" | "retired";

export interface RecordInstructionScope {
  kind: string;
  entityIds: string[];
  jurisdictions: string[];
  objectRefs: RecordRef[];
}

export interface RecordInstruction {
  tenantId: string;
  instructionId: string;
  instructionRef: string;
  tier: number;
  scope: RecordInstructionScope;
  text: string;
  compiled: Record<string, unknown>;
  status: RecordInstructionStatus;
  author: RecordActor;
  submittedAt: string;
  submittedEvent: number;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedEvent: number | null;
  retiredBy: string | null;
  retiredAt: string | null;
  retiredEvent: number | null;
  retirementReason: string | null;
}

export interface SubmitInstructionCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  tier: number;
  scope: Partial<RecordInstructionScope> & { kind: string };
  text: string;
  compiled?: Record<string, unknown>;
  submittedAt?: string | Date;
}

export interface SubmitInstructionResult {
  instruction: RecordInstruction;
  event: RecordEvent;
}

export interface ApproveInstructionCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  instructionId: string;
  approvedAt?: string | Date;
}

export interface ApproveInstructionResult {
  instruction: RecordInstruction;
  event: RecordEvent;
}

export interface RetireInstructionCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  instructionId: string;
  reason: string;
  retiredAt?: string | Date;
}

export interface RetireInstructionResult {
  instruction: RecordInstruction;
  event: RecordEvent;
}

export interface GetInstructionInput {
  tenantId: string;
  instructionId: string;
}

export interface ListInstructionsInput {
  tenantId: string;
  status?: RecordInstructionStatus;
}

interface StalenessMetricsState {
  propagationLatenciesMs: number[];
  dirtyFlagsCreated: number;
  rebuildProposalsCreated: number;
}

export interface ListAssertionsInput {
  tenantId: string;
  lens?: RecordLens;
  subject?: RecordAssertionSubject;
  includeRetracted?: boolean;
}

export interface RecordSubscriptionFilter {
  types?: string[];
  manifestRefs?: string[];
}

export interface SubscribeRecordEventsInput {
  tenantId: string;
  consumer: string;
  fromOffset?: number;
  filters?: RecordSubscriptionFilter;
}

export interface RecordEventDelivery {
  consumer: string;
  fromOffset: number;
  nextOffset: number;
  events: RecordEvent[];
}

export interface AcknowledgeRecordOffsetInput {
  tenantId: string;
  consumer: string;
  offset: number;
}

export interface RecordService {
  getCanonical(input: GetCanonicalInput): unknown | null;
  getRef(input: GetRefInput): GetRefResult | null;
  getTimeline(input: GetTimelineInput): GetTimelineResult;
  getSubgraph(input: GetSubgraphInput): RecordSubgraphResult;
  mirrorRunStarted(command: MirrorRunStartedCommand): MirrorRunEventResult;
  mirrorRunStep(command: MirrorRunStepCommand): MirrorRunStepResult;
  mirrorRunCompleted(command: MirrorRunCompletedCommand): MirrorRunEventResult;
  mirrorRunFailed(command: MirrorRunFailedCommand): MirrorRunEventResult;
  mirrorRunCancelled(command: MirrorRunCancelledCommand): MirrorRunEventResult;
  appendEvent(command: AppendRecordEventCommand): RecordEvent;
  runTransaction(command: RecordTransactionCommand): RecordTransactionResult;
  submitAssertions(command: SubmitAssertionsCommand): SubmitAssertionsResult;
  recordFindingCandidate(command: RecordFindingCandidateCommand): RecordFindingCandidateResult;
  listFindingCandidates(input: ListFindingCandidatesInput): RecordAssertion[];
  retractAssertion(command: RetractAssertionCommand): RetractAssertionResult;
  supersedeAssertion(command: SupersedeAssertionCommand): SupersedeAssertionResult;
  auditAssertionProvenance(input: AuditAssertionProvenanceInput): AssertionProvenanceAudit;
  promoteCanonical(command: PromoteCanonicalCommand): CanonicalMutationResult;
  applyGovernedEdit(command: ApplyGovernedEditCommand): CanonicalMutationResult;
  stageObject(command: StageObjectCommand): StageObjectResult;
  requestGate(command: RequestGateCommand): RequestGateResult;
  decideGate(command: DecideGateCommand): DecideGateResult;
  delegateGate(command: DelegateGateCommand): DelegateGateResult;
  escalateGate(command: EscalateGateCommand): EscalateGateResult;
  registerPrecedencePolicy(command: RegisterPrecedencePolicyCommand): RegisterPrecedencePolicyResult;
  getCurrentValue(input: CurrentValueInput): CurrentValueResult;
  listCurrentValues(input: ListCurrentValuesInput): CurrentValueResult[];
  getConflicts(input: ConflictsInput): ConflictsResult;
  addEntityAlias(command: AddEntityAliasCommand): AddEntityAliasResult;
  mergeEntities(command: MergeEntitiesCommand): MergeEntitiesResult;
  splitEntity(command: SplitEntityCommand): SplitEntityResult;
  listEntityAliases(input: ListEntityAliasesInput): EntityAlias[];
  resolveEntityAlias(input: ResolveEntityAliasInput): ResolveEntityAliasResult | null;
  proposeAccountMapping(command: ProposeAccountMappingCommand): ProposeAccountMappingResult;
  applyAccountMapping(command: ApplyAccountMappingCommand): ApplyAccountMappingResult;
  listAccountMappingProposals(input: ListAccountMappingProposalsInput): AccountMappingProposal[];
  listAccountMappings(input: ListAccountMappingsInput): AccountMapping[];
  commitIngestionBatch(command: CommitIngestionBatchCommand): CommitIngestionBatchResult;
  getCorpusVersion(input: GetCorpusVersionInput): CorpusVersion;
  registerManifest(command: RegisterManifestCommand): RegisterManifestResult;
  getManifest(input: GetManifestInput): RecordManifest | null;
  getManifestPins(input: GetManifestInput): ManifestPinsResult | null;
  registerArtifact(command: RegisterArtifactCommand): RegisterArtifactResult;
  sealArtifact(command: SealArtifactCommand): SealArtifactResult;
  getArtifact(input: GetArtifactInput): RecordArtifact | null;
  listArtifacts(input: ListArtifactsInput): RecordArtifact[];
  verifyArtifactReplay(input: VerifyArtifactReplayInput): ArtifactReplayVerification;
  declareDependencies(command: DeclareDependenciesCommand): DeclareDependenciesResult;
  declareDependenciesBatch(command: DeclareDependenciesBatchCommand): DeclareDependenciesResult;
  listDependencies(input: ListDependenciesInput): RecordDependency[];
  getDirtySet(input: DirtySetInput): DirtySetResult;
  listRebuildProposals(input: ListRebuildProposalsInput): RebuildProposal[];
  resolveRebuildProposal(command: ResolveRebuildProposalCommand): ResolveRebuildProposalResult;
  getStalenessMetrics(input: StalenessMetricsInput): StalenessMetrics;
  listStalenessPropagationJobs(input: ListStalenessPropagationJobsInput): StalenessPropagationJob[];
  processStalenessPropagationQueue(input: ProcessStalenessPropagationQueueInput): ProcessStalenessPropagationQueueResult;
  openPeriod(command: OpenPeriodCommand): OpenPeriodResult;
  closePeriod(command: ClosePeriodCommand): ClosePeriodResult;
  sealPeriod(command: SealPeriodCommand): SealPeriodResult;
  getPeriod(input: GetPeriodInput): RecordPeriod | null;
  listPeriods(input: ListPeriodsInput): RecordPeriod[];
  getPeriodSnapshot(input: GetPeriodSnapshotInput): PeriodSnapshot | null;
  getAsFiled(input: GetAsFiledInput): CanonicalRecordRow | null;
  getAsKnownToday(input: GetAsKnownTodayInput): CanonicalRecordRow | null;
  submitInstruction(command: SubmitInstructionCommand): SubmitInstructionResult;
  approveInstruction(command: ApproveInstructionCommand): ApproveInstructionResult;
  retireInstruction(command: RetireInstructionCommand): RetireInstructionResult;
  getInstruction(input: GetInstructionInput): RecordInstruction | null;
  listInstructions(input: ListInstructionsInput): RecordInstruction[];
  listStagingObjects(input: ListStagingObjectsInput): RecordStagingObject[];
  listGates(input: ListGatesInput): RecordGate[];
  listCanonical(input: ListCanonicalInput): CanonicalRecordRow[];
  listAssertions(input: ListAssertionsInput): RecordAssertion[];
  listEvents(tenantId: string): RecordEvent[];
  readOutbox(tenantId: string): DomainOutboxEntry[];
  getEventLogPartitions(input?: EventLogPartitionsInput): EventLogPartition[];
  getEventLagMetrics(input: EventLagMetricsInput): EventLagMetrics;
  runInvariantGates(input: RunRecordInvariantGatesInput): RecordInvariantGateReport;
  getMetricsDashboard(input: RecordMetricsDashboardInput): RecordMetricsDashboard;
  subscribe(input: SubscribeRecordEventsInput): RecordEventDelivery;
  acknowledgeConsumerOffset(input: AcknowledgeRecordOffsetInput): void;
  getConsumerOffset(input: { tenantId: string; consumer: string }): number;
}

interface RecordStore {
  canonical: Map<string, CanonicalRecordRow[]>;
  stagingObjectsByTenant: Map<string, RecordStagingObject[]>;
  gatesByTenant: Map<string, RecordGate[]>;
  precedencePoliciesByTenant: Map<string, PrecedencePolicy[]>;
  assertionsByTenant: Map<string, RecordAssertion[]>;
  entityAliasesByTenant: Map<string, EntityAlias[]>;
  entityRedirectsByTenant: Map<string, Map<string, RecordRef>>;
  accountMappingProposalsByTenant: Map<string, AccountMappingProposal[]>;
  accountMappingsByTenant: Map<string, AccountMapping[]>;
  corpusVersionsByTenant: Map<string, CorpusVersion>;
  manifestsByTenant: Map<string, RecordManifest[]>;
  artifactsByTenant: Map<string, RecordArtifact[]>;
  dependenciesByTenant: Map<string, RecordDependency[]>;
  dependencyIndexesByTenant: Map<string, RecordDependencyIndex>;
  dirtyFlagsByTenant: Map<string, RecordDirtyFlag[]>;
  rebuildProposalsByTenant: Map<string, RebuildProposal[]>;
  stalenessMetricsByTenant: Map<string, StalenessMetricsState>;
  stalenessJobsByTenant: Map<string, StalenessPropagationJobRecord[]>;
  stalenessOptions: { synchronousEdgeLimit: number };
  periodsByTenant: Map<string, RecordPeriod[]>;
  periodSnapshotsByTenant: Map<string, PeriodSnapshot[]>;
  instructionsByTenant: Map<string, RecordInstruction[]>;
  eventsByTenant: Map<string, RecordEvent[]>;
  outboxByTenant: Map<string, DomainOutboxEntry[]>;
  consumerOffsets: Map<string, number>;
  idempotency: Map<string, { fingerprint: string; event: RecordEvent }>;
  transactions: Map<string, { fingerprint: string; result: RecordTransactionResult }>;
  canonicalCommands: Map<string, { fingerprint: string; result: CanonicalMutationResult }>;
  stageCommands: Map<string, { fingerprint: string; result: StageObjectResult }>;
  gateCommands: Map<
    string,
    { fingerprint: string; result: RequestGateResult | DecideGateResult | DelegateGateResult | EscalateGateResult }
  >;
  precedencePolicyCommands: Map<string, { fingerprint: string; result: RegisterPrecedencePolicyResult }>;
  resolutionCommands: Map<
    string,
    { fingerprint: string; result: AddEntityAliasResult | MergeEntitiesResult | SplitEntityResult }
  >;
  accountMappingCommands: Map<
    string,
    { fingerprint: string; result: ProposeAccountMappingResult | ApplyAccountMappingResult }
  >;
  corpusCommands: Map<string, { fingerprint: string; result: CommitIngestionBatchResult }>;
  manifestCommands: Map<string, { fingerprint: string; result: RegisterManifestResult }>;
  artifactCommands: Map<string, { fingerprint: string; result: RegisterArtifactResult | SealArtifactResult }>;
  dependencyCommands: Map<string, { fingerprint: string; result: DeclareDependenciesResult }>;
  stalenessCommands: Map<string, { fingerprint: string; result: ResolveRebuildProposalResult }>;
  periodCommands: Map<string, { fingerprint: string; result: OpenPeriodResult | ClosePeriodResult | SealPeriodResult }>;
  instructionCommands: Map<
    string,
    { fingerprint: string; result: SubmitInstructionResult | ApproveInstructionResult | RetireInstructionResult }
  >;
  assertionCommands: Map<
    string,
    { fingerprint: string; result: SubmitAssertionsResult | RetractAssertionResult | SupersedeAssertionResult }
  >;
}

interface RecordDependencyIndex {
  byUpstream: Map<string, RecordDependency[]>;
  byDownstream: Map<string, RecordDependency[]>;
}

const RECORD_EVENT_TYPES = new Set([
  "ingestion.received",
  "ingestion.classified",
  "ingestion.versioned",
  "ingestion.problem",
  "assertion.recorded",
  "assertion.retracted",
  "assertion.superseded",
  "resolution.alias_added",
  "resolution.merged",
  "resolution.split",
  "resolution.mapping_proposed",
  "resolution.mapping_applied",
  "gate.requested",
  "gate.delegated",
  "gate.escalated",
  "gate.decided",
  "canonical.promoted",
  "edit.applied",
  "run.started",
  "run.step",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "dependency.declared",
  "staleness.dirtied",
  "staleness.proposal_created",
  "staleness.proposal_resolved",
  "period.opened",
  "period.closing",
  "period.sealed",
  "instruction.submitted",
  "instruction.approved",
  "instruction.retired",
  "precedence.policy_changed",
  "artifact.rendered",
  "artifact.sealed",
  "artifact.superseded",
]);

export function createRecordIdentity(input: CreateRecordIdentityInput): TenantScopedRecordRef {
  assertTenantId(input.tenantId);
  return {
    tenantId: input.tenantId,
    ref: createRecordRef({
      objectType: input.objectType,
      objectId: createRecordUlid(),
      version: input.version,
    }),
  };
}

export function recordMatchesSensitivity(record: unknown, predicate: RecordSensitivityPredicate) {
  const maxSensitivity = normalizeSensitivityPredicate(predicate.maxSensitivity);
  return recordSensitivity(record) <= maxSensitivity;
}

export function recordMatchesScope(record: unknown, predicate: RecordScopePredicate) {
  const entityIds = uniqueStrings(predicate.entityIds ?? []);
  const jurisdictions = uniqueStrings((predicate.jurisdictions ?? []).map((jurisdiction) => jurisdiction.toUpperCase()));
  const objectRefs = (predicate.objectRefs ?? []).map((ref) => createRecordRef(ref));
  const scope = collectRecordScope(record);

  if (entityIds.length > 0 && !entityIds.some((entityId) => scope.entityIds.has(entityId))) return false;
  if (jurisdictions.length > 0 && !jurisdictions.some((jurisdiction) => scope.jurisdictions.has(jurisdiction))) return false;
  if (objectRefs.length > 0 && !objectRefs.some((ref) => scope.objectRefs.some((candidate) => sameRecordObject(candidate, ref)))) {
    return false;
  }

  return true;
}

const RECORD_ARCHITECTURE_DECISIONS: RecordArchitectureDecision[] = deepFreeze([
  {
    id: "event-sourcing-live-v0",
    title: "Record event log is live from v0",
    status: "accepted",
    source: "DEMO-PRD/PRD-02-record.md#13",
    decidedAt: "2026-06-19",
    implementation: {
      authority: "postgres-event-log",
      eventLogLiveFrom: "v0",
      bitemporalReadsFrom: "v1",
      writePath: "record-service-only",
      sameDatabaseOutbox: true,
    },
    rationale:
      "Retrofitting event sourcing after canonical data exists would be the expensive migration. The v0 Record service therefore owns a hash-chained insert-only event log from day one.",
  },
  {
    id: "postgres-log-scale-out-trigger",
    title: "Postgres remains authoritative until evidence requires a dedicated log service",
    status: "accepted",
    source: "DEMO-PRD/PRD-02-record.md#15",
    decidedAt: "2026-06-19",
    implementation: {
      currentAuthority: "postgres",
      dedicatedLogServiceTriggerEventsPerTenant: 10_000_000,
      decisionMode: "evidence-review",
      derivedStoresAreDisposable: true,
    },
    rationale:
      "The PRD keeps the authoritative log in Postgres through v1 and calls for a dedicated log-service review only once tenant event volume gives real evidence.",
  },
  {
    id: "event-log-partitioning-baseline",
    title: "Tenant partitioning is the baseline event-log shape",
    status: "accepted",
    source: "DEMO-PRD/PRD-02-record.md#6",
    decidedAt: "2026-06-19",
    implementation: {
      partitionBy: "tenant_id",
      primaryKey: ["tenant_id", "seq"],
      insertOnlyRole: true,
      updateDeleteRevoked: true,
    },
    rationale:
      "The event log is tenant-scoped, append-only, and verified per tenant, so tenant_id is the baseline partition boundary and the per-tenant sequence remains the ordering contract.",
  },
]);

export function listRecordArchitectureDecisions() {
  return RECORD_ARCHITECTURE_DECISIONS;
}

export function getRecordArchitectureDecision(id: RecordArchitectureDecisionId) {
  return RECORD_ARCHITECTURE_DECISIONS.find((decision) => decision.id === id) ?? null;
}

const RECORD_MIGRATION_PLANS: RecordMigrationPlan[] = deepFreeze([
  {
    wave: "v0",
    title: "Wave 0 demo Record foundation",
    source: "DEMO-PRD/PRD-02-record.md#13",
    status: "active",
    capabilities: [
      "hash-chained event log live from day one",
      "assertions with provenance",
      "staging and single-approver gates",
      "direct dependency staleness propagation",
      "lens shapes with knownAt populated",
      "single-tenant RLS scaffolding",
    ],
    releaseGates: [
      "append-only event chain verifies",
      "canonical writes require approval references",
      "assertion provenance audit passes",
    ],
    exitCriteria: [
      "Record service commands are idempotent",
      "domain events enqueue the outbox",
      "read events stay out of the domain log",
    ],
  },
  {
    wave: "v1",
    title: "Wave 1 bitemporal and governance hardening",
    source: "DEMO-PRD/PRD-02-record.md#13",
    status: "planned",
    capabilities: [
      "bitemporal reconstruction reads",
      "period sealing write rejection",
      "manifest replay smoke test",
      "precedence policy configuration",
      "async staleness propagation",
      "multi-tenant RLS enforcement",
    ],
    releaseGates: [
      "all Record invariant gates pass",
      "golden dossier replay remains byte-identical",
      "cross-tenant canaries return zero hits",
    ],
    exitCriteria: [
      "as-filed and as-known-today reads are covered",
      "sealed snapshots read in constant time",
      "event lag and staleness latency targets are measured",
    ],
  },
  {
    wave: "v2",
    title: "Wave 2 scale and retention hardening",
    source: "DEMO-PRD/PRD-02-record.md#13",
    status: "planned",
    capabilities: [
      "partition strategy hardening",
      "dedicated log-service evaluation at 10M events per tenant",
      "crypto-shredding field hooks",
      "sealed-period snapshot cadence review",
    ],
    releaseGates: [
      "partition statistics are visible per tenant",
      "dedicated log-service review is evidence-based",
      "derived stores remain disposable from log and blobs",
    ],
    exitCriteria: [
      "tenant event-volume trigger is monitored",
      "partition plan is documented before storage growth",
      "field-level retention hooks align with PRD-14",
    ],
  },
]);

export function listRecordMigrationPlans() {
  return RECORD_MIGRATION_PLANS;
}

export function getRecordMigrationPlan(wave: RecordMigrationWave) {
  return RECORD_MIGRATION_PLANS.find((plan) => plan.wave === wave) ?? null;
}

export function createRecordService(options: CreateRecordServiceOptions = {}): RecordService {
  const store: RecordStore = {
    canonical: new Map(),
    stagingObjectsByTenant: new Map(),
    gatesByTenant: new Map(),
    precedencePoliciesByTenant: new Map(),
    assertionsByTenant: new Map(),
    entityAliasesByTenant: new Map(),
    entityRedirectsByTenant: new Map(),
    accountMappingProposalsByTenant: new Map(),
    accountMappingsByTenant: new Map(),
    corpusVersionsByTenant: new Map(),
    manifestsByTenant: new Map(),
    artifactsByTenant: new Map(),
    dependenciesByTenant: new Map(),
    dependencyIndexesByTenant: new Map(),
    dirtyFlagsByTenant: new Map(),
    rebuildProposalsByTenant: new Map(),
    stalenessMetricsByTenant: new Map(),
    stalenessJobsByTenant: new Map(),
    stalenessOptions: {
      synchronousEdgeLimit: options.staleness?.synchronousEdgeLimit ?? Number.POSITIVE_INFINITY,
    },
    periodsByTenant: new Map(),
    periodSnapshotsByTenant: new Map(),
    instructionsByTenant: new Map(),
    eventsByTenant: new Map(),
    outboxByTenant: new Map(),
    consumerOffsets: new Map(),
    idempotency: new Map(),
    transactions: new Map(),
    canonicalCommands: new Map(),
    stageCommands: new Map(),
    gateCommands: new Map(),
    precedencePolicyCommands: new Map(),
    resolutionCommands: new Map(),
    accountMappingCommands: new Map(),
    corpusCommands: new Map(),
    manifestCommands: new Map(),
    artifactCommands: new Map(),
    dependencyCommands: new Map(),
    stalenessCommands: new Map(),
    periodCommands: new Map(),
    instructionCommands: new Map(),
    assertionCommands: new Map(),
  };

  return {
    getCanonical(input) {
      assertTenantId(input.tenantId);
      const ref = createRecordRef(input.ref);
      if (!input.lens) {
        throw new RecordError(
          "LENS_REQUIRED",
          "Canonical Record reads require an explicit valid_at and known_at lens.",
          { ref: stringifyRecordRef(ref) },
        );
      }

      const lens = createRecordLens(input.lens);
      return canonicalRowAtLens(store.canonical.get(recordKey(input.tenantId, ref)) ?? [], lens);
    },

    getRef(input) {
      assertTenantId(input.tenantId);
      assertTenantReadAccess(input.tenantId, input.access);
      const ref = createRecordRef(input.ref);
      if (!isCanonicalObjectType(ref.objectType)) return null;
      if (!input.lens) {
        throw new RecordError(
          "LENS_REQUIRED",
          "Record ref reads for canonical objects require an explicit valid_at and known_at lens.",
          { ref: stringifyRecordRef(ref) },
        );
      }

      const lens = createRecordLens(input.lens);
      const row = canonicalRowAtLens(store.canonical.get(recordKey(input.tenantId, ref)) ?? [], lens);
      if (!row) return null;

      return {
        tenantId: input.tenantId,
        ref,
        kind: "canonical",
        lens,
        value: row,
      };
    },

    getTimeline(input) {
      assertTenantId(input.tenantId);
      assertTenantReadAccess(input.tenantId, input.access);
      const ref = createRecordRef(input.ref);
      const events = (store.eventsByTenant.get(input.tenantId) ?? []).filter((event) =>
        eventReferencesRecordRef(event, ref),
      );

      return {
        tenantId: input.tenantId,
        ref,
        events,
      };
    },

    getSubgraph(input) {
      assertTenantId(input.tenantId);
      assertTenantReadAccess(input.tenantId, input.access);
      const root = createRecordRef(input.root);
      if (!input.lens) {
        throw new RecordError("LENS_REQUIRED", "Subgraph reads require an explicit valid_at and known_at lens.", {
          root: stringifyRecordRef(root),
        });
      }
      const lens = createRecordLens(input.lens);
      const depth = normalizeSubgraphDepth(input.depth);
      const direction = input.direction ?? "both";
      const graph = collectDependencySubgraph(store, input.tenantId, root, direction, depth);
      const nodes = Array.from(graph.nodeRefs.values())
        .map((ref) => ({
          ref,
          value: isCanonicalObjectType(ref.objectType)
            ? canonicalRowAtLens(store.canonical.get(recordKey(input.tenantId, ref)) ?? [], lens)
            : null,
        }))
        .filter((node) => node.value || sameRecordObject(node.ref, root))
        .filter((node) => node.value || (sameRecordObject(node.ref, root) && graph.dependencies.length > 0))
        .sort((left, right) => stringifyRecordRef(left.ref).localeCompare(stringifyRecordRef(right.ref)));
      const edges = graph.dependencies
        .map((dependency) => ({
          dependencyId: dependency.dependencyId,
          upstreamRef: dependency.upstreamRef,
          downstreamRef: dependency.downstreamRef,
          kind: dependency.kind,
        }))
        .sort((left, right) => left.dependencyId.localeCompare(right.dependencyId));

      return {
        tenantId: input.tenantId,
        root,
        lens,
        nodes,
        edges,
      };
    },

    mirrorRunStarted(command) {
      assertActor(command.actor);
      const runRef = normalizeRunRef(command.runRef);
      const planRef = command.planRef === undefined || command.planRef === null ? null : createRecordRef(command.planRef);
      const scope = normalizeRecordRunScope(command.scope ?? {});
      const occurredAt = normalizeKnownAt(command.startedAt ?? new Date());
      const event = appendRecordEventWithIdempotency(store, {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        fingerprintKind: "mirror_run_started",
        actor: command.actor,
        type: "run.started",
        occurredAt,
        payload: {
          runRef: stringifyRecordRef(runRef),
          kind: command.kind,
          status: normalizeNonEmptyString(command.status, "status"),
          scope: serializedRecordRunScope(scope),
          planRef: planRef ? stringifyRecordRef(planRef) : null,
        },
      });

      return deepFreeze({
        runRef,
        planRef,
        event,
      });
    },

    mirrorRunStep(command) {
      assertActor(command.actor);
      const runRef = normalizeRunRef(command.runRef);
      const stepId = normalizeNonEmptyString(command.stepId, "stepId");
      const argsRef = command.argsRef === undefined || command.argsRef === null ? null : createRecordRef(command.argsRef);
      const resultRef = command.resultRef === undefined || command.resultRef === null ? null : createRecordRef(command.resultRef);
      const startedAt = normalizeKnownAt(command.startedAt);
      const completedAt = command.completedAt === undefined || command.completedAt === null ? null : normalizeKnownAt(command.completedAt);
      const payload = {
        runRef: stringifyRecordRef(runRef),
        stepId,
        type: command.type,
        toolName: command.toolName?.trim() || null,
        argsRef: argsRef ? stringifyRecordRef(argsRef) : null,
        resultRef: resultRef ? stringifyRecordRef(resultRef) : null,
        startedAt,
        completedAt,
        cost: normalizeJsonObject(command.cost ?? {}),
      };
      const event = appendRecordEventWithIdempotency(store, {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        fingerprintKind: "mirror_run_step",
        actor: command.actor,
        type: "run.step",
        occurredAt: completedAt ?? startedAt,
        payload,
      });

      return deepFreeze({
        runRef,
        stepId,
        event,
      });
    },

    mirrorRunCompleted(command) {
      const runRef = normalizeRunRef(command.runRef);
      const outputRefs = (command.outputRefs ?? []).map((ref) => createRecordRef(ref));
      const completedAt = normalizeKnownAt(command.completedAt ?? new Date());
      const event = appendRecordEventWithIdempotency(store, {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        fingerprintKind: "mirror_run_completed",
        actor: command.actor,
        type: "run.completed",
        manifestRef: command.manifestRef,
        occurredAt: completedAt,
        payload: {
          runRef: stringifyRecordRef(runRef),
          status: normalizeNonEmptyString(command.status, "status"),
          outputRefs: outputRefs.map((ref) => stringifyRecordRef(ref)),
        },
      });

      return deepFreeze({ runRef, planRef: null, event });
    },

    mirrorRunFailed(command) {
      const runRef = normalizeRunRef(command.runRef);
      const detailRef = command.failure.detailRef === undefined || command.failure.detailRef === null ? null : createRecordRef(command.failure.detailRef);
      const failedAt = normalizeKnownAt(command.failedAt ?? new Date());
      const event = appendRecordEventWithIdempotency(store, {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        fingerprintKind: "mirror_run_failed",
        actor: command.actor,
        type: "run.failed",
        occurredAt: failedAt,
        payload: {
          runRef: stringifyRecordRef(runRef),
          status: normalizeNonEmptyString(command.status, "status"),
          failure: {
            class: normalizeNonEmptyString(command.failure.class, "failure.class"),
            detailRef: detailRef ? stringifyRecordRef(detailRef) : null,
          },
        },
      });

      return deepFreeze({ runRef, planRef: null, event });
    },

    mirrorRunCancelled(command) {
      const runRef = normalizeRunRef(command.runRef);
      const cancelledAt = normalizeKnownAt(command.cancelledAt ?? new Date());
      const event = appendRecordEventWithIdempotency(store, {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        fingerprintKind: "mirror_run_cancelled",
        actor: command.actor,
        type: "run.cancelled",
        occurredAt: cancelledAt,
        payload: {
          runRef: stringifyRecordRef(runRef),
          status: normalizeNonEmptyString(command.status, "status"),
          reason: normalizeNonEmptyString(command.reason, "reason"),
        },
      });

      return deepFreeze({ runRef, planRef: null, event });
    },

    appendEvent(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);

      const payload = command.payload ?? {};
      validateEventInput({
        actor: command.actor,
        type: command.type,
        payload,
        manifestRef: command.manifestRef,
      });
      const fingerprint = stableStringify({
        kind: "append_event",
        tenantId: command.tenantId,
        actor: command.actor,
        type: command.type,
        payload,
        manifestRef: command.manifestRef,
      });
      const idempotencyKey = `${command.tenantId}:${command.idempotencyKey}`;
      const existing = store.idempotency.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.event;
      }

      const events = store.eventsByTenant.get(command.tenantId) ?? [];
      const prevHash = events.at(-1)?.hash ?? null;
      const event = createRecordEvent({
        tenantId: command.tenantId,
        seq: events.length + 1,
        type: command.type,
        actor: command.actor,
        payload,
        occurredAt: normalizeKnownAt(command.occurredAt ?? new Date()),
        manifestRef: command.manifestRef,
        prevHash,
      });

      events.push(event);
      store.eventsByTenant.set(command.tenantId, events);
      enqueueOutbox(store, command.tenantId, [event]);
      store.idempotency.set(idempotencyKey, { fingerprint, event });

      return event;
    },

    runTransaction(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);

      const fingerprint = stableStringify({
    kind: "transaction",
        tenantId: command.tenantId,
        operations: command.operations,
      });
      const idempotencyKey = `${command.tenantId}:transaction:${command.idempotencyKey}`;
      const existing = store.transactions.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record transaction idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result;
      }

      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const nextEvents = buildTransactionEvents(
        command.tenantId,
        currentEvents.length,
        currentEvents.at(-1)?.hash ?? null,
        command.operations,
      );
      const result = { events: nextEvents };

      store.eventsByTenant.set(command.tenantId, [...currentEvents, ...nextEvents]);
      enqueueOutbox(store, command.tenantId, nextEvents);
      store.transactions.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    submitAssertions(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      if (command.manifestRef !== undefined && !isRecordUlid(command.manifestRef)) {
        throw new RecordError("INVALID_REF", "Assertion manifest_ref must be a Record ULID.", {
          manifestRef: command.manifestRef,
        });
      }
      if (command.assertions.length === 0) {
        throw new RecordError("INVALID_ASSERTION", "submit_assertions requires at least one assertion.");
      }

      const assertionFingerprints = command.assertions.map((assertion) => assertionInputFingerprint(assertion));
      const fingerprint = stableStringify({
        kind: "submit_assertions",
        tenantId: command.tenantId,
        actor: command.actor,
        assertions: assertionFingerprints,
        manifestRef: command.manifestRef,
      });
      const idempotencyKey = `${command.tenantId}:submit_assertions:${command.idempotencyKey}`;
      const existing = store.assertionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as SubmitAssertionsResult;
      }

      const normalizedAssertions = command.assertions.map((assertion) =>
        normalizeAssertionInput(command.tenantId, assertion),
      );
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const nextEvents = buildTransactionEvents(
        command.tenantId,
        currentEvents.length,
        currentEvents.at(-1)?.hash ?? null,
        normalizedAssertions.map((assertion) => ({
          kind: "append_event",
          actor: command.actor,
          type: "assertion.recorded",
          manifestRef: command.manifestRef,
          payload: assertionRecordedPayload(assertion),
        })),
      );
      const result = deepFreeze({
        assertions: normalizedAssertions,
        events: nextEvents,
      });

      store.assertionsByTenant.set(command.tenantId, [
        ...(store.assertionsByTenant.get(command.tenantId) ?? []),
        ...normalizedAssertions,
      ]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, ...nextEvents]);
      enqueueOutbox(store, command.tenantId, nextEvents);
      store.assertionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    recordFindingCandidate(command) {
      const subjectRef = createRecordRef(command.subjectRef);
      const submitted = this.submitAssertions({
        tenantId: command.tenantId,
        idempotencyKey: `finding-candidate:${command.idempotencyKey}`,
        actor: command.actor,
        manifestRef: command.manifestRef,
        assertions: [
          {
            subject: {
              objectRef: subjectRef,
              field: "finding.candidate",
            },
            value: command.candidate,
            validFrom: command.validFrom,
            validTo: command.validTo,
            assertedAt: command.assertedAt,
            source: command.source,
            confidence: command.confidence,
            scopeKeys: command.scopeKeys,
            sensitivity: command.sensitivity,
          },
        ],
      });

      return deepFreeze({
        assertion: submitted.assertions[0],
        event: submitted.events[0],
      });
    },

    listFindingCandidates(input) {
      assertTenantId(input.tenantId);
      const subjectRef = input.subjectRef ? createRecordRef(input.subjectRef) : null;
      const lens = input.lens ? createRecordLens(input.lens) : null;

      return (store.assertionsByTenant.get(input.tenantId) ?? [])
        .filter((assertion) => assertion.subject.field === "finding.candidate")
        .filter((assertion) => !subjectRef || sameRecordObject(assertion.subject.objectRef, subjectRef))
        .filter((assertion) => !lens || assertionVisibleAtLens(assertion, lens));
    },

    retractAssertion(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertAssertionId(command.assertionId);
      if (!command.reason.trim()) {
        throw new RecordError("INVALID_ASSERTION", "Assertion retractions require a reason.");
      }

      const retractedAt = normalizeKnownAt(command.retractedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "retract_assertion",
        tenantId: command.tenantId,
        actor: command.actor,
        assertionId: command.assertionId,
        reason: command.reason,
        retractedAt,
      });
      const idempotencyKey = `${command.tenantId}:retract_assertion:${command.idempotencyKey}`;
      const existing = store.assertionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as RetractAssertionResult;
      }

      const assertions = store.assertionsByTenant.get(command.tenantId) ?? [];
      const assertionIndex = assertions.findIndex((assertion) => assertion.assertionId === command.assertionId);
      if (assertionIndex === -1) {
        throw new RecordError("ASSERTION_NOT_FOUND", "Assertion was not found.", {
          assertionId: command.assertionId,
        });
      }

      const assertion = assertions[assertionIndex];
      if (assertion.retractedAt) {
        throw new RecordError("INVALID_ASSERTION", "Assertion is already retracted.", {
          assertionId: command.assertionId,
        });
      }
      if (retractedAt <= assertion.assertedAt) {
        throw new RecordError("INVALID_ASSERTION", "Assertion retracted_at must be after asserted_at.", {
          assertionId: command.assertionId,
          assertedAt: assertion.assertedAt,
          retractedAt,
        });
      }

      const updatedAssertion = deepFreeze({
        ...assertion,
        retractedAt,
      });
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "assertion.retracted",
          payload: {
            assertionId: command.assertionId,
            reason: command.reason,
          },
        },
      ]);
      const result = deepFreeze({
        assertion: updatedAssertion,
        event,
      });

      const nextAssertions = [...assertions];
      nextAssertions[assertionIndex] = updatedAssertion;
      store.assertionsByTenant.set(command.tenantId, nextAssertions);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.assertionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    supersedeAssertion(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertAssertionId(command.assertionId);
      const supersededAt = normalizeKnownAt(command.supersededAt ?? command.replacement.assertedAt ?? new Date());
      const replacementInput = {
        ...command.replacement,
        assertedAt: command.replacement.assertedAt ?? supersededAt,
        supersedes: command.assertionId,
      };
      const replacementFingerprint = assertionInputFingerprint(replacementInput);
      const fingerprint = stableStringify({
        kind: "supersede_assertion",
        tenantId: command.tenantId,
        actor: command.actor,
        assertionId: command.assertionId,
        replacement: replacementFingerprint,
        reason: command.reason,
        supersededAt,
      });
      const idempotencyKey = `${command.tenantId}:supersede_assertion:${command.idempotencyKey}`;
      const existing = store.assertionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as SupersedeAssertionResult;
      }

      const replacement = normalizeAssertionInput(command.tenantId, replacementInput);
      const assertions = store.assertionsByTenant.get(command.tenantId) ?? [];
      const assertionIndex = assertions.findIndex((assertion) => assertion.assertionId === command.assertionId);
      if (assertionIndex === -1) {
        throw new RecordError("ASSERTION_NOT_FOUND", "Assertion was not found.", {
          assertionId: command.assertionId,
        });
      }

      const assertion = assertions[assertionIndex];
      if (assertion.retractedAt) {
        throw new RecordError("INVALID_ASSERTION", "Assertion is already retracted.", {
          assertionId: command.assertionId,
        });
      }
      if (supersededAt <= assertion.assertedAt) {
        throw new RecordError("INVALID_ASSERTION", "Assertion superseded_at must be after asserted_at.", {
          assertionId: command.assertionId,
          assertedAt: assertion.assertedAt,
          supersededAt,
        });
      }

      const superseded = deepFreeze({
        ...assertion,
        retractedAt: supersededAt,
      });
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const nextEvents = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "assertion.superseded",
          payload: {
            assertionId: command.assertionId,
            supersededBy: replacement.assertionId,
            reason: command.reason,
          },
        },
        {
          kind: "append_event",
          actor: command.actor,
          type: "assertion.recorded",
          payload: assertionRecordedPayload(replacement),
        },
      ]);
      const result = deepFreeze({
        superseded,
        replacement,
        events: nextEvents,
      });

      const nextAssertions = [...assertions];
      nextAssertions[assertionIndex] = superseded;
      nextAssertions.push(replacement);
      store.assertionsByTenant.set(command.tenantId, nextAssertions);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, ...nextEvents]);
      enqueueOutbox(store, command.tenantId, nextEvents);
      store.assertionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    auditAssertionProvenance(input) {
      assertTenantId(input.tenantId);
      const assertions = store.assertionsByTenant.get(input.tenantId) ?? [];
      const sourceKinds = {
        engine: 0,
        extraction: 0,
        human: 0,
        reviewer: 0,
      };
      const incompleteAssertions: AssertionProvenanceGap[] = [];

      assertions.forEach((assertion) => {
        sourceKinds[assertion.source.kind] += 1;
        const reasons = storedProvenanceGaps(assertion);
        if (reasons.length > 0) {
          incompleteAssertions.push({
            assertionId: assertion.assertionId,
            sourceKind: assertion.source.kind,
            reasons,
          });
        }
      });

      const completeAssertions = assertions.length - incompleteAssertions.length;
      return {
        tenantId: input.tenantId,
        totalAssertions: assertions.length,
        completeAssertions,
        incompleteAssertions,
        completenessRate: assertions.length === 0 ? 1 : completeAssertions / assertions.length,
        sourceKinds,
      };
    },

    promoteCanonical(command) {
      return commitCanonicalMutation(store, {
        kind: "gate",
        eventType: "canonical.promoted",
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        actor: command.actor,
        ref: command.ref,
        value: command.value,
        approvalRef: command.approvalRef,
        occurredAt: command.occurredAt,
      });
    },

    applyGovernedEdit(command) {
      if (!command.reason.trim()) {
        throw new RecordError("CANONICAL_APPROVAL_REQUIRED", "Governed edits require a reason.");
      }

      return commitCanonicalMutation(store, {
        kind: "governed_edit",
        eventType: "edit.applied",
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        actor: command.actor,
        ref: command.ref,
        value: command.value,
        approvalRef: command.approvalRef,
        reason: command.reason,
        occurredAt: command.occurredAt,
      });
    },

    stageObject(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const ref = createRecordRef(command.ref);
      const objectType = assertCanonicalObjectType(ref.objectType);
      const lens = createRecordLens(command.lens);
      const stagedAt = normalizeKnownAt(command.stagedAt ?? new Date());
      const proposedValue = normalizeCanonicalValue(objectType, ref, command.proposedValue);
      const currentRow = canonicalRowAtLens(store.canonical.get(recordKey(command.tenantId, ref)) ?? [], lens);
      const current = currentRow ? stripCanonicalMetadata(currentRow) : null;
      const diffSnapshot = createCanonicalDiffSnapshot(current, proposedValue);
      const fingerprint = stableStringify({
        kind: "stage_object",
        tenantId: command.tenantId,
        actor: command.actor,
        ref: stringifyRecordRef(ref),
        proposedValue,
        producedByRun: command.producedByRun ?? null,
        lens,
        stagedAt,
      });
      const idempotencyKey = `${command.tenantId}:stage_object:${command.idempotencyKey}`;
      const existing = store.stageCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as StageObjectResult;
      }

      const stagingObject = deepFreeze({
        tenantId: command.tenantId,
        stagingId: createRecordUlid(),
        objectRef: ref,
        proposedValue,
        producedByRun: command.producedByRun ?? null,
        gateId: null,
        status: "staged" as const,
        stagedBy: command.actor,
        stagedAt,
        diffSnapshot,
      });
      const result = deepFreeze({ stagingObject });

      store.stagingObjectsByTenant.set(command.tenantId, [
        ...(store.stagingObjectsByTenant.get(command.tenantId) ?? []),
        stagingObject,
      ]);
      store.stageCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    requestGate(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.stagingId, "stagingId");
      const requestedAt = normalizeKnownAt(command.requestedAt ?? new Date());
      const slaDue = normalizeKnownAt(command.slaDue);
      if (slaDue <= requestedAt) {
        throw new RecordError("INVALID_GATE", "Gate SLA due time must be after requested_at.", {
          requestedAt,
          slaDue,
        });
      }

      const stagingObject = findStagingObject(store, command.tenantId, command.stagingId);
      if (stagingObject.gateId) {
        throw new RecordError("INVALID_GATE", "Staging object already has a gate.", {
          stagingId: command.stagingId,
          gateId: stagingObject.gateId,
        });
      }
      if (stagingObject.status !== "staged") {
        throw new RecordError("INVALID_GATE", "Only staged objects can request gates.", {
          stagingId: command.stagingId,
          status: stagingObject.status,
        });
      }

      const fingerprint = stableStringify({
        kind: "request_gate",
        tenantId: command.tenantId,
        actor: command.actor,
        stagingId: command.stagingId,
        requestedAt,
        slaDue,
      });
      const idempotencyKey = `${command.tenantId}:request_gate:${command.idempotencyKey}`;
      const existing = store.gateCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as RequestGateResult;
      }

      const gateId = createRecordUlid();
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "gate.requested",
          occurredAt: requestedAt,
          payload: {
            gateId,
            stagingId: command.stagingId,
            objectRef: stringifyRecordRef(stagingObject.objectRef),
            slaDue,
          },
        },
      ]);
      const gate = deepFreeze({
        tenantId: command.tenantId,
        gateId,
        objectRef: stagingObject.objectRef,
        stagingId: command.stagingId,
        requestedBy: command.actor,
        requestedAt,
        slaDue,
        decision: null,
        decider: null,
        decidedAt: null,
        decisionReason: null,
        status: "pending" as const,
        delegateChain: [],
        escalations: [],
        diffSnapshot: stagingObject.diffSnapshot,
      });
      const updatedStagingObject = deepFreeze({
        ...stagingObject,
        gateId,
        status: "gate_requested" as const,
      });
      const result = deepFreeze({
        gate,
        stagingObject: updatedStagingObject,
        event,
      });

      replaceStagingObject(store, command.tenantId, updatedStagingObject);
      store.gatesByTenant.set(command.tenantId, [...(store.gatesByTenant.get(command.tenantId) ?? []), gate]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.gateCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    decideGate(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.gateId, "gateId");
      if (!["approved", "rejected"].includes(command.decision)) {
        throw new RecordError("INVALID_GATE", "Gate decisions must be approved or rejected.", {
          decision: command.decision,
        });
      }
      if (command.decision === "rejected" && !command.reason?.trim()) {
        throw new RecordError("INVALID_GATE", "Rejected gates require a reason.");
      }
      const decidedAt = normalizeKnownAt(command.decidedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "decide_gate",
        tenantId: command.tenantId,
        actor: command.actor,
        gateId: command.gateId,
        decision: command.decision,
        reason: command.reason ?? null,
        decidedAt,
      });
      const idempotencyKey = `${command.tenantId}:decide_gate:${command.idempotencyKey}`;
      const existing = store.gateCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as DecideGateResult;
      }

      const gate = findGate(store, command.tenantId, command.gateId);
      if (gate.decision) {
        throw new RecordError("INVALID_GATE", "Gate already has a decision.", {
          gateId: command.gateId,
          decision: gate.decision,
        });
      }
      const stagingObject = findStagingObject(store, command.tenantId, gate.stagingId);
      if (stagingObject.status !== "gate_requested") {
        throw new RecordError("INVALID_GATE", "Gate decisions require a requested staging object.", {
          stagingId: stagingObject.stagingId,
          status: stagingObject.status,
        });
      }

      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const operations: AppendRecordEventOperation[] = [
        {
          kind: "append_event",
          actor: command.actor,
          type: "gate.decided",
          occurredAt: decidedAt,
          payload: {
            gateId: gate.gateId,
            stagingId: stagingObject.stagingId,
            objectRef: stringifyRecordRef(gate.objectRef),
            decision: command.decision,
            reason: command.reason ?? null,
          },
        },
      ];

      if (command.decision === "approved") {
        operations.push({
          kind: "append_event",
          actor: command.actor,
          type: "canonical.promoted",
          occurredAt: decidedAt,
          payload: {
            gateId: gate.gateId,
            stagingId: stagingObject.stagingId,
            objectRef: stringifyRecordRef(gate.objectRef),
            objectType: gate.objectRef.objectType,
            table: canonicalTableName(gate.objectRef.objectType as CanonicalObjectType),
            approvalRef: gate.gateId,
            diffSnapshot: stagingObject.diffSnapshot,
          },
        });
      }

      const events = buildTransactionEvents(
        command.tenantId,
        currentEvents.length,
        currentEvents.at(-1)?.hash ?? null,
        operations,
      );
      const updatedGate = deepFreeze({
        ...gate,
        decision: command.decision,
        decider: command.actor,
        decidedAt,
        decisionReason: command.reason ?? null,
        status: command.decision,
      });
      const updatedStagingObject = deepFreeze({
        ...stagingObject,
        status: command.decision === "approved" ? ("promoted" as const) : ("rejected" as const),
      });
      const row =
        command.decision === "approved"
          ? deepFreeze({
              tenantId: command.tenantId,
              objectType: gate.objectRef.objectType as CanonicalObjectType,
              ref: gate.objectRef,
              ...stagingObject.proposedValue,
              approvalKind: "gate" as const,
              approvalRef: gate.gateId,
              lastChangeEvent: events[1].seq,
              lastChangeEventId: events[1].eventId,
              lastChangedAt: events[1].occurredAt,
            })
          : null;
      const result = deepFreeze({
        gate: updatedGate,
        stagingObject: updatedStagingObject,
        events,
        row,
      });

      replaceGate(store, command.tenantId, updatedGate);
      replaceStagingObject(store, command.tenantId, updatedStagingObject);
      if (row) {
        const key = recordKey(command.tenantId, gate.objectRef);
        store.canonical.set(key, [...(store.canonical.get(key) ?? []), row]);
      }
      store.eventsByTenant.set(command.tenantId, [...currentEvents, ...events]);
      enqueueOutbox(store, command.tenantId, events);
      store.gateCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    delegateGate(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.gateId, "gateId");
      if (!command.delegatedTo.trim()) {
        throw new RecordError("INVALID_GATE", "Gate delegation requires a delegate.");
      }
      const delegatedAt = normalizeKnownAt(command.delegatedAt ?? new Date());
      const expiresAt = command.expiresAt === undefined || command.expiresAt === null ? null : normalizeKnownAt(command.expiresAt);
      if (expiresAt && expiresAt <= delegatedAt) {
        throw new RecordError("INVALID_GATE", "Gate delegation expiry must be after delegated_at.", {
          delegatedAt,
          expiresAt,
        });
      }
      const reason = command.reason?.trim() ? command.reason : null;
      const fingerprint = stableStringify({
        kind: "delegate_gate",
        tenantId: command.tenantId,
        actor: command.actor,
        gateId: command.gateId,
        delegatedTo: command.delegatedTo,
        delegatedAt,
        expiresAt,
        reason,
      });
      const idempotencyKey = `${command.tenantId}:delegate_gate:${command.idempotencyKey}`;
      const existing = store.gateCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as DelegateGateResult;
      }

      const gate = findOpenGate(store, command.tenantId, command.gateId);
      const delegation = deepFreeze({
        delegatedTo: command.delegatedTo,
        delegatedBy: command.actor,
        delegatedAt,
        expiresAt,
        reason,
      });
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "gate.delegated",
          occurredAt: delegatedAt,
          payload: {
            gateId: gate.gateId,
            delegatedTo: command.delegatedTo,
            expiresAt,
            reason,
          },
        },
      ]);
      const updatedGate = deepFreeze({
        ...gate,
        status: "delegated" as const,
        delegateChain: [...gate.delegateChain, delegation],
      });
      const result = deepFreeze({ gate: updatedGate, event });

      replaceGate(store, command.tenantId, updatedGate);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.gateCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    escalateGate(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.gateId, "gateId");
      if (!command.escalatedTo.trim()) {
        throw new RecordError("INVALID_GATE", "Gate escalation requires an escalation target.");
      }
      if (!command.reason.trim()) {
        throw new RecordError("INVALID_GATE", "Gate escalation requires a reason.");
      }
      const escalatedAt = normalizeKnownAt(command.escalatedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "escalate_gate",
        tenantId: command.tenantId,
        actor: command.actor,
        gateId: command.gateId,
        escalatedTo: command.escalatedTo,
        reason: command.reason,
        escalatedAt,
      });
      const idempotencyKey = `${command.tenantId}:escalate_gate:${command.idempotencyKey}`;
      const existing = store.gateCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as EscalateGateResult;
      }

      const gate = findOpenGate(store, command.tenantId, command.gateId);
      const escalation = deepFreeze({
        escalatedTo: command.escalatedTo,
        escalatedBy: command.actor,
        escalatedAt,
        reason: command.reason,
      });
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "gate.escalated",
          occurredAt: escalatedAt,
          payload: {
            gateId: gate.gateId,
            escalatedTo: command.escalatedTo,
            reason: command.reason,
          },
        },
      ]);
      const updatedGate = deepFreeze({
        ...gate,
        status: "escalated" as const,
        escalations: [...gate.escalations, escalation],
      });
      const result = deepFreeze({ gate: updatedGate, event });

      replaceGate(store, command.tenantId, updatedGate);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.gateCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    registerPrecedencePolicy(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const changedAt = normalizeKnownAt(command.changedAt ?? new Date());
      const effectiveFrom = normalizeValidAt(command.effectiveFrom);
      const entries = normalizePrecedencePolicyEntries(command.entries);
      if (!command.name.trim()) {
        throw new RecordError("INVALID_PRECEDENCE_POLICY", "Precedence policies require a name.");
      }

      const fingerprint = stableStringify({
        kind: "register_precedence_policy",
        tenantId: command.tenantId,
        actor: command.actor,
        name: command.name,
        effectiveFrom,
        entries,
        changedAt,
      });
      const idempotencyKey = `${command.tenantId}:precedence_policy:${command.idempotencyKey}`;
      const existing = store.precedencePolicyCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result;
      }

      const existingPolicies = store.precedencePoliciesByTenant.get(command.tenantId) ?? [];
      const policyId = createRecordUlid();
      const version = existingPolicies.length + 1;
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "precedence.policy_changed",
          occurredAt: changedAt,
          payload: {
            policyId,
            policyVersion: version,
            name: command.name,
            effectiveFrom,
            fieldClasses: entries.map((entry) => entry.fieldClass),
          },
        },
      ]);
      const policy = deepFreeze({
        tenantId: command.tenantId,
        policyId,
        version,
        name: command.name,
        effectiveFrom,
        changedAt,
        changedBy: command.actor,
        entries,
        changeEvent: event.seq,
        changeEventId: event.eventId,
      });
      const result = deepFreeze({ policy, event });

      store.precedencePoliciesByTenant.set(command.tenantId, [...existingPolicies, policy]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.precedencePolicyCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    getCurrentValue(input) {
      return resolveCurrentValue(store, input);
    },

    listCurrentValues(input) {
      assertTenantId(input.tenantId);
      const lens = createRecordLens(input.lens);
      const subjects = new Map<string, RecordAssertionSubject>();

      (store.assertionsByTenant.get(input.tenantId) ?? [])
        .filter((assertion) => assertionVisibleAtLens(assertion, lens))
        .forEach((assertion) => {
          const key = `${stringifyRecordRef(assertion.subject.objectRef)}:${assertion.subject.field}`;
          subjects.set(key, assertion.subject);
        });

      return Array.from(subjects.values())
        .sort((left, right) => {
          const byField = left.field.localeCompare(right.field);
          if (byField !== 0) return byField;
          return stringifyRecordRef(left.objectRef).localeCompare(stringifyRecordRef(right.objectRef));
        })
        .map((subject) =>
          resolveCurrentValue(store, {
            tenantId: input.tenantId,
            subject,
            lens,
            policyVersion: input.policyVersion,
          }),
        );
    },

    getConflicts(input) {
      assertTenantId(input.tenantId);
      const subject = normalizeAssertionSubject(input.subject);
      const lens = createRecordLens(input.lens);
      const assertions = (store.assertionsByTenant.get(input.tenantId) ?? []).filter(
        (assertion) => sameAssertionSubject(assertion.subject, subject) && assertionVisibleAtLens(assertion, lens),
      );
      const groupsByValue = new Map<string, ConflictGroup>();

      assertions.forEach((assertion) => {
        const candidate = currentValueCandidate(assertion, null);
        const existing = groupsByValue.get(candidate.normalizedValue);
        if (existing) {
          existing.assertions.push(candidate);
          return;
        }

        groupsByValue.set(candidate.normalizedValue, {
          normalizedValue: candidate.normalizedValue,
          value: assertion.value,
          assertions: [candidate],
        });
      });

      const groups = Array.from(groupsByValue.values())
        .map((group) => ({
          ...group,
          assertions: group.assertions.sort((left, right) => left.assertedAt.localeCompare(right.assertedAt)),
        }))
        .sort((left, right) => left.normalizedValue.localeCompare(right.normalizedValue));

      return {
        tenantId: input.tenantId,
        subject,
        lens,
        status: groups.length > 1 ? "conflict" : "clear",
        totalAssertions: assertions.length,
        groups,
      };
    },

    addEntityAlias(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const entityRef = normalizeEntityRef(command.entityRef);
      const sourceRef = command.sourceRef === undefined || command.sourceRef === null ? null : createRecordRef(command.sourceRef);
      const aliasText = normalizeEntityAliasText(command.aliasText);
      const aliasKey = entityAliasKey(aliasText);
      const resolvedAt = normalizeKnownAt(command.resolvedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "add_entity_alias",
        tenantId: command.tenantId,
        actor: command.actor,
        entityRef: stringifyRecordRef(entityRef),
        aliasText,
        sourceRef: sourceRef ? stringifyRecordRef(sourceRef) : null,
        resolvedAt,
      });
      const idempotencyKey = `${command.tenantId}:resolution:alias:${command.idempotencyKey}`;
      const existing = store.resolutionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as AddEntityAliasResult;
      }

      const aliasId = createRecordUlid();
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "resolution.alias_added",
          occurredAt: resolvedAt,
          payload: {
            aliasId,
            aliasText,
            aliasKey,
            entityRef: stringifyRecordRef(entityRef),
            sourceRef: sourceRef ? stringifyRecordRef(sourceRef) : null,
          },
        },
      ]);
      const alias = deepFreeze({
        tenantId: command.tenantId,
        aliasId,
        aliasText,
        aliasKey,
        entityId: entityRef.objectId,
        entityRef,
        sourceRef,
        resolvedBy: command.actor,
        resolvedAt,
      });
      const result = deepFreeze({ alias, event });

      store.entityAliasesByTenant.set(command.tenantId, [...(store.entityAliasesByTenant.get(command.tenantId) ?? []), alias]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.resolutionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    mergeEntities(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const sourceEntityRef = normalizeEntityRef(command.sourceEntityRef);
      const targetEntityRef = followEntityRedirects(store, command.tenantId, normalizeEntityRef(command.targetEntityRef));
      if (sameRecordRef(sourceEntityRef, targetEntityRef)) {
        throw new RecordError("INVALID_ENTITY_ALIAS", "Entity merge source and target must be different entities.", {
          sourceEntityRef: stringifyRecordRef(sourceEntityRef),
          targetEntityRef: stringifyRecordRef(targetEntityRef),
        });
      }
      if (!command.reason.trim()) {
        throw new RecordError("INVALID_ENTITY_ALIAS", "Entity merges require a reason.");
      }
      const mergedAt = normalizeKnownAt(command.mergedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "merge_entities",
        tenantId: command.tenantId,
        actor: command.actor,
        sourceEntityRef: stringifyRecordRef(sourceEntityRef),
        targetEntityRef: stringifyRecordRef(targetEntityRef),
        reason: command.reason,
        mergedAt,
      });
      const idempotencyKey = `${command.tenantId}:resolution:merge:${command.idempotencyKey}`;
      const existing = store.resolutionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as MergeEntitiesResult;
      }

      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "resolution.merged",
          occurredAt: mergedAt,
          payload: {
            sourceEntityRef: stringifyRecordRef(sourceEntityRef),
            targetEntityRef: stringifyRecordRef(targetEntityRef),
            reason: command.reason,
          },
        },
      ]);
      const aliases = (store.entityAliasesByTenant.get(command.tenantId) ?? []).filter((alias) =>
        sameRecordRef(alias.entityRef, sourceEntityRef),
      );
      const result = deepFreeze({
        sourceEntityRef,
        targetEntityRef,
        aliases,
        event,
      });
      const redirects = new Map(store.entityRedirectsByTenant.get(command.tenantId) ?? []);

      redirects.set(entityRedirectKey(sourceEntityRef), targetEntityRef);
      store.entityRedirectsByTenant.set(command.tenantId, redirects);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.resolutionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    splitEntity(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const sourceEntityRef = normalizeEntityRef(command.sourceEntityRef);
      const newEntityRef = normalizeEntityRef(command.newEntityRef);
      const sourceRef = command.sourceRef === undefined || command.sourceRef === null ? null : createRecordRef(command.sourceRef);
      if (sameRecordRef(sourceEntityRef, newEntityRef)) {
        throw new RecordError("INVALID_ENTITY_ALIAS", "Entity split source and new entity must be different entities.", {
          sourceEntityRef: stringifyRecordRef(sourceEntityRef),
          newEntityRef: stringifyRecordRef(newEntityRef),
        });
      }
      if (!command.reason.trim()) {
        throw new RecordError("INVALID_ENTITY_ALIAS", "Entity splits require a reason.");
      }
      const aliasTexts = uniqueStrings(command.aliasTexts.map((aliasText) => normalizeEntityAliasText(aliasText)));
      if (aliasTexts.length === 0) {
        throw new RecordError("INVALID_ENTITY_ALIAS", "Entity splits require at least one alias for the new entity.");
      }
      const splitAt = normalizeKnownAt(command.splitAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "split_entity",
        tenantId: command.tenantId,
        actor: command.actor,
        sourceEntityRef: stringifyRecordRef(sourceEntityRef),
        newEntityRef: stringifyRecordRef(newEntityRef),
        aliasTexts,
        reason: command.reason,
        sourceRef: sourceRef ? stringifyRecordRef(sourceRef) : null,
        splitAt,
      });
      const idempotencyKey = `${command.tenantId}:resolution:split:${command.idempotencyKey}`;
      const existing = store.resolutionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as SplitEntityResult;
      }

      const aliases = aliasTexts.map((aliasText) =>
        deepFreeze({
          tenantId: command.tenantId,
          aliasId: createRecordUlid(),
          aliasText,
          aliasKey: entityAliasKey(aliasText),
          entityId: newEntityRef.objectId,
          entityRef: newEntityRef,
          sourceRef,
          resolvedBy: command.actor,
          resolvedAt: splitAt,
        }),
      );
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "resolution.split",
          occurredAt: splitAt,
          payload: {
            sourceEntityRef: stringifyRecordRef(sourceEntityRef),
            newEntityRef: stringifyRecordRef(newEntityRef),
            aliasIds: aliases.map((alias) => alias.aliasId),
            aliasTexts,
            sourceRef: sourceRef ? stringifyRecordRef(sourceRef) : null,
            reason: command.reason,
          },
        },
      ]);
      const result = deepFreeze({
        sourceEntityRef,
        newEntityRef,
        aliases,
        event,
      });

      store.entityAliasesByTenant.set(command.tenantId, [
        ...(store.entityAliasesByTenant.get(command.tenantId) ?? []),
        ...aliases,
      ]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.resolutionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    listEntityAliases(input) {
      assertTenantId(input.tenantId);
      const entityRef = input.entityRef ? normalizeEntityRef(input.entityRef) : null;
      const aliasKey = input.aliasText === undefined ? null : entityAliasKey(normalizeEntityAliasText(input.aliasText));

      return (store.entityAliasesByTenant.get(input.tenantId) ?? [])
        .filter((alias) => !entityRef || sameRecordRef(alias.entityRef, entityRef))
        .filter((alias) => !aliasKey || alias.aliasKey === aliasKey);
    },

    resolveEntityAlias(input) {
      assertTenantId(input.tenantId);
      const aliasKey = entityAliasKey(normalizeEntityAliasText(input.aliasText));
      const alias =
        (store.entityAliasesByTenant.get(input.tenantId) ?? [])
          .filter((candidate) => candidate.aliasKey === aliasKey)
          .sort((left, right) => right.resolvedAt.localeCompare(left.resolvedAt) || right.aliasId.localeCompare(left.aliasId))[0] ??
        null;

      if (!alias) return null;

      return {
        alias,
        entityRef: followEntityRedirects(store, input.tenantId, alias.entityRef),
      };
    },

    proposeAccountMapping(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const sourceAccount = normalizeAccountCode(command.sourceAccount, "sourceAccount");
      const canonicalAccount = normalizeAccountCode(command.canonicalAccount, "canonicalAccount");
      const scope = normalizeAccountMappingScope(command.scope ?? {});
      const confidence = normalizeAccountMappingConfidence(command.confidence);
      const proposedAt = normalizeKnownAt(command.proposedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "propose_account_mapping",
        tenantId: command.tenantId,
        actor: command.actor,
        sourceAccount,
        canonicalAccount,
        scope,
        confidence,
        proposedAt,
      });
      const idempotencyKey = `${command.tenantId}:account_mapping:propose:${command.idempotencyKey}`;
      const existing = store.accountMappingCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as ProposeAccountMappingResult;
      }

      const mappingProposalId = createRecordUlid();
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "resolution.mapping_proposed",
          occurredAt: proposedAt,
          payload: {
            mappingProposalId,
            sourceAccount,
            canonicalAccount,
            scope,
            confidence,
          },
        },
      ]);
      const proposal = deepFreeze({
        tenantId: command.tenantId,
        mappingProposalId,
        sourceAccount,
        canonicalAccount,
        scope,
        confidence,
        proposedBy: command.actor,
        proposedAt,
        status: "proposed" as const,
        appliedMappingId: null,
      });
      const result = deepFreeze({ proposal, event });

      store.accountMappingProposalsByTenant.set(command.tenantId, [
        ...(store.accountMappingProposalsByTenant.get(command.tenantId) ?? []),
        proposal,
      ]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.accountMappingCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    applyAccountMapping(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.mappingProposalId, "mappingProposalId");
      assertRecordUlidValue(command.approvalRef, "approvalRef");
      const appliedAt = normalizeKnownAt(command.appliedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "apply_account_mapping",
        tenantId: command.tenantId,
        actor: command.actor,
        mappingProposalId: command.mappingProposalId,
        approvalRef: command.approvalRef,
        appliedAt,
      });
      const idempotencyKey = `${command.tenantId}:account_mapping:apply:${command.idempotencyKey}`;
      const existing = store.accountMappingCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as ApplyAccountMappingResult;
      }

      const proposals = store.accountMappingProposalsByTenant.get(command.tenantId) ?? [];
      const proposalIndex = proposals.findIndex((proposal) => proposal.mappingProposalId === command.mappingProposalId);
      if (proposalIndex === -1) {
        throw new RecordError("ACCOUNT_MAPPING_NOT_FOUND", "Account mapping proposal was not found.", {
          mappingProposalId: command.mappingProposalId,
        });
      }
      const proposal = proposals[proposalIndex];
      if (proposal.status !== "proposed") {
        throw new RecordError("INVALID_ACCOUNT_MAPPING", "Account mapping proposal is already applied.", {
          mappingProposalId: command.mappingProposalId,
          status: proposal.status,
        });
      }

      const mappingId = createRecordUlid();
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "resolution.mapping_applied",
          occurredAt: appliedAt,
          payload: {
            mappingProposalId: proposal.mappingProposalId,
            mappingId,
            sourceAccount: proposal.sourceAccount,
            canonicalAccount: proposal.canonicalAccount,
            approvalRef: command.approvalRef,
          },
        },
      ]);
      const mapping = deepFreeze({
        tenantId: command.tenantId,
        mappingId,
        mappingProposalId: proposal.mappingProposalId,
        sourceAccount: proposal.sourceAccount,
        canonicalAccount: proposal.canonicalAccount,
        scope: proposal.scope,
        approvedBy: command.actor,
        approvalRef: command.approvalRef,
        appliedAt,
      });
      const updatedProposal = deepFreeze({
        ...proposal,
        status: "applied" as const,
        appliedMappingId: mappingId,
      });
      const result = deepFreeze({
        proposal: updatedProposal,
        mapping,
        event,
      });
      const nextProposals = [...proposals];

      nextProposals[proposalIndex] = updatedProposal;
      store.accountMappingProposalsByTenant.set(command.tenantId, nextProposals);
      store.accountMappingsByTenant.set(command.tenantId, [
        ...(store.accountMappingsByTenant.get(command.tenantId) ?? []),
        mapping,
      ]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.accountMappingCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    listAccountMappingProposals(input) {
      assertTenantId(input.tenantId);
      return (store.accountMappingProposalsByTenant.get(input.tenantId) ?? []).filter(
        (proposal) => !input.status || proposal.status === input.status,
      );
    },

    listAccountMappings(input) {
      assertTenantId(input.tenantId);
      return [...(store.accountMappingsByTenant.get(input.tenantId) ?? [])];
    },

    commitIngestionBatch(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const batchRef = normalizeIngestionBatchRef(command.batchRef);
      const documentRefs = normalizeDocumentRefs(command.documentRefs);
      const committedAt = normalizeKnownAt(command.committedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "commit_ingestion_batch",
        tenantId: command.tenantId,
        actor: command.actor,
        batchRef: stringifyRecordRef(batchRef),
        documentRefs: documentRefs.map((ref) => stringifyRecordRef(ref)),
        committedAt,
      });
      const idempotencyKey = `${command.tenantId}:corpus:ingestion_batch:${command.idempotencyKey}`;
      const existing = store.corpusCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result;
      }

      const currentCorpusVersion = store.corpusVersionsByTenant.get(command.tenantId) ?? emptyCorpusVersion(command.tenantId);
      const corpusVersion = deepFreeze({
        tenantId: command.tenantId,
        version: currentCorpusVersion.version + 1,
        lastBatchRef: batchRef,
        updatedAt: committedAt,
      });
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "ingestion.versioned",
          occurredAt: committedAt,
          payload: {
            corpusVersion: corpusVersion.version,
            batchRef: stringifyRecordRef(batchRef),
            documentRefs: documentRefs.map((ref) => stringifyRecordRef(ref)),
            documentCount: documentRefs.length,
          },
        },
      ]);
      const result = deepFreeze({
        corpusVersion,
        event,
      });

      store.corpusVersionsByTenant.set(command.tenantId, corpusVersion);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.corpusCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    getCorpusVersion(input) {
      assertTenantId(input.tenantId);
      return store.corpusVersionsByTenant.get(input.tenantId) ?? emptyCorpusVersion(input.tenantId);
    },

    registerManifest(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const jobRef = createRecordRef(command.jobRef);
      const corpusVersion = normalizeCorpusVersionNumber(command.corpusVersion);
      const rulepackVersions = normalizeVersionMap(command.rulepackVersions ?? {}, "rulepackVersions");
      const modelVersions = normalizeVersionMap(command.modelVersions ?? {}, "modelVersions");
      const instructionRefs = normalizeUlidList(command.instructionRefs ?? [], "instructionRefs");
      const gateRefs = normalizeUlidList(command.gateRefs ?? [], "gateRefs");
      const inputPins = normalizeManifestInputPins(command.inputPins);
      const outputHashes = normalizeOutputHashes(command.outputHashes ?? {});
      const registeredAt = normalizeKnownAt(command.registeredAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "register_manifest",
        tenantId: command.tenantId,
        actor: command.actor,
        jobRef: stringifyRecordRef(jobRef),
        corpusVersion,
        rulepackVersions,
        modelVersions,
        instructionRefs,
        gateRefs,
        inputPins: inputPins.map((pin) => ({ ref: stringifyRecordRef(pin.ref), version: pin.version })),
        outputHashes,
        registeredAt,
      });
      const idempotencyKey = `${command.tenantId}:manifest:${command.idempotencyKey}`;
      const existing = store.manifestCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result;
      }

      const manifestId = createRecordUlid();
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "run.completed",
          occurredAt: registeredAt,
          manifestRef: manifestId,
          payload: {
            runRef: stringifyRecordRef(jobRef),
            manifestId,
            corpusVersion,
            inputPinCount: inputPins.length,
            outputHashCount: Object.keys(outputHashes).length,
          },
        },
      ]);
      const manifest = deepFreeze({
        tenantId: command.tenantId,
        manifestId,
        jobRef,
        corpusVersion,
        rulepackVersions,
        modelVersions,
        instructionRefs,
        gateRefs,
        inputPins,
        outputHashes,
        registeredBy: command.actor,
        registeredAt,
        eventSeq: event.seq,
        eventId: event.eventId,
      });
      const result = deepFreeze({
        manifest,
        event,
      });

      store.manifestsByTenant.set(command.tenantId, [...(store.manifestsByTenant.get(command.tenantId) ?? []), manifest]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.manifestCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    getManifest(input) {
      assertTenantId(input.tenantId);
      assertRecordUlidValue(input.manifestId, "manifestId");
      return findManifest(store, input.tenantId, input.manifestId) ?? null;
    },

    getManifestPins(input) {
      assertTenantId(input.tenantId);
      assertRecordUlidValue(input.manifestId, "manifestId");
      const manifest = findManifest(store, input.tenantId, input.manifestId);
      if (!manifest) return null;

      return {
        tenantId: input.tenantId,
        manifestId: manifest.manifestId,
        corpusVersion: manifest.corpusVersion,
        inputPins: manifest.inputPins,
        instructionRefs: manifest.instructionRefs,
        gateRefs: manifest.gateRefs,
        rulepackVersions: manifest.rulepackVersions,
        modelVersions: manifest.modelVersions,
      };
    },

    registerArtifact(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.manifestId, "manifestId");
      const manifest = findManifest(store, command.tenantId, command.manifestId);
      if (!manifest) {
        throw new RecordError("MANIFEST_NOT_FOUND", "Artifacts require an existing manifest.", {
          manifestId: command.manifestId,
        });
      }
      const format = normalizeArtifactFormat(command.format);
      const blobRef = normalizeArtifactBlobRef(command.blobRef);
      const contentHash = normalizeContentHash(command.contentHash);
      const renderedAt = normalizeKnownAt(command.renderedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "register_artifact",
        tenantId: command.tenantId,
        actor: command.actor,
        manifestId: command.manifestId,
        format,
        blobRef,
        contentHash,
        renderedAt,
      });
      const idempotencyKey = `${command.tenantId}:artifact:register:${command.idempotencyKey}`;
      const existing = store.artifactCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result;
      }

      const artifactId = createRecordUlid();
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "artifact.rendered",
          occurredAt: renderedAt,
          manifestRef: manifest.manifestId,
          payload: {
            artifactId,
            manifestId: manifest.manifestId,
            format,
            blobRef,
            contentHash,
          },
        },
      ]);
      const artifact = deepFreeze({
        tenantId: command.tenantId,
        artifactId,
        manifestId: manifest.manifestId,
        format,
        blobRef,
        contentHash,
        sealed: false,
        sealedEvent: null,
        supersededCandidate: false,
        supersededByEvent: null,
        supersededAt: null,
        renderedBy: command.actor,
        renderedAt,
      });
      const result = deepFreeze({ artifact, event });

      store.artifactsByTenant.set(command.tenantId, [...(store.artifactsByTenant.get(command.tenantId) ?? []), artifact]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.artifactCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    sealArtifact(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.artifactId, "artifactId");
      const sealedAt = normalizeKnownAt(command.sealedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "seal_artifact",
        tenantId: command.tenantId,
        actor: command.actor,
        artifactId: command.artifactId,
        sealedAt,
      });
      const idempotencyKey = `${command.tenantId}:artifact:seal:${command.idempotencyKey}`;
      const existing = store.artifactCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as SealArtifactResult;
      }

      const artifact = findArtifact(store, command.tenantId, command.artifactId);
      if (!artifact) {
        throw new RecordError("ARTIFACT_NOT_FOUND", "Artifact was not found.", {
          artifactId: command.artifactId,
        });
      }
      if (artifact.sealed) {
        throw new RecordError("INVALID_ARTIFACT", "Artifact is already sealed.", {
          artifactId: artifact.artifactId,
          sealedEvent: artifact.sealedEvent,
        });
      }

      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "artifact.sealed",
          occurredAt: sealedAt,
          manifestRef: artifact.manifestId,
          payload: {
            artifactId: artifact.artifactId,
            manifestId: artifact.manifestId,
            contentHash: artifact.contentHash,
          },
        },
      ]);
      const sealedArtifact = deepFreeze({
        ...artifact,
        sealed: true,
        sealedEvent: event.seq,
      });
      const result = deepFreeze({
        artifact: sealedArtifact,
        event,
      });

      replaceArtifact(store, command.tenantId, sealedArtifact);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.artifactCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    getArtifact(input) {
      assertTenantId(input.tenantId);
      assertRecordUlidValue(input.artifactId, "artifactId");
      return findArtifact(store, input.tenantId, input.artifactId) ?? null;
    },

    listArtifacts(input) {
      assertTenantId(input.tenantId);
      if (input.manifestId !== undefined) {
        assertRecordUlidValue(input.manifestId, "manifestId");
      }

      return (store.artifactsByTenant.get(input.tenantId) ?? []).filter(
        (artifact) => !input.manifestId || artifact.manifestId === input.manifestId,
      );
    },

    verifyArtifactReplay(input) {
      return verifyArtifactReplayFromStore(store, input);
    },

    declareDependencies(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const declaredByRun = normalizeRunRef(command.declaredByRun);
      const downstreamRef = createRecordRef(command.downstreamRef);
      const upstreamRefs = normalizeDependencyInputs(command.upstreamRefs);
      const declaredAt = normalizeKnownAt(command.declaredAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "declare_dependencies",
        tenantId: command.tenantId,
        actor: command.actor,
        declaredByRun: stringifyRecordRef(declaredByRun),
        downstreamRef: stringifyRecordRef(downstreamRef),
        upstreamRefs: upstreamRefs.map((upstream) => ({
          ref: stringifyRecordRef(upstream.ref),
          kind: upstream.kind,
        })),
        declaredAt,
      });
      const idempotencyKey = `${command.tenantId}:dependencies:${command.idempotencyKey}`;
      const existing = store.dependencyCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result;
      }

      const existingDependencies = store.dependenciesByTenant.get(command.tenantId) ?? [];
      const dependencies = upstreamRefs
        .filter((upstream) =>
          !existingDependencies.some(
            (dependency) =>
              sameRecordRef(dependency.downstreamRef, downstreamRef) &&
              sameRecordRef(dependency.upstreamRef, upstream.ref) &&
              dependency.kind === upstream.kind,
          ),
        )
        .map((upstream) =>
          deepFreeze({
            tenantId: command.tenantId,
            dependencyId: createRecordUlid(),
            downstreamRef,
            upstreamRef: upstream.ref,
            kind: upstream.kind,
            declaredByRun,
            declaredAt,
          }),
        );
      if (dependencies.length === 0) {
        throw new RecordError("INVALID_DEPENDENCY", "declare_dependencies must add at least one new edge.");
      }

      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "dependency.declared",
          occurredAt: declaredAt,
          payload: {
            dependencyIds: dependencies.map((dependency) => dependency.dependencyId),
            downstreamRef: stringifyRecordRef(downstreamRef),
            upstreamRefs: dependencies.map((dependency) => stringifyRecordRef(dependency.upstreamRef)),
            declaredByRun: stringifyRecordRef(declaredByRun),
          },
        },
      ]);
      const result = deepFreeze({
        dependencies,
        event,
      });

      store.dependenciesByTenant.set(command.tenantId, [...existingDependencies, ...dependencies]);
      indexDependencies(store, command.tenantId, dependencies);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.dependencyCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    declareDependenciesBatch(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const declaredByRun = normalizeRunRef(command.declaredByRun);
      const requestedEdges = normalizeDependencyBatchEdges(command.edges);
      const declaredAt = normalizeKnownAt(command.declaredAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "declare_dependencies_batch",
        tenantId: command.tenantId,
        actor: command.actor,
        declaredByRun: stringifyRecordRef(declaredByRun),
        edges: requestedEdges.map((edge) => ({
          downstreamRef: stringifyRecordRef(edge.downstreamRef),
          upstreamRef: stringifyRecordRef(edge.upstreamRef),
          kind: edge.kind,
        })),
        declaredAt,
      });
      const idempotencyKey = `${command.tenantId}:dependencies_batch:${command.idempotencyKey}`;
      const existing = store.dependencyCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result;
      }

      const existingDependencies = store.dependenciesByTenant.get(command.tenantId) ?? [];
      const dependencies = requestedEdges
        .filter(
          (edge) =>
            !existingDependencies.some(
              (dependency) =>
                sameRecordRef(dependency.downstreamRef, edge.downstreamRef) &&
                sameRecordRef(dependency.upstreamRef, edge.upstreamRef) &&
                dependency.kind === edge.kind,
            ),
        )
        .map((edge) =>
          deepFreeze({
            tenantId: command.tenantId,
            dependencyId: createRecordUlid(),
            downstreamRef: edge.downstreamRef,
            upstreamRef: edge.upstreamRef,
            kind: edge.kind,
            declaredByRun,
            declaredAt,
          }),
        );
      if (dependencies.length === 0) {
        throw new RecordError("INVALID_DEPENDENCY", "declare_dependencies_batch must add at least one new edge.");
      }

      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const downstreamRefs = uniqueStrings(dependencies.map((dependency) => stringifyRecordRef(dependency.downstreamRef)));
      const upstreamRefs = uniqueStrings(dependencies.map((dependency) => stringifyRecordRef(dependency.upstreamRef)));
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "dependency.declared",
          occurredAt: declaredAt,
          payload: {
            dependencyIds: dependencies.map((dependency) => dependency.dependencyId),
            downstreamRefs,
            upstreamRefs,
            edges: dependencies.map((dependency) => ({
              dependencyId: dependency.dependencyId,
              downstreamRef: stringifyRecordRef(dependency.downstreamRef),
              upstreamRef: stringifyRecordRef(dependency.upstreamRef),
              kind: dependency.kind,
            })),
            declaredByRun: stringifyRecordRef(declaredByRun),
          },
        },
      ]);
      const result = deepFreeze({
        dependencies,
        event,
      });

      store.dependenciesByTenant.set(command.tenantId, [...existingDependencies, ...dependencies]);
      indexDependencies(store, command.tenantId, dependencies);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.dependencyCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    listDependencies(input) {
      assertTenantId(input.tenantId);
      const upstreamRef = input.upstreamRef ? createRecordRef(input.upstreamRef) : null;
      const downstreamRef = input.downstreamRef ? createRecordRef(input.downstreamRef) : null;
      const index = getDependencyIndex(store, input.tenantId);

      if (upstreamRef && !downstreamRef) {
        return index.byUpstream.get(recordObjectKey(upstreamRef)) ?? [];
      }
      if (downstreamRef && !upstreamRef) {
        return index.byDownstream.get(recordObjectKey(downstreamRef)) ?? [];
      }

      return (store.dependenciesByTenant.get(input.tenantId) ?? [])
        .filter((dependency) => !upstreamRef || sameRecordRef(dependency.upstreamRef, upstreamRef))
        .filter((dependency) => !downstreamRef || sameRecordRef(dependency.downstreamRef, downstreamRef));
    },

    getDirtySet(input) {
      assertTenantId(input.tenantId);
      const objectRef = input.objectRef ? createRecordRef(input.objectRef) : null;
      const status = input.status ?? "active";
      const flags = (store.dirtyFlagsByTenant.get(input.tenantId) ?? [])
        .filter((flag) => flag.status === status)
        .filter((flag) => !objectRef || sameRecordObject(flag.objectRef, objectRef));
      const flagIds = new Set(flags.map((flag) => flag.dirtyFlagId));
      const proposals = (store.rebuildProposalsByTenant.get(input.tenantId) ?? []).filter(
        (proposal) => proposal.status === "proposed" && proposal.dirtyFlagIds.some((dirtyFlagId) => flagIds.has(dirtyFlagId)),
      );

      return {
        tenantId: input.tenantId,
        flags,
        proposals,
      };
    },

    listRebuildProposals(input) {
      assertTenantId(input.tenantId);
      const targetRef = input.targetRef ? createRecordRef(input.targetRef) : null;

      return (store.rebuildProposalsByTenant.get(input.tenantId) ?? [])
        .filter((proposal) => !input.status || proposal.status === input.status)
        .filter((proposal) => !targetRef || proposal.targets.some((target) => sameRecordObject(target, targetRef)));
    },

    resolveRebuildProposal(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.proposalId, "proposalId");
      if (!["accepted", "skipped"].includes(command.decision)) {
        throw new RecordError("INVALID_STALENESS", "Rebuild proposal decisions must be accepted or skipped.", {
          decision: command.decision,
        });
      }
      if (!command.reason.trim()) {
        throw new RecordError("INVALID_STALENESS", "Rebuild proposal resolution requires a reason.");
      }
      const resolvedAt = normalizeKnownAt(command.resolvedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "resolve_rebuild_proposal",
        tenantId: command.tenantId,
        actor: command.actor,
        proposalId: command.proposalId,
        decision: command.decision,
        reason: command.reason,
        resolvedAt,
      });
      const idempotencyKey = `${command.tenantId}:staleness:resolve:${command.idempotencyKey}`;
      const existing = store.stalenessCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result;
      }

      const proposals = store.rebuildProposalsByTenant.get(command.tenantId) ?? [];
      const proposalIndex = proposals.findIndex((proposal) => proposal.proposalId === command.proposalId);
      if (proposalIndex === -1) {
        throw new RecordError("INVALID_STALENESS", "Rebuild proposal was not found.", {
          proposalId: command.proposalId,
        });
      }
      const proposal = proposals[proposalIndex];
      if (proposal.status !== "proposed") {
        throw new RecordError("INVALID_STALENESS", "Rebuild proposal is already resolved.", {
          proposalId: proposal.proposalId,
          status: proposal.status,
        });
      }

      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "staleness.proposal_resolved",
          occurredAt: resolvedAt,
          payload: {
            proposalId: proposal.proposalId,
            decision: command.decision,
            reason: command.reason,
            dirtyFlagIds: proposal.dirtyFlagIds,
          },
        },
      ]);
      const updatedProposal = deepFreeze({
        ...proposal,
        status: command.decision,
        resolvedAt,
        resolvedBy: command.actor,
        resolutionReason: command.reason,
      });
      const result = deepFreeze({
        proposal: updatedProposal,
        event,
      });
      const nextProposals = [...proposals];

      nextProposals[proposalIndex] = updatedProposal;
      store.rebuildProposalsByTenant.set(command.tenantId, nextProposals);
      resolveDirtyFlags(store, command.tenantId, proposal.dirtyFlagIds);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.stalenessCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    getStalenessMetrics(input) {
      assertTenantId(input.tenantId);
      const metrics = store.stalenessMetricsByTenant.get(input.tenantId) ?? emptyStalenessMetricsState();

      return {
        tenantId: input.tenantId,
        propagationRuns: metrics.propagationLatenciesMs.length,
        dirtyFlagsCreated: metrics.dirtyFlagsCreated,
        rebuildProposalsCreated: metrics.rebuildProposalsCreated,
        p95PropagationLatencyMs: percentile(metrics.propagationLatenciesMs, 0.95),
      };
    },

    listStalenessPropagationJobs(input) {
      assertTenantId(input.tenantId);
      return (store.stalenessJobsByTenant.get(input.tenantId) ?? [])
        .filter((job) => !input.status || job.status === input.status)
        .map(publicStalenessJob);
    },

    processStalenessPropagationQueue(input) {
      assertTenantId(input.tenantId);
      const maxJobs = input.maxJobs ?? Number.POSITIVE_INFINITY;
      if (maxJobs <= 0) {
        throw new RecordError("INVALID_STALENESS", "maxJobs must be positive.");
      }
      const processedAt = normalizeKnownAt(input.processedAt ?? new Date());
      const jobs = store.stalenessJobsByTenant.get(input.tenantId) ?? [];
      const queuedJobs = jobs.filter((job) => job.status === "queued").slice(0, maxJobs);
      if (queuedJobs.length === 0) {
        return { jobs: [], events: [] };
      }

      const currentEvents = store.eventsByTenant.get(input.tenantId) ?? [];
      let operations: AppendRecordEventOperation[] = [];
      const completedJobs = queuedJobs.map((job) => {
        const materialized = materializeDirtyTargets(store, input.tenantId, job.sourceEvent, job.changedRef, job.dirtyTargets, processedAt);
        operations = [...operations, ...materialized.operations];
        return deepFreeze({
          ...job,
          status: "completed" as const,
          processedAt,
          dirtyFlagIds: materialized.dirtyFlagIds,
          proposalId: materialized.proposalId,
        });
      });
      const events =
        operations.length === 0
          ? []
          : buildTransactionEvents(
              input.tenantId,
              currentEvents.length,
              currentEvents.at(-1)?.hash ?? null,
              operations,
            );
      const completedById = new Map(completedJobs.map((job) => [job.jobId, job]));

      store.stalenessJobsByTenant.set(
        input.tenantId,
        jobs.map((job) => completedById.get(job.jobId) ?? job),
      );
      if (events.length > 0) {
        store.eventsByTenant.set(input.tenantId, [...currentEvents, ...events]);
        enqueueOutbox(store, input.tenantId, events);
      }

      return {
        jobs: completedJobs.map(publicStalenessJob),
        events,
      };
    },

    openPeriod(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const fy = normalizePeriodLabel(command.fy, "fy");
      const quarter = command.quarter === undefined || command.quarter === null ? null : normalizePeriodLabel(command.quarter, "quarter");
      const validFrom = normalizeValidAt(command.validFrom);
      const validTo = normalizeValidAt(command.validTo);
      if (validTo <= validFrom) {
        throw new RecordError("INVALID_PERIOD", "Period validTo must be after validFrom.", { validFrom, validTo });
      }
      const openedAt = normalizeKnownAt(command.openedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "open_period",
        tenantId: command.tenantId,
        actor: command.actor,
        fy,
        quarter,
        validFrom,
        validTo,
        openedAt,
      });
      const idempotencyKey = `${command.tenantId}:period:open:${command.idempotencyKey}`;
      const existing = store.periodCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as OpenPeriodResult;
      }

      const periodId = createRecordUlid();
      const periodRef = createRecordRef({ objectType: "period", objectId: periodId });
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "period.opened",
          occurredAt: openedAt,
          payload: {
            periodId,
            periodRef: stringifyRecordRef(periodRef),
            fy,
            quarter,
            validFrom,
            validTo,
          },
        },
      ]);
      const period = deepFreeze({
        tenantId: command.tenantId,
        periodId,
        periodRef,
        fy,
        quarter,
        validFrom,
        validTo,
        status: "open" as const,
        openedEvent: event.seq,
        closingEvent: null,
        sealedEvent: null,
        openedAt,
        closingAt: null,
        sealedAt: null,
        sealedBy: null,
      });
      const result = deepFreeze({ period, event });

      store.periodsByTenant.set(command.tenantId, [...(store.periodsByTenant.get(command.tenantId) ?? []), period]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.periodCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    closePeriod(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.periodId, "periodId");
      const closingAt = normalizeKnownAt(command.closingAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "close_period",
        tenantId: command.tenantId,
        actor: command.actor,
        periodId: command.periodId,
        closingAt,
      });
      const idempotencyKey = `${command.tenantId}:period:close:${command.idempotencyKey}`;
      const existing = store.periodCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as ClosePeriodResult;
      }

      const period = findPeriodOrThrow(store, command.tenantId, command.periodId);
      if (period.status === "sealed") {
        throw new RecordError("PERIOD_SEALED", "Sealed periods cannot be moved back to closing.", {
          periodId: period.periodId,
        });
      }
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const [event] = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
        {
          kind: "append_event",
          actor: command.actor,
          type: "period.closing",
          occurredAt: closingAt,
          payload: {
            periodId: period.periodId,
            periodRef: stringifyRecordRef(period.periodRef),
            fy: period.fy,
          },
        },
      ]);
      const updatedPeriod = deepFreeze({
        ...period,
        status: "closing" as const,
        closingEvent: event.seq,
        closingAt,
      });
      const result = deepFreeze({ period: updatedPeriod, event });

      replacePeriod(store, command.tenantId, updatedPeriod);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, event]);
      enqueueOutbox(store, command.tenantId, [event]);
      store.periodCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    sealPeriod(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.periodId, "periodId");
      const sealedAt = normalizeKnownAt(command.sealedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "seal_period",
        tenantId: command.tenantId,
        actor: command.actor,
        periodId: command.periodId,
        sealedAt,
      });
      const idempotencyKey = `${command.tenantId}:period:seal:${command.idempotencyKey}`;
      const existing = store.periodCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as SealPeriodResult;
      }

      const period = findPeriodOrThrow(store, command.tenantId, command.periodId);
      if (period.status === "sealed") {
        throw new RecordError("PERIOD_SEALED", "Period is already sealed.", {
          periodId: period.periodId,
          sealedEvent: period.sealedEvent,
        });
      }
      if (period.status !== "closing") {
        throw new RecordError("INVALID_PERIOD", "Only closing periods can be sealed.", {
          periodId: period.periodId,
          status: period.status,
        });
      }

      const artifactsToSeal = findArtifactsLinkedToPeriod(store, command.tenantId, period.periodRef).filter(
        (artifact) => !artifact.sealed,
      );
      const currentEvents = store.eventsByTenant.get(command.tenantId) ?? [];
      const operations: AppendRecordEventOperation[] = [
        {
          kind: "append_event",
          actor: command.actor,
          type: "period.sealed",
          occurredAt: sealedAt,
          payload: {
            periodId: period.periodId,
            periodRef: stringifyRecordRef(period.periodRef),
            fy: period.fy,
            quarter: period.quarter,
            closingEvent: period.closingEvent,
            sealedArtifactIds: artifactsToSeal.map((artifact) => artifact.artifactId),
          },
        },
        ...artifactsToSeal.map(
          (artifact): AppendRecordEventOperation => ({
            kind: "append_event",
            actor: command.actor,
            type: "artifact.sealed",
            occurredAt: sealedAt,
            manifestRef: artifact.manifestId,
            payload: {
              artifactId: artifact.artifactId,
              manifestId: artifact.manifestId,
              contentHash: artifact.contentHash,
              sealedByPeriodId: period.periodId,
            },
          }),
        ),
      ];
      const events = buildTransactionEvents(command.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, operations);
      const [event, ...artifactEvents] = events;
      const updatedPeriod = deepFreeze({
        ...period,
        status: "sealed" as const,
        sealedEvent: event.seq,
        sealedAt,
        sealedBy: command.actor,
      });
      const snapshot = deepFreeze({
        tenantId: command.tenantId,
        snapshotId: createRecordUlid(),
        periodId: period.periodId,
        periodRef: period.periodRef,
        cadence: "per-seal" as const,
        sealedEvent: event.seq,
        capturedAt: sealedAt,
        rows: snapshotCanonicalRows(store, command.tenantId, period, sealedAt),
      });
      const sealedArtifacts = artifactsToSeal.map((artifact, index) =>
        deepFreeze({
          ...artifact,
          sealed: true,
          sealedEvent: artifactEvents[index].seq,
        }),
      );
      const result = deepFreeze({
        period: updatedPeriod,
        event,
        snapshot,
        sealedArtifacts,
        artifactEvents,
      });

      replacePeriod(store, command.tenantId, updatedPeriod);
      sealedArtifacts.forEach((artifact) => replaceArtifact(store, command.tenantId, artifact));
      store.periodSnapshotsByTenant.set(command.tenantId, [
        ...(store.periodSnapshotsByTenant.get(command.tenantId) ?? []).filter(
          (candidate) => candidate.periodId !== period.periodId,
        ),
        snapshot,
      ]);
      store.eventsByTenant.set(command.tenantId, [...currentEvents, ...events]);
      enqueueOutbox(store, command.tenantId, events);
      store.periodCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    getPeriod(input) {
      assertTenantId(input.tenantId);
      assertRecordUlidValue(input.periodId, "periodId");
      return findPeriod(store, input.tenantId, input.periodId);
    },

    listPeriods(input) {
      assertTenantId(input.tenantId);
      return (store.periodsByTenant.get(input.tenantId) ?? []).filter((period) => !input.status || period.status === input.status);
    },

    getPeriodSnapshot(input) {
      assertTenantId(input.tenantId);
      assertRecordUlidValue(input.periodId, "periodId");
      return findPeriodSnapshot(store, input.tenantId, input.periodId);
    },

    getAsFiled(input) {
      assertTenantId(input.tenantId);
      assertRecordUlidValue(input.periodId, "periodId");
      const ref = createRecordRef(input.ref);
      const snapshot = findPeriodSnapshot(store, input.tenantId, input.periodId);
      if (!snapshot) return null;

      return snapshot.rows.find((row) => sameRecordObject(row.ref, ref)) ?? null;
    },

    getAsKnownToday(input) {
      assertTenantId(input.tenantId);
      const ref = createRecordRef(input.ref);
      return (store.canonical.get(recordKey(input.tenantId, ref)) ?? []).at(-1) ?? null;
    },

    submitInstruction(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      const tier = normalizeInstructionTier(command.tier);
      const scope = normalizeInstructionScope(command.scope);
      const text = normalizeNonEmptyString(command.text, "text");
      const compiled = normalizeJsonObject(command.compiled ?? {});
      const submittedAt = normalizeKnownAt(command.submittedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "submit_instruction",
        tenantId: command.tenantId,
        actor: command.actor,
        tier,
        scope: serializedInstructionScope(scope),
        text,
        compiled,
        submittedAt,
      });
      const idempotencyKey = `${command.tenantId}:instruction:submit:${command.idempotencyKey}`;
      const existing = store.instructionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as SubmitInstructionResult;
      }

      const instructionId = createRecordUlid();
      const instructionRef = stringifyRecordRef(createRecordRef({ objectType: "instruction", objectId: instructionId }));
      const event = appendRecordEventWithIdempotency(store, {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        fingerprintKind: "instruction_submitted_event",
        actor: command.actor,
        type: "instruction.submitted",
        occurredAt: submittedAt,
        payload: {
          instructionRef,
          tier,
          scope: serializedInstructionScope(scope),
        },
      });
      const instruction = deepFreeze({
        tenantId: command.tenantId,
        instructionId,
        instructionRef,
        tier,
        scope,
        text,
        compiled,
        status: "submitted" as const,
        author: command.actor,
        submittedAt,
        submittedEvent: event.seq,
        approvedBy: null,
        approvedAt: null,
        approvedEvent: null,
        retiredBy: null,
        retiredAt: null,
        retiredEvent: null,
        retirementReason: null,
      });
      const result = deepFreeze({ instruction, event });

      store.instructionsByTenant.set(command.tenantId, [...(store.instructionsByTenant.get(command.tenantId) ?? []), instruction]);
      store.instructionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    approveInstruction(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.instructionId, "instructionId");
      const approvedAt = normalizeKnownAt(command.approvedAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "approve_instruction",
        tenantId: command.tenantId,
        actor: command.actor,
        instructionId: command.instructionId,
        approvedAt,
      });
      const idempotencyKey = `${command.tenantId}:instruction:approve:${command.idempotencyKey}`;
      const existing = store.instructionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as ApproveInstructionResult;
      }

      const instruction = findInstructionOrThrow(store, command.tenantId, command.instructionId);
      if (instruction.status === "retired") {
        throw new RecordError("INVALID_INSTRUCTION", "Retired instructions cannot be approved.", {
          instructionId: instruction.instructionId,
        });
      }
      const event = appendRecordEventWithIdempotency(store, {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        fingerprintKind: "instruction_approved_event",
        actor: command.actor,
        type: "instruction.approved",
        occurredAt: approvedAt,
        payload: {
          instructionRef: instruction.instructionRef,
          approvedBy: command.actor.id,
        },
      });
      const approved = deepFreeze({
        ...instruction,
        status: "active" as const,
        approvedBy: command.actor.id,
        approvedAt,
        approvedEvent: event.seq,
      });
      const result = deepFreeze({ instruction: approved, event });

      replaceInstruction(store, command.tenantId, approved);
      store.instructionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    retireInstruction(command) {
      assertTenantId(command.tenantId);
      assertIdempotencyKey(command.idempotencyKey);
      assertActor(command.actor);
      assertRecordUlidValue(command.instructionId, "instructionId");
      const reason = normalizeNonEmptyString(command.reason, "reason");
      const retiredAt = normalizeKnownAt(command.retiredAt ?? new Date());
      const fingerprint = stableStringify({
        kind: "retire_instruction",
        tenantId: command.tenantId,
        actor: command.actor,
        instructionId: command.instructionId,
        reason,
        retiredAt,
      });
      const idempotencyKey = `${command.tenantId}:instruction:retire:${command.idempotencyKey}`;
      const existing = store.instructionCommands.get(idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
            idempotencyKey: command.idempotencyKey,
          });
        }

        return existing.result as RetireInstructionResult;
      }

      const instruction = findInstructionOrThrow(store, command.tenantId, command.instructionId);
      const event = appendRecordEventWithIdempotency(store, {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        fingerprintKind: "instruction_retired_event",
        actor: command.actor,
        type: "instruction.retired",
        occurredAt: retiredAt,
        payload: {
          instructionRef: instruction.instructionRef,
          reason,
        },
      });
      const retired = deepFreeze({
        ...instruction,
        status: "retired" as const,
        retiredBy: command.actor.id,
        retiredAt,
        retiredEvent: event.seq,
        retirementReason: reason,
      });
      const result = deepFreeze({ instruction: retired, event });

      replaceInstruction(store, command.tenantId, retired);
      store.instructionCommands.set(idempotencyKey, { fingerprint, result });

      return result;
    },

    getInstruction(input) {
      assertTenantId(input.tenantId);
      assertRecordUlidValue(input.instructionId, "instructionId");
      return findInstruction(store, input.tenantId, input.instructionId);
    },

    listInstructions(input) {
      assertTenantId(input.tenantId);
      return (store.instructionsByTenant.get(input.tenantId) ?? []).filter(
        (instruction) => !input.status || instruction.status === input.status,
      );
    },

    listStagingObjects(input) {
      assertTenantId(input.tenantId);
      const ref = input.objectRef ? createRecordRef(input.objectRef) : null;

      return (store.stagingObjectsByTenant.get(input.tenantId) ?? [])
        .filter((stagingObject) => !input.status || stagingObject.status === input.status)
        .filter((stagingObject) => !ref || stringifyRecordRef(stagingObject.objectRef) === stringifyRecordRef(ref));
    },

    listGates(input) {
      assertTenantId(input.tenantId);
      const ref = input.objectRef ? createRecordRef(input.objectRef) : null;

      return (store.gatesByTenant.get(input.tenantId) ?? [])
        .filter((gate) => !input.status || gate.status === input.status)
        .filter((gate) => !ref || stringifyRecordRef(gate.objectRef) === stringifyRecordRef(ref));
    },

    listCanonical(input) {
      assertTenantId(input.tenantId);
      if (!input.lens) {
        throw new RecordError("LENS_REQUIRED", "Canonical Record reads require an explicit valid_at and known_at lens.");
      }
      const lens = createRecordLens(input.lens);
      if (input.objectType) {
        assertCanonicalObjectType(input.objectType);
      }

      return Array.from(store.canonical.values())
        .map((history) => canonicalRowAtLens(history, lens))
        .filter((row): row is CanonicalRecordRow => Boolean(row))
        .filter((row) => !input.objectType || row.objectType === input.objectType);
    },

    listAssertions(input) {
      assertTenantId(input.tenantId);
      const rows = store.assertionsByTenant.get(input.tenantId) ?? [];
      const lens = input.lens ? createRecordLens(input.lens) : undefined;
      const subject = input.subject ? normalizeAssertionSubject(input.subject) : undefined;

      return rows.filter((assertion) => {
        if (subject && !sameAssertionSubject(assertion.subject, subject)) return false;
        if (!lens) return input.includeRetracted || !assertion.retractedAt;

        return assertionVisibleAtLens(assertion, lens);
      });
    },

    listEvents(tenantId) {
      assertTenantId(tenantId);
      return [...(store.eventsByTenant.get(tenantId) ?? [])];
    },

    readOutbox(tenantId) {
      assertTenantId(tenantId);
      return [...(store.outboxByTenant.get(tenantId) ?? [])];
    },

    getEventLogPartitions(input = {}) {
      if (input.tenantId) {
        assertTenantId(input.tenantId);
      }
      return eventLogPartitions(store, input);
    },

    getEventLagMetrics(input) {
      assertTenantId(input.tenantId);
      return eventLagMetrics(store, input.tenantId);
    },

    runInvariantGates(input) {
      assertTenantId(input.tenantId);
      return runRecordInvariantGates(store, input);
    },

    getMetricsDashboard(input) {
      assertTenantId(input.tenantId);
      return recordMetricsDashboard(store, input);
    },

    subscribe(input) {
      assertTenantId(input.tenantId);
      assertConsumer(input.consumer);
      const fromOffset = input.fromOffset ?? getConsumerOffset(store, input.tenantId, input.consumer);
      const entries = (store.outboxByTenant.get(input.tenantId) ?? []).filter(
        (entry) => entry.offset > fromOffset && matchesSubscriptionFilter(entry.event, input.filters),
      );

      entries.forEach((entry) => {
        entry.delivered = true;
      });

      const events = entries.map((entry) => entry.event);
      return {
        consumer: input.consumer,
        fromOffset,
        nextOffset: entries.at(-1)?.offset ?? fromOffset,
        events,
      };
    },

    acknowledgeConsumerOffset(input) {
      assertTenantId(input.tenantId);
      assertConsumer(input.consumer);
      if (!Number.isInteger(input.offset) || input.offset < 0) {
        throw new RecordError("INVALID_EVENT_PAYLOAD", "Consumer offsets must be non-negative integers.", {
          offset: input.offset,
        });
      }
      const key = consumerOffsetKey(input.tenantId, input.consumer);
      const current = store.consumerOffsets.get(key) ?? 0;
      store.consumerOffsets.set(key, Math.max(current, input.offset));
    },

    getConsumerOffset(input) {
      assertTenantId(input.tenantId);
      assertConsumer(input.consumer);
      return getConsumerOffset(store, input.tenantId, input.consumer);
    },
  };
}

interface CommitCanonicalMutationInput {
  kind: CanonicalApprovalKind;
  eventType: "canonical.promoted" | "edit.applied";
  tenantId: string;
  idempotencyKey: string;
  actor: RecordActor;
  ref: RecordRef;
  value: Record<string, unknown>;
  approvalRef: string;
  reason?: string;
  occurredAt?: string | Date;
}

interface AppendRecordEventWithIdempotencyInput {
  tenantId: string;
  idempotencyKey: string;
  fingerprintKind: string;
  actor: RecordActor;
  type: string;
  payload: Record<string, unknown>;
  manifestRef?: string;
  occurredAt: string;
}

function appendRecordEventWithIdempotency(
  store: RecordStore,
  input: AppendRecordEventWithIdempotencyInput,
) {
  assertTenantId(input.tenantId);
  assertIdempotencyKey(input.idempotencyKey);
  validateEventInput({
    actor: input.actor,
    type: input.type,
    payload: input.payload,
    manifestRef: input.manifestRef,
  });
  const fingerprint = stableStringify({
    kind: input.fingerprintKind,
    tenantId: input.tenantId,
    actor: input.actor,
    type: input.type,
    payload: input.payload,
    manifestRef: input.manifestRef,
    occurredAt: input.occurredAt,
  });
  const idempotencyKey = `${input.tenantId}:${input.fingerprintKind}:${input.idempotencyKey}`;
  const existing = store.idempotency.get(idempotencyKey);

  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
        idempotencyKey: input.idempotencyKey,
      });
    }

    return existing.event;
  }

  const events = store.eventsByTenant.get(input.tenantId) ?? [];
  const event = createRecordEvent({
    tenantId: input.tenantId,
    seq: events.length + 1,
    type: input.type,
    actor: input.actor,
    payload: input.payload,
    occurredAt: input.occurredAt,
    manifestRef: input.manifestRef,
    prevHash: events.at(-1)?.hash ?? null,
  });

  store.eventsByTenant.set(input.tenantId, [...events, event]);
  enqueueOutbox(store, input.tenantId, [event]);
  store.idempotency.set(idempotencyKey, { fingerprint, event });

  return event;
}

function commitCanonicalMutation(
  store: RecordStore,
  input: CommitCanonicalMutationInput,
): CanonicalMutationResult {
  assertTenantId(input.tenantId);
  assertIdempotencyKey(input.idempotencyKey);
  assertActor(input.actor);
  const ref = createRecordRef(input.ref);
  const objectType = assertCanonicalObjectType(ref.objectType);
  const approvalRef = normalizeApprovalRef(input.approvalRef);
  const value = normalizeCanonicalValue(objectType, ref, input.value);
  assertCanonicalMutationAllowedByPeriod(store, input.tenantId, ref, value);
  const occurredAt = normalizeKnownAt(input.occurredAt ?? new Date());
  const fingerprint = stableStringify({
    kind: input.kind,
    tenantId: input.tenantId,
    actor: input.actor,
    ref: stringifyRecordRef(ref),
    value,
    approvalRef,
    reason: input.reason,
    occurredAt,
  });
  const idempotencyKey = `${input.tenantId}:canonical:${input.kind}:${input.idempotencyKey}`;
  const existing = store.canonicalCommands.get(idempotencyKey);

  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new RecordError("IDEMPOTENCY_CONFLICT", "Record command idempotency key was reused with different input.", {
        idempotencyKey: input.idempotencyKey,
      });
    }

    return existing.result;
  }

  const currentEvents = store.eventsByTenant.get(input.tenantId) ?? [];
  const [event] = buildTransactionEvents(input.tenantId, currentEvents.length, currentEvents.at(-1)?.hash ?? null, [
    {
      kind: "append_event",
      actor: input.actor,
      type: input.eventType,
      occurredAt,
      payload: {
        objectRef: stringifyRecordRef(ref),
        objectType,
        table: canonicalTableName(objectType),
        approvalRef,
        reason: input.reason,
      },
    },
  ]);
  const row = deepFreeze({
    tenantId: input.tenantId,
    objectType,
    ref,
    ...value,
    approvalKind: input.kind,
    approvalRef,
    lastChangeEvent: event.seq,
    lastChangeEventId: event.eventId,
    lastChangedAt: event.occurredAt,
  });
  const result = deepFreeze({ row, event });
  const key = recordKey(input.tenantId, ref);
  const stalenessEvents = propagateStalenessForEvents(
    store,
    input.tenantId,
    [event],
    currentEvents.length + 1,
    event.hash,
  );

  store.canonical.set(key, [...(store.canonical.get(key) ?? []), row]);
  store.eventsByTenant.set(input.tenantId, [...currentEvents, event, ...stalenessEvents]);
  enqueueOutbox(store, input.tenantId, [event, ...stalenessEvents]);
  store.canonicalCommands.set(idempotencyKey, { fingerprint, result });

  return result;
}

function canonicalRowAtLens(history: CanonicalRecordRow[], lens: RecordLens) {
  return history.filter((row) => row.lastChangedAt <= lens.knownAt).at(-1) ?? null;
}

function assertCanonicalMutationAllowedByPeriod(
  store: RecordStore,
  tenantId: string,
  ref: RecordRef,
  value: Record<string, unknown>,
) {
  const sealedPeriod = (store.periodsByTenant.get(tenantId) ?? [])
    .filter((period) => period.status === "sealed")
    .find(
      (period) =>
        sameRecordObject(period.periodRef, ref) || canonicalValueReferencesPeriod(value, period.periodRef),
    );

  if (!sealedPeriod) return;

  throw new RecordError("PERIOD_SEALED", "Canonical writes cannot change a sealed period scope.", {
    periodId: sealedPeriod.periodId,
    objectRef: stringifyRecordRef(ref),
    sealedEvent: sealedPeriod.sealedEvent,
  });
}

function canonicalValueReferencesPeriod(value: unknown, periodRef: RecordRef): boolean {
  const ref = recordRefFromUnknown(value);
  if (ref && sameRecordObject(ref, periodRef)) return true;

  if (Array.isArray(value)) {
    return value.some((item) => canonicalValueReferencesPeriod(item, periodRef));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => canonicalValueReferencesPeriod(item, periodRef));
  }

  return false;
}

function recordRefFromUnknown(value: unknown) {
  if (typeof value === "string" && value.startsWith("period:")) {
    return parseRecordRef(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { objectType?: unknown; objectId?: unknown; version?: unknown };
  if (typeof candidate.objectType !== "string" || typeof candidate.objectId !== "string") return null;
  return createRecordRef({
    objectType: candidate.objectType,
    objectId: candidate.objectId,
    version: candidate.version === undefined ? undefined : Number(candidate.version),
  });
}

function normalizeSensitivityPredicate(value: unknown): 0 | 1 | 2 {
  if (value !== 0 && value !== 1 && value !== 2) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Sensitivity predicates require maxSensitivity 0, 1, or 2.", {
      maxSensitivity: value,
    });
  }

  return value;
}

function recordSensitivity(record: unknown): 0 | 1 | 2 {
  if (!record || typeof record !== "object" || Array.isArray(record)) return 0;
  const value = (record as { sensitivity?: unknown }).sensitivity;
  if (value === 0 || value === 1 || value === 2) return value;
  return 0;
}

function collectRecordScope(record: unknown) {
  const entityIds = new Set<string>();
  const jurisdictions = new Set<string>();
  const objectRefs: RecordRef[] = [];

  collectRecordScopeFromValue(record, { entityIds, jurisdictions, objectRefs });

  return { entityIds, jurisdictions, objectRefs };
}

function collectRecordScopeFromValue(
  value: unknown,
  scope: { entityIds: Set<string>; jurisdictions: Set<string>; objectRefs: RecordRef[] },
) {
  const ref = recordRefFromPayloadValue(value);
  if (ref) {
    scope.objectRefs.push(ref);
    if (ref.objectType === "entity") {
      scope.entityIds.add(ref.objectId);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectRecordScopeFromValue(item, scope));
    return;
  }

  if (!value || typeof value !== "object") return;

  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    if (key === "entityId" && typeof child === "string") {
      const childRef = parseRecordRefIfPossible(child);
      scope.entityIds.add(childRef?.objectType === "entity" ? childRef.objectId : child);
    }
    if (key === "entityIds" && Array.isArray(child)) {
      child.filter((item): item is string => typeof item === "string").forEach((entityId) => scope.entityIds.add(entityId));
    }
    if (key === "jurisdiction" && typeof child === "string") {
      scope.jurisdictions.add(child.toUpperCase());
    }
    if (key === "jurisdictions" && Array.isArray(child)) {
      child
        .filter((item): item is string => typeof item === "string")
        .forEach((jurisdiction) => scope.jurisdictions.add(jurisdiction.toUpperCase()));
    }
    collectRecordScopeFromValue(child, scope);
  });
}

function stripCanonicalMetadata(row: CanonicalRecordRow): Record<string, unknown> {
  const {
    tenantId: _tenantId,
    objectType: _objectType,
    ref: _ref,
    approvalKind: _approvalKind,
    approvalRef: _approvalRef,
    lastChangeEvent: _lastChangeEvent,
    lastChangeEventId: _lastChangeEventId,
    lastChangedAt: _lastChangedAt,
    ...value
  } = row;

  return value;
}

function createCanonicalDiffSnapshot(
  current: Record<string, unknown> | null,
  proposed: Record<string, unknown>,
): CanonicalDiffSnapshot {
  const changes: CanonicalDiffChange[] = [];
  const currentValue = current ?? {};

  Array.from(new Set([...Object.keys(currentValue), ...Object.keys(proposed)])).forEach((field) => {
    const before = currentValue[field] ?? null;
    const after = proposed[field] ?? null;
    if (stableStringify(before) !== stableStringify(after)) {
      changes.push({ field, before, after });
    }
  });

  return deepFreeze({
    current,
    proposed,
    changes,
  });
}

function findStagingObject(store: RecordStore, tenantId: string, stagingId: string) {
  const stagingObject = (store.stagingObjectsByTenant.get(tenantId) ?? []).find(
    (candidate) => candidate.stagingId === stagingId,
  );
  if (!stagingObject) {
    throw new RecordError("STAGING_OBJECT_NOT_FOUND", "Staging object was not found.", {
      stagingId,
    });
  }

  return stagingObject;
}

function replaceStagingObject(store: RecordStore, tenantId: string, stagingObject: RecordStagingObject) {
  const existing = store.stagingObjectsByTenant.get(tenantId) ?? [];
  const index = existing.findIndex((candidate) => candidate.stagingId === stagingObject.stagingId);
  if (index === -1) {
    throw new RecordError("STAGING_OBJECT_NOT_FOUND", "Staging object was not found.", {
      stagingId: stagingObject.stagingId,
    });
  }

  const next = [...existing];
  next[index] = stagingObject;
  store.stagingObjectsByTenant.set(tenantId, next);
}

function findGate(store: RecordStore, tenantId: string, gateId: string) {
  const gate = (store.gatesByTenant.get(tenantId) ?? []).find((candidate) => candidate.gateId === gateId);
  if (!gate) {
    throw new RecordError("GATE_NOT_FOUND", "Gate was not found.", {
      gateId,
    });
  }

  return gate;
}

function findOpenGate(store: RecordStore, tenantId: string, gateId: string) {
  const gate = findGate(store, tenantId, gateId);
  if (gate.decision) {
    throw new RecordError("INVALID_GATE", "Gate is already decided.", {
      gateId,
      decision: gate.decision,
    });
  }

  return gate;
}

function replaceGate(store: RecordStore, tenantId: string, gate: RecordGate) {
  const existing = store.gatesByTenant.get(tenantId) ?? [];
  const index = existing.findIndex((candidate) => candidate.gateId === gate.gateId);
  if (index === -1) {
    throw new RecordError("GATE_NOT_FOUND", "Gate was not found.", {
      gateId: gate.gateId,
    });
  }

  const next = [...existing];
  next[index] = gate;
  store.gatesByTenant.set(tenantId, next);
}

const DEFAULT_SOURCE_PRECEDENCE: AssertionSourceKind[] = ["reviewer", "human", "extraction", "engine"];

function normalizePrecedencePolicyEntries(entries: PrecedencePolicyEntry[]): PrecedencePolicyEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new RecordError("INVALID_PRECEDENCE_POLICY", "Precedence policies require at least one field-class entry.");
  }

  const fieldClasses = new Set<string>();
  const fields = new Set<string>();

  return entries.map((entry) => {
    if ("field" in (entry as unknown as Record<string, unknown>)) {
      throw new RecordError(
        "INVALID_PRECEDENCE_POLICY",
        "Precedence policies are configured by field class, not individual field entries.",
      );
    }
    if (!entry.fieldClass?.trim()) {
      throw new RecordError("INVALID_PRECEDENCE_POLICY", "Precedence policy entries require a fieldClass.");
    }
    if (fieldClasses.has(entry.fieldClass)) {
      throw new RecordError("INVALID_PRECEDENCE_POLICY", "Precedence policy fieldClass values must be unique.", {
        fieldClass: entry.fieldClass,
      });
    }
    fieldClasses.add(entry.fieldClass);

    if (!Array.isArray(entry.fields) || entry.fields.length === 0) {
      throw new RecordError("INVALID_PRECEDENCE_POLICY", "Precedence policy entries require field mappings.");
    }
    const normalizedFields = uniqueStrings(entry.fields);
    normalizedFields.forEach((field) => {
      if (fields.has(field)) {
        throw new RecordError("INVALID_PRECEDENCE_POLICY", "A field can only belong to one precedence field class.", {
          field,
        });
      }
      fields.add(field);
    });

    const sourcePrecedence = normalizeSourcePrecedence(entry.sourcePrecedence);
    return deepFreeze({
      fieldClass: entry.fieldClass,
      fields: normalizedFields,
      sourcePrecedence,
    });
  });
}

function normalizeSourcePrecedence(sourcePrecedence: AssertionSourceKind[]) {
  if (!Array.isArray(sourcePrecedence) || sourcePrecedence.length === 0) {
    throw new RecordError("INVALID_PRECEDENCE_POLICY", "Precedence policy entries require sourcePrecedence.");
  }

  const normalized = uniqueStrings(sourcePrecedence);
  normalized.forEach((sourceKind) => {
    if (!DEFAULT_SOURCE_PRECEDENCE.includes(sourceKind as AssertionSourceKind)) {
      throw new RecordError("INVALID_PRECEDENCE_POLICY", "Unknown assertion source kind in precedence policy.", {
        sourceKind,
      });
    }
  });

  return normalized as AssertionSourceKind[];
}

function resolvePrecedencePolicy(
  store: RecordStore,
  tenantId: string,
  lens: RecordLens,
  requestedVersion?: number,
) {
  const policies = store.precedencePoliciesByTenant.get(tenantId) ?? [];
  if (requestedVersion !== undefined) {
    const policy = policies.find((candidate) => candidate.version === requestedVersion);
    if (!policy) {
      throw new RecordError("PRECEDENCE_POLICY_NOT_FOUND", "Precedence policy version was not found.", {
        requestedVersion,
      });
    }
    return policy;
  }

  return (
    policies
      .filter((policy) => policy.effectiveFrom <= lens.validAt && policy.changedAt <= lens.knownAt)
      .sort((left, right) => right.version - left.version)[0] ?? null
  );
}

function findPolicyEntryForField(policy: PrecedencePolicy, field: string) {
  return policy.entries.find((entry) => entry.fields.includes(field)) ?? null;
}

function resolveCurrentValue(store: RecordStore, input: CurrentValueInput): CurrentValueResult {
  assertTenantId(input.tenantId);
  const subject = normalizeAssertionSubject(input.subject);
  const lens = createRecordLens(input.lens);
  const policy = resolvePrecedencePolicy(store, input.tenantId, lens, input.policyVersion);
  const policyEntry = policy ? findPolicyEntryForField(policy, subject.field) : null;
  const fieldClass = policyEntry?.fieldClass ?? null;
  const assertions = (store.assertionsByTenant.get(input.tenantId) ?? []).filter(
    (assertion) => sameAssertionSubject(assertion.subject, subject) && assertionVisibleAtLens(assertion, lens),
  );
  const candidates = assertions.map((assertion) => currentValueCandidate(assertion, policyEntry)).sort(compareCurrentValueCandidates);

  if (candidates.length === 0) {
    return {
      tenantId: input.tenantId,
      subject,
      lens,
      status: "empty",
      value: null,
      policyVersion: policy?.version ?? null,
      fieldClass,
      provenance: null,
      candidates,
    };
  }

  const winner = candidates[0];
  const winningAssertion = assertions.find((assertion) => assertion.assertionId === winner.assertionId);
  if (!winningAssertion) {
    throw new RecordError("INVALID_ASSERTION", "Current value winner was not found.");
  }

  return {
    tenantId: input.tenantId,
    subject,
    lens,
    status: "resolved",
    value: winningAssertion.value,
    policyVersion: policy?.version ?? null,
    fieldClass,
    provenance: {
      assertionId: winningAssertion.assertionId,
      source: winningAssertion.source,
      confidence: winningAssertion.confidence,
      assertedAt: winningAssertion.assertedAt,
      validFrom: winningAssertion.validFrom,
      validTo: winningAssertion.validTo,
    },
    candidates,
  };
}

function currentValueCandidate(assertion: RecordAssertion, policyEntry: PrecedencePolicyEntry | null): CurrentValueCandidate {
  return {
    assertionId: assertion.assertionId,
    value: assertion.value,
    normalizedValue: normalizeAssertionValueForComparison(assertion.value),
    source: assertion.source,
    confidence: assertion.confidence,
    assertedAt: assertion.assertedAt,
    rank: assertionSourceRank(assertion.source.kind, policyEntry),
  };
}

function assertionSourceRank(sourceKind: AssertionSourceKind, policyEntry: PrecedencePolicyEntry | null) {
  const precedence = policyEntry?.sourcePrecedence ?? DEFAULT_SOURCE_PRECEDENCE;
  const rank = precedence.indexOf(sourceKind);
  return rank === -1 ? precedence.length : rank;
}

function compareCurrentValueCandidates(left: CurrentValueCandidate, right: CurrentValueCandidate) {
  if (left.rank !== right.rank) return left.rank - right.rank;
  if ((left.confidence ?? -1) !== (right.confidence ?? -1)) return (right.confidence ?? -1) - (left.confidence ?? -1);
  return right.assertedAt.localeCompare(left.assertedAt);
}

function normalizeEntityRef(ref: RecordRef) {
  const entityRef = createRecordRef(ref);
  if (entityRef.objectType !== "entity") {
    throw new RecordError("INVALID_ENTITY_ALIAS", "Entity aliases must resolve to an entity Record ref.", {
      entityRef: stringifyRecordRef(entityRef),
    });
  }

  return entityRef;
}

function normalizeEntityAliasText(aliasText: string) {
  const normalized = aliasText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new RecordError("INVALID_ENTITY_ALIAS", "Entity aliases require alias text.");
  }

  return normalized;
}

function entityAliasKey(aliasText: string) {
  return aliasText.toLocaleLowerCase("en-US");
}

function sameRecordRef(left: RecordRef, right: RecordRef) {
  return stringifyRecordRef(left) === stringifyRecordRef(right);
}

function sameRecordObject(left: RecordRef, right: RecordRef) {
  const checkedLeft = createRecordRef(left);
  const checkedRight = createRecordRef(right);
  return checkedLeft.objectType === checkedRight.objectType && checkedLeft.objectId === checkedRight.objectId;
}

function eventReferencesRecordRef(event: RecordEvent, ref: RecordRef) {
  if (payloadReferencesRecordRef(event.payload, ref)) return true;
  if (event.manifestRef && ref.objectType === "manifest" && event.manifestRef === ref.objectId) return true;
  return false;
}

function payloadReferencesRecordRef(value: unknown, ref: RecordRef): boolean {
  const candidate = recordRefFromPayloadValue(value);
  if (candidate && sameRecordObject(candidate, ref)) return true;

  if (typeof value === "string") {
    return payloadIdReferencesRecordRef(value, ref);
  }

  if (Array.isArray(value)) {
    return value.some((item) => payloadReferencesRecordRef(item, ref));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, child]) => {
      if (payloadIdKeyReferencesRecordRef(key, child, ref)) return true;
      return payloadReferencesRecordRef(child, ref);
    });
  }

  return false;
}

function recordRefFromPayloadValue(value: unknown) {
  if (typeof value === "string") {
    return parseRecordRefIfPossible(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { objectType?: unknown; objectId?: unknown; version?: unknown };
  if (typeof candidate.objectType !== "string" || typeof candidate.objectId !== "string") return null;
  return createRecordRef({
    objectType: candidate.objectType,
    objectId: candidate.objectId,
    version: candidate.version === undefined ? undefined : Number(candidate.version),
  });
}

function parseRecordRefIfPossible(value: string) {
  if (!/^[a-z][a-z0-9_]*:[0-9A-HJKMNP-TV-Z]{26}(?:@\d+)?$/.test(value)) return null;
  return parseRecordRef(value);
}

function payloadIdReferencesRecordRef(value: string, ref: RecordRef) {
  return value === ref.objectId;
}

function payloadIdKeyReferencesRecordRef(key: string, value: unknown, ref: RecordRef) {
  if (typeof value !== "string") return false;
  return recordObjectIdPayloadKeys(ref.objectType).includes(key) && value === ref.objectId;
}

function recordObjectIdPayloadKeys(objectType: string) {
  const normalized = objectType.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  return [`${normalized}Id`, "objectId"];
}

function entityRedirectKey(ref: RecordRef) {
  return createRecordRef(ref).objectId;
}

function followEntityRedirects(store: RecordStore, tenantId: string, ref: RecordRef) {
  let current = normalizeEntityRef(ref);
  const seen = new Set<string>();
  const redirects = store.entityRedirectsByTenant.get(tenantId) ?? new Map<string, RecordRef>();

  while (redirects.has(entityRedirectKey(current))) {
    const key = entityRedirectKey(current);
    if (seen.has(key)) {
      throw new RecordError("INVALID_ENTITY_ALIAS", "Entity merge redirects contain a cycle.", {
        entityRef: stringifyRecordRef(current),
      });
    }
    seen.add(key);
    current = normalizeEntityRef(redirects.get(key) as RecordRef);
  }

  return current;
}

function normalizeAccountCode(value: string, key: "sourceAccount" | "canonicalAccount") {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new RecordError("INVALID_ACCOUNT_MAPPING", `Account mappings require ${key}.`, {
      key,
    });
  }

  return normalized;
}

function normalizeAccountMappingScope(scope: Record<string, string>) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    throw new RecordError("INVALID_ACCOUNT_MAPPING", "Account mapping scope must be an object.");
  }

  return Object.fromEntries(
    Object.entries(scope)
      .map(([key, value]) => [key.trim(), String(value).trim()] as const)
      .filter(([key, value]) => key && value)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeAccountMappingConfidence(confidence: number | null | undefined) {
  if (confidence === undefined || confidence === null) return null;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RecordError("INVALID_ACCOUNT_MAPPING", "Account mapping confidence must be between 0 and 1.", {
      confidence,
    });
  }

  return confidence;
}

function emptyCorpusVersion(tenantId: string): CorpusVersion {
  return deepFreeze({
    tenantId,
    version: 0,
    lastBatchRef: null,
    updatedAt: null,
  });
}

function normalizeIngestionBatchRef(ref: RecordRef) {
  const batchRef = createRecordRef(ref);
  if (batchRef.objectType !== "ingestion_batch") {
    throw new RecordError("INVALID_INGESTION_BATCH", "Ingestion batch commits require an ingestion_batch Record ref.", {
      batchRef: stringifyRecordRef(batchRef),
    });
  }

  return batchRef;
}

function normalizeDocumentRefs(documentRefs: RecordRef[]) {
  if (!Array.isArray(documentRefs) || documentRefs.length === 0) {
    throw new RecordError("INVALID_INGESTION_BATCH", "Ingestion batch commits require at least one document ref.");
  }

  return documentRefs.map((ref) => {
    const documentRef = createRecordRef(ref);
    if (documentRef.objectType !== "document") {
      throw new RecordError("INVALID_INGESTION_BATCH", "Ingestion batch documents must be document Record refs.", {
        documentRef: stringifyRecordRef(documentRef),
      });
    }

    return documentRef;
  });
}

function normalizeCorpusVersionNumber(version: number) {
  if (!Number.isInteger(version) || version < 0) {
    throw new RecordError("INVALID_MANIFEST", "Manifest corpus_version must be a non-negative integer.", {
      corpusVersion: version,
    });
  }

  return version;
}

function normalizeVersionMap(value: Record<string, string>, key: "rulepackVersions" | "modelVersions") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecordError("INVALID_MANIFEST", `Manifest ${key} must be an object.`);
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([name, version]) => [name.trim(), String(version).trim()] as const)
      .filter(([name, version]) => name && version)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeUlidList(values: string[], key: "instructionRefs" | "gateRefs") {
  if (!Array.isArray(values)) {
    throw new RecordError("INVALID_MANIFEST", `Manifest ${key} must be an array.`);
  }

  return uniqueStrings(values).map((value) => {
    assertRecordUlidValue(value, key);
    return value;
  });
}

function normalizeManifestInputPins(inputPins: ManifestInputPin[]) {
  if (!Array.isArray(inputPins) || inputPins.length === 0) {
    throw new RecordError("INVALID_MANIFEST", "Manifests require at least one pinned input.");
  }

  const pinsByRef = new Map<string, ManifestInputPin>();

  inputPins.forEach((pin) => {
    const ref = createRecordRef(pin.ref);
    if (!Number.isInteger(pin.version) || pin.version < 1) {
      throw new RecordError("INVALID_MANIFEST", "Manifest input pins require positive integer versions.", {
        ref: stringifyRecordRef(ref),
        version: pin.version,
      });
    }

    const key = stringifyRecordRef(ref);
    const existing = pinsByRef.get(key);
    if (existing && existing.version !== pin.version) {
      throw new RecordError("INVALID_MANIFEST", "Manifest input pins cannot pin the same ref to different versions.", {
        ref: key,
        versions: [existing.version, pin.version],
      });
    }

    pinsByRef.set(key, deepFreeze({ ref, version: pin.version }));
  });

  return Array.from(pinsByRef.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, pin]) => pin);
}

function normalizeOutputHashes(outputHashes: Record<string, string>) {
  if (!outputHashes || typeof outputHashes !== "object" || Array.isArray(outputHashes)) {
    throw new RecordError("INVALID_MANIFEST", "Manifest output_hashes must be an object.");
  }

  return Object.fromEntries(
    Object.entries(outputHashes)
      .map(([name, hash]) => [name.trim(), String(hash).trim()] as const)
      .filter(([name, hash]) => name && hash)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function findManifest(store: RecordStore, tenantId: string, manifestId: string) {
  return (store.manifestsByTenant.get(tenantId) ?? []).find((manifest) => manifest.manifestId === manifestId) ?? null;
}

function normalizeArtifactFormat(format: string) {
  const normalized = format.trim().toLowerCase();
  if (!normalized) {
    throw new RecordError("INVALID_ARTIFACT", "Artifacts require a format.");
  }

  return normalized;
}

function normalizeArtifactBlobRef(blobRef: string) {
  const normalized = blobRef.trim();
  if (!normalized) {
    throw new RecordError("INVALID_ARTIFACT", "Artifacts require a blob_ref.");
  }

  return normalized;
}

function normalizeContentHash(contentHash: string) {
  const normalized = contentHash.trim();
  if (!normalized) {
    throw new RecordError("INVALID_ARTIFACT", "Artifacts require a content_hash.");
  }

  return normalized;
}

function hashReplayContent(content: string | Uint8Array) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function verifyArtifactReplayFromStore(store: RecordStore, input: VerifyArtifactReplayInput): ArtifactReplayVerification {
  assertTenantId(input.tenantId);
  assertRecordUlidValue(input.artifactId, "artifactId");
  const artifact = findArtifact(store, input.tenantId, input.artifactId);
  if (!artifact) {
    throw new RecordError("ARTIFACT_NOT_FOUND", "Artifact was not found.", {
      artifactId: input.artifactId,
    });
  }
  const manifest = findManifest(store, input.tenantId, artifact.manifestId);
  if (!manifest) {
    throw new RecordError("MANIFEST_NOT_FOUND", "Artifact manifest was not found.", {
      manifestId: artifact.manifestId,
    });
  }

  const expectedHash = artifact.contentHash;
  const actualHash = hashReplayContent(input.renderedContent);
  const manifestOutputPinned = Object.values(manifest.outputHashes).includes(expectedHash);

  return {
    ok: actualHash === expectedHash && manifestOutputPinned,
    artifactId: artifact.artifactId,
    manifestId: artifact.manifestId,
    expectedHash,
    actualHash,
    manifestOutputPinned,
    corpusVersion: manifest.corpusVersion,
    inputPins: manifest.inputPins,
  };
}

function findArtifact(store: RecordStore, tenantId: string, artifactId: string) {
  return (store.artifactsByTenant.get(tenantId) ?? []).find((artifact) => artifact.artifactId === artifactId) ?? null;
}

function findSealedArtifactTarget(store: RecordStore, tenantId: string, ref: RecordRef) {
  const artifactRef = createRecordRef(ref);
  if (artifactRef.objectType !== "artifact") return null;
  const artifact = findArtifact(store, tenantId, artifactRef.objectId);
  if (!artifact?.sealed) return null;
  return artifact;
}

function getDependencyIndex(store: RecordStore, tenantId: string) {
  const existing = store.dependencyIndexesByTenant.get(tenantId);
  if (existing) return existing;

  const index = emptyDependencyIndex();
  indexDependenciesInto(index, store.dependenciesByTenant.get(tenantId) ?? []);
  store.dependencyIndexesByTenant.set(tenantId, index);
  return index;
}

function indexDependencies(store: RecordStore, tenantId: string, dependencies: RecordDependency[]) {
  if (dependencies.length === 0) return;
  const index = getDependencyIndex(store, tenantId);
  indexDependenciesInto(index, dependencies);
}

function indexDependenciesInto(index: RecordDependencyIndex, dependencies: RecordDependency[]) {
  dependencies.forEach((dependency) => {
    appendDependencyIndexEntry(index.byUpstream, dependency.upstreamRef, dependency);
    appendDependencyIndexEntry(index.byDownstream, dependency.downstreamRef, dependency);
  });
}

function appendDependencyIndexEntry(index: Map<string, RecordDependency[]>, ref: RecordRef, dependency: RecordDependency) {
  const key = recordObjectKey(ref);
  const existing = index.get(key) ?? [];
  if (existing.some((candidate) => candidate.dependencyId === dependency.dependencyId)) return;
  index.set(key, [...existing, dependency]);
}

function emptyDependencyIndex(): RecordDependencyIndex {
  return {
    byUpstream: new Map(),
    byDownstream: new Map(),
  };
}

function normalizeRecordRunScope(scope: Partial<RecordRunScope>): RecordRunScope {
  return {
    entityIds: uniqueStrings(scope.entityIds ?? []),
    jurisdictions: uniqueStrings((scope.jurisdictions ?? []).map((jurisdiction) => jurisdiction.toUpperCase())),
    objectRefs: uniqueRecordRefs((scope.objectRefs ?? []).map((ref) => createRecordRef(ref))),
  };
}

function serializedRecordRunScope(scope: RecordRunScope) {
  return {
    entityIds: scope.entityIds,
    jurisdictions: scope.jurisdictions,
    objectRefs: scope.objectRefs.map((ref) => stringifyRecordRef(ref)),
  };
}

function normalizeNonEmptyString(value: string, key: string) {
  if (!value?.trim()) {
    throw new RecordError("INVALID_EVENT_PAYLOAD", `${key} is required.`, { key });
  }

  return value.trim();
}

function normalizeJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecordError("INVALID_EVENT_PAYLOAD", "Expected a JSON object.");
  }

  return normalizeJsonValue(value) as Record<string, unknown>;
}

function normalizeRunRef(ref: RecordRef) {
  const runRef = createRecordRef(ref);
  if (runRef.objectType !== "run") {
    throw new RecordError("INVALID_DEPENDENCY", "Dependency declarations require a run Record ref.", {
      runRef: stringifyRecordRef(runRef),
    });
  }

  return runRef;
}

function normalizeDependencyInputs(upstreamRefs: DeclareDependencyInput[]) {
  if (!Array.isArray(upstreamRefs) || upstreamRefs.length === 0) {
    throw new RecordError("INVALID_DEPENDENCY", "Dependency declarations require at least one upstream ref.");
  }

  const dependenciesByKey = new Map<string, { ref: RecordRef; kind: string }>();

  upstreamRefs.forEach((upstream) => {
    const ref = createRecordRef(upstream.ref);
    const kind = upstream.kind?.trim() ? upstream.kind.trim() : "record-read";
    const key = `${stringifyRecordRef(ref)}:${kind}`;
    dependenciesByKey.set(key, { ref, kind });
  });

  return Array.from(dependenciesByKey.values()).sort((left, right) => {
    const byRef = stringifyRecordRef(left.ref).localeCompare(stringifyRecordRef(right.ref));
    if (byRef !== 0) return byRef;
    return left.kind.localeCompare(right.kind);
  });
}

function normalizeDependencyBatchEdges(edges: DeclareDependenciesBatchEdgeInput[]) {
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new RecordError("INVALID_DEPENDENCY", "Batch dependency declarations require at least one edge group.");
  }

  const edgesByKey = new Map<
    string,
    {
      downstreamRef: RecordRef;
      upstreamRef: RecordRef;
      kind: string;
    }
  >();

  edges.forEach((edge) => {
    const downstreamRef = createRecordRef(edge.downstreamRef);
    const upstreamRefs = normalizeDependencyInputs(edge.upstreamRefs);

    upstreamRefs.forEach((upstream) => {
      const key = `${stringifyRecordRef(downstreamRef)}:${stringifyRecordRef(upstream.ref)}:${upstream.kind}`;
      edgesByKey.set(key, {
        downstreamRef,
        upstreamRef: upstream.ref,
        kind: upstream.kind,
      });
    });
  });

  return Array.from(edgesByKey.values()).sort((left, right) => {
    const byDownstream = stringifyRecordRef(left.downstreamRef).localeCompare(stringifyRecordRef(right.downstreamRef));
    if (byDownstream !== 0) return byDownstream;

    const byUpstream = stringifyRecordRef(left.upstreamRef).localeCompare(stringifyRecordRef(right.upstreamRef));
    if (byUpstream !== 0) return byUpstream;

    return left.kind.localeCompare(right.kind);
  });
}

function replaceArtifact(store: RecordStore, tenantId: string, artifact: RecordArtifact) {
  const artifacts = store.artifactsByTenant.get(tenantId) ?? [];
  const index = artifacts.findIndex((candidate) => candidate.artifactId === artifact.artifactId);
  if (index === -1) {
    throw new RecordError("ARTIFACT_NOT_FOUND", "Artifact was not found.", {
      artifactId: artifact.artifactId,
    });
  }

  const nextArtifacts = [...artifacts];
  nextArtifacts[index] = artifact;
  store.artifactsByTenant.set(tenantId, nextArtifacts);
}

interface DirtyTarget {
  objectRef: RecordRef;
  upstreamRef: RecordRef;
  propagationPath: RecordRef[];
}

function propagateStalenessForEvents(
  store: RecordStore,
  tenantId: string,
  sourceEvents: RecordEvent[],
  currentEventCount: number,
  startingPrevHash: string | null,
) {
  const dirtyEvents: AppendRecordEventOperation[] = [];

  sourceEvents.forEach((event) => {
    const changedRef = changedRecordRefFromEvent(event);
    if (!changedRef) return;

    const targets = collectDirtyTargets(store, tenantId, changedRef);
    if (targets.length === 0) return;

    if (targets.length > store.stalenessOptions.synchronousEdgeLimit) {
      enqueueStalenessJob(store, tenantId, event, changedRef, targets);
      return;
    }

    dirtyEvents.push(...materializeDirtyTargets(store, tenantId, event, changedRef, targets, event.occurredAt).operations);
  });

  if (dirtyEvents.length === 0) return [];

  return buildTransactionEvents(tenantId, currentEventCount, startingPrevHash, dirtyEvents);
}

function materializeDirtyTargets(
  store: RecordStore,
  tenantId: string,
  event: RecordEvent,
  changedRef: RecordRef,
  targets: DirtyTarget[],
  createdAt: string,
) {
  const supersededArtifacts = targets
    .map((target) => ({ target, artifact: findSealedArtifactTarget(store, tenantId, target.objectRef) }))
    .filter((entry): entry is { target: DirtyTarget; artifact: RecordArtifact } => Boolean(entry.artifact));
  const supersededArtifactKeys = new Set(
    supersededArtifacts.map((entry) => recordObjectKey(entry.target.objectRef)),
  );
  const supersededOperations = supersededArtifacts
    .filter((entry) => entry.artifact.supersededByEvent !== event.seq)
    .map((entry) => {
      const supersededArtifact = deepFreeze({
        ...entry.artifact,
        supersededCandidate: true,
        supersededByEvent: event.seq,
        supersededAt: createdAt,
      });
      replaceArtifact(store, tenantId, supersededArtifact);

      return {
        kind: "append_event" as const,
        actor: { kind: "system" as const, id: "record-staleness" },
        type: "artifact.superseded",
        occurredAt: createdAt,
        manifestRef: supersededArtifact.manifestId,
        payload: {
          artifactId: supersededArtifact.artifactId,
          manifestId: supersededArtifact.manifestId,
          contentHash: supersededArtifact.contentHash,
          sourceEventSeq: event.seq,
          sourceEventId: event.eventId,
          sourceEventType: event.type,
          changedRef: stringifyRecordRef(changedRef),
        },
      };
    });
  const existingFlags = store.dirtyFlagsByTenant.get(tenantId) ?? [];
  const flags = targets
    .filter((target) => !supersededArtifactKeys.has(recordObjectKey(target.objectRef)))
    .filter(
      (target) =>
        !existingFlags.some(
          (flag) =>
            flag.status === "active" &&
            flag.dirtiedByEvent === event.seq &&
            sameRecordObject(flag.objectRef, target.objectRef),
        ),
    )
    .map((target) =>
      deepFreeze({
        tenantId,
        dirtyFlagId: createRecordUlid(),
        objectRef: target.objectRef,
        upstreamRef: target.upstreamRef,
        dirtiedByEvent: event.seq,
        reason: {
          sourceEventId: event.eventId,
          sourceEventType: event.type,
          changedRef: stringifyRecordRef(changedRef),
        },
        propagationPath: target.propagationPath,
        status: "active" as const,
        createdAt,
      }),
    );

  if (flags.length === 0) {
    return { operations: supersededOperations, dirtyFlagIds: [], proposalId: null };
  }

  store.dirtyFlagsByTenant.set(tenantId, [...existingFlags, ...flags]);
  const proposal = deepFreeze({
    tenantId,
    proposalId: createRecordUlid(),
    targets: uniqueRecordRefs(flags.map((flag) => flag.objectRef)),
    causeEvents: [event.seq],
    dirtyFlagIds: flags.map((flag) => flag.dirtyFlagId),
    status: "proposed" as const,
    createdAt,
    resolvedAt: null,
    resolvedBy: null,
    resolutionReason: null,
  });
  store.rebuildProposalsByTenant.set(tenantId, [...(store.rebuildProposalsByTenant.get(tenantId) ?? []), proposal]);
  recordStalenessMetrics(store, tenantId, {
    dirtyFlagsCreated: flags.length,
    rebuildProposalsCreated: 1,
    latencyMs: Math.max(0, new Date(proposal.createdAt).getTime() - new Date(event.occurredAt).getTime()),
  });

  return {
    operations: [
      ...supersededOperations,
      {
        kind: "append_event" as const,
        actor: { kind: "system" as const, id: "record-staleness" },
        type: "staleness.dirtied",
        occurredAt: createdAt,
        payload: {
          sourceEventSeq: event.seq,
          sourceEventId: event.eventId,
          changedRef: stringifyRecordRef(changedRef),
          dirtyFlagIds: flags.map((flag) => flag.dirtyFlagId),
          objectRefs: flags.map((flag) => stringifyRecordRef(flag.objectRef)),
        },
      },
      {
        kind: "append_event" as const,
        actor: { kind: "system" as const, id: "record-staleness" },
        type: "staleness.proposal_created",
        occurredAt: createdAt,
        payload: {
          proposalId: proposal.proposalId,
          targets: proposal.targets.map((target) => stringifyRecordRef(target)),
          causeEvents: proposal.causeEvents,
          dirtyFlagIds: proposal.dirtyFlagIds,
        },
      },
    ],
    dirtyFlagIds: flags.map((flag) => flag.dirtyFlagId),
    proposalId: proposal.proposalId,
  };
}

function enqueueStalenessJob(
  store: RecordStore,
  tenantId: string,
  sourceEvent: RecordEvent,
  changedRef: RecordRef,
  dirtyTargets: DirtyTarget[],
) {
  const existingJobs = store.stalenessJobsByTenant.get(tenantId) ?? [];
  if (
    existingJobs.some(
      (job) => job.status === "queued" && job.sourceEventSeq === sourceEvent.seq && sameRecordObject(job.changedRef, changedRef),
    )
  ) {
    return;
  }

  const job = deepFreeze({
    tenantId,
    jobId: createRecordUlid(),
    sourceEventSeq: sourceEvent.seq,
    sourceEventId: sourceEvent.eventId,
    sourceEventType: sourceEvent.type,
    changedRef,
    targetCount: dirtyTargets.length,
    status: "queued" as const,
    queuedAt: sourceEvent.occurredAt,
    processedAt: null,
    dirtyFlagIds: [],
    proposalId: null,
    sourceEvent,
    dirtyTargets,
  });
  store.stalenessJobsByTenant.set(tenantId, [...existingJobs, job]);
}

function publicStalenessJob(job: StalenessPropagationJobRecord): StalenessPropagationJob {
  const { sourceEvent: _sourceEvent, dirtyTargets: _dirtyTargets, ...publicJob } = job;
  return publicJob;
}

function changedRecordRefFromEvent(event: RecordEvent) {
  if (typeof event.payload.objectRef === "string") {
    return parseRecordRef(event.payload.objectRef);
  }

  return null;
}

function collectDirtyTargets(store: RecordStore, tenantId: string, changedRef: RecordRef) {
  const index = getDependencyIndex(store, tenantId);
  const targets: DirtyTarget[] = [];
  const visitedTargets = new Set<string>();
  const queue: Array<{ ref: RecordRef; path: RecordRef[] }> = [{ ref: changedRef, path: [changedRef] }];

  while (queue.length > 0) {
    const current = queue.shift() as { ref: RecordRef; path: RecordRef[] };
    (index.byUpstream.get(recordObjectKey(current.ref)) ?? []).forEach((dependency) => {
        const targetKey = recordObjectKey(dependency.downstreamRef);
        if (visitedTargets.has(targetKey)) return;
        visitedTargets.add(targetKey);
        const propagationPath = [...current.path, dependency.downstreamRef];
        targets.push({
          objectRef: dependency.downstreamRef,
          upstreamRef: dependency.upstreamRef,
          propagationPath,
        });
        queue.push({ ref: dependency.downstreamRef, path: propagationPath });
      });
  }

  return targets;
}

function normalizeSubgraphDepth(depth: number | undefined) {
  if (depth === undefined) return 1;
  if (!Number.isInteger(depth) || depth < 0) {
    throw new RecordError("INVALID_DEPENDENCY", "Subgraph depth must be a non-negative integer.", {
      depth,
    });
  }

  return depth;
}

function collectDependencySubgraph(
  store: RecordStore,
  tenantId: string,
  root: RecordRef,
  direction: RecordSubgraphDirection,
  depth: number,
) {
  const index = getDependencyIndex(store, tenantId);
  const nodeRefs = new Map<string, RecordRef>([[recordObjectKey(root), root]]);
  const dependenciesById = new Map<string, RecordDependency>();
  const visitedAtDepth = new Map<string, number>([[recordObjectKey(root), 0]]);
  const queue: Array<{ ref: RecordRef; depth: number }> = [{ ref: root, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift() as { ref: RecordRef; depth: number };
    if (current.depth >= depth) continue;

    dependenciesForSubgraph(index, current.ref, direction).forEach((dependency) => {
      dependenciesById.set(dependency.dependencyId, dependency);
      [dependency.upstreamRef, dependency.downstreamRef].forEach((ref) => {
        const key = recordObjectKey(ref);
        nodeRefs.set(key, ref);
        const nextDepth = current.depth + 1;
        if ((visitedAtDepth.get(key) ?? Number.POSITIVE_INFINITY) <= nextDepth) return;
        visitedAtDepth.set(key, nextDepth);
        queue.push({ ref, depth: nextDepth });
      });
    });
  }

  return {
    nodeRefs,
    dependencies: Array.from(dependenciesById.values()),
  };
}

function dependenciesForSubgraph(index: RecordDependencyIndex, ref: RecordRef, direction: RecordSubgraphDirection) {
  const key = recordObjectKey(ref);
  if (direction === "downstream") return index.byUpstream.get(key) ?? [];
  if (direction === "upstream") return index.byDownstream.get(key) ?? [];

  return [...(index.byUpstream.get(key) ?? []), ...(index.byDownstream.get(key) ?? [])];
}

function uniqueRecordRefs(refs: RecordRef[]) {
  const byKey = new Map<string, RecordRef>();
  refs.forEach((ref) => {
    byKey.set(recordObjectKey(ref), createRecordRef(ref));
  });

  return Array.from(byKey.values()).sort((left, right) => stringifyRecordRef(left).localeCompare(stringifyRecordRef(right)));
}

function recordObjectKey(ref: RecordRef) {
  const checked = createRecordRef(ref);
  return `${checked.objectType}:${checked.objectId}`;
}

function resolveDirtyFlags(store: RecordStore, tenantId: string, dirtyFlagIds: string[]) {
  const dirtyFlagIdSet = new Set(dirtyFlagIds);
  const flags = store.dirtyFlagsByTenant.get(tenantId) ?? [];
  store.dirtyFlagsByTenant.set(
    tenantId,
    flags.map((flag) => (dirtyFlagIdSet.has(flag.dirtyFlagId) ? deepFreeze({ ...flag, status: "resolved" as const }) : flag)),
  );
}

function recordStalenessMetrics(
  store: RecordStore,
  tenantId: string,
  input: { dirtyFlagsCreated: number; rebuildProposalsCreated: number; latencyMs: number },
) {
  const current = store.stalenessMetricsByTenant.get(tenantId) ?? emptyStalenessMetricsState();
  store.stalenessMetricsByTenant.set(tenantId, {
    propagationLatenciesMs: [...current.propagationLatenciesMs, input.latencyMs],
    dirtyFlagsCreated: current.dirtyFlagsCreated + input.dirtyFlagsCreated,
    rebuildProposalsCreated: current.rebuildProposalsCreated + input.rebuildProposalsCreated,
  });
}

function emptyStalenessMetricsState(): StalenessMetricsState {
  return {
    propagationLatenciesMs: [],
    dirtyFlagsCreated: 0,
    rebuildProposalsCreated: 0,
  };
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

const EVENT_LOG_SCALE_OUT_TRIGGER_EVENTS_PER_TENANT = 10_000_000;
const EVENT_LAG_TARGET_P95_MS = 2000;
const STALENESS_PROPAGATION_TARGET_P95_MS = 5000;
const ASSERTION_PROVENANCE_TARGET_COMPLETENESS_RATE = 0.999;
const GATE_DECISION_TARGET_P50_MS = 24 * 60 * 60 * 1000;

function eventLogPartitions(store: RecordStore, input: EventLogPartitionsInput): EventLogPartition[] {
  const tenantIds = input.tenantId
    ? [input.tenantId]
    : Array.from(store.eventsByTenant.keys()).sort((left, right) => left.localeCompare(right));

  return tenantIds.map((tenantId) => {
    const events = store.eventsByTenant.get(tenantId) ?? [];
    const firstEvent = events[0] ?? null;
    const lastEvent = events.at(-1) ?? null;

    return deepFreeze({
      tenantId,
      partitionKey: `tenant_id=${tenantId}`,
      partitionBy: "tenant_id" as const,
      eventCount: events.length,
      firstSeq: firstEvent?.seq ?? null,
      lastSeq: lastEvent?.seq ?? null,
      lastHash: lastEvent?.hash ?? null,
      scaleOutReviewDue: events.length >= EVENT_LOG_SCALE_OUT_TRIGGER_EVENTS_PER_TENANT,
      scaleOutTriggerEventsPerTenant: EVENT_LOG_SCALE_OUT_TRIGGER_EVENTS_PER_TENANT,
    });
  });
}

function eventLagMetrics(store: RecordStore, tenantId: string): EventLagMetrics {
  const entries = store.outboxByTenant.get(tenantId) ?? [];
  const lagSamples = entries.map((entry) =>
    Math.max(0, new Date(entry.enqueuedAt).getTime() - new Date(entry.committedAt).getTime()),
  );
  const p95CommitToConsumerMs = percentile(lagSamples, 0.95);
  const maxCommitToConsumerMs = lagSamples.length === 0 ? 0 : Math.max(...lagSamples);

  return deepFreeze({
    tenantId,
    sampleCount: lagSamples.length,
    lastEnqueuedOffset: entries.at(-1)?.offset ?? 0,
    targetP95Ms: EVENT_LAG_TARGET_P95_MS,
    p95CommitToConsumerMs,
    maxCommitToConsumerMs,
    withinTarget: p95CommitToConsumerMs <= EVENT_LAG_TARGET_P95_MS,
  });
}

function recordMetricsDashboard(store: RecordStore, input: RecordMetricsDashboardInput): RecordMetricsDashboard {
  const generatedAt = normalizeKnownAt(input.generatedAt ?? new Date());
  const invariants = invariantDashboardSummary(runRecordInvariantGates(store, { tenantId: input.tenantId }));
  const provenance = provenanceDashboardMetric(store, input.tenantId);
  const replayDeterminism = replayDashboardMetric(store, input.tenantId, input.replaySamples ?? []);
  const eventLag = eventLagDashboardMetric(store, input.tenantId);
  const stalenessPropagation = stalenessDashboardMetric(store, input.tenantId);
  const gateDecisionLatency = gateDecisionLatencyMetric(store, input.tenantId);
  const tenantCanaries = tenantCanaryMetric(store, input.tenantId);
  const blockingMetrics = [
    invariants.status === "fail" ? "invariants" : null,
    provenance.status === "fail" ? "assertion-provenance" : null,
    replayDeterminism.status === "fail" ? "replay-determinism" : null,
    eventLag.status === "fail" ? "event-lag" : null,
    stalenessPropagation.status === "fail" ? "staleness-propagation" : null,
    gateDecisionLatency.status === "fail" ? "gate-decision-latency" : null,
    tenantCanaries.status === "fail" ? "tenant-canaries" : null,
  ].filter((metric): metric is string => Boolean(metric));

  return deepFreeze({
    tenantId: input.tenantId,
    generatedAt,
    releaseGate: {
      status: blockingMetrics.length === 0 ? "pass" : "fail",
      invariantFailures: invariants.failed,
      blockingMetrics,
    },
    invariants,
    provenance,
    replayDeterminism,
    eventLag,
    stalenessPropagation,
    gateDecisionLatency,
    tenantCanaries,
    eventLogPartitions: eventLogPartitions(store, { tenantId: input.tenantId }),
  });
}

function invariantDashboardSummary(report: RecordInvariantGateReport): RecordInvariantDashboardSummary {
  const failed = report.results.filter((result) => result.status === "fail").length;

  return deepFreeze({
    status: failed === 0 ? "pass" : "fail",
    total: report.results.length,
    failed,
    results: report.results,
  });
}

function provenanceDashboardMetric(store: RecordStore, tenantId: string): RecordProvenanceDashboardMetric {
  const audit = assertionProvenanceAuditFromStore(store, tenantId);
  const withinTarget = audit.completenessRate >= ASSERTION_PROVENANCE_TARGET_COMPLETENESS_RATE;

  return deepFreeze({
    ...audit,
    targetCompletenessRate: ASSERTION_PROVENANCE_TARGET_COMPLETENESS_RATE,
    withinTarget,
    status: withinTarget ? "pass" : "fail",
  });
}

function assertionProvenanceAuditFromStore(store: RecordStore, tenantId: string): AssertionProvenanceAudit {
  const assertions = store.assertionsByTenant.get(tenantId) ?? [];
  const sourceKinds = {
    engine: 0,
    extraction: 0,
    human: 0,
    reviewer: 0,
  };
  const incompleteAssertions: AssertionProvenanceGap[] = [];

  assertions.forEach((assertion) => {
    sourceKinds[assertion.source.kind] += 1;
    const reasons = storedProvenanceGaps(assertion);
    if (reasons.length > 0) {
      incompleteAssertions.push({
        assertionId: assertion.assertionId,
        sourceKind: assertion.source.kind,
        reasons,
      });
    }
  });

  const completeAssertions = assertions.length - incompleteAssertions.length;
  return {
    tenantId,
    totalAssertions: assertions.length,
    completeAssertions,
    incompleteAssertions,
    completenessRate: assertions.length === 0 ? 1 : completeAssertions / assertions.length,
    sourceKinds,
  };
}

function replayDashboardMetric(
  store: RecordStore,
  tenantId: string,
  samples: RecordReplaySampleInput[],
): RecordReplayDashboardMetric {
  const failures: string[] = [];
  let passed = 0;

  samples.forEach((sample) => {
    try {
      const verification = verifyArtifactReplayFromStore(store, {
        tenantId,
        artifactId: sample.artifactId,
        renderedContent: sample.renderedContent,
      });
      if (verification.ok) {
        passed += 1;
      } else {
        failures.push(`Artifact ${sample.artifactId} replay hash did not match.`);
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `Artifact ${sample.artifactId} replay failed.`);
    }
  });

  const failed = samples.length - passed;
  return deepFreeze({
    sampleCount: samples.length,
    passed,
    failed,
    status: samples.length > 0 && failed === 0 ? "pass" : "fail",
    failures,
  });
}

function eventLagDashboardMetric(store: RecordStore, tenantId: string): RecordEventLagDashboardMetric {
  const metrics = eventLagMetrics(store, tenantId);

  return deepFreeze({
    ...metrics,
    status: metrics.withinTarget ? "pass" : "fail",
  });
}

function stalenessDashboardMetric(store: RecordStore, tenantId: string): RecordStalenessDashboardMetric {
  const metrics = store.stalenessMetricsByTenant.get(tenantId) ?? emptyStalenessMetricsState();
  const p95PropagationLatencyMs = percentile(metrics.propagationLatenciesMs, 0.95);
  const withinTarget = p95PropagationLatencyMs <= STALENESS_PROPAGATION_TARGET_P95_MS;

  return deepFreeze({
    tenantId,
    propagationRuns: metrics.propagationLatenciesMs.length,
    dirtyFlagsCreated: metrics.dirtyFlagsCreated,
    rebuildProposalsCreated: metrics.rebuildProposalsCreated,
    p95PropagationLatencyMs,
    targetP95Ms: STALENESS_PROPAGATION_TARGET_P95_MS,
    withinTarget,
    status: withinTarget ? "pass" : "fail",
  });
}

function gateDecisionLatencyMetric(store: RecordStore, tenantId: string): RecordGateDecisionLatencyMetric {
  const latencies = (store.gatesByTenant.get(tenantId) ?? [])
    .filter((gate) => gate.decidedAt)
    .map((gate) => Math.max(0, new Date(gate.decidedAt ?? gate.requestedAt).getTime() - new Date(gate.requestedAt).getTime()));
  const p50DecisionLatencyMs = percentile(latencies, 0.5);
  const withinTarget = p50DecisionLatencyMs <= GATE_DECISION_TARGET_P50_MS;

  return deepFreeze({
    decidedGates: latencies.length,
    p50DecisionLatencyMs,
    targetP50Ms: GATE_DECISION_TARGET_P50_MS,
    withinTarget,
    status: withinTarget ? "pass" : "fail",
  });
}

function tenantCanaryMetric(store: RecordStore, tenantId: string): RecordTenantCanaryMetric {
  const otherTenantRows = Array.from(store.canonical.values())
    .flatMap((history) => history)
    .filter((row) => row.tenantId !== tenantId);
  const failures = otherTenantRows
    .filter((row) => (store.canonical.get(recordKey(tenantId, row.ref)) ?? []).length > 0)
    .map((row) => `Cross-tenant canonical ref visible: ${stringifyRecordRef(row.ref)}.`);

  return deepFreeze({
    checkedRefs: otherTenantRows.length,
    crossTenantHits: failures.length,
    status: failures.length === 0 ? "pass" : "fail",
    failures,
  });
}

const ALL_RECORD_INVARIANT_GATES: RecordInvariantGate[] = [
  "append-only-events",
  "canonical-change-approval",
  "assertion-provenance",
  "sealed-write-rejection",
  "manifest-and-pins",
  "alias-survival",
  "staleness-false-clean",
  "tenant-isolation",
];

function runRecordInvariantGates(store: RecordStore, input: RunRecordInvariantGatesInput): RecordInvariantGateReport {
  const gates = input.gates ?? ALL_RECORD_INVARIANT_GATES;
  const results = gates.map((gate) => runRecordInvariantGate(store, input.tenantId, gate));
  const status: RecordInvariantGateStatus = results.every((result) => result.status === "pass") ? "pass" : "fail";

  return deepFreeze({
    tenantId: input.tenantId,
    status,
    results,
  });
}

function runRecordInvariantGate(
  store: RecordStore,
  tenantId: string,
  gate: RecordInvariantGate,
): RecordInvariantGateResult {
  if (gate === "append-only-events") {
    const verification = verifyRecordEventChain(store.eventsByTenant.get(tenantId) ?? []);
    return deepFreeze({
      gate,
      status: verification.ok ? "pass" : "fail",
      checkedRecords: verification.checkedEvents,
      failures: verification.ok ? [] : [verification.reason ?? "Event chain verification failed."],
    });
  }

  if (gate === "canonical-change-approval") {
    return canonicalChangeApprovalInvariant(store, tenantId, gate);
  }

  if (gate === "assertion-provenance") {
    return assertionProvenanceInvariant(store, tenantId, gate);
  }

  if (gate === "sealed-write-rejection") {
    return sealedWriteRejectionInvariant(store, tenantId, gate);
  }

  if (gate === "manifest-and-pins") {
    return manifestAndPinsInvariant(store, tenantId, gate);
  }

  if (gate === "alias-survival") {
    return aliasSurvivalInvariant(store, tenantId, gate);
  }

  if (gate === "staleness-false-clean") {
    return stalenessFalseCleanInvariant(store, tenantId, gate);
  }

  if (gate === "tenant-isolation") {
    return tenantIsolationInvariant(store, tenantId, gate);
  }

  return deepFreeze({
    gate,
    status: "fail" as const,
    checkedRecords: 0,
    failures: [`Unknown invariant gate: ${gate}`],
  });
}

function assertionProvenanceInvariant(
  store: RecordStore,
  tenantId: string,
  gate: RecordInvariantGate,
): RecordInvariantGateResult {
  const assertions = store.assertionsByTenant.get(tenantId) ?? [];
  const failures = assertions.flatMap((assertion) =>
    storedProvenanceGaps(assertion).map((reason) => `Assertion ${assertion.assertionId}: ${reason}`),
  );

  return deepFreeze({
    gate,
    status: failures.length === 0 ? "pass" : "fail",
    checkedRecords: assertions.length,
    failures,
  });
}

function sealedWriteRejectionInvariant(
  store: RecordStore,
  tenantId: string,
  gate: RecordInvariantGate,
): RecordInvariantGateResult {
  const sealedPeriods = (store.periodsByTenant.get(tenantId) ?? []).filter((period) => period.status === "sealed");
  const rows = Array.from(store.canonical.entries())
    .filter(([key]) => key.startsWith(`${tenantId}:`))
    .flatMap(([, history]) => history);
  const failures: string[] = [];

  sealedPeriods.forEach((period) => {
    rows.forEach((row) => {
      if (!period.sealedAt || row.lastChangedAt <= period.sealedAt) return;
      if (sameRecordObject(row.ref, period.periodRef) || canonicalValueReferencesPeriod(row, period.periodRef)) {
        failures.push(
          `Canonical row ${stringifyRecordRef(row.ref)} changed after sealed period ${period.periodId}.`,
        );
      }
    });
  });

  return deepFreeze({
    gate,
    status: failures.length === 0 ? "pass" : "fail",
    checkedRecords: sealedPeriods.length + rows.length,
    failures,
  });
}

function manifestAndPinsInvariant(
  store: RecordStore,
  tenantId: string,
  gate: RecordInvariantGate,
): RecordInvariantGateResult {
  const manifests = store.manifestsByTenant.get(tenantId) ?? [];
  const artifacts = store.artifactsByTenant.get(tenantId) ?? [];
  const manifestIds = new Set(manifests.map((manifest) => manifest.manifestId));
  const failures: string[] = [];

  manifests.forEach((manifest) => {
    if (manifest.inputPins.length === 0) {
      failures.push(`Manifest ${manifest.manifestId} has no input pins.`);
    }
    manifest.inputPins.forEach((pin) => {
      if (!Number.isInteger(pin.version) || pin.version < 1) {
        failures.push(`Manifest ${manifest.manifestId} has invalid pin for ${stringifyRecordRef(pin.ref)}.`);
      }
    });
  });
  artifacts.forEach((artifact) => {
    if (!manifestIds.has(artifact.manifestId)) {
      failures.push(`Artifact ${artifact.artifactId} references missing manifest ${artifact.manifestId}.`);
    }
  });

  return deepFreeze({
    gate,
    status: failures.length === 0 ? "pass" : "fail",
    checkedRecords: manifests.length + artifacts.length,
    failures,
  });
}

function aliasSurvivalInvariant(
  store: RecordStore,
  tenantId: string,
  gate: RecordInvariantGate,
): RecordInvariantGateResult {
  const aliases = store.entityAliasesByTenant.get(tenantId) ?? [];
  const redirects = Array.from((store.entityRedirectsByTenant.get(tenantId) ?? new Map()).entries());
  const failures: string[] = [];

  aliases.forEach((alias) => {
    if (!alias.aliasText.trim() || !alias.aliasKey.trim()) {
      failures.push(`Alias ${alias.aliasId} is missing resolvable text.`);
    }
    const resolved = followEntityRedirects(store, tenantId, alias.entityRef);
    if (!resolved.objectId) {
      failures.push(`Alias ${alias.aliasId} does not resolve to an entity.`);
    }
  });
  redirects.forEach(([sourceKey, targetRef]) => {
    if (!targetRef.objectId || targetRef.objectType !== "entity") {
      failures.push(`Entity redirect ${sourceKey} does not resolve to an entity target.`);
    }
  });

  return deepFreeze({
    gate,
    status: failures.length === 0 ? "pass" : "fail",
    checkedRecords: aliases.length + redirects.length,
    failures,
  });
}

function stalenessFalseCleanInvariant(
  store: RecordStore,
  tenantId: string,
  gate: RecordInvariantGate,
): RecordInvariantGateResult {
  const dependencies = store.dependenciesByTenant.get(tenantId) ?? [];
  const events = store.eventsByTenant.get(tenantId) ?? [];
  const dirtyFlags = store.dirtyFlagsByTenant.get(tenantId) ?? [];
  const proposals = store.rebuildProposalsByTenant.get(tenantId) ?? [];
  const artifacts = store.artifactsByTenant.get(tenantId) ?? [];
  const failures: string[] = [];

  dependencies.forEach((dependency) => {
    const declaredSeq = dependencyDeclaredEventSeq(events, dependency.dependencyId);
    const changes = events.filter(
      (event) =>
        isStalenessSourceEvent(event) &&
        event.seq > declaredSeq &&
        eventReferencesRecordRef(event, dependency.upstreamRef),
    );
    changes.forEach((event) => {
      const hasDirtyFlag = dirtyFlags.some(
        (flag) => flag.dirtiedByEvent === event.seq && sameRecordObject(flag.objectRef, dependency.downstreamRef),
      );
      const hasProposal = proposals.some(
        (proposal) =>
          proposal.causeEvents.includes(event.seq) &&
          proposal.targets.some((target) => sameRecordObject(target, dependency.downstreamRef)),
      );
      const supersededArtifact = artifacts.some(
        (artifact) =>
          artifact.artifactId === dependency.downstreamRef.objectId &&
          artifact.supersededCandidate === true &&
          artifact.supersededByEvent === event.seq,
      );
      if (!hasDirtyFlag && !hasProposal && !supersededArtifact) {
        failures.push(
          `Dependency ${dependency.dependencyId} stayed clean after upstream event ${event.seq}.`,
        );
      }
    });
  });

  return deepFreeze({
    gate,
    status: failures.length === 0 ? "pass" : "fail",
    checkedRecords: dependencies.length,
    failures,
  });
}

function isStalenessSourceEvent(event: RecordEvent) {
  return [
    "canonical.promoted",
    "edit.applied",
    "assertion.recorded",
    "assertion.retracted",
    "assertion.superseded",
    "period.sealed",
    "artifact.rendered",
    "artifact.sealed",
  ].includes(event.type);
}

function dependencyDeclaredEventSeq(events: RecordEvent[], dependencyId: string) {
  return (
    events.find(
      (event) =>
        event.type === "dependency.declared" &&
        Array.isArray(event.payload.dependencyIds) &&
        event.payload.dependencyIds.includes(dependencyId),
    )?.seq ?? 0
  );
}

function tenantIsolationInvariant(
  store: RecordStore,
  tenantId: string,
  gate: RecordInvariantGate,
): RecordInvariantGateResult {
  const failures: string[] = [];
  let checkedRecords = 0;
  const checkRows = (label: string, rows: Array<{ tenantId: string }>) => {
    checkedRecords += rows.length;
    rows.forEach((row, index) => {
      if (row.tenantId !== tenantId) {
        failures.push(`${label}[${index}] belongs to ${row.tenantId}, not ${tenantId}.`);
      }
    });
  };

  checkRows("canonical", Array.from(store.canonical.entries()).filter(([key]) => key.startsWith(`${tenantId}:`)).flatMap(([, rows]) => rows));
  checkRows("assertions", store.assertionsByTenant.get(tenantId) ?? []);
  checkRows("staging_objects", store.stagingObjectsByTenant.get(tenantId) ?? []);
  checkRows("gates", store.gatesByTenant.get(tenantId) ?? []);
  checkRows("aliases", store.entityAliasesByTenant.get(tenantId) ?? []);
  checkRows("manifests", store.manifestsByTenant.get(tenantId) ?? []);
  checkRows("artifacts", store.artifactsByTenant.get(tenantId) ?? []);
  checkRows("dependencies", store.dependenciesByTenant.get(tenantId) ?? []);
  checkRows("dirty_flags", store.dirtyFlagsByTenant.get(tenantId) ?? []);
  checkRows("rebuild_proposals", store.rebuildProposalsByTenant.get(tenantId) ?? []);
  checkRows("periods", store.periodsByTenant.get(tenantId) ?? []);
  checkRows("period_snapshots", store.periodSnapshotsByTenant.get(tenantId) ?? []);
  checkRows("instructions", store.instructionsByTenant.get(tenantId) ?? []);
  checkRows("events", store.eventsByTenant.get(tenantId) ?? []);
  checkRows("outbox", store.outboxByTenant.get(tenantId) ?? []);

  return deepFreeze({
    gate,
    status: failures.length === 0 ? "pass" : "fail",
    checkedRecords,
    failures,
  });
}

function canonicalChangeApprovalInvariant(
  store: RecordStore,
  tenantId: string,
  gate: RecordInvariantGate,
): RecordInvariantGateResult {
  const rows = Array.from(store.canonical.entries())
    .filter(([key]) => key.startsWith(`${tenantId}:`))
    .flatMap(([, history]) => history);
  const events = (store.eventsByTenant.get(tenantId) ?? []).filter((event) =>
    ["canonical.promoted", "edit.applied"].includes(event.type),
  );
  const failures: string[] = [];

  rows.forEach((row) => {
    if (!["gate", "governed_edit"].includes(row.approvalKind) || !row.approvalRef) {
      failures.push(`Canonical row ${stringifyRecordRef(row.ref)} is missing an approval reference.`);
    }
  });
  events.forEach((event) => {
    const approvalRef = typeof event.payload.approvalRef === "string" ? event.payload.approvalRef.trim() : "";
    const gateId = typeof event.payload.gateId === "string" ? event.payload.gateId.trim() : "";
    if (!approvalRef && !gateId) {
      failures.push(`Canonical change event ${event.seq} is missing an approval reference.`);
    }
  });

  return deepFreeze({
    gate,
    status: failures.length === 0 ? "pass" : "fail",
    checkedRecords: rows.length + events.length,
    failures,
  });
}

function normalizePeriodLabel(value: string, key: "fy" | "quarter") {
  if (!value.trim()) {
    throw new RecordError("INVALID_PERIOD", `Period ${key} is required.`, { key });
  }

  return value.trim();
}

function findPeriod(store: RecordStore, tenantId: string, periodId: string) {
  return (store.periodsByTenant.get(tenantId) ?? []).find((period) => period.periodId === periodId) ?? null;
}

function findPeriodOrThrow(store: RecordStore, tenantId: string, periodId: string) {
  const period = findPeriod(store, tenantId, periodId);
  if (!period) {
    throw new RecordError("PERIOD_NOT_FOUND", "Period was not found.", { periodId });
  }

  return period;
}

function replacePeriod(store: RecordStore, tenantId: string, period: RecordPeriod) {
  const periods = store.periodsByTenant.get(tenantId) ?? [];
  const index = periods.findIndex((candidate) => candidate.periodId === period.periodId);
  if (index === -1) {
    throw new RecordError("PERIOD_NOT_FOUND", "Period was not found.", { periodId: period.periodId });
  }

  const nextPeriods = [...periods];
  nextPeriods[index] = period;
  store.periodsByTenant.set(tenantId, nextPeriods);
}

function normalizeInstructionTier(tier: number) {
  if (!Number.isInteger(tier) || tier < 1) {
    throw new RecordError("INVALID_INSTRUCTION", "Instruction tier must be a positive integer.", { tier });
  }

  return tier;
}

function normalizeInstructionScope(scope: Partial<RecordInstructionScope> & { kind: string }): RecordInstructionScope {
  return {
    kind: normalizeNonEmptyString(scope.kind, "scope.kind"),
    entityIds: uniqueStrings(scope.entityIds ?? []),
    jurisdictions: uniqueStrings((scope.jurisdictions ?? []).map((jurisdiction) => jurisdiction.toUpperCase())),
    objectRefs: uniqueRecordRefs((scope.objectRefs ?? []).map((ref) => createRecordRef(ref))),
  };
}

function serializedInstructionScope(scope: RecordInstructionScope) {
  return {
    kind: scope.kind,
    entityIds: scope.entityIds,
    jurisdictions: scope.jurisdictions,
    objectRefs: scope.objectRefs.map((ref) => stringifyRecordRef(ref)),
  };
}

function findInstruction(store: RecordStore, tenantId: string, instructionId: string) {
  return (store.instructionsByTenant.get(tenantId) ?? []).find((instruction) => instruction.instructionId === instructionId) ?? null;
}

function findInstructionOrThrow(store: RecordStore, tenantId: string, instructionId: string) {
  const instruction = findInstruction(store, tenantId, instructionId);
  if (!instruction) {
    throw new RecordError("INSTRUCTION_NOT_FOUND", "Instruction was not found.", { instructionId });
  }

  return instruction;
}

function replaceInstruction(store: RecordStore, tenantId: string, instruction: RecordInstruction) {
  const instructions = store.instructionsByTenant.get(tenantId) ?? [];
  const index = instructions.findIndex((candidate) => candidate.instructionId === instruction.instructionId);
  if (index === -1) {
    throw new RecordError("INSTRUCTION_NOT_FOUND", "Instruction was not found.", {
      instructionId: instruction.instructionId,
    });
  }

  const nextInstructions = [...instructions];
  nextInstructions[index] = instruction;
  store.instructionsByTenant.set(tenantId, nextInstructions);
}

function findPeriodSnapshot(store: RecordStore, tenantId: string, periodId: string) {
  return (store.periodSnapshotsByTenant.get(tenantId) ?? []).find((snapshot) => snapshot.periodId === periodId) ?? null;
}

function findArtifactsLinkedToPeriod(store: RecordStore, tenantId: string, periodRef: RecordRef) {
  const manifestsById = new Map(
    (store.manifestsByTenant.get(tenantId) ?? [])
      .filter((manifest) => manifest.inputPins.some((pin) => sameRecordObject(pin.ref, periodRef)))
      .map((manifest) => [manifest.manifestId, manifest]),
  );

  if (manifestsById.size === 0) return [];

  return (store.artifactsByTenant.get(tenantId) ?? []).filter((artifact) => manifestsById.has(artifact.manifestId));
}

function snapshotCanonicalRows(store: RecordStore, tenantId: string, period: RecordPeriod, capturedAt: string) {
  return Array.from(store.canonical.entries())
    .filter(([key]) => key.startsWith(`${tenantId}:`))
    .map(([, history]) => canonicalRowAtLens(history, { validAt: period.validFrom, knownAt: capturedAt }))
    .filter((row): row is CanonicalRecordRow => Boolean(row))
    .sort((left, right) => stringifyRecordRef(left.ref).localeCompare(stringifyRecordRef(right.ref)));
}

function normalizeAssertionValueForComparison(value: unknown) {
  if (typeof value === "number") return normalizeComparableNumber(value);
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.endsWith("%")) {
      const parsed = Number(trimmed.slice(0, -1).trim());
      if (Number.isFinite(parsed)) {
        return normalizeComparableNumber(parsed / 100);
      }
    }
    return trimmed;
  }
  return stableStringify(value);
}

function normalizeComparableNumber(value: number) {
  return String(Number(value.toFixed(12)));
}

function assertCanonicalObjectType(objectType: string): CanonicalObjectType {
  if (!isCanonicalObjectType(objectType)) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", `Unsupported canonical object type: ${objectType}`, {
      objectType,
    });
  }

  return objectType as CanonicalObjectType;
}

function isCanonicalObjectType(objectType: string): objectType is CanonicalObjectType {
  return [
    "entity",
    "flow",
    "agreement",
    "document",
    "doc_section",
    "finding",
    "obligation",
    "period",
    "instruction",
  ].includes(objectType);
}

function normalizeApprovalRef(approvalRef: string) {
  if (!approvalRef?.trim()) {
    throw new RecordError("CANONICAL_APPROVAL_REQUIRED", "Canonical mutations require a gate or governed-edit approval ref.");
  }
  if (!isRecordUlid(approvalRef)) {
    throw new RecordError("INVALID_REF", "Canonical approval refs must be Record ULIDs.", {
      approvalRef,
    });
  }

  return approvalRef;
}

function normalizeCanonicalValue(
  objectType: CanonicalObjectType,
  ref: RecordRef,
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical values must be objects.");
  }

  if (objectType === "entity") {
    return {
      entityId: ref.objectId,
      name: requireCanonicalString(value, "name"),
      jurisdiction: requireCanonicalString(value, "jurisdiction").toUpperCase(),
      roleInGroup: requireCanonicalString(value, "roleInGroup"),
      elections: normalizeCanonicalJsonObject(value.elections ?? {}),
      status: requireCanonicalString(value, "status"),
      sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
    };
  }

  if (objectType === "flow") {
    return {
      flowId: ref.objectId,
      fromEntity: requireCanonicalRef(value, "fromEntity"),
      toEntity: requireCanonicalRef(value, "toEntity"),
      kind: requireCanonicalString(value, "kind"),
      method: optionalCanonicalString(value, "method"),
      policy: normalizeCanonicalJsonObject(value.policy ?? {}),
      agreementIds: normalizeCanonicalIdArray(value.agreementIds ?? []),
      status: requireCanonicalString(value, "status"),
      sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
    };
  }

  if (objectType === "agreement") {
    return {
      agreementId: ref.objectId,
      parties: requireCanonicalRefArray(value, "parties"),
      kind: requireCanonicalString(value, "kind"),
      effective: requireCanonicalDate(value, "effective"),
      terminates: optionalCanonicalDate(value, "terminates"),
      execStatus: requireCanonicalString(value, "execStatus"),
      docRef: optionalCanonicalRef(value, "docRef"),
      terms: normalizeCanonicalJsonObject(value.terms ?? {}),
      sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
    };
  }

  if (objectType === "document") {
    return {
      docId: ref.objectId,
      docType: requireCanonicalString(value, "docType"),
      jurisdiction: optionalCanonicalString(value, "jurisdiction"),
      periodId: optionalCanonicalRef(value, "periodId"),
      lang: requireCanonicalString(value, "lang"),
      status: requireCanonicalString(value, "status"),
      outline: normalizeCanonicalJsonObject(value.outline ?? {}),
      sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
    };
  }

  if (objectType === "doc_section") {
    if ("content" in value) {
      throw new RecordError(
        "INVALID_CANONICAL_OBJECT",
        "Canonical doc_sections store content by blob ref and hash, not inline content.",
        { ref: stringifyRecordRef(ref) },
      );
    }

    return {
      sectionId: ref.objectId,
      docId: requireCanonicalRef(value, "docId"),
      position: requireCanonicalPositiveInteger(value, "position"),
      contentBlobRef: requireCanonicalString(value, "contentBlobRef"),
      contentHash: requireCanonicalString(value, "contentHash"),
      inputChips: normalizeCanonicalRefOrStringArray(value.inputChips ?? []),
      version: requireCanonicalPositiveInteger(value, "version"),
      status: requireCanonicalString(value, "status"),
      sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
    };
  }

  if (objectType === "finding") {
    return {
      findingId: ref.objectId,
      severity: requireCanonicalString(value, "severity"),
      ruleId: requireCanonicalString(value, "ruleId"),
      state: requireCanonicalString(value, "state"),
      flowRef: optionalCanonicalRef(value, "flowRef"),
      exposure: normalizeCanonicalJsonObject(value.exposure ?? {}),
      exhibitRefs: normalizeCanonicalRefOrStringArray(value.exhibitRefs ?? []),
      confidence: normalizeCanonicalConfidence(value.confidence),
      assignee: optionalCanonicalString(value, "assignee"),
      reviewer: value.reviewer === undefined || value.reviewer === null ? null : normalizeCanonicalJsonObject(value.reviewer),
      sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
    };
  }

  if (objectType === "obligation") {
    return {
      obligationId: ref.objectId,
      entityId: optionalCanonicalRef(value, "entityId"),
      jurisdiction: requireCanonicalString(value, "jurisdiction").toUpperCase(),
      dueAt: requireCanonicalTimestamp(value, "dueAt"),
      dueTz: requireCanonicalString(value, "dueTz"),
      owner: optionalCanonicalString(value, "owner"),
      status: requireCanonicalString(value, "status"),
      artifactRef: optionalCanonicalRef(value, "artifactRef"),
      filingEvidenceRef: optionalCanonicalRef(value, "filingEvidenceRef"),
      source: requireCanonicalString(value, "source"),
      sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
    };
  }

  if (objectType === "period") {
    return {
      periodId: ref.objectId,
      fy: requireCanonicalString(value, "fy"),
      quarter: optionalCanonicalString(value, "quarter"),
      status: requireCanonicalString(value, "status"),
      sealedEvent:
        value.sealedEvent === undefined || value.sealedEvent === null
          ? null
          : requireCanonicalNonNegativeInteger(value, "sealedEvent"),
      sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
    };
  }

  return {
    instrId: ref.objectId,
    tier: requireCanonicalPositiveInteger(value, "tier"),
    scope: normalizeCanonicalJsonObject(value.scope),
    text: requireCanonicalString(value, "text"),
    compiled: normalizeCanonicalJsonObject(value.compiled ?? {}),
    status: requireCanonicalString(value, "status"),
    author: requireCanonicalString(value, "author"),
    approvedBy: optionalCanonicalString(value, "approvedBy"),
    sensitivity: normalizeCanonicalSensitivity(value.sensitivity),
  };
}

function requireCanonicalString(value: Record<string, unknown>, key: string) {
  if (typeof value[key] !== "string" || !value[key].trim()) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", `Canonical rows require ${key}.`, { key });
  }

  return value[key];
}

function optionalCanonicalString(value: Record<string, unknown>, key: string) {
  if (value[key] === undefined || value[key] === null) {
    return null;
  }

  return requireCanonicalString(value, key);
}

function requireCanonicalPositiveInteger(value: Record<string, unknown>, key: string) {
  if (!Number.isInteger(value[key]) || (value[key] as number) < 1) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", `Canonical rows require positive integer ${key}.`, { key });
  }

  return value[key];
}

function requireCanonicalNonNegativeInteger(value: Record<string, unknown>, key: string) {
  if (!Number.isInteger(value[key]) || (value[key] as number) < 0) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", `Canonical rows require non-negative integer ${key}.`, { key });
  }

  return value[key];
}

function requireCanonicalDate(value: Record<string, unknown>, key: string) {
  if (typeof value[key] !== "string") {
    throw new RecordError("INVALID_CANONICAL_OBJECT", `Canonical rows require date ${key}.`, { key });
  }

  return normalizeValidAt(value[key]);
}

function optionalCanonicalDate(value: Record<string, unknown>, key: string) {
  if (value[key] === undefined || value[key] === null) {
    return null;
  }

  return requireCanonicalDate(value, key);
}

function requireCanonicalTimestamp(value: Record<string, unknown>, key: string) {
  if (typeof value[key] !== "string" && !(value[key] instanceof Date)) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", `Canonical rows require timestamp ${key}.`, { key });
  }

  return normalizeKnownAt(value[key]);
}

function requireCanonicalRef(value: Record<string, unknown>, key: string) {
  const ref = normalizeCanonicalRef(value[key]);
  if (!ref) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", `Canonical rows require ref ${key}.`, { key });
  }

  return ref;
}

function optionalCanonicalRef(value: Record<string, unknown>, key: string) {
  if (value[key] === undefined || value[key] === null) {
    return null;
  }

  return requireCanonicalRef(value, key);
}

function requireCanonicalRefArray(value: Record<string, unknown>, key: string) {
  if (!Array.isArray(value[key]) || value[key].length === 0) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", `Canonical rows require a non-empty ref array ${key}.`, { key });
  }

  return value[key].map((item) => {
    const ref = normalizeCanonicalRef(item);
    if (!ref) {
      throw new RecordError("INVALID_CANONICAL_OBJECT", `Canonical rows require valid refs in ${key}.`, { key });
    }
    return ref;
  });
}

function normalizeCanonicalIdArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical ID arrays must be arrays.");
  }

  return value.map((item) => {
    if (typeof item === "string" && item.trim()) return item;
    const ref = normalizeCanonicalRef(item);
    if (ref) return ref;
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical ID arrays must contain IDs or refs.");
  });
}

function normalizeCanonicalRefOrStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical ref arrays must be arrays.");
  }

  return value.map((item) => {
    if (typeof item === "string" && item.trim()) return item;
    const ref = normalizeCanonicalRef(item);
    if (ref) return ref;
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical ref arrays must contain strings or refs.");
  });
}

function normalizeCanonicalRef(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return stringifyRecordRef(createRecordRef(value as RecordRef));
}

function normalizeCanonicalJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical JSON fields must be objects.");
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical JSON fields must be serializable.");
  }
}

function normalizeCanonicalSensitivity(value: unknown): 0 | 1 | 2 {
  if (value === undefined) {
    return 0;
  }
  if (value !== 0 && value !== 1 && value !== 2) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical sensitivity must be 0, 1, or 2.", {
      sensitivity: value,
    });
  }

  return value;
}

function normalizeCanonicalConfidence(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RecordError("INVALID_CANONICAL_OBJECT", "Canonical confidence must be between 0 and 1.", {
      confidence: value,
    });
  }

  return value;
}

function canonicalTableName(objectType: CanonicalObjectType) {
  if (objectType === "entity") return "entities";
  if (objectType === "doc_section") return "doc_sections";
  return `${objectType}s`;
}

function buildTransactionEvents(
  tenantId: string,
  currentEventCount: number,
  startingPrevHash: string | null,
  operations: AppendRecordEventOperation[],
): RecordEvent[] {
  if (operations.length === 0) {
    throw new RecordError("TRANSACTION_ROLLED_BACK", "Record transactions require at least one operation.");
  }

  operations.forEach((operation) => {
    if (operation.kind !== "append_event") {
      throw new RecordError("TRANSACTION_ROLLED_BACK", `Unsupported Record transaction operation: ${operation.kind}`);
    }
    validateEventInput({
      actor: operation.actor,
      type: operation.type,
      payload: operation.payload ?? {},
      manifestRef: operation.manifestRef,
    });
  });

  const events: RecordEvent[] = [];
  let prevHash: string | null = startingPrevHash;

  return operations.map((operation, index) => {
    const event = createRecordEvent({
      tenantId,
      seq: currentEventCount + index + 1,
      type: operation.type,
      actor: operation.actor,
      payload: operation.payload ?? {},
      occurredAt: normalizeKnownAt(operation.occurredAt ?? new Date()),
      manifestRef: operation.manifestRef,
      prevHash,
    });
    prevHash = event.hash;
    events.push(event);
    return event;
  });
}

function createRecordEvent(input: {
  tenantId: string;
  seq: number;
  type: string;
  actor: RecordActor;
  payload: Record<string, unknown>;
  occurredAt: string;
  manifestRef?: string;
  prevHash: string | null;
}): RecordEvent {
  const eventWithoutHash = {
    tenantId: input.tenantId,
    eventId: createRecordUlid(),
    seq: input.seq,
    type: input.type,
    actor: input.actor,
    payload: input.payload,
    occurredAt: input.occurredAt,
    manifestRef: input.manifestRef,
    prevHash: input.prevHash,
  };

  return deepFreeze({
    ...eventWithoutHash,
    hash: hashRecordEvent(eventWithoutHash),
  });
}

export function verifyRecordEventChain(events: RecordEvent[]): EventChainVerification {
  let prevHash: string | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedSeq = index + 1;
    if (event.seq !== expectedSeq) {
      return {
        ok: false,
        checkedEvents: index,
        lastHash: prevHash,
        brokenAtSeq: event.seq,
        reason: `Expected event sequence ${expectedSeq} but found ${event.seq}.`,
      };
    }

    if (event.prevHash !== prevHash) {
      return {
        ok: false,
        checkedEvents: index,
        lastHash: prevHash,
        brokenAtSeq: event.seq,
        reason: "Previous hash does not match the prior event hash.",
      };
    }

    const expectedHash = hashRecordEvent(event);
    if (event.hash !== expectedHash) {
      return {
        ok: false,
        checkedEvents: index,
        lastHash: prevHash,
        brokenAtSeq: event.seq,
        reason: "Event hash does not match event contents.",
      };
    }

    prevHash = event.hash;
  }

  return {
    ok: true,
    checkedEvents: events.length,
    lastHash: prevHash,
  };
}

function enqueueOutbox(store: RecordStore, tenantId: string, events: RecordEvent[]) {
  const outbox = store.outboxByTenant.get(tenantId) ?? [];
  events.forEach((event) => {
    const committedAt = new Date().toISOString();
    outbox.push({
      tenantId,
      offset: outbox.length + 1,
      event,
      delivered: false,
      committedAt,
      enqueuedAt: committedAt,
    });
  });
  store.outboxByTenant.set(tenantId, outbox);
}

function normalizeAssertionInput(tenantId: string, input: RecordAssertionInput): RecordAssertion {
  const subject = normalizeAssertionSubject(input.subject);
  const validFrom = normalizeValidAt(input.validFrom);
  const validTo = input.validTo === undefined || input.validTo === null ? null : normalizeValidAt(input.validTo);
  if (validTo && validTo <= validFrom) {
    throw new RecordError("INVALID_ASSERTION", "Assertion valid_to must be after valid_from.", {
      validFrom,
      validTo,
    });
  }

  const assertion: RecordAssertion = {
    tenantId,
    assertionId: createRecordUlid(),
    subject,
    value: normalizeJsonValue(input.value),
    validFrom,
    validTo,
    assertedAt: normalizeKnownAt(input.assertedAt ?? new Date()),
    retractedAt: null,
    source: normalizeAssertionSource(input.source),
    confidence: normalizeAssertionConfidence(input.confidence),
    supersedes: normalizeOptionalAssertionId(input.supersedes),
    sensitivity: normalizeAssertionSensitivity(input.sensitivity),
    scopeKeys: normalizeAssertionScopeKeys(input.scopeKeys, subject),
  };

  return deepFreeze(assertion);
}

function assertionInputFingerprint(input: RecordAssertionInput): Record<string, unknown> {
  const subject = normalizeAssertionSubject(input.subject);
  const validFrom = normalizeValidAt(input.validFrom);
  const validTo = input.validTo === undefined || input.validTo === null ? null : normalizeValidAt(input.validTo);
  if (validTo && validTo <= validFrom) {
    throw new RecordError("INVALID_ASSERTION", "Assertion valid_to must be after valid_from.", {
      validFrom,
      validTo,
    });
  }

  return {
    subject: {
      objectRef: stringifyRecordRef(subject.objectRef),
      field: subject.field,
    },
    value: normalizeJsonValue(input.value),
    validFrom,
    validTo,
    assertedAt: input.assertedAt === undefined ? null : normalizeKnownAt(input.assertedAt),
    source: normalizeAssertionSource(input.source),
    confidence: normalizeAssertionConfidence(input.confidence),
    supersedes: normalizeOptionalAssertionId(input.supersedes),
    sensitivity: normalizeAssertionSensitivity(input.sensitivity),
    scopeKeys: normalizeAssertionScopeKeys(input.scopeKeys, subject),
  };
}

function normalizeAssertionSubject(subject: RecordAssertionSubject): RecordAssertionSubject {
  const objectRef = createRecordRef(subject.objectRef);
  if (!subject.field?.trim()) {
    throw new RecordError("INVALID_ASSERTION", "Assertion subjects require a non-empty field.", {
      subject,
    });
  }

  return {
    objectRef,
    field: subject.field,
  };
}

function normalizeAssertionSource(source: RecordAssertionSource): RecordAssertionSource {
  if (!source || typeof source !== "object") {
    throw new RecordError("PROVENANCE_INCOMPLETE", "Assertions require source provenance.");
  }

  switch (source.kind) {
    case "extraction": {
      const docRef = createRecordRef(source.docRef);
      const span = normalizeSourceSpan(source.span);
      if (!source.extractorVersion?.trim()) {
        throw new RecordError("PROVENANCE_INCOMPLETE", "Extraction assertions require an extractor version.");
      }
      return {
        kind: "extraction",
        docRef,
        span,
        extractorVersion: source.extractorVersion,
      };
    }
    case "engine": {
      if (!source.rulepackVersion?.trim() || !source.engineId?.trim()) {
        throw new RecordError("PROVENANCE_INCOMPLETE", "Engine assertions require rulepackVersion and engineId.");
      }
      return {
        kind: "engine",
        rulepackVersion: source.rulepackVersion,
        engineId: source.engineId,
      };
    }
    case "human": {
      if (!source.userId?.trim()) {
        throw new RecordError("PROVENANCE_INCOMPLETE", "Human assertions require a userId.");
      }
      return {
        kind: "human",
        userId: source.userId,
      };
    }
    case "reviewer": {
      if (!source.userId?.trim()) {
        throw new RecordError("PROVENANCE_INCOMPLETE", "Reviewer assertions require a userId.");
      }
      return {
        kind: "reviewer",
        userId: source.userId,
        reviewRef: source.reviewRef ? createRecordRef(source.reviewRef) : undefined,
      };
    }
    default:
      throw new RecordError("PROVENANCE_INCOMPLETE", "Assertion source kind is not supported.", {
        kind: (source as { kind?: unknown }).kind,
      });
  }
}

function storedProvenanceGaps(assertion: RecordAssertion) {
  const reasons: string[] = [];
  const source = assertion.source;

  switch (source.kind) {
    case "extraction":
      if (!source.docRef) reasons.push("missing docRef");
      if (!source.span || !Number.isInteger(source.span.start) || !Number.isInteger(source.span.end)) {
        reasons.push("missing span");
      }
      if (!source.extractorVersion?.trim()) reasons.push("missing extractorVersion");
      break;
    case "engine":
      if (!source.engineId?.trim()) reasons.push("missing engineId");
      if (!source.rulepackVersion?.trim()) reasons.push("missing rulepackVersion");
      break;
    case "human":
      if (!source.userId?.trim()) reasons.push("missing userId");
      break;
    case "reviewer":
      if (!source.userId?.trim()) reasons.push("missing userId");
      break;
  }

  return reasons;
}

function normalizeSourceSpan(span: { start: number; end: number }) {
  if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start) {
    throw new RecordError("PROVENANCE_INCOMPLETE", "Extraction assertions require a valid source span.");
  }

  return {
    start: span.start,
    end: span.end,
  };
}

function normalizeAssertionConfidence(confidence: number | null | undefined) {
  if (confidence === undefined || confidence === null) {
    return null;
  }

  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RecordError("INVALID_ASSERTION", "Assertion confidence must be between 0 and 1.");
  }

  return confidence;
}

function normalizeOptionalAssertionId(assertionId: string | null | undefined) {
  if (assertionId === undefined || assertionId === null) {
    return null;
  }

  assertAssertionId(assertionId);
  return assertionId;
}

function assertAssertionId(assertionId: string) {
  assertRecordUlidValue(assertionId, "assertionId");
}

function assertRecordUlidValue(value: string, key: string) {
  if (!isRecordUlid(value)) {
    throw new RecordError("INVALID_REF", `${key} must be a Record ULID.`, {
      [key]: value,
    });
  }
}

function normalizeAssertionSensitivity(sensitivity: 0 | 1 | 2 | undefined): 0 | 1 | 2 {
  if (sensitivity === undefined) {
    return 0;
  }

  if (![0, 1, 2].includes(sensitivity)) {
    throw new RecordError("INVALID_ASSERTION", "Assertion sensitivity must be 0, 1, or 2.", {
      sensitivity,
    });
  }

  return sensitivity;
}

function normalizeAssertionScopeKeys(
  scopeKeys: Partial<RecordAssertionScopeKeys> | undefined,
  subject: RecordAssertionSubject,
): RecordAssertionScopeKeys {
  const entityIds = uniqueStrings(scopeKeys?.entityIds ?? []);
  if (subject.objectRef.objectType === "entity") {
    entityIds.push(subject.objectRef.objectId);
  }

  return {
    entityIds: uniqueStrings(entityIds),
    jurisdictions: uniqueStrings((scopeKeys?.jurisdictions ?? []).map((jurisdiction) => jurisdiction.toUpperCase())),
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === undefined) {
    throw new RecordError("INVALID_ASSERTION", "Assertion value cannot be undefined.");
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    throw new RecordError("INVALID_ASSERTION", "Assertion value must be JSON-serializable.");
  }
}

function assertionRecordedPayload(assertion: RecordAssertion): Record<string, unknown> {
  return {
    assertionId: assertion.assertionId,
    subject: {
      objectRef: stringifyRecordRef(assertion.subject.objectRef),
      field: assertion.subject.field,
    },
    validFrom: assertion.validFrom,
    validTo: assertion.validTo,
    source: {
      kind: assertion.source.kind,
    },
    confidence: assertion.confidence,
    sensitivity: assertion.sensitivity,
    scopeKeys: assertion.scopeKeys,
  };
}

function sameAssertionSubject(left: RecordAssertionSubject, right: RecordAssertionSubject) {
  return stringifyRecordRef(left.objectRef) === stringifyRecordRef(right.objectRef) && left.field === right.field;
}

function assertionVisibleAtLens(assertion: RecordAssertion, lens: RecordLens) {
  if (assertion.validFrom > lens.validAt) return false;
  if (assertion.validTo && lens.validAt >= assertion.validTo) return false;
  if (assertion.assertedAt > lens.knownAt) return false;
  if (assertion.retractedAt && assertion.retractedAt <= lens.knownAt) return false;
  return true;
}

function matchesSubscriptionFilter(event: RecordEvent, filters?: RecordSubscriptionFilter) {
  if (!filters) return true;
  if (filters.types && !filters.types.includes(event.type)) return false;
  if (filters.manifestRefs && (!event.manifestRef || !filters.manifestRefs.includes(event.manifestRef))) {
    return false;
  }
  return true;
}

function hashRecordEvent(event: Omit<RecordEvent, "hash"> | RecordEvent) {
  return createHash("sha256")
    .update(
      stableStringify({
        tenantId: event.tenantId,
        eventId: event.eventId,
        seq: event.seq,
        type: event.type,
        actor: event.actor,
        payload: event.payload,
        occurredAt: event.occurredAt,
        manifestRef: event.manifestRef,
        prevHash: event.prevHash,
      }),
    )
    .digest("hex");
}

export function createRecordRef(input: RecordRef): RecordRef {
  assertObjectType(input.objectType);
  if (!isRecordUlid(input.objectId)) {
    throw new RecordError("INVALID_REF", `Invalid Record ULID: ${input.objectId}`, {
      objectId: input.objectId,
    });
  }
  if (input.version !== undefined && (!Number.isInteger(input.version) || input.version < 1)) {
    throw new RecordError("INVALID_REF", "Record ref version must be a positive integer when present.", {
      version: input.version,
    });
  }

  return {
    objectType: input.objectType,
    objectId: input.objectId,
    version: input.version,
  };
}

export function stringifyRecordRef(ref: RecordRef) {
  const checked = createRecordRef(ref);
  return `${checked.objectType}:${checked.objectId}${checked.version ? `@${checked.version}` : ""}`;
}

export function parseRecordRef(value: string): RecordRef {
  const [typeAndId, versionValue] = value.split("@");
  const [objectType, objectId] = typeAndId.split(":");

  return createRecordRef({
    objectType,
    objectId,
    version: versionValue === undefined ? undefined : Number(versionValue),
  });
}

export function isRecordUlid(value: string) {
  return ULID_PATTERN.test(value);
}

export function isRecordError(error: unknown): error is RecordError {
  return error instanceof RecordError;
}

export function createRecordLens(input: CreateRecordLensInput): RecordLens {
  const validAt = normalizeValidAt(input.validAt);
  const knownAt = normalizeKnownAt(input.knownAt);
  return { validAt, knownAt };
}

export function createRecordUlid(date = new Date()) {
  return encodeTime(date.getTime(), 10) + encodeRandom(16);
}

function normalizeValidAt(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (!CALENDAR_DATE_PATTERN.test(value)) {
    throw new RecordError("INVALID_LENS", "Record lens validAt must be a calendar date in YYYY-MM-DD form.", {
      validAt: value,
    });
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RecordError("INVALID_LENS", "Record lens validAt must be a real calendar date.", {
      validAt: value,
    });
  }

  return value;
}

function normalizeKnownAt(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RecordError("INVALID_LENS", "Record lens knownAt must be a valid timestamp.", {
      knownAt: String(value),
    });
  }
  return date.toISOString();
}

function encodeTime(time: number, length: number) {
  let remaining = Math.floor(time);
  let encoded = "";

  for (let index = length - 1; index >= 0; index -= 1) {
    encoded = ULID_ALPHABET[remaining % 32] + encoded;
    remaining = Math.floor(remaining / 32);
  }

  return encoded;
}

function encodeRandom(length: number) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => ULID_ALPHABET[byte % 32]).join("");
}

function assertTenantId(tenantId: string) {
  if (!tenantId.trim()) {
    throw new RecordError("INVALID_TENANT", "tenantId is required.");
  }
}

function assertTenantReadAccess(tenantId: string, access?: RecordReadAccess) {
  if (!access) return;
  assertTenantId(access.tenantId);
  if (access.tenantId !== tenantId || (access.allowedTenantIds && !access.allowedTenantIds.includes(tenantId))) {
    throw new RecordError("TENANT_ACCESS_DENIED", "Record query access is scoped to a different tenant.", {
      tenantId,
      accessTenantId: access.tenantId,
      allowedTenantIds: access.allowedTenantIds ?? [access.tenantId],
    });
  }
}

function assertObjectType(objectType: string) {
  if (!OBJECT_TYPE_PATTERN.test(objectType)) {
    throw new RecordError("INVALID_REF", `Invalid Record object type: ${objectType}`, {
      objectType,
    });
  }
}

function assertIdempotencyKey(idempotencyKey: string) {
  if (!idempotencyKey.trim()) {
    throw new RecordError("IDEMPOTENCY_KEY_REQUIRED", "Record commands require a caller-supplied idempotency key.");
  }
}

function assertConsumer(consumer: string) {
  if (!consumer.trim()) {
    throw new RecordError("INVALID_EVENT_PAYLOAD", "Record subscriptions require a consumer name.");
  }
}

function validateEventInput(input: {
  actor: RecordActor;
  type: string;
  payload: Record<string, unknown>;
  manifestRef?: string;
}) {
  assertActor(input.actor);
  assertEventType(input.type);
  if (input.manifestRef !== undefined && !isRecordUlid(input.manifestRef)) {
    throw new RecordError("INVALID_REF", "Event manifest_ref must be a Record ULID.", {
      manifestRef: input.manifestRef,
    });
  }
  assertEventPayload(input.type, input.payload);
}

function assertActor(actor: RecordActor) {
  if (!actor || !["user", "agent", "system"].includes(actor.kind) || !actor.id?.trim()) {
    throw new RecordError("INVALID_ACTOR", "Record events require an actor with kind user, agent, or system and an id.");
  }
}

function assertEventType(type: string) {
  if (!type.trim()) {
    throw new RecordError("INVALID_EVENT_TYPE", "Record events require a type.");
  }
  if (type.startsWith("access.") || type.startsWith("read.") || type.includes(".read")) {
    throw new RecordError("INVALID_EVENT_TYPE", "Access and read events are not allowed in the Record domain log.", {
      type,
    });
  }
  if (!RECORD_EVENT_TYPES.has(type)) {
    throw new RecordError("INVALID_EVENT_TYPE", `Unknown Record event type: ${type}`, { type });
  }
}

function assertEventPayload(type: string, payload: Record<string, unknown>) {
  if (type === "ingestion.versioned") {
    requireStringPayload(type, payload, "batchRef");
    if (!Number.isInteger(payload.corpusVersion) || (payload.corpusVersion as number) < 1) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "ingestion.versioned requires payload.corpusVersion.", {
        type,
        key: "corpusVersion",
      });
    }
    if (!Number.isInteger(payload.documentCount) || (payload.documentCount as number) < 1) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "ingestion.versioned requires payload.documentCount.", {
        type,
        key: "documentCount",
      });
    }
  }

  if (type.startsWith("assertion.")) {
    requireStringPayload(type, payload, "assertionId");
  }

  if (type.startsWith("gate.")) {
    requireStringPayload(type, payload, "gateId");
  }

  if (type === "gate.requested") {
    requireStringPayload(type, payload, "stagingId");
    requireStringPayload(type, payload, "objectRef");
  }

  if (type === "gate.decided") {
    requireStringPayload(type, payload, "decision");
  }

  if (type === "gate.delegated") {
    requireStringPayload(type, payload, "delegatedTo");
  }

  if (type === "gate.escalated") {
    requireStringPayload(type, payload, "escalatedTo");
    requireStringPayload(type, payload, "reason");
  }

  if (type === "canonical.promoted" || type === "edit.applied") {
    requireStringPayload(type, payload, "objectRef");
    requireStringPayload(type, payload, "approvalRef");
  }

  if (type === "edit.applied") {
    requireStringPayload(type, payload, "reason");
  }

  if (type.startsWith("run.")) {
    requireStringPayload(type, payload, "runRef");
  }

  if (type.startsWith("instruction.")) {
    requireStringPayload(type, payload, "instructionRef");
  }

  if (type === "precedence.policy_changed") {
    requireStringPayload(type, payload, "policyId");
    if (!Number.isInteger(payload.policyVersion) || (payload.policyVersion as number) < 1) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "precedence.policy_changed requires payload.policyVersion.", {
        type,
        key: "policyVersion",
      });
    }
  }

  if (type === "resolution.alias_added") {
    requireStringPayload(type, payload, "aliasId");
    requireStringPayload(type, payload, "aliasText");
    requireStringPayload(type, payload, "entityRef");
  }

  if (type === "resolution.merged") {
    requireStringPayload(type, payload, "sourceEntityRef");
    requireStringPayload(type, payload, "targetEntityRef");
    requireStringPayload(type, payload, "reason");
  }

  if (type === "resolution.split") {
    requireStringPayload(type, payload, "sourceEntityRef");
    requireStringPayload(type, payload, "newEntityRef");
    requireStringPayload(type, payload, "reason");
    if (!Array.isArray(payload.aliasIds) || payload.aliasIds.length === 0) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "resolution.split requires payload.aliasIds.", {
        type,
        key: "aliasIds",
      });
    }
  }

  if (type === "resolution.mapping_proposed") {
    requireStringPayload(type, payload, "mappingProposalId");
    requireStringPayload(type, payload, "sourceAccount");
    requireStringPayload(type, payload, "canonicalAccount");
  }

  if (type === "resolution.mapping_applied") {
    requireStringPayload(type, payload, "mappingProposalId");
    requireStringPayload(type, payload, "mappingId");
  }

  if (type === "artifact.rendered") {
    requireStringPayload(type, payload, "artifactId");
    requireStringPayload(type, payload, "manifestId");
    requireStringPayload(type, payload, "format");
    requireStringPayload(type, payload, "contentHash");
  }

  if (type === "artifact.sealed") {
    requireStringPayload(type, payload, "artifactId");
    requireStringPayload(type, payload, "manifestId");
    requireStringPayload(type, payload, "contentHash");
  }

  if (type === "artifact.superseded") {
    requireStringPayload(type, payload, "artifactId");
    requireStringPayload(type, payload, "manifestId");
    requireStringPayload(type, payload, "contentHash");
    requireStringPayload(type, payload, "sourceEventId");
    requireStringPayload(type, payload, "changedRef");
    if (!Number.isInteger(payload.sourceEventSeq) || (payload.sourceEventSeq as number) < 1) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "artifact.superseded requires payload.sourceEventSeq.", {
        type,
        key: "sourceEventSeq",
      });
    }
  }

  if (type === "dependency.declared") {
    requireStringPayload(type, payload, "declaredByRun");
    if (typeof payload.downstreamRef !== "string") {
      if (!Array.isArray(payload.downstreamRefs) || payload.downstreamRefs.length === 0) {
        throw new RecordError("INVALID_EVENT_PAYLOAD", "dependency.declared requires payload.downstreamRef or payload.downstreamRefs.", {
          type,
          key: "downstreamRefs",
        });
      }
    }
    if (!Array.isArray(payload.dependencyIds) || payload.dependencyIds.length === 0) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "dependency.declared requires payload.dependencyIds.", {
        type,
        key: "dependencyIds",
      });
    }
    if (!Array.isArray(payload.upstreamRefs) || payload.upstreamRefs.length === 0) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "dependency.declared requires payload.upstreamRefs.", {
        type,
        key: "upstreamRefs",
      });
    }
  }

  if (type === "staleness.dirtied") {
    requireStringPayload(type, payload, "sourceEventId");
    requireStringPayload(type, payload, "changedRef");
    if (!Number.isInteger(payload.sourceEventSeq) || (payload.sourceEventSeq as number) < 1) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "staleness.dirtied requires payload.sourceEventSeq.", {
        type,
        key: "sourceEventSeq",
      });
    }
    if (!Array.isArray(payload.dirtyFlagIds) || payload.dirtyFlagIds.length === 0) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "staleness.dirtied requires payload.dirtyFlagIds.", {
        type,
        key: "dirtyFlagIds",
      });
    }
  }

  if (type === "staleness.proposal_created") {
    requireStringPayload(type, payload, "proposalId");
    if (!Array.isArray(payload.targets) || payload.targets.length === 0) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "staleness.proposal_created requires payload.targets.", {
        type,
        key: "targets",
      });
    }
    if (!Array.isArray(payload.causeEvents) || payload.causeEvents.length === 0) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "staleness.proposal_created requires payload.causeEvents.", {
        type,
        key: "causeEvents",
      });
    }
  }

  if (type === "staleness.proposal_resolved") {
    requireStringPayload(type, payload, "proposalId");
    requireStringPayload(type, payload, "decision");
    requireStringPayload(type, payload, "reason");
    if (!Array.isArray(payload.dirtyFlagIds) || payload.dirtyFlagIds.length === 0) {
      throw new RecordError("INVALID_EVENT_PAYLOAD", "staleness.proposal_resolved requires payload.dirtyFlagIds.", {
        type,
        key: "dirtyFlagIds",
      });
    }
  }

  if (type === "period.opened" && payload.periodId !== undefined) {
    requireStringPayload(type, payload, "periodId");
    requireStringPayload(type, payload, "periodRef");
    requireStringPayload(type, payload, "fy");
    requireStringPayload(type, payload, "validFrom");
    requireStringPayload(type, payload, "validTo");
  }

  if (type === "period.closing" && payload.periodId !== undefined) {
    requireStringPayload(type, payload, "periodId");
    requireStringPayload(type, payload, "periodRef");
  }

  if (type === "period.sealed" && payload.periodId !== undefined) {
    requireStringPayload(type, payload, "periodId");
    requireStringPayload(type, payload, "periodRef");
    requireStringPayload(type, payload, "fy");
  }
}

function requireStringPayload(type: string, payload: Record<string, unknown>, key: string) {
  if (typeof payload[key] !== "string" || !payload[key].trim()) {
    throw new RecordError("INVALID_EVENT_PAYLOAD", `${type} requires payload.${key}.`, {
      type,
      key,
    });
  }
}

function recordKey(tenantId: string, ref: RecordRef) {
  return `${tenantId}:${stringifyRecordRef(ref)}`;
}

function consumerOffsetKey(tenantId: string, consumer: string) {
  return `${tenantId}:${consumer}`;
}

function getConsumerOffset(store: RecordStore, tenantId: string, consumer: string) {
  return store.consumerOffsets.get(consumerOffsetKey(tenantId, consumer)) ?? 0;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach((child) => deepFreeze(child));
  return value;
}
