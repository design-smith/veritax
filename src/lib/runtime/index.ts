import type {
  DecideGateResult,
  DeclareDependenciesResult,
  DelegateGateResult,
  EscalateGateResult,
  RecordActor,
  RecordGate,
  RecordLens,
  RecordManifest,
  RecordService,
  RecordStagingObject,
} from "../record";

const RUNTIME_ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RUNTIME_ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const OBJECT_TYPE_PATTERN = /^[a-z][a-z0-9_]*$/;
const STEP_ID_PATTERN = /^[a-z][a-z0-9_-]{1,127}$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const MODEL_ID_PATTERN = /^[a-z][a-z0-9._-]{1,127}$/;

export const RUNTIME_JOB_KINDS = ["agent", "engine", "pipeline", "composite"] as const;
export const RUNTIME_INITIATOR_KINDS = ["user", "watcher", "system", "commitment"] as const;
export const RUNTIME_PRIORITY_LANES = ["interactive", "standard", "background", "batch"] as const;
export const RUNTIME_STEP_TYPES = ["tool", "engine", "model", "subjob"] as const;
export const RUNTIME_MODEL_IO_RETENTION_CLASSES = ["batch-6-months", "gate-adjacent-24-months"] as const;
export const RUNTIME_PLAN_STATUSES = ["compiled", "approved", "superseded"] as const;
export const RUNTIME_PLAN_SOURCES = ["user_command", "inline_directive", "commitment_ref", "schedule_ref"] as const;
export const RUNTIME_PLAN_TOOL_CLASSES = ["read", "engine-call", "staging-write", "export-prepare"] as const;
export const RUNTIME_TOOL_CAPABILITY_CLASSES = ["read", "engine-call", "staging-write", "export-prepare"] as const;
export const RUNTIME_SENSITIVITY_CEILINGS = ["public", "internal", "confidential", "privileged-vault"] as const;
export const RUNTIME_JOB_TOOL_SETS = {
  agent: ["read", "engine-call", "staging-write"],
  engine: ["engine-call"],
  pipeline: ["read", "engine-call", "staging-write", "export-prepare"],
  composite: [],
} as const;
export const RUNTIME_COST_CLASS_BUDGETS = {
  instant: { tokenCeiling: 0, toolCallCeiling: 4, wallclockMs: 1000 },
  standard: { tokenCeiling: 250000, toolCallCeiling: 40, wallclockMs: 30 * 60 * 1000 },
  heavy: { tokenCeiling: 2000000, toolCallCeiling: 200, wallclockMs: 2 * 60 * 60 * 1000 },
  batch: { tokenCeiling: 10000000, toolCallCeiling: 1000, wallclockMs: 24 * 60 * 60 * 1000 },
} as const;
export const RUNTIME_COST_CLASSES = ["instant", "standard", "heavy", "batch"] as const;
export const RUNTIME_MODEL_ROUTE_KEYS = ["classification", "extraction", "drafting", "investigation"] as const;
export const RUNTIME_INSTRUCTION_TIERS = ["style", "run", "methodology"] as const;
export const RUNTIME_INSTRUCTION_STATUSES = ["draft", "active", "retired", "superseded"] as const;
export const RUNTIME_INSTRUCTION_SCOPE_KINDS = ["org", "jurisdiction", "doc-type", "section", "object"] as const;
export const RUNTIME_INSTRUCTION_TARGETS = [
  "engine-parameters",
  "generation-constraints",
  "scope-definition",
] as const;
const RUNTIME_INSTRUCTION_TIER_NUMBERS: Record<RuntimeInstructionTier, number> = {
  style: 1,
  run: 2,
  methodology: 3,
};
const RUNTIME_MODEL_EVAL_REFS = {
  small: { objectType: "eval_status", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0MA" },
  large: { objectType: "eval_status", objectId: "01KVJ9N8M7P6Q5R4S3T2V1W0MB" },
} as const;
export const RUNTIME_DEFAULT_MODELS = [
  {
    modelId: "veritax-small-classifier",
    version: "2026.06.19",
    provider: "openai",
    capabilityTags: ["classification", "extraction", "small"],
    costWeight: 1,
    evalStatusRef: RUNTIME_MODEL_EVAL_REFS.small,
    registeredBy: "deploy",
  },
  {
    modelId: "veritax-large-investigator",
    version: "2026.06.19",
    provider: "openai",
    capabilityTags: ["drafting", "investigation", "large"],
    costWeight: 5,
    evalStatusRef: RUNTIME_MODEL_EVAL_REFS.large,
    registeredBy: "deploy",
  },
  {
    modelId: "veritax-large-investigator-failover",
    version: "2026.06.19",
    provider: "anthropic",
    capabilityTags: ["drafting", "investigation", "large"],
    costWeight: 5,
    evalStatusRef: RUNTIME_MODEL_EVAL_REFS.large,
    registeredBy: "deploy",
  },
] as const;
export const RUNTIME_DEFAULT_MODEL_ROUTES = [
  {
    routeKey: "classification",
    preferredModel: { modelId: "veritax-small-classifier", version: "2026.06.19" },
    fallbackModels: [],
    requiredCapabilityTags: ["classification", "small"],
    configuredBy: "prd-15-release-gate",
    version: "2026.06.19",
  },
  {
    routeKey: "extraction",
    preferredModel: { modelId: "veritax-small-classifier", version: "2026.06.19" },
    fallbackModels: [],
    requiredCapabilityTags: ["extraction", "small"],
    configuredBy: "prd-15-release-gate",
    version: "2026.06.19",
  },
  {
    routeKey: "drafting",
    preferredModel: { modelId: "veritax-large-investigator", version: "2026.06.19" },
    fallbackModels: [{ modelId: "veritax-large-investigator-failover", version: "2026.06.19" }],
    requiredCapabilityTags: ["drafting", "large"],
    configuredBy: "prd-15-release-gate",
    version: "2026.06.19",
  },
  {
    routeKey: "investigation",
    preferredModel: { modelId: "veritax-large-investigator", version: "2026.06.19" },
    fallbackModels: [{ modelId: "veritax-large-investigator-failover", version: "2026.06.19" }],
    requiredCapabilityTags: ["investigation", "large"],
    configuredBy: "prd-15-release-gate",
    version: "2026.06.19",
  },
] as const;
export const RUNTIME_RETRY_POLICIES = {
  tool_error: { maxAttempts: 2, initialBackoffMs: 1000, multiplier: 2 },
  timeout: { maxAttempts: 1, initialBackoffMs: 2000, multiplier: 2 },
  budget: { maxAttempts: 0, initialBackoffMs: 0, multiplier: 1 },
  validation: { maxAttempts: 0, initialBackoffMs: 0, multiplier: 1 },
  refusal: { maxAttempts: 0, initialBackoffMs: 0, multiplier: 1 },
  conflict: { maxAttempts: 0, initialBackoffMs: 0, multiplier: 1 },
} as const;
export const RUNTIME_DEFAULT_TOOLS = [
  {
    name: "record.get",
    capabilityClass: "read",
    scopeRequirements: { objectTypes: ["record"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 1,
    rateLimits: { perMinute: 600, burst: 120 },
    registeredBy: "deploy",
  },
  {
    name: "record.subgraph",
    capabilityClass: "read",
    scopeRequirements: { objectTypes: ["entity", "flow"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 2,
    rateLimits: { perMinute: 300, burst: 60 },
    registeredBy: "deploy",
  },
  {
    name: "record.conflicts",
    capabilityClass: "read",
    scopeRequirements: { objectTypes: ["assertion"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 2,
    rateLimits: { perMinute: 240, burst: 60 },
    registeredBy: "deploy",
  },
  {
    name: "record.timeline",
    capabilityClass: "read",
    scopeRequirements: { objectTypes: ["record"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 1,
    rateLimits: { perMinute: 300, burst: 60 },
    registeredBy: "deploy",
  },
  {
    name: "record.current_value",
    capabilityClass: "read",
    scopeRequirements: { objectTypes: ["assertion"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 1,
    rateLimits: { perMinute: 600, burst: 120 },
    registeredBy: "deploy",
  },
  {
    name: "retrieval.search",
    capabilityClass: "read",
    scopeRequirements: { objectTypes: ["document"], jurisdictionsRequired: false, objectRefsRequired: false },
    sensitivityCeiling: "confidential",
    costWeight: 2,
    rateLimits: { perMinute: 300, burst: 60 },
    registeredBy: "deploy",
  },
  {
    name: "blob.read",
    capabilityClass: "read",
    scopeRequirements: { objectTypes: ["blob"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "privileged-vault",
    costWeight: 1,
    rateLimits: { perMinute: 300, burst: 60 },
    registeredBy: "deploy",
  },
  {
    name: "engine.range_test",
    capabilityClass: "engine-call",
    scopeRequirements: { objectTypes: ["flow"], jurisdictionsRequired: true, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 4,
    rateLimits: { perMinute: 120, burst: 30 },
    registeredBy: "deploy",
  },
  {
    name: "engine.globe_check",
    capabilityClass: "engine-call",
    scopeRequirements: { objectTypes: ["entity"], jurisdictionsRequired: true, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 5,
    rateLimits: { perMinute: 90, burst: 20 },
    registeredBy: "deploy",
  },
  {
    name: "engine.cascade_traversal",
    capabilityClass: "engine-call",
    scopeRequirements: { objectTypes: ["entity", "flow"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 4,
    rateLimits: { perMinute: 120, burst: 30 },
    registeredBy: "deploy",
  },
  {
    name: "staging.put",
    capabilityClass: "staging-write",
    scopeRequirements: { objectTypes: ["staged_object"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 2,
    rateLimits: { perMinute: 120, burst: 30 },
    registeredBy: "deploy",
  },
  {
    name: "export.prepare",
    capabilityClass: "export-prepare",
    scopeRequirements: { objectTypes: ["artifact"], jurisdictionsRequired: false, objectRefsRequired: true },
    sensitivityCeiling: "confidential",
    costWeight: 2,
    rateLimits: { perMinute: 60, burst: 10 },
    registeredBy: "deploy",
  },
] as const satisfies readonly RegisterRuntimeToolCommand[];
export const RUNTIME_JOB_STATUSES = [
  "queued",
  "planning",
  "running",
  "producing",
  "awaiting-gate",
  "completed",
  "failed",
  "cancelled",
  "budget-exceeded",
] as const;
export const RUNTIME_FAILURE_CLASSES = ["tool_error", "timeout", "budget", "validation", "refusal", "conflict"] as const;

export type RuntimeJobKind = "agent" | "engine" | "pipeline" | "composite";
export type RuntimeInitiatorKind = "user" | "watcher" | "system" | "commitment";
export type RuntimePriorityLane = "interactive" | "standard" | "background" | "batch";
export type RuntimeStepType = "tool" | "engine" | "model" | "subjob";
export type RuntimeModelIORetentionClass = "batch-6-months" | "gate-adjacent-24-months";
export type RuntimePlanStatus = "compiled" | "approved" | "superseded";
export type RuntimePlanSourceKind = "user_command" | "inline_directive" | "commitment_ref" | "schedule_ref";
export type RuntimePlanToolClass = "read" | "engine-call" | "staging-write" | "export-prepare";
export type RuntimeToolCapabilityClass = "read" | "engine-call" | "staging-write" | "export-prepare";
export type RuntimeSensitivityCeiling = "public" | "internal" | "confidential" | "privileged-vault";
export type RuntimeCostClass = "instant" | "standard" | "heavy" | "batch";
export type RuntimeModelRouteKey = "classification" | "extraction" | "drafting" | "investigation";
export type RuntimeInstructionTier = "style" | "run" | "methodology";
export type RuntimeInstructionStatus = "draft" | "active" | "retired" | "superseded";
export type RuntimeInstructionScopeKind = "org" | "jurisdiction" | "doc-type" | "section" | "object";
export type RuntimeInstructionTarget = "engine-parameters" | "generation-constraints" | "scope-definition";
export type RuntimeScheduleTriggerKind = "calendar" | "record-change" | "manual";
export type RuntimeScheduleStatus = "active" | "orphaned";
export type RuntimeJobClaimStatus = "active" | "started" | "released";
export type RuntimeJobStatus =
  | "queued"
  | "planning"
  | "running"
  | "producing"
  | "awaiting-gate"
  | "completed"
  | "failed"
  | "cancelled"
  | "budget-exceeded";
export type RuntimeFailureClass = "tool_error" | "timeout" | "budget" | "validation" | "refusal" | "conflict";
export type RuntimeToolDenialReason =
  | "tool_not_registered"
  | "tool_circuit_open"
  | "tool_rate_limited"
  | "tool_not_allowed_for_job_kind"
  | "capability_missing"
  | "scope_requirements_not_met"
  | "scope_outside_job"
  | "scope_outside_initiator"
  | "sensitivity_exceeds_tool"
  | "sensitivity_exceeds_capability";
export type RuntimeEventType =
  | "run.queued"
  | "run.planning"
  | "run.started"
  | "run.producing"
  | "run.awaiting_gate"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "run.budget_exceeded"
  | "run.step"
  | "gate.requested"
  | "gate.decided"
  | "gate.delegated"
  | "gate.escalated"
  | "gate.changes_requested";

export interface RuntimeRecordRef {
  objectType: string;
  objectId: string;
  version?: number;
}

export interface RuntimeInitiator {
  kind: RuntimeInitiatorKind;
  ref: string;
}

export interface RuntimeScope {
  entityIds: string[];
  jurisdictions: string[];
  objectRefs: RuntimeRecordRef[];
  period: string | null;
}

export interface RuntimeFailure {
  class: RuntimeFailureClass;
  detailRef: RuntimeRecordRef | null;
}

export interface RuntimeToolScopeRequirements {
  objectTypes: string[];
  jurisdictionsRequired: boolean;
  objectRefsRequired: boolean;
}

export interface RuntimeToolRateLimits {
  perMinute: number;
  burst: number;
}

export interface RuntimeTool {
  name: string;
  capabilityClass: RuntimeToolCapabilityClass;
  scopeRequirements: RuntimeToolScopeRequirements;
  sensitivityCeiling: RuntimeSensitivityCeiling;
  costWeight: number;
  rateLimits: RuntimeToolRateLimits;
  registeredBy: "deploy";
}

export type RuntimeKillSwitchScope =
  | { kind: "tenant"; jobKind: null }
  | { kind: "job-kind"; jobKind: RuntimeJobKind };

export interface RuntimeKillSwitch {
  tenantId: string;
  scope: RuntimeKillSwitchScope;
  enabled: boolean;
  reason: string;
  actor: RuntimeInitiator;
  changedAt: string;
}

export type RuntimeCircuitBreakerState = "closed" | "open";

export interface RuntimeCircuitBreaker {
  tenantId: string;
  toolName: string;
  failureThreshold: number;
  windowMs: number;
  cooldownMs: number | null;
  state: RuntimeCircuitBreakerState;
  recentFailures: number;
  failureTimes: string[];
  openedAt: string | null;
  openUntil: string | null;
}

export interface RuntimeCapabilityMap {
  toolClasses: RuntimeToolCapabilityClass[];
  entityIds: string[];
  jurisdictions: string[];
  objectRefs: RuntimeRecordRef[];
  sensitivityCeiling: RuntimeSensitivityCeiling;
}

export interface RuntimeRetryState {
  attempts: number;
  nextRetryAt: string | null;
  lastFailure: RuntimeFailure | null;
  poisonEntryId: string | null;
}

export interface RuntimePoisonQueueEntry {
  entryId: string;
  tenantId: string;
  jobId: string;
  failure: RuntimeFailure;
  attempts: number;
  diagnostics: string | null;
  parkedAt: string;
}

export interface RuntimeGateChangeComment {
  anchorRef: RuntimeRecordRef;
  text: string;
}

export interface RuntimeGateChangeRequest {
  changeRequestId: string;
  tenantId: string;
  jobId: string;
  gateId: string;
  requestedBy: RuntimeInitiator;
  comments: RuntimeGateChangeComment[];
  requestedAt: string;
}

export interface RuntimeStep {
  stepId: string;
  type: RuntimeStepType;
  toolName?: string;
  readRefs?: RuntimeVersionedRecordRef[];
  modelIO?: RuntimeModelIORefs;
  argsRef: RuntimeRecordRef | null;
  resultRef: RuntimeRecordRef | null;
  t0: string | null;
  t1: string | null;
  cost: Record<string, unknown>;
}

export interface RuntimeModelIORefs {
  promptRef: RuntimeRecordRef;
  outputRef: RuntimeRecordRef;
  retentionClass: RuntimeModelIORetentionClass;
}

export interface RuntimeVersionedRecordRef extends RuntimeRecordRef {
  version: number;
}

export interface RuntimeReadPin {
  ref: RuntimeVersionedRecordRef;
  version: number;
  stepId: string;
  toolName: string | null;
  readAt: string;
}

export interface RuntimeMeter {
  tokens: number;
  toolCalls: number;
  engineCalls: number;
  modelCalls: number;
  wallclockMs: number;
  costWeight: number;
}

export interface RuntimeBudget {
  costClass: RuntimeCostClass | null;
  tokenCeiling: number | null;
  toolCallCeiling: number | null;
  wallclockMs: number | null;
}

export interface RuntimeBudgetPatch {
  tokenCeiling?: number;
  toolCallCeiling?: number;
  wallclockMs?: number;
}

export interface RuntimeBudgetRaise {
  tenantId: string;
  jobId: string;
  approvedBy: RuntimeInitiator;
  previousBudget: RuntimeBudget;
  budget: RuntimeBudget;
  reason: string;
  approvedAt: string;
}

export interface RuntimeTenantBudgetGuard {
  tenantId: string;
  maxConcurrentRunningJobs: number | null;
  monthlyCostWeightCeiling: number | null;
}

export interface RuntimeCostTelemetryEntry {
  tenantId: string;
  jobId: string;
  stepId: string;
  type: RuntimeStepType;
  costClass: RuntimeCostClass | null;
  occurredAt: string;
  cost: Record<string, unknown>;
  meter: RuntimeMeter;
}

export interface RuntimeModelRef {
  modelId: string;
  version: string;
}

export interface RuntimeModel {
  modelId: string;
  version: string;
  provider: string;
  capabilityTags: string[];
  costWeight: number;
  evalStatusRef: RuntimeRecordRef;
  available: boolean;
  registeredBy: "deploy";
}

export interface RuntimeModelRoute {
  routeKey: RuntimeModelRouteKey;
  preferredModel: RuntimeModelRef;
  fallbackModels: RuntimeModelRef[];
  requiredCapabilityTags: string[];
  configuredBy: "prd-15-release-gate";
  version: string;
}

export interface RuntimeGatePolicy {
  tenantId: string;
  objectType: string;
  fourEyes: boolean;
  configuredBy: RuntimeInitiator;
  configuredAt: string;
}

export interface RuntimeStagingWrite {
  writeId: string;
  tenantId: string;
  jobId: string;
  idempotencyKey: string;
  outputRef: RuntimeRecordRef;
  stagedRef: RuntimeRecordRef;
  outputHash: string | null;
  stagingId?: string;
  gateRef?: RuntimeRecordRef;
  writtenAt: string;
}

export interface RuntimeCompositeChild {
  key: string;
  jobId: string;
  dependsOn: string[];
}

export interface RuntimeCompositeManifest {
  parentJobId: string;
  failFast: boolean;
  childJobs: RuntimeCompositeChild[];
  statusByKey: Record<string, RuntimeJobStatus>;
  completedChildKeys: string[];
  failedChildKeys: string[];
  cancelledChildKeys: string[];
  terminal: boolean;
}

export interface RuntimeCompositeState {
  failFast: boolean;
  childJobs: RuntimeCompositeChild[];
  manifest: RuntimeCompositeManifest;
}

export interface RuntimeJob {
  tenantId: string;
  jobId: string;
  parentJobId: string | null;
  kind: RuntimeJobKind;
  initiator: RuntimeInitiator;
  scope: RuntimeScope;
  planRef: RuntimeRecordRef | null;
  manifestRef: RuntimeRecordRef | null;
  instructionSet: {
    setHash: string | null;
    refs: string[];
  };
  pins: {
    corpusVersion: number | null;
    rulepackVersions: Record<string, string>;
    modelVersions: Record<string, string>;
  };
  budget: RuntimeBudget;
  meter: RuntimeMeter;
  idempotencyKey: string;
  priorityLane: RuntimePriorityLane;
  steps: RuntimeStep[];
  readPins: RuntimeReadPin[];
  stagingWrites: RuntimeStagingWrite[];
  composite: RuntimeCompositeState | null;
  retry: RuntimeRetryState;
  status: RuntimeJobStatus;
  failure: RuntimeFailure | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimePlanSource {
  kind: RuntimePlanSourceKind;
  ref: string | null;
}

export interface RuntimePlanPreviewItem {
  objectType: string;
  label: string;
  reason: string | null;
}

export interface RuntimePlanPermissionVerdict {
  allowed: boolean;
  reason: string | null;
}

export interface RuntimePlanStepPreview {
  action: string;
  scope: RuntimeScope;
  toolClass: RuntimePlanToolClass;
}

export interface RuntimePlan {
  tenantId: string;
  planId: string;
  planRef: RuntimeRecordRef;
  kind: Extract<RuntimeJobKind, "agent" | "composite">;
  initiator: RuntimeInitiator;
  scope: RuntimeScope;
  status: RuntimePlanStatus;
  intentRestated: string;
  steps: RuntimePlanStepPreview[];
  invalidationsPreview: RuntimePlanPreviewItem[];
  produces: RuntimePlanPreviewItem[];
  estDurationMs: number;
  costClass: RuntimeCostClass;
  instructionEcho: string;
  permissionVerdict: RuntimePlanPermissionVerdict;
  source: RuntimePlanSource;
  supersedesPlanId: string | null;
  approvedJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeScheduleTrigger {
  kind: RuntimeScheduleTriggerKind;
  ref: string;
  cadence: string;
  timezone: string;
  nextFireAt: string | null;
}

export interface RuntimeSchedulePlanTemplate {
  kind: Extract<RuntimeJobKind, "agent" | "composite">;
  scope: RuntimeScope;
  intentRestated: string;
  steps: RuntimePlanStepPreview[];
  invalidationsPreview: RuntimePlanPreviewItem[];
  produces: RuntimePlanPreviewItem[];
  estDurationMs: number;
  costClass: RuntimeCostClass;
  instructionEcho: string;
  permissionVerdict: RuntimePlanPermissionVerdict;
  priorityLane: RuntimePriorityLane;
}

export interface RuntimeScheduleOrphan {
  reason: "owner_scope_lost";
  previousOwner: RuntimeInitiator;
  orphanedAt: string;
  reassignmentPrompt: {
    target: "workspace-owner";
    message: string;
  };
}

export interface RuntimeSchedule {
  tenantId: string;
  scheduleId: string;
  scheduleRef: RuntimeRecordRef;
  owner: RuntimeInitiator;
  trigger: RuntimeScheduleTrigger;
  planTemplate: RuntimeSchedulePlanTemplate;
  status: RuntimeScheduleStatus;
  orphan: RuntimeScheduleOrphan | null;
  orphanedAt: string | null;
  lastFiredAt: string | null;
  lastJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeScheduleOrphanResolution {
  tenantId: string;
  scheduleId: string;
  previousOwner: RuntimeInitiator;
  newOwner: RuntimeInitiator;
  orphanedAt: string;
  reassignedAt: string;
  resolutionMs: number;
}

export interface RuntimeJobClaim {
  tenantId: string;
  claimId: string;
  jobId: string;
  workerId: string;
  lanes: RuntimePriorityLane[];
  status: RuntimeJobClaimStatus;
  claimedAt: string;
  leaseExpiresAt: string;
  startedAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
}

export interface RuntimeEvent {
  eventId: string;
  tenantId: string;
  jobId: string;
  type: RuntimeEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface RuntimeInstructionScope {
  kind: RuntimeInstructionScopeKind;
  jurisdictions: string[];
  objectRefs: RuntimeRecordRef[];
  docType: string | null;
  section: string | null;
}

export interface RuntimeCompiledInstruction {
  target: RuntimeInstructionTarget;
  directives: Array<{
    key: string;
    value: string;
  }>;
  confidence: number;
}

export interface RuntimeInstructionApproval {
  approvedBy: RuntimeInitiator;
  approvedAt: string;
}

export interface RuntimeInstructionRefusal {
  reason: "fact-conflict" | "low-confidence";
  conflictingAssertions: RuntimeRecordRef[];
  remedy: string;
}

export interface RuntimeInstruction {
  tenantId: string;
  instructionId: string;
  instructionRef: string;
  tier: RuntimeInstructionTier;
  scope: RuntimeInstructionScope;
  text: string;
  compiled: RuntimeCompiledInstruction;
  status: RuntimeInstructionStatus;
  author: RuntimeInitiator;
  approvals: RuntimeInstructionApproval[];
  approvalGateRef: RuntimeRecordRef | null;
  approvalStagingRef: RuntimeRecordRef | null;
  supersedesInstructionId: string | null;
  refusal: RuntimeInstructionRefusal | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeInstructionEvent {
  eventId: string;
  tenantId: string;
  type: "instruction.submitted" | "instruction.approved" | "instruction.retired" | "instruction.refused" | "instruction.superseded";
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface RuntimeInstructionSet {
  setHash: string | null;
  refs: string[];
  instructions: RuntimeInstruction[];
}

export interface RuntimeManifestRegistration {
  manifest: RecordManifest;
  dependencies: DeclareDependenciesResult[];
}

export interface CreateRuntimeServiceOptions {
  record?: Pick<
    RecordService,
    | "stageObject"
    | "requestGate"
    | "decideGate"
    | "delegateGate"
    | "escalateGate"
    | "listGates"
    | "registerManifest"
    | "declareDependencies"
    | "declareDependenciesBatch"
    | "listDependencies"
  >;
}

export interface SubmitRuntimeJobCommand {
  tenantId: string;
  idempotencyKey: string;
  kind: RuntimeJobKind;
  initiator: RuntimeInitiator;
  scope?: Partial<RuntimeScope>;
  planRef?: RuntimeRecordRef | null;
  priorityLane?: RuntimePriorityLane;
}

export interface SubmitRuntimeJobResult {
  job: RuntimeJob;
}

export interface SubmitRuntimeInstructionCommand {
  tenantId: string;
  idempotencyKey: string;
  author: RuntimeInitiator;
  text: string;
  scope: Partial<RuntimeInstructionScope> & { kind: RuntimeInstructionScopeKind };
  submittedAt?: string | Date;
  approvalSlaDue?: string | Date;
  conflictingAssertions?: RuntimeRecordRef[];
}

export interface SubmitRuntimeInstructionResult {
  instruction: RuntimeInstruction | null;
  refusal: RuntimeInstructionRefusal | null;
  event: RuntimeInstructionEvent;
  shadowedInstructions: RuntimeInstruction[];
  approvalGate: RecordGate | null;
  approvalStagingObject: RecordStagingObject | null;
}

export interface ApproveRuntimeInstructionCommand {
  tenantId: string;
  instructionId: string;
  idempotencyKey: string;
  approvedBy: RuntimeInitiator;
  approvedAt?: string | Date;
  gateId?: string;
}

export interface ApproveRuntimeInstructionResult {
  instruction: RuntimeInstruction;
  event: RuntimeInstructionEvent;
  approvalGate: RecordGate | null;
  approvalStagingObject: RecordStagingObject | null;
}

export interface RetireRuntimeInstructionCommand {
  tenantId: string;
  instructionId: string;
  idempotencyKey: string;
  retiredBy: RuntimeInitiator;
  retiredAt?: string | Date;
  reason?: string;
}

export interface RetireRuntimeInstructionResult {
  instruction: RuntimeInstruction;
  event: RuntimeInstructionEvent;
}

type RuntimeInstructionCommandResult =
  | SubmitRuntimeInstructionResult
  | ApproveRuntimeInstructionResult
  | RetireRuntimeInstructionResult;

export interface ListRuntimeInstructionsInput {
  tenantId: string;
  status?: RuntimeInstructionStatus;
}

export interface GetRuntimeInstructionInput {
  tenantId: string;
  instructionId: string;
}

export interface ComposeRuntimeInstructionSetCommand {
  tenantId: string;
  scope?: Partial<RuntimeScope>;
}

export interface RegisterRuntimeToolCommand {
  name: string;
  capabilityClass: RuntimeToolCapabilityClass;
  scopeRequirements: RuntimeToolScopeRequirements;
  sensitivityCeiling: RuntimeSensitivityCeiling;
  costWeight: number;
  rateLimits: RuntimeToolRateLimits;
  registeredBy: "deploy";
}

export interface RegisterRuntimeToolResult {
  tool: RuntimeTool;
}

export interface GetRuntimeToolInput {
  name: string;
}

export interface AuthorizeRuntimeToolUseCommand {
  tenantId: string;
  jobId: string;
  toolName: string;
  requestedScope?: Partial<RuntimeScope>;
  requestedSensitivity?: RuntimeSensitivityCeiling;
  requestedAt?: string | Date;
  capabilityMap: RuntimeCapabilityMap;
}

export interface ListAvailableRuntimeToolsForJobCommand {
  tenantId: string;
  jobId: string;
  asOf?: string | Date;
  capabilityMap: RuntimeCapabilityMap;
}

export interface RuntimeToolAuthorization {
  allowed: boolean;
  reason: RuntimeToolDenialReason | null;
  tool: RuntimeTool | null;
  effectiveScope: RuntimeScope;
}

export interface RegisterRuntimeModelCommand {
  modelId: string;
  version: string;
  provider: string;
  capabilityTags: readonly string[];
  costWeight: number;
  evalStatusRef: RuntimeRecordRef;
  registeredBy: "deploy";
}

export interface RegisterRuntimeModelResult {
  model: RuntimeModel;
}

export type GetRuntimeModelInput = RuntimeModelRef;

export interface SetRuntimeModelAvailabilityCommand extends RuntimeModelRef {
  available: boolean;
}

export interface ConfigureRuntimeModelRouteCommand {
  routeKey: RuntimeModelRouteKey;
  preferredModel: RuntimeModelRef;
  fallbackModels?: readonly RuntimeModelRef[];
  requiredCapabilityTags: readonly string[];
  configuredBy: "prd-15-release-gate";
  version: string;
}

export interface ConfigureRuntimeModelRouteResult {
  route: RuntimeModelRoute;
}

export interface ConfigureRuntimeGatePolicyCommand {
  tenantId: string;
  objectType: string;
  fourEyes: boolean;
  configuredBy: RuntimeInitiator;
  configuredAt?: string | Date;
}

export interface GetRuntimeGatePolicyInput {
  tenantId: string;
  objectType: string;
}

export interface RouteRuntimeModelCommand {
  routeKey: RuntimeModelRouteKey;
}

export interface RouteRuntimeModelResult {
  route: RuntimeModelRoute;
  model: RuntimeModel;
  failover: boolean;
}

export interface SubmitRuntimeCompositeChildCommand {
  key: string;
  kind: Exclude<RuntimeJobKind, "composite">;
  scope?: Partial<RuntimeScope>;
  planRef?: RuntimeRecordRef | null;
  priorityLane?: RuntimePriorityLane;
  dependsOn?: string[];
}

export interface SubmitRuntimeCompositeJobCommand {
  tenantId: string;
  idempotencyKey: string;
  planRef: RuntimeRecordRef;
  initiator: RuntimeInitiator;
  scope?: Partial<RuntimeScope>;
  priorityLane?: RuntimePriorityLane;
  failFast?: boolean;
  childJobs: SubmitRuntimeCompositeChildCommand[];
}

export interface SubmitRuntimeCompositeJobResult {
  job: RuntimeJob;
  children: Array<{
    key: string;
    dependsOn: string[];
    job: RuntimeJob;
  }>;
}

export interface CompileRuntimePlanCommand {
  tenantId: string;
  idempotencyKey: string;
  kind?: Extract<RuntimeJobKind, "agent" | "composite">;
  initiator: RuntimeInitiator;
  scope?: Partial<RuntimeScope>;
  intentRestated: string;
  steps: Array<{
    action: string;
    scope?: Partial<RuntimeScope>;
    toolClass: RuntimePlanToolClass;
  }>;
  invalidationsPreview?: RuntimePlanPreviewItem[];
  produces?: RuntimePlanPreviewItem[];
  estDurationMs: number;
  costClass: RuntimeCostClass;
  instructionEcho?: string;
  permissionVerdict: RuntimePlanPermissionVerdict;
  source: {
    kind: RuntimePlanSourceKind;
    ref?: string | null;
  };
}

export interface CompileRuntimePlanResult {
  plan: RuntimePlan;
}

export interface EditRuntimePlanCommand {
  tenantId: string;
  planId: string;
  idempotencyKey: string;
  scope?: Partial<RuntimeScope>;
  intentRestated?: string;
  steps?: Array<{
    action: string;
    scope?: Partial<RuntimeScope>;
    toolClass: RuntimePlanToolClass;
  }>;
  invalidationsPreview?: RuntimePlanPreviewItem[];
  produces?: RuntimePlanPreviewItem[];
  estDurationMs?: number;
  costClass?: RuntimeCostClass;
  instructionEcho?: string;
  permissionVerdict?: RuntimePlanPermissionVerdict;
  source?: {
    kind: RuntimePlanSourceKind;
    ref?: string | null;
  };
}

export interface EditRuntimePlanResult {
  plan: RuntimePlan;
  supersededPlan: RuntimePlan;
}

export interface RuntimePinSnapshot {
  corpusVersion?: number | null;
  rulepackVersions?: Record<string, string>;
  modelVersions?: Record<string, string>;
}

export interface ApproveRuntimePlanCommand {
  tenantId: string;
  planId: string;
  idempotencyKey: string;
  priorityLane?: RuntimePriorityLane;
  approvedAt?: string | Date;
  pins?: RuntimePinSnapshot;
}

export interface ApproveRuntimePlanResult {
  plan: RuntimePlan;
  job: RuntimeJob;
}

export interface RegisterRuntimeScheduleCommand {
  tenantId: string;
  idempotencyKey: string;
  owner: RuntimeInitiator;
  trigger: RuntimeScheduleTrigger;
  planTemplate: Partial<RuntimeSchedulePlanTemplate> &
    Omit<
      RuntimeSchedulePlanTemplate,
      | "scope"
      | "steps"
      | "invalidationsPreview"
      | "produces"
      | "instructionEcho"
      | "permissionVerdict"
      | "priorityLane"
    > & {
      scope?: Partial<RuntimeScope>;
      steps: Array<{ action: string; scope?: Partial<RuntimeScope>; toolClass: RuntimePlanToolClass }>;
      invalidationsPreview?: RuntimePlanPreviewItem[];
      produces?: RuntimePlanPreviewItem[];
      instructionEcho?: string;
      permissionVerdict?: RuntimePlanPermissionVerdict;
      priorityLane?: RuntimePriorityLane;
    };
  registeredAt?: string | Date;
}

export interface RegisterRuntimeScheduleResult {
  schedule: RuntimeSchedule;
}

export interface FireRuntimeScheduleCommand {
  tenantId: string;
  scheduleId: string;
  idempotencyKey: string;
  ownerCapabilityMap: RuntimeCapabilityMap;
  firedAt?: string | Date;
  pins?: RuntimePinSnapshot;
}

export interface FireRuntimeScheduleResult {
  decision: "scheduled" | "orphaned";
  schedule: RuntimeSchedule;
  orphan: RuntimeScheduleOrphan | null;
  plan: RuntimePlan | null;
  job: RuntimeJob | null;
}

export interface ReassignRuntimeScheduleCommand {
  tenantId: string;
  scheduleId: string;
  idempotencyKey: string;
  actor: RuntimeInitiator;
  newOwner: RuntimeInitiator;
  ownerCapabilityMap: RuntimeCapabilityMap;
  reassignedAt?: string | Date;
}

export interface ReassignRuntimeScheduleResult {
  schedule: RuntimeSchedule;
}

export interface ClaimNextRuntimeJobCommand {
  tenantId: string;
  idempotencyKey: string;
  workerId: string;
  lanes?: RuntimePriorityLane[];
  claimedAt?: string | Date;
  leaseMs?: number;
}

export interface ClaimNextRuntimeJobResult {
  job: RuntimeJob | null;
  claim: RuntimeJobClaim | null;
}

export interface ReleaseRuntimeJobClaimCommand {
  tenantId: string;
  claimId: string;
  idempotencyKey: string;
  releasedAt?: string | Date;
  reason: string;
}

export interface ReleaseRuntimeJobClaimResult {
  job: RuntimeJob;
  claim: RuntimeJobClaim;
}

export interface GetRuntimeScheduleInput {
  tenantId: string;
  scheduleId: string;
}

export interface ListRuntimeSchedulesInput {
  tenantId: string;
  status?: RuntimeScheduleStatus;
}

export interface RecordRuntimeStepCommand {
  tenantId: string;
  jobId: string;
  stepId: string;
  type: RuntimeStepType;
  toolName?: string | null;
  readRefs?: RuntimeRecordRef[];
  modelIO?: RuntimeModelIORefs;
  argsRef?: RuntimeRecordRef | null;
  resultRef?: RuntimeRecordRef | null;
  t0?: string | Date | null;
  t1?: string | Date | null;
  cost?: Record<string, unknown>;
}

export interface RecordRuntimeStepResult {
  job: RuntimeJob;
  step: RuntimeStep;
}

export interface TransitionRuntimeJobCommand {
  tenantId: string;
  jobId: string;
  status: RuntimeJobStatus;
  transitionedAt?: string | Date;
  failure?: RuntimeFailure | null;
}

export interface TransitionRuntimeJobResult {
  job: RuntimeJob;
  manifest?: RuntimeManifestRegistration | null;
}

export interface RaiseRuntimeBudgetCommand {
  tenantId: string;
  jobId: string;
  idempotencyKey: string;
  approvedBy: RuntimeInitiator;
  reason: string;
  budget: RuntimeBudgetPatch;
  approvedAt?: string | Date;
}

export interface RaiseRuntimeBudgetResult {
  job: RuntimeJob;
  budgetRaise: RuntimeBudgetRaise;
}

export interface ConfigureRuntimeTenantBudgetGuardCommand {
  tenantId: string;
  maxConcurrentRunningJobs?: number | null;
  monthlyCostWeightCeiling?: number | null;
}

export interface GetRuntimeTenantBudgetGuardInput {
  tenantId: string;
}

export interface RecordRuntimeFailureCommand {
  tenantId: string;
  jobId: string;
  toolName?: string | null;
  failure: RuntimeFailure;
  occurredAt?: string | Date;
  diagnostics?: string | null;
}

export interface RecordRuntimeFailureResult {
  decision: "retry" | "failed" | "poisoned";
  job: RuntimeJob;
  nextRetryAt: string | null;
  poisonEntry: RuntimePoisonQueueEntry | null;
}

export interface RecordRuntimeStagingWriteCommand {
  tenantId: string;
  jobId: string;
  idempotencyKey: string;
  outputRef: RuntimeRecordRef;
  stagedRef: RuntimeRecordRef;
  outputHash?: string | null;
  promotion?: {
    proposedValue: Record<string, unknown>;
    lens: RecordLens;
    slaDue: string | Date;
    requestedAt?: string | Date;
  };
  writtenAt?: string | Date;
}

export interface RecordRuntimeStagingWriteResult {
  write: RuntimeStagingWrite;
  stagingObject?: RecordStagingObject;
  gate?: RecordGate;
  replayed: boolean;
}

export interface DecideRuntimeGateCommand {
  tenantId: string;
  jobId: string;
  gateId: string;
  idempotencyKey: string;
  actor: RuntimeInitiator;
  decision: "approved" | "rejected";
  reason?: string;
  decidedAt?: string | Date;
}

export interface DecideRuntimeGateResult {
  job: RuntimeJob;
  decision: DecideGateResult;
}

export interface DecideRuntimeGateBatchCommand {
  tenantId: string;
  jobId: string;
  gateIds: string[];
  idempotencyKey: string;
  actor: RuntimeInitiator;
  decision: "approved" | "rejected";
  reason?: string;
  decidedAt?: string | Date;
  confirmation: {
    gateIds: string[];
    objectType: string;
    diffFields: string[];
  };
}

export interface DecideRuntimeGateBatchResult {
  job: RuntimeJob;
  decisions: DecideGateResult[];
}

export interface DelegateRuntimeGateCommand {
  tenantId: string;
  jobId: string;
  gateId: string;
  idempotencyKey: string;
  actor: RuntimeInitiator;
  delegatedTo: string;
  delegatedAt?: string | Date;
  expiresAt?: string | Date | null;
  reason?: string | null;
}

export interface DelegateRuntimeGateResult {
  job: RuntimeJob;
  delegation: DelegateGateResult;
}

export interface EscalateRuntimeGateCommand {
  tenantId: string;
  jobId: string;
  gateId: string;
  idempotencyKey: string;
  actor: RuntimeInitiator;
  escalatedTo: string;
  reason: string;
  escalatedAt?: string | Date;
}

export interface EscalateRuntimeGateResult {
  job: RuntimeJob;
  escalation: EscalateGateResult;
}

export interface EscalateOverdueRuntimeGatesCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RuntimeInitiator;
  asOf?: string | Date;
  escalationPath: string[];
  reason?: string | null;
}

export interface EscalateOverdueRuntimeGatesResult {
  inspectedGateCount: number;
  overdueGateCount: number;
  escalations: EscalateGateResult[];
}

export interface RequestRuntimeGateChangesCommand {
  tenantId: string;
  jobId: string;
  gateId: string;
  idempotencyKey: string;
  actor: RuntimeInitiator;
  comments: RuntimeGateChangeComment[];
  requestedAt?: string | Date;
}

export interface RequestRuntimeGateChangesResult {
  job: RuntimeJob;
  changeRequest: RuntimeGateChangeRequest;
}

export interface SetRuntimeKillSwitchCommand {
  tenantId: string;
  idempotencyKey: string;
  actor: RuntimeInitiator;
  scope: { kind: "tenant" } | { kind: "job-kind"; jobKind: RuntimeJobKind };
  enabled: boolean;
  reason: string;
  changedAt?: string | Date;
}

export interface SetRuntimeKillSwitchResult {
  switch: RuntimeKillSwitch;
}

export interface ListRuntimeKillSwitchesInput {
  tenantId: string;
}

export interface ConfigureRuntimeCircuitBreakerCommand {
  tenantId: string;
  toolName: string;
  failureThreshold: number;
  windowMs: number;
  cooldownMs?: number | null;
}

export interface GetRuntimeCircuitBreakerInput {
  tenantId: string;
  toolName: string;
}

export interface ResetRuntimeCircuitBreakerCommand {
  tenantId: string;
  toolName: string;
  resetAt?: string | Date;
}

export interface GetRuntimeRunInput {
  tenantId: string;
  jobId: string;
}

export interface ListRuntimeStagingWritesInput {
  tenantId: string;
  jobId: string;
}

export interface ListRuntimePoisonQueueInput {
  tenantId: string;
}

export interface ListRuntimeRunsInput {
  tenantId: string;
  status?: RuntimeJobStatus;
}

export interface ListRuntimeCostTelemetryInput {
  tenantId: string;
}

export interface GetRuntimePlanInput {
  tenantId: string;
  planId: string;
}

export interface GetRuntimeCompositeManifestInput {
  tenantId: string;
  jobId: string;
}

export interface ListRuntimePlansInput {
  tenantId: string;
  status?: RuntimePlanStatus;
}

export interface StreamRuntimeRunInput {
  tenantId: string;
  jobId: string;
  afterEventId?: string;
}

export interface StreamRuntimeRunResult {
  job: RuntimeJob;
  events: RuntimeEvent[];
}

export interface GetRuntimeOperationalMetricsInput {
  tenantId: string;
  asOf?: string | Date;
  killSwitchDrillWindowDays?: number;
}

export interface RuntimePlanFidelityMetrics {
  approvedPlanCount: number;
  editedBeforeApprovalCount: number;
  editedBeforeApprovalRate: number | null;
}

export interface RuntimeTraceCompletenessMetrics {
  completedExecutableRunCount: number;
  completedWithTraceCount: number;
  violationCount: number;
  rate: number | null;
}

export interface RuntimeGateLatencyMetrics {
  requestedGateCount: number;
  decidedGateCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
  escalatedGateCount: number;
  escalationRate: number | null;
}

export interface RuntimeCostClassMetrics extends RuntimeMeter {
  jobCount: number;
}

export interface RuntimeWatcherOrphanMetrics {
  orphanedCount: number;
  reassignedCount: number;
  averageResolutionMs: number | null;
}

export interface RuntimeKillSwitchDrillMetrics {
  windowDays: number;
  lastDrillAt: string | null;
  passed: boolean;
}

export interface RuntimeCanonicalWriteGuardMetrics {
  outsidePromotePathViolations: number;
}

export interface RuntimeOperationalMetrics {
  tenantId: string;
  asOf: string;
  planFidelity: RuntimePlanFidelityMetrics;
  traceCompleteness: RuntimeTraceCompletenessMetrics;
  gateLatency: RuntimeGateLatencyMetrics;
  costByClass: Record<RuntimeCostClass, RuntimeCostClassMetrics>;
  watcherOrphans: RuntimeWatcherOrphanMetrics;
  killSwitchDrill: RuntimeKillSwitchDrillMetrics;
  canonicalWriteGuard: RuntimeCanonicalWriteGuardMetrics;
}

export interface RuntimeService {
  submitInstruction(command: SubmitRuntimeInstructionCommand): SubmitRuntimeInstructionResult;
  approveInstruction(command: ApproveRuntimeInstructionCommand): ApproveRuntimeInstructionResult;
  retireInstruction(command: RetireRuntimeInstructionCommand): RetireRuntimeInstructionResult;
  getInstruction(input: GetRuntimeInstructionInput): RuntimeInstruction | null;
  listInstructions(input: ListRuntimeInstructionsInput): RuntimeInstruction[];
  composeInstructionSet(command: ComposeRuntimeInstructionSetCommand): RuntimeInstructionSet;
  registerModel(command: RegisterRuntimeModelCommand): RegisterRuntimeModelResult;
  getModel(input: GetRuntimeModelInput): RuntimeModel | null;
  listModels(): RuntimeModel[];
  configureModelRoute(command: ConfigureRuntimeModelRouteCommand): ConfigureRuntimeModelRouteResult;
  configureGatePolicy(command: ConfigureRuntimeGatePolicyCommand): RuntimeGatePolicy;
  getGatePolicy(input: GetRuntimeGatePolicyInput): RuntimeGatePolicy | null;
  routeModel(command: RouteRuntimeModelCommand): RouteRuntimeModelResult;
  setModelAvailability(command: SetRuntimeModelAvailabilityCommand): RuntimeModel;
  registerTool(command: RegisterRuntimeToolCommand): RegisterRuntimeToolResult;
  getTool(input: GetRuntimeToolInput): RuntimeTool | null;
  listTools(): RuntimeTool[];
  listAvailableToolsForJob(command: ListAvailableRuntimeToolsForJobCommand): RuntimeTool[];
  authorizeToolUse(command: AuthorizeRuntimeToolUseCommand): RuntimeToolAuthorization;
  compilePlan(command: CompileRuntimePlanCommand): CompileRuntimePlanResult;
  editPlan(command: EditRuntimePlanCommand): EditRuntimePlanResult;
  approvePlan(command: ApproveRuntimePlanCommand): ApproveRuntimePlanResult;
  registerSchedule(command: RegisterRuntimeScheduleCommand): RegisterRuntimeScheduleResult;
  fireSchedule(command: FireRuntimeScheduleCommand): FireRuntimeScheduleResult;
  reassignSchedule(command: ReassignRuntimeScheduleCommand): ReassignRuntimeScheduleResult;
  claimNextJob(command: ClaimNextRuntimeJobCommand): ClaimNextRuntimeJobResult;
  releaseJobClaim(command: ReleaseRuntimeJobClaimCommand): ReleaseRuntimeJobClaimResult;
  getSchedule(input: GetRuntimeScheduleInput): RuntimeSchedule | null;
  listSchedules(input: ListRuntimeSchedulesInput): RuntimeSchedule[];
  submitJob(command: SubmitRuntimeJobCommand): SubmitRuntimeJobResult;
  submitCompositeJob(command: SubmitRuntimeCompositeJobCommand): SubmitRuntimeCompositeJobResult;
  recordStep(command: RecordRuntimeStepCommand): RecordRuntimeStepResult;
  recordFailure(command: RecordRuntimeFailureCommand): RecordRuntimeFailureResult;
  recordStagingWrite(command: RecordRuntimeStagingWriteCommand): RecordRuntimeStagingWriteResult;
  decideGate(command: DecideRuntimeGateCommand): DecideRuntimeGateResult;
  decideGateBatch(command: DecideRuntimeGateBatchCommand): DecideRuntimeGateBatchResult;
  delegateGate(command: DelegateRuntimeGateCommand): DelegateRuntimeGateResult;
  escalateGate(command: EscalateRuntimeGateCommand): EscalateRuntimeGateResult;
  escalateOverdueGates(command: EscalateOverdueRuntimeGatesCommand): EscalateOverdueRuntimeGatesResult;
  requestGateChanges(command: RequestRuntimeGateChangesCommand): RequestRuntimeGateChangesResult;
  transitionJob(command: TransitionRuntimeJobCommand): TransitionRuntimeJobResult;
  raiseBudget(command: RaiseRuntimeBudgetCommand): RaiseRuntimeBudgetResult;
  configureTenantBudgetGuard(command: ConfigureRuntimeTenantBudgetGuardCommand): RuntimeTenantBudgetGuard;
  getTenantBudgetGuard(input: GetRuntimeTenantBudgetGuardInput): RuntimeTenantBudgetGuard | null;
  setKillSwitch(command: SetRuntimeKillSwitchCommand): SetRuntimeKillSwitchResult;
  listKillSwitches(input: ListRuntimeKillSwitchesInput): RuntimeKillSwitch[];
  configureCircuitBreaker(command: ConfigureRuntimeCircuitBreakerCommand): RuntimeCircuitBreaker;
  getCircuitBreaker(input: GetRuntimeCircuitBreakerInput): RuntimeCircuitBreaker | null;
  resetCircuitBreaker(command: ResetRuntimeCircuitBreakerCommand): RuntimeCircuitBreaker;
  getPlan(input: GetRuntimePlanInput): RuntimePlan | null;
  getCompositeManifest(input: GetRuntimeCompositeManifestInput): RuntimeCompositeManifest | null;
  listPlans(input: ListRuntimePlansInput): RuntimePlan[];
  listPoisonQueue(input: ListRuntimePoisonQueueInput): RuntimePoisonQueueEntry[];
  listCostTelemetry(input: ListRuntimeCostTelemetryInput): RuntimeCostTelemetryEntry[];
  listStagingWrites(input: ListRuntimeStagingWritesInput): RuntimeStagingWrite[];
  getRun(input: GetRuntimeRunInput): RuntimeJob | null;
  listRuns(input: ListRuntimeRunsInput): RuntimeJob[];
  streamRun(input: StreamRuntimeRunInput): StreamRuntimeRunResult;
  getOperationalMetrics(input: GetRuntimeOperationalMetricsInput): RuntimeOperationalMetrics;
}

export class RuntimeError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.details = details;
  }
}

interface RuntimeStore {
  recordService: NonNullable<CreateRuntimeServiceOptions["record"]> | null;
  toolsByName: Map<string, RuntimeTool>;
  modelsByKey: Map<string, RuntimeModel>;
  modelRoutesByKey: Map<RuntimeModelRouteKey, RuntimeModelRoute>;
  gatePoliciesByTenant: Map<string, Map<string, RuntimeGatePolicy>>;
  instructionsByTenant: Map<string, RuntimeInstruction[]>;
  instructionEventsByTenant: Map<string, RuntimeInstructionEvent[]>;
  jobsByTenant: Map<string, RuntimeJob[]>;
  plansByTenant: Map<string, RuntimePlan[]>;
  schedulesByTenant: Map<string, RuntimeSchedule[]>;
  scheduleOrphanResolutionsByTenant: Map<string, RuntimeScheduleOrphanResolution[]>;
  jobClaimsByTenant: Map<string, RuntimeJobClaim[]>;
  poisonQueueByTenant: Map<string, RuntimePoisonQueueEntry[]>;
  costTelemetryByTenant: Map<string, RuntimeCostTelemetryEntry[]>;
  tenantBudgetGuards: Map<string, RuntimeTenantBudgetGuard>;
  killSwitchesByTenant: Map<string, RuntimeKillSwitch[]>;
  killSwitchChangesByTenant: Map<string, RuntimeKillSwitch[]>;
  circuitBreakersByTenant: Map<string, Map<string, RuntimeCircuitBreaker>>;
  toolAuthorizationTimesByTenant: Map<string, Map<string, string[]>>;
  gateChangeRequestsByTenant: Map<string, RuntimeGateChangeRequest[]>;
  eventsByTenant: Map<string, RuntimeEvent[]>;
  stagingWritesByDedupeKey: Map<string, RuntimeStagingWrite>;
  jobCommands: Map<string, { fingerprint: string; result: SubmitRuntimeJobResult }>;
  compositeCommands: Map<string, { fingerprint: string; result: SubmitRuntimeCompositeJobResult }>;
  budgetCommands: Map<string, { fingerprint: string; result: RaiseRuntimeBudgetResult }>;
  instructionCommands: Map<string, { fingerprint: string; result: RuntimeInstructionCommandResult }>;
  gateCommands: Map<
    string,
    {
      fingerprint: string;
      result:
        | DecideRuntimeGateResult
        | DecideRuntimeGateBatchResult
        | DelegateRuntimeGateResult
        | EscalateRuntimeGateResult
        | EscalateOverdueRuntimeGatesResult
        | RequestRuntimeGateChangesResult;
    }
  >;
  killSwitchCommands: Map<string, { fingerprint: string; result: SetRuntimeKillSwitchResult }>;
  stagingWriteResultsByDedupeKey: Map<string, Omit<RecordRuntimeStagingWriteResult, "replayed">>;
  planCommands: Map<
    string,
    { fingerprint: string; result: CompileRuntimePlanResult | EditRuntimePlanResult | ApproveRuntimePlanResult }
  >;
  scheduleCommands: Map<
    string,
    { fingerprint: string; result: RegisterRuntimeScheduleResult | FireRuntimeScheduleResult | ReassignRuntimeScheduleResult }
  >;
  claimCommands: Map<
    string,
    { fingerprint: string; result: ClaimNextRuntimeJobResult | ReleaseRuntimeJobClaimResult }
  >;
}

export function createRuntimeService(options: CreateRuntimeServiceOptions = {}): RuntimeService {
  const store: RuntimeStore = {
    recordService: options.record ?? null,
    toolsByName: new Map(),
    modelsByKey: new Map(),
    modelRoutesByKey: new Map(),
    gatePoliciesByTenant: new Map(),
    instructionsByTenant: new Map(),
    instructionEventsByTenant: new Map(),
    jobsByTenant: new Map(),
    plansByTenant: new Map(),
    schedulesByTenant: new Map(),
    scheduleOrphanResolutionsByTenant: new Map(),
    jobClaimsByTenant: new Map(),
    poisonQueueByTenant: new Map(),
    costTelemetryByTenant: new Map(),
    tenantBudgetGuards: new Map(),
    killSwitchesByTenant: new Map(),
    killSwitchChangesByTenant: new Map(),
    circuitBreakersByTenant: new Map(),
    toolAuthorizationTimesByTenant: new Map(),
    gateChangeRequestsByTenant: new Map(),
    eventsByTenant: new Map(),
    stagingWritesByDedupeKey: new Map(),
    jobCommands: new Map(),
    compositeCommands: new Map(),
    budgetCommands: new Map(),
    instructionCommands: new Map(),
    gateCommands: new Map(),
    killSwitchCommands: new Map(),
    stagingWriteResultsByDedupeKey: new Map(),
    planCommands: new Map(),
    scheduleCommands: new Map(),
    claimCommands: new Map(),
  };
  RUNTIME_DEFAULT_TOOLS.forEach((tool) => {
    registerRuntimeTool(store, tool);
  });
  RUNTIME_DEFAULT_MODELS.forEach((model) => {
    registerRuntimeModel(store, model);
  });
  RUNTIME_DEFAULT_MODEL_ROUTES.forEach((route) => {
    configureRuntimeModelRoute(store, route);
  });

  return {
    submitInstruction(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const author = normalizeInitiator(command.author);
      const text = normalizeInstructionText(command.text);
      const scope = normalizeInstructionScope(command.scope);
      const submittedAt =
        command.submittedAt === undefined ? null : normalizeRequiredTimestamp(command.submittedAt, "submittedAt");
      const approvalSlaDue =
        command.approvalSlaDue === undefined
          ? null
          : normalizeRequiredTimestamp(command.approvalSlaDue, "approvalSlaDue");
      const conflictingAssertions = uniqueRecordRefs(
        (command.conflictingAssertions ?? []).map((ref) => normalizeRecordRef(ref)),
      );
      const compiled = compileRuntimeInstruction(text);
      const tier = classifyInstructionTier(text, compiled);
      const fingerprint = stableStringify({
        tenantId,
        author,
        text,
        scope,
        submittedAt,
        approvalSlaDue,
        conflictingAssertions,
      });
      const commandKey = `${tenantId}:instruction:submit:${idempotencyKey}`;
      const existing = store.instructionCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as SubmitRuntimeInstructionResult;
      }

      const occurredAt = submittedAt ?? new Date().toISOString();

      if (conflictingAssertions.length > 0) {
        const refusal = deepFreeze({
          reason: "fact-conflict" as const,
          conflictingAssertions,
          remedy: "To state this, the Record must change through a governed edit.",
        });
        const event = emitInstructionEvent(store, tenantId, "instruction.refused", occurredAt, {
          tier,
          scope,
          text,
          refusal,
        });
        const result = deepFreeze({
          instruction: null,
          refusal,
          event,
          shadowedInstructions: [],
          approvalGate: null,
          approvalStagingObject: null,
        });

        store.instructionCommands.set(commandKey, { fingerprint, result });
        return result;
      }

      if (compiled.confidence < 0.7) {
        const refusal = deepFreeze({
          reason: "low-confidence" as const,
          conflictingAssertions: [],
          remedy: "Clarify the instruction so the compiler can assign a typed target before approval.",
        });
        const event = emitInstructionEvent(store, tenantId, "instruction.refused", occurredAt, {
          tier,
          scope,
          text,
          compiled,
          refusal,
        });
        const result = deepFreeze({
          instruction: null,
          refusal,
          event,
          shadowedInstructions: [],
          approvalGate: null,
          approvalStagingObject: null,
        });

        store.instructionCommands.set(commandKey, { fingerprint, result });
        return result;
      }

      const shadowedInstructions = findRuntimeInstructionShadowPreview(store, tenantId, tier, scope);
      const superseded =
        tier === "methodology"
          ? null
          : supersedeIdenticalInstructionScope(store, tenantId, tier, scope, occurredAt);
      const instructionId = createRuntimeUlid();
      const instructionRef = stringifyRuntimeRef({ objectType: "instruction", objectId: instructionId });
      const instruction = deepFreeze({
        tenantId,
        instructionId,
        instructionRef,
        tier,
        scope,
        text,
        compiled,
        status: tier === "methodology" ? ("draft" as const) : ("active" as const),
        author,
        approvals: [],
        approvalGateRef: null,
        approvalStagingRef: null,
        supersedesInstructionId: superseded?.instructionId ?? null,
        refusal: null,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
      const approvalGateRequest =
        tier === "methodology" && store.recordService
          ? requestRuntimeInstructionApprovalGate(
              store,
              instruction,
              occurredAt,
              approvalSlaDue ?? defaultRuntimeInstructionApprovalSlaDue(occurredAt),
            )
          : null;
      const storedInstruction = approvalGateRequest
        ? deepFreeze({
            ...instruction,
            approvalGateRef: deepFreeze({
              objectType: "gate",
              objectId: approvalGateRequest.gate.gateId,
            }),
            approvalStagingRef: deepFreeze({
              objectType: "staging_object",
              objectId: approvalGateRequest.stagingObject.stagingId,
            }),
          })
        : instruction;
      const event = emitInstructionEvent(store, tenantId, "instruction.submitted", occurredAt, {
        instructionRef: storedInstruction.instructionRef,
        tier,
        status: storedInstruction.status,
        supersedesInstructionRef: superseded?.instructionRef ?? null,
        shadowedInstructionRefs: shadowedInstructions.map((instruction) => instruction.instructionRef),
        approvalGateRef: storedInstruction.approvalGateRef ? stringifyRuntimeRef(storedInstruction.approvalGateRef) : null,
      });
      const result = deepFreeze({
        instruction: storedInstruction,
        refusal: null,
        event,
        shadowedInstructions,
        approvalGate: approvalGateRequest?.gate ?? null,
        approvalStagingObject: approvalGateRequest?.stagingObject ?? null,
      });

      store.instructionsByTenant.set(tenantId, [
        ...(store.instructionsByTenant.get(tenantId) ?? []),
        storedInstruction,
      ]);
      store.instructionCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    approveInstruction(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.instructionId, "instructionId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const approvedBy = normalizeInitiator(command.approvedBy);
      const approvedAt = normalizeRequiredTimestamp(command.approvedAt ?? new Date(), "approvedAt");
      const requestedGateId = command.gateId === undefined ? null : normalizeGateId(command.gateId, "gateId");
      const fingerprint = stableStringify({
        tenantId,
        instructionId: command.instructionId,
        approvedBy,
        approvedAt,
        gateId: requestedGateId,
      });
      const commandKey = `${tenantId}:instruction:approve:${idempotencyKey}`;
      const existing = store.instructionCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as ApproveRuntimeInstructionResult;
      }

      const instruction = findRuntimeInstruction(store, tenantId, command.instructionId);

      if (!instruction) {
        throw new RuntimeError("INSTRUCTION_NOT_FOUND", "Runtime instruction was not found.", {
          tenantId,
          instructionId: command.instructionId,
        });
      }
      if (instruction.status !== "draft") {
        throw new RuntimeError("INSTRUCTION_NOT_APPROVABLE", "Only draft runtime instructions can be approved.", {
          instructionId: instruction.instructionId,
          status: instruction.status,
        });
      }
      if (requestedGateId && instruction.approvalGateRef?.objectId !== requestedGateId) {
        throw new RuntimeError("INSTRUCTION_GATE_MISMATCH", "Runtime instruction approval gate does not match.", {
          instructionId: instruction.instructionId,
          requestedGateId,
          approvalGateRef: instruction.approvalGateRef,
        });
      }

      const approvalGateDecision =
        instruction.approvalGateRef && store.recordService
          ? decideRuntimeInstructionApprovalGate(
              store,
              instruction,
              approvedBy,
              approvedAt,
              requestedGateId ?? instruction.approvalGateRef.objectId,
              idempotencyKey,
            )
          : null;

      const superseded = supersedeIdenticalInstructionScope(
        store,
        tenantId,
        instruction.tier,
        instruction.scope,
        approvedAt,
      );
      const approvedInstruction = deepFreeze({
        ...instruction,
        status: "active" as const,
        approvals: [
          ...instruction.approvals,
          deepFreeze({
            approvedBy,
            approvedAt,
          }),
        ],
        supersedesInstructionId: superseded?.instructionId ?? instruction.supersedesInstructionId,
        updatedAt: approvedAt,
      });
      const event = emitInstructionEvent(store, tenantId, "instruction.approved", approvedAt, {
        instructionRef: approvedInstruction.instructionRef,
        tier: approvedInstruction.tier,
        status: approvedInstruction.status,
        supersedesInstructionRef: superseded?.instructionRef ?? null,
        gate: {
          class: "methodology-instruction",
          verdict: "approved",
          ...(approvalGateDecision ? { gateId: approvalGateDecision.gate.gateId } : {}),
        },
      });
      const result = deepFreeze({
        instruction: approvedInstruction,
        event,
        approvalGate: approvalGateDecision?.gate ?? null,
        approvalStagingObject: approvalGateDecision?.stagingObject ?? null,
      });

      replaceRuntimeInstruction(store, approvedInstruction);
      store.instructionCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    retireInstruction(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.instructionId, "instructionId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const retiredBy = normalizeInitiator(command.retiredBy);
      const retiredAt = normalizeRequiredTimestamp(command.retiredAt ?? new Date(), "retiredAt");
      const reason = command.reason?.trim() || null;
      const fingerprint = stableStringify({
        tenantId,
        instructionId: command.instructionId,
        retiredBy,
        retiredAt,
        reason,
      });
      const commandKey = `${tenantId}:instruction:retire:${idempotencyKey}`;
      const existing = store.instructionCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as RetireRuntimeInstructionResult;
      }

      const instruction = findRuntimeInstruction(store, tenantId, command.instructionId);

      if (!instruction) {
        throw new RuntimeError("INSTRUCTION_NOT_FOUND", "Runtime instruction was not found.", {
          tenantId,
          instructionId: command.instructionId,
        });
      }
      if (instruction.status === "retired" || instruction.status === "superseded") {
        throw new RuntimeError("INSTRUCTION_NOT_RETIRABLE", "Runtime instruction is already inactive.", {
          instructionId: instruction.instructionId,
          status: instruction.status,
        });
      }

      const retiredInstruction = deepFreeze({
        ...instruction,
        status: "retired" as const,
        updatedAt: retiredAt,
      });
      const event = emitInstructionEvent(store, tenantId, "instruction.retired", retiredAt, {
        instructionRef: retiredInstruction.instructionRef,
        tier: retiredInstruction.tier,
        status: retiredInstruction.status,
        retiredBy,
        reason,
      });
      const result = deepFreeze({ instruction: retiredInstruction, event });

      replaceRuntimeInstruction(store, retiredInstruction);
      store.instructionCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    getInstruction(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      assertRuntimeUlid(input.instructionId, "instructionId");
      return findRuntimeInstruction(store, tenantId, input.instructionId);
    },

    listInstructions(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      const status = input.status === undefined ? null : normalizeInstructionStatus(input.status);
      return (store.instructionsByTenant.get(tenantId) ?? []).filter(
        (instruction) => !status || instruction.status === status,
      );
    },

    composeInstructionSet(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      return composeRuntimeInstructionSet(store, tenantId, normalizeScope(command.scope ?? {}));
    },

    registerModel(command) {
      return deepFreeze({ model: registerRuntimeModel(store, command) });
    },

    getModel(input) {
      return store.modelsByKey.get(createModelKey(normalizeModelRef(input))) ?? null;
    },

    listModels() {
      return Array.from(store.modelsByKey.values());
    },

    configureModelRoute(command) {
      return deepFreeze({ route: configureRuntimeModelRoute(store, command) });
    },

    configureGatePolicy(command) {
      return configureRuntimeGatePolicy(store, command);
    },

    getGatePolicy(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      const objectType = normalizeObjectType(input.objectType);
      return getRuntimeGatePolicy(store, tenantId, objectType);
    },

    routeModel(command) {
      return routeRuntimeModel(store, command);
    },

    setModelAvailability(command) {
      const ref = normalizeModelRef(command);
      const key = createModelKey(ref);
      const model = store.modelsByKey.get(key);

      if (!model) {
        throw new RuntimeError("MODEL_NOT_REGISTERED", "Runtime model is not registered.", { model: ref });
      }

      const updatedModel = deepFreeze({
        ...model,
        available: Boolean(command.available),
      });

      store.modelsByKey.set(key, updatedModel);
      return updatedModel;
    },

    configureTenantBudgetGuard(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const guard = deepFreeze({
        tenantId,
        maxConcurrentRunningJobs:
          command.maxConcurrentRunningJobs === undefined || command.maxConcurrentRunningJobs === null
            ? null
            : normalizePositiveInteger(command.maxConcurrentRunningJobs, "maxConcurrentRunningJobs"),
        monthlyCostWeightCeiling:
          command.monthlyCostWeightCeiling === undefined || command.monthlyCostWeightCeiling === null
            ? null
            : normalizeNonNegativeInteger(command.monthlyCostWeightCeiling, "monthlyCostWeightCeiling"),
      });

      store.tenantBudgetGuards.set(tenantId, guard);
      return guard;
    },

    getTenantBudgetGuard(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      return store.tenantBudgetGuards.get(tenantId) ?? null;
    },

    setKillSwitch(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const actor = normalizeInitiator(command.actor);
      const scope = normalizeKillSwitchScope(command.scope);
      const enabled = Boolean(command.enabled);
      const reason = normalizeRequiredText(command.reason, "reason");
      const changedAt = normalizeRequiredTimestamp(command.changedAt ?? new Date(), "changedAt");
      const fingerprint = stableStringify({
        tenantId,
        actor,
        scope,
        enabled,
        reason,
        changedAt,
      });
      const commandKey = `${tenantId}:kill_switch:${idempotencyKey}`;
      const existing = store.killSwitchCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result;
      }

      const killSwitch = deepFreeze({
        tenantId,
        scope,
        enabled,
        reason,
        actor,
        changedAt,
      });
      const switches = store.killSwitchesByTenant.get(tenantId) ?? [];
      const nextSwitches = [...switches.filter((candidate) => !sameKillSwitchScope(candidate.scope, scope)), killSwitch];
      const result = deepFreeze({ switch: killSwitch });

      store.killSwitchesByTenant.set(tenantId, nextSwitches);
      store.killSwitchChangesByTenant.set(tenantId, [...(store.killSwitchChangesByTenant.get(tenantId) ?? []), killSwitch]);
      store.killSwitchCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    listKillSwitches(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      return store.killSwitchesByTenant.get(tenantId) ?? [];
    },

    configureCircuitBreaker(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const toolName = normalizeToolName(command.toolName);
      if (!store.toolsByName.has(toolName)) {
        throw new RuntimeError("TOOL_NOT_REGISTERED", "Runtime tool is not registered.", { toolName });
      }

      const existing = getCircuitBreakerState(store, tenantId, toolName);
      const circuitBreaker = deepFreeze({
        tenantId,
        toolName,
        failureThreshold: normalizePositiveInteger(command.failureThreshold, "failureThreshold"),
        windowMs: normalizePositiveInteger(command.windowMs, "windowMs"),
        cooldownMs:
          command.cooldownMs === undefined || command.cooldownMs === null
            ? null
            : normalizePositiveInteger(command.cooldownMs, "cooldownMs"),
        state: existing?.state ?? ("closed" as const),
        recentFailures: existing?.recentFailures ?? 0,
        failureTimes: existing?.failureTimes ?? [],
        openedAt: existing?.openedAt ?? null,
        openUntil: existing?.openUntil ?? null,
      });

      setCircuitBreakerState(store, tenantId, toolName, circuitBreaker);
      return circuitBreaker;
    },

    getCircuitBreaker(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      const toolName = normalizeToolName(input.toolName);
      return getCircuitBreakerState(store, tenantId, toolName);
    },

    resetCircuitBreaker(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const toolName = normalizeToolName(command.toolName);
      const existing = getCircuitBreakerState(store, tenantId, toolName);
      if (!existing) {
        throw new RuntimeError("CIRCUIT_BREAKER_NOT_CONFIGURED", "Runtime circuit breaker is not configured.", {
          toolName,
        });
      }

      normalizeRequiredTimestamp(command.resetAt ?? new Date(), "resetAt");
      const reset = deepFreeze({
        ...existing,
        state: "closed" as const,
        recentFailures: 0,
        failureTimes: [],
        openedAt: null,
        openUntil: null,
      });

      setCircuitBreakerState(store, tenantId, toolName, reset);
      return reset;
    },

    registerTool(command) {
      return deepFreeze({ tool: registerRuntimeTool(store, command) });
    },

    getTool(input) {
      const name = normalizeToolName(input.name);
      return store.toolsByName.get(name) ?? null;
    },

    listTools() {
      return Array.from(store.toolsByName.values());
    },

    listAvailableToolsForJob(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      const capabilityMap = normalizeCapabilityMap(command.capabilityMap);

      const listedAt = normalizeRequiredTimestamp(command.asOf ?? new Date(), "asOf");

      return Array.from(store.toolsByName.values()).filter(
        (tool) => !isCircuitBreakerOpen(store, tenantId, tool.name, listedAt) && toolAvailableForJob(job, tool, capabilityMap),
      );
    },

    authorizeToolUse(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      const toolName = normalizeToolName(command.toolName);
      const tool = store.toolsByName.get(toolName) ?? null;
      const requestedScope = normalizeScope(command.requestedScope ?? {});
      const requestedSensitivity = normalizeSensitivityCeiling(command.requestedSensitivity ?? "confidential");
      const requestedAt = normalizeRequiredTimestamp(command.requestedAt ?? new Date(), "requestedAt");
      const capabilityMap = normalizeCapabilityMap(command.capabilityMap);
      const authorization = authorizeRuntimeToolUse(
        job,
        tool,
        requestedScope,
        requestedSensitivity,
        capabilityMap,
        tool ? isCircuitBreakerOpen(store, tenantId, tool.name, requestedAt) : false,
      );

      if (!authorization.allowed || !tool) {
        return authorization;
      }
      if (isRuntimeToolRateLimited(store, tenantId, tool, requestedAt)) {
        return toolAuthorization(false, "tool_rate_limited", tool, requestedScope);
      }

      recordRuntimeToolAuthorization(store, tenantId, tool, requestedAt);
      return authorization;
    },

    compilePlan(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const kind = normalizePlanJobKind(command.kind ?? "agent");
      const initiator = normalizeInitiator(command.initiator);
      const scope = normalizeScope(command.scope ?? {});
      const intentRestated = normalizeRequiredText(command.intentRestated, "intentRestated");
      const steps = normalizePlanSteps(command.steps);
      const invalidationsPreview = normalizePlanPreviewItems(command.invalidationsPreview ?? []);
      const produces = normalizePlanPreviewItems(command.produces ?? []);
      const estDurationMs = normalizeNonNegativeInteger(command.estDurationMs, "estDurationMs");
      const costClass = normalizeCostClass(command.costClass);
      const instructionEcho = command.instructionEcho?.trim() ?? "";
      const permissionVerdict = normalizePermissionVerdict(command.permissionVerdict);
      const source = normalizePlanSource(command.source);
      const fingerprint = stableStringify({
        tenantId,
        kind,
        initiator,
        scope,
        intentRestated,
        steps,
        invalidationsPreview,
        produces,
        estDurationMs,
        costClass,
        instructionEcho,
        permissionVerdict,
        source,
      });
      const commandKey = `${tenantId}:compile_plan:${idempotencyKey}`;
      const existing = store.planCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result;
      }

      const now = new Date().toISOString();
      const planId = createRuntimeUlid();
      const plan = deepFreeze({
        tenantId,
        planId,
        planRef: deepFreeze({ objectType: "plan", objectId: planId }),
        kind,
        initiator,
        scope,
        status: "compiled" as const,
        intentRestated,
        steps,
        invalidationsPreview,
        produces,
        estDurationMs,
        costClass,
        instructionEcho,
        permissionVerdict,
        source,
        supersedesPlanId: null,
        approvedJobId: null,
        createdAt: now,
        updatedAt: now,
      });
      const result = deepFreeze({ plan });

      store.plansByTenant.set(tenantId, [...(store.plansByTenant.get(tenantId) ?? []), plan]);
      store.planCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    editPlan(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.planId, "planId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const original = findRuntimePlanOrThrow(store, tenantId, command.planId);

      if (original.status !== "compiled") {
        throw new RuntimeError("PLAN_NOT_EDITABLE", "Only compiled plans can be edited.", {
          planId: original.planId,
          status: original.status,
        });
      }

      const scope = command.scope === undefined ? original.scope : normalizeScope(command.scope);
      const intentRestated =
        command.intentRestated === undefined
          ? original.intentRestated
          : normalizeRequiredText(command.intentRestated, "intentRestated");
      const steps = command.steps === undefined ? original.steps : normalizePlanSteps(command.steps);
      const invalidationsPreview =
        command.invalidationsPreview === undefined
          ? original.invalidationsPreview
          : normalizePlanPreviewItems(command.invalidationsPreview);
      const produces =
        command.produces === undefined ? original.produces : normalizePlanPreviewItems(command.produces);
      const estDurationMs =
        command.estDurationMs === undefined
          ? original.estDurationMs
          : normalizeNonNegativeInteger(command.estDurationMs, "estDurationMs");
      const costClass = command.costClass === undefined ? original.costClass : normalizeCostClass(command.costClass);
      const instructionEcho = command.instructionEcho === undefined ? original.instructionEcho : command.instructionEcho.trim();
      const permissionVerdict =
        command.permissionVerdict === undefined
          ? original.permissionVerdict
          : normalizePermissionVerdict(command.permissionVerdict);
      const source = command.source === undefined ? original.source : normalizePlanSource(command.source);
      const fingerprint = stableStringify({
        tenantId,
        planId: original.planId,
        scope,
        intentRestated,
        steps,
        invalidationsPreview,
        produces,
        estDurationMs,
        costClass,
        instructionEcho,
        permissionVerdict,
        source,
      });
      const commandKey = `${tenantId}:edit_plan:${idempotencyKey}`;
      const existing = store.planCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as EditRuntimePlanResult;
      }

      const now = new Date().toISOString();
      const supersededPlan = deepFreeze({
        ...original,
        status: "superseded" as const,
        updatedAt: now,
      });
      const planId = createRuntimeUlid();
      const plan = deepFreeze({
        ...original,
        planId,
        planRef: deepFreeze({ objectType: "plan", objectId: planId }),
        scope,
        status: "compiled" as const,
        intentRestated,
        steps,
        invalidationsPreview,
        produces,
        estDurationMs,
        costClass,
        instructionEcho,
        permissionVerdict,
        source,
        supersedesPlanId: original.planId,
        approvedJobId: null,
        createdAt: now,
        updatedAt: now,
      });
      const result = deepFreeze({ plan, supersededPlan });

      replaceRuntimePlan(store, supersededPlan);
      store.plansByTenant.set(tenantId, [...(store.plansByTenant.get(tenantId) ?? []), plan]);
      store.planCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    approvePlan(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.planId, "planId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const priorityLane = normalizePriorityLane(command.priorityLane ?? "standard");
      const pins = normalizePins(command.pins ?? {});
      const approvedAt = normalizeTimestamp(command.approvedAt ?? new Date(), "approvedAt");
      if (approvedAt === null) {
        throw new RuntimeError("INVALID_TIMESTAMP", "Runtime approvedAt is required.");
      }
      const fingerprint = stableStringify({
        tenantId,
        planId: command.planId,
        priorityLane,
        pins,
        approvedAt,
      });
      const commandKey = `${tenantId}:approve_plan:${idempotencyKey}`;
      const existing = store.planCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as ApproveRuntimePlanResult;
      }

      const plan = findRuntimePlanOrThrow(store, tenantId, command.planId);

      if (plan.status !== "compiled") {
        throw new RuntimeError("PLAN_NOT_APPROVABLE", "Only compiled plans can be approved.", {
          planId: plan.planId,
          status: plan.status,
        });
      }
      if (!plan.permissionVerdict.allowed) {
        throw new RuntimeError("PLAN_NOT_APPROVABLE", "Plan permission verdict does not allow approval.", {
          planId: plan.planId,
          reason: plan.permissionVerdict.reason,
        });
      }
      assertSchedulingAllowed(store, tenantId, plan.kind);

      const instructionSet = composeRuntimeInstructionSet(store, tenantId, plan.scope);
      const job = deepFreeze({
        tenantId,
        jobId: createRuntimeUlid(),
        parentJobId: null,
        kind: plan.kind,
        initiator: plan.initiator,
        scope: plan.scope,
        planRef: plan.planRef,
        manifestRef: null,
        instructionSet: {
          setHash: instructionSet.setHash,
          refs: instructionSet.refs,
        },
        pins,
        budget: createRuntimeBudget(plan.costClass),
        meter: initialRuntimeMeter(),
        idempotencyKey,
        priorityLane,
        steps: [],
        readPins: [],
        stagingWrites: [],
        composite: null,
        retry: initialRetryState(),
        status: "queued" as const,
        failure: null,
        createdAt: approvedAt,
        updatedAt: approvedAt,
      });
      const approvedPlan = deepFreeze({
        ...plan,
        status: "approved" as const,
        approvedJobId: job.jobId,
        updatedAt: approvedAt,
      });
      const result = deepFreeze({ plan: approvedPlan, job });

      replaceRuntimePlan(store, approvedPlan);
      store.jobsByTenant.set(tenantId, [...(store.jobsByTenant.get(tenantId) ?? []), job]);
      store.planCommands.set(commandKey, { fingerprint, result });
      emitRunEvent(store, job, "run.queued", approvedAt, {
        status: job.status,
        kind: job.kind,
        planRef: job.planRef,
      });

      return result;
    },

    registerSchedule(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const owner = normalizeInitiator(command.owner);
      const trigger = normalizeScheduleTrigger(command.trigger);
      const planTemplate = normalizeSchedulePlanTemplate(command.planTemplate);
      const registeredAt = normalizeRequiredTimestamp(command.registeredAt ?? new Date(), "registeredAt");
      const fingerprint = stableStringify({
        tenantId,
        owner,
        trigger,
        planTemplate,
        registeredAt,
      });
      const commandKey = `${tenantId}:schedule:register:${idempotencyKey}`;
      const existing = store.scheduleCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as RegisterRuntimeScheduleResult;
      }

      const scheduleId = createRuntimeUlid();
      const schedule = deepFreeze({
        tenantId,
        scheduleId,
        scheduleRef: deepFreeze({ objectType: "schedule", objectId: scheduleId }),
        owner,
        trigger,
        planTemplate,
        status: "active" as const,
        orphan: null,
        orphanedAt: null,
        lastFiredAt: null,
        lastJobId: null,
        createdAt: registeredAt,
        updatedAt: registeredAt,
      });
      const result = deepFreeze({ schedule });

      store.schedulesByTenant.set(tenantId, [...(store.schedulesByTenant.get(tenantId) ?? []), schedule]);
      store.scheduleCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    fireSchedule(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.scheduleId, "scheduleId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const ownerCapabilityMap = normalizeCapabilityMap(command.ownerCapabilityMap);
      const pins = normalizePins(command.pins ?? {});
      const firedAt = normalizeRequiredTimestamp(command.firedAt ?? new Date(), "firedAt");
      const fingerprint = stableStringify({
        tenantId,
        scheduleId: command.scheduleId,
        ownerCapabilityMap,
        pins,
        firedAt,
      });
      const commandKey = `${tenantId}:schedule:fire:${idempotencyKey}`;
      const existing = store.scheduleCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as FireRuntimeScheduleResult;
      }

      const schedule = findRuntimeSchedule(store, tenantId, command.scheduleId);
      if (schedule.status !== "active") {
        throw new RuntimeError("SCHEDULE_NOT_ACTIVE", "Only active schedules can be fired.", {
          scheduleId: schedule.scheduleId,
          status: schedule.status,
        });
      }

      if (!capabilityMapCoversScheduleTemplate(ownerCapabilityMap, schedule.planTemplate)) {
        const orphan = createScheduleOrphan(schedule.owner, firedAt);
        const orphanedSchedule = deepFreeze({
          ...schedule,
          status: "orphaned" as const,
          orphan,
          orphanedAt: firedAt,
          lastFiredAt: firedAt,
          lastJobId: null,
          updatedAt: firedAt,
        });
        const result = deepFreeze({
          decision: "orphaned" as const,
          schedule: orphanedSchedule,
          orphan,
          plan: null,
          job: null,
        });

        replaceRuntimeSchedule(store, orphanedSchedule);
        store.scheduleCommands.set(commandKey, { fingerprint, result });

        return result;
      }

      assertSchedulingAllowed(store, tenantId, schedule.planTemplate.kind);
      const { plan, job } = createScheduledPlanRun(store, schedule, idempotencyKey, pins, firedAt);
      const firedSchedule = deepFreeze({
        ...schedule,
        status: "active" as const,
        orphan: null,
        orphanedAt: null,
        lastFiredAt: firedAt,
        lastJobId: job.jobId,
        updatedAt: firedAt,
      });
      const result = deepFreeze({
        decision: "scheduled" as const,
        schedule: firedSchedule,
        orphan: null,
        plan,
        job,
      });

      replaceRuntimeSchedule(store, firedSchedule);
      store.scheduleCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    reassignSchedule(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.scheduleId, "scheduleId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const actor = normalizeInitiator(command.actor);
      const newOwner = normalizeInitiator(command.newOwner);
      const ownerCapabilityMap = normalizeCapabilityMap(command.ownerCapabilityMap);
      const reassignedAt = normalizeRequiredTimestamp(command.reassignedAt ?? new Date(), "reassignedAt");
      const fingerprint = stableStringify({
        tenantId,
        scheduleId: command.scheduleId,
        actor,
        newOwner,
        ownerCapabilityMap,
        reassignedAt,
      });
      const commandKey = `${tenantId}:schedule:reassign:${idempotencyKey}`;
      const existing = store.scheduleCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as ReassignRuntimeScheduleResult;
      }

      const schedule = findRuntimeSchedule(store, tenantId, command.scheduleId);
      if (!capabilityMapCoversScheduleTemplate(ownerCapabilityMap, schedule.planTemplate)) {
        throw new RuntimeError("SCHEDULE_OWNER_SCOPE_MISSING", "New schedule owner does not cover the template scope.", {
          scheduleId: schedule.scheduleId,
          actor,
          newOwner,
        });
      }

      if (schedule.status === "orphaned" && schedule.orphanedAt && schedule.orphan) {
        const resolutionMs = new Date(reassignedAt).getTime() - new Date(schedule.orphanedAt).getTime();
        if (resolutionMs < 0) {
          throw new RuntimeError("INVALID_TIMESTAMP", "Runtime schedule reassignment cannot precede orphaning.", {
            scheduleId: schedule.scheduleId,
            orphanedAt: schedule.orphanedAt,
            reassignedAt,
          });
        }
        const resolution = deepFreeze({
          tenantId,
          scheduleId: schedule.scheduleId,
          previousOwner: schedule.orphan.previousOwner,
          newOwner,
          orphanedAt: schedule.orphanedAt,
          reassignedAt,
          resolutionMs,
        });

        store.scheduleOrphanResolutionsByTenant.set(tenantId, [
          ...(store.scheduleOrphanResolutionsByTenant.get(tenantId) ?? []),
          resolution,
        ]);
      }

      const reassignedSchedule = deepFreeze({
        ...schedule,
        owner: newOwner,
        status: "active" as const,
        orphan: null,
        orphanedAt: null,
        updatedAt: reassignedAt,
      });
      const result = deepFreeze({ schedule: reassignedSchedule });

      replaceRuntimeSchedule(store, reassignedSchedule);
      store.scheduleCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    claimNextJob(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const workerId = normalizeRequiredText(command.workerId, "workerId");
      const lanes = normalizeClaimLanes(command.lanes);
      const claimedAt = normalizeRequiredTimestamp(command.claimedAt ?? new Date(), "claimedAt");
      const leaseMs =
        command.leaseMs === undefined ? 5 * 60 * 1000 : normalizePositiveInteger(command.leaseMs, "leaseMs");
      const fingerprint = stableStringify({
        tenantId,
        workerId,
        lanes,
        claimedAt,
        leaseMs,
      });
      const commandKey = `${tenantId}:claim_next_job:${idempotencyKey}`;
      const existing = store.claimCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as ClaimNextRuntimeJobResult;
      }

      assertTenantDispatchAllowed(store, tenantId);
      const job = findNextDispatchableJob(store, tenantId, lanes);
      if (!job) {
        const result = deepFreeze({ job: null, claim: null });
        store.claimCommands.set(commandKey, { fingerprint, result });
        return result;
      }

      const claimId = createRuntimeUlid();
      const leaseExpiresAt = new Date(new Date(claimedAt).getTime() + leaseMs).toISOString();
      const claim = deepFreeze({
        tenantId,
        claimId,
        jobId: job.jobId,
        workerId,
        lanes,
        status: "active" as const,
        claimedAt,
        leaseExpiresAt,
        startedAt: null,
        releasedAt: null,
        releaseReason: null,
      });
      const updatedJob = deepFreeze({
        ...job,
        status: "planning" as const,
        failure: null,
        updatedAt: claimedAt,
      });
      const result = deepFreeze({ job: updatedJob, claim });

      replaceRuntimeJob(store, updatedJob);
      store.jobClaimsByTenant.set(tenantId, [...(store.jobClaimsByTenant.get(tenantId) ?? []), claim]);
      emitRunEvent(store, updatedJob, "run.planning", claimedAt, {
        status: updatedJob.status,
        claimId,
        workerId,
        leaseExpiresAt,
      });
      refreshParentCompositeAfterChildTransition(store, updatedJob, claimedAt);
      store.claimCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    releaseJobClaim(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.claimId, "claimId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const releasedAt = normalizeRequiredTimestamp(command.releasedAt ?? new Date(), "releasedAt");
      const reason = normalizeRequiredText(command.reason, "reason");
      const fingerprint = stableStringify({
        tenantId,
        claimId: command.claimId,
        releasedAt,
        reason,
      });
      const commandKey = `${tenantId}:release_job_claim:${idempotencyKey}`;
      const existing = store.claimCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as ReleaseRuntimeJobClaimResult;
      }

      const claim = findRuntimeJobClaim(store, tenantId, command.claimId);
      if (claim.status !== "active") {
        throw new RuntimeError("CLAIM_NOT_RELEASABLE", "Only active job claims can be released.", {
          claimId: claim.claimId,
          status: claim.status,
        });
      }
      const job = findRuntimeJob(store, tenantId, claim.jobId);
      if (job.status !== "planning") {
        throw new RuntimeError("CLAIM_NOT_RELEASABLE", "Only unstarted planning runs can be released.", {
          claimId: claim.claimId,
          jobId: job.jobId,
          status: job.status,
        });
      }

      const releasedClaim = deepFreeze({
        ...claim,
        status: "released" as const,
        releasedAt,
        releaseReason: reason,
      });
      const updatedJob = deepFreeze({
        ...job,
        status: "queued" as const,
        failure: null,
        updatedAt: releasedAt,
      });
      const result = deepFreeze({ job: updatedJob, claim: releasedClaim });

      replaceRuntimeJob(store, updatedJob);
      replaceRuntimeJobClaim(store, releasedClaim);
      emitRunEvent(store, updatedJob, "run.queued", releasedAt, {
        status: updatedJob.status,
        claimId: claim.claimId,
        releaseReason: reason,
      });
      store.claimCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    submitJob(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const kind = normalizeJobKind(command.kind);
      const initiator = normalizeInitiator(command.initiator);
      const scope = normalizeScope(command.scope ?? {});
      const requestedPlanRef =
        command.planRef === undefined || command.planRef === null ? null : normalizeRecordRef(command.planRef);
      const planRef = normalizeJobPlanRef(kind, requestedPlanRef);
      const priorityLane = normalizePriorityLane(command.priorityLane ?? "standard");
      const fingerprint = stableStringify({
        tenantId,
        kind,
        initiator,
        scope,
        planRef,
        priorityLane,
      });
      const commandKey = `${tenantId}:submit_job:${idempotencyKey}`;
      const existing = store.jobCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result;
      }

      assertSchedulingAllowed(store, tenantId, kind);
      const now = new Date().toISOString();
      const job = deepFreeze({
        tenantId,
        jobId: createRuntimeUlid(),
        parentJobId: null,
        kind,
        initiator,
        scope,
        planRef,
        manifestRef: null,
        instructionSet: {
          setHash: null,
          refs: [],
        },
        pins: {
          corpusVersion: null,
          rulepackVersions: {},
          modelVersions: {},
        },
        budget: createRuntimeBudget(null),
        meter: initialRuntimeMeter(),
        idempotencyKey,
        priorityLane,
        steps: [],
        readPins: [],
        stagingWrites: [],
        composite: null,
        retry: initialRetryState(),
        status: "queued" as const,
        failure: null,
        createdAt: now,
        updatedAt: now,
      });
      const result = deepFreeze({ job });

      store.jobsByTenant.set(tenantId, [...(store.jobsByTenant.get(tenantId) ?? []), job]);
      store.jobCommands.set(commandKey, { fingerprint, result });
      emitRunEvent(store, job, "run.queued", now, {
        status: job.status,
        kind: job.kind,
        planRef: job.planRef,
      });

      return result;
    },

    submitCompositeJob(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const planRef = normalizeJobPlanRef("composite", normalizeRecordRef(command.planRef));
      const initiator = normalizeInitiator(command.initiator);
      const scope = normalizeScope(command.scope ?? {});
      const priorityLane = normalizePriorityLane(command.priorityLane ?? "standard");
      const failFast = command.failFast ?? false;
      const childSpecs = normalizeCompositeChildSpecs(command.childJobs, priorityLane);
      const fingerprint = stableStringify({
        tenantId,
        planRef,
        initiator,
        scope,
        priorityLane,
        failFast,
        childSpecs,
      });
      const commandKey = `${tenantId}:submit_composite_job:${idempotencyKey}`;
      const existing = store.compositeCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result;
      }

      assertSchedulingAllowed(store, tenantId, "composite");
      childSpecs.forEach((child) => assertSchedulingAllowed(store, tenantId, child.kind));
      const now = new Date().toISOString();
      const parentJobId = createRuntimeUlid();
      const children = childSpecs.map((child) => {
        const job = deepFreeze({
          tenantId,
          jobId: createRuntimeUlid(),
          parentJobId,
          kind: child.kind,
          initiator,
          scope: child.scope,
          planRef: child.planRef,
          manifestRef: null,
          instructionSet: {
            setHash: null,
            refs: [],
          },
          pins: {
            corpusVersion: null,
            rulepackVersions: {},
            modelVersions: {},
          },
          budget: createRuntimeBudget(null),
          meter: initialRuntimeMeter(),
          idempotencyKey: `${idempotencyKey}:${child.key}`,
          priorityLane: child.priorityLane,
          steps: [],
          readPins: [],
          stagingWrites: [],
          composite: null,
          retry: initialRetryState(),
          status: "queued" as const,
          failure: null,
          createdAt: now,
          updatedAt: now,
        });

        return deepFreeze({
          key: child.key,
          dependsOn: child.dependsOn,
          job,
        });
      });
      const childJobs = children.map((child) =>
        deepFreeze({ key: child.key, jobId: child.job.jobId, dependsOn: child.dependsOn }),
      );
      const manifest = createCompositeManifest(parentJobId, failFast, childJobs, children.map((child) => child.job));
      const parentJob = deepFreeze({
        tenantId,
        jobId: parentJobId,
        parentJobId: null,
        kind: "composite" as const,
        initiator,
        scope,
        planRef,
        manifestRef: null,
        instructionSet: {
          setHash: null,
          refs: [],
        },
        pins: {
          corpusVersion: null,
          rulepackVersions: {},
          modelVersions: {},
        },
        budget: createRuntimeBudget(null),
        meter: initialRuntimeMeter(),
        idempotencyKey,
        priorityLane,
        steps: childJobs.map((child) =>
          deepFreeze({
            stepId: `subjob-${child.key}`,
            type: "subjob" as const,
            argsRef: null,
            resultRef: deepFreeze({ objectType: "run", objectId: child.jobId }),
            t0: now,
            t1: null,
            cost: {},
          }),
        ),
        readPins: [],
        stagingWrites: [],
        composite: deepFreeze({
          failFast,
          childJobs,
          manifest,
        }),
        retry: initialRetryState(),
        status: "queued" as const,
        failure: null,
        createdAt: now,
        updatedAt: now,
      });
      const result = deepFreeze({ job: parentJob, children });

      store.jobsByTenant.set(tenantId, [
        ...(store.jobsByTenant.get(tenantId) ?? []),
        parentJob,
        ...children.map((child) => child.job),
      ]);
      store.compositeCommands.set(commandKey, { fingerprint, result });
      emitRunEvent(store, parentJob, "run.queued", now, {
        status: parentJob.status,
        kind: parentJob.kind,
        planRef: parentJob.planRef,
      });
      children.forEach((child) => {
        emitRunEvent(store, child.job, "run.queued", now, {
          status: child.job.status,
          kind: child.job.kind,
          parentJobId,
        });
      });

      return result;
    },

    recordStep(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      const job = findRuntimeJob(store, tenantId, command.jobId);

      if (isTerminalStatus(job.status)) {
        throw new RuntimeError("RUN_TERMINAL", "Runtime terminal runs cannot record new steps.", {
          jobId: job.jobId,
          status: job.status,
        });
      }

      const stepId = normalizeStepId(command.stepId);

      if (job.steps.some((step) => step.stepId === stepId)) {
        throw new RuntimeError("DUPLICATE_STEP", "Runtime step ids must be unique within a run.", {
          jobId: command.jobId,
          stepId,
        });
      }

      const type = normalizeStepType(command.type);
      const t0 = normalizeTimestamp(command.t0 ?? null, "t0");
      const t1 = normalizeTimestamp(command.t1 ?? null, "t1");
      const cost = normalizeStepCost(command.cost ?? {});
      const toolName = command.toolName === undefined || command.toolName === null ? null : normalizeToolName(command.toolName);
      const readRefs = normalizeReadRefs(command.readRefs ?? []);
      const modelIO = normalizeModelIORefs(command.modelIO, type);
      const step = deepFreeze({
        stepId,
        type,
        ...(toolName ? { toolName } : {}),
        ...(readRefs.length > 0 ? { readRefs } : {}),
        ...(modelIO ? { modelIO } : {}),
        argsRef: command.argsRef === undefined || command.argsRef === null ? null : normalizeRecordRef(command.argsRef),
        resultRef:
          command.resultRef === undefined || command.resultRef === null ? null : normalizeRecordRef(command.resultRef),
        t0,
        t1,
        cost,
      });
      const stepMeter = meterFromStep(step);
      const meter = addRuntimeMeters(job.meter, stepMeter);
      const occurredAt = step.t1 ?? step.t0 ?? new Date().toISOString();
      const readPins = readRefs.map((ref) =>
        deepFreeze({
          ref,
          version: ref.version,
          stepId,
          toolName,
          readAt: occurredAt,
        }),
      );
      const budgetExceeded =
        getBudgetExceededReason(job.budget, meter) ?? getTenantSpendExceededReason(store, tenantId, stepMeter);
      const updatedJob = deepFreeze({
        ...job,
        steps: [...job.steps, step],
        readPins: uniqueRuntimeReadPins([...job.readPins, ...readPins]),
        meter,
        ...(budgetExceeded
          ? {
              status: "budget-exceeded" as const,
              failure: deepFreeze({ class: "budget" as const, detailRef: null }),
            }
          : {}),
        updatedAt: budgetExceeded ? occurredAt : new Date().toISOString(),
      });

      replaceRuntimeJob(store, updatedJob);
      store.costTelemetryByTenant.set(tenantId, [
        ...(store.costTelemetryByTenant.get(tenantId) ?? []),
        createCostTelemetryEntry(updatedJob, step, occurredAt),
      ]);
      emitRunEvent(store, updatedJob, "run.step", occurredAt, {
        stepId: step.stepId,
        type: step.type,
        toolName: step.toolName ?? null,
        readRefs: step.readRefs ?? [],
        argsRef: step.argsRef,
        resultRef: step.resultRef,
        cost: step.cost,
      });
      if (budgetExceeded) {
        emitRunEvent(store, updatedJob, "run.budget_exceeded", occurredAt, {
          status: updatedJob.status,
          failure: updatedJob.failure,
          budgetExceeded,
          meter: updatedJob.meter,
        });
      }

      return deepFreeze({ job: updatedJob, step });
    },

    recordFailure(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      const job = findRuntimeJob(store, tenantId, command.jobId);

      if (isTerminalStatus(job.status)) {
        throw new RuntimeError("RUN_TERMINAL", "Runtime terminal runs cannot record failures.", {
          jobId: job.jobId,
          status: job.status,
        });
      }

      const failure = normalizeFailure(command.failure);
      const toolName = command.toolName === undefined || command.toolName === null ? null : normalizeToolName(command.toolName);
      const occurredAt = normalizeRequiredTimestamp(command.occurredAt ?? new Date(), "occurredAt");
      const diagnostics = command.diagnostics?.trim() || null;
      const policy = RUNTIME_RETRY_POLICIES[failure.class];

      if (toolName && (failure.class === "tool_error" || failure.class === "timeout")) {
        recordCircuitBreakerFailure(store, tenantId, toolName, occurredAt);
      }

      if (policy.maxAttempts > job.retry.attempts) {
        const attempts = job.retry.attempts + 1;
        const nextRetryAt = new Date(
          new Date(occurredAt).getTime() + policy.initialBackoffMs * policy.multiplier ** (attempts - 1),
        ).toISOString();
        const updatedJob = deepFreeze({
          ...job,
          status: "queued" as const,
          failure: null,
          retry: deepFreeze({
            attempts,
            nextRetryAt,
            lastFailure: failure,
            poisonEntryId: null,
          }),
          updatedAt: occurredAt,
        });

        replaceRuntimeJob(store, updatedJob);
        emitRunEvent(store, updatedJob, "run.queued", occurredAt, {
          status: updatedJob.status,
          retry: updatedJob.retry,
          diagnostics,
        });

        return deepFreeze({
          decision: "retry" as const,
          job: updatedJob,
          nextRetryAt,
          poisonEntry: null,
        });
      }

      const poisonEntry =
        policy.maxAttempts > 0
          ? deepFreeze({
              entryId: createRuntimeUlid(),
              tenantId,
              jobId: job.jobId,
              failure,
              attempts: job.retry.attempts,
              diagnostics,
              parkedAt: occurredAt,
            })
          : null;
      const updatedJob = deepFreeze({
        ...job,
        status: "failed" as const,
        failure,
        retry: deepFreeze({
          ...job.retry,
          nextRetryAt: null,
          lastFailure: failure,
          poisonEntryId: poisonEntry?.entryId ?? null,
        }),
        updatedAt: occurredAt,
      });

      replaceRuntimeJob(store, updatedJob);
      if (poisonEntry) {
        store.poisonQueueByTenant.set(tenantId, [...(store.poisonQueueByTenant.get(tenantId) ?? []), poisonEntry]);
      }
      emitRunEvent(store, updatedJob, "run.failed", occurredAt, {
        status: updatedJob.status,
        failure,
        diagnostics,
      });

      return deepFreeze({
        decision: poisonEntry ? ("poisoned" as const) : ("failed" as const),
        job: updatedJob,
        nextRetryAt: null,
        poisonEntry,
      });
    },

    recordStagingWrite(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const outputRef = normalizeRecordRef(command.outputRef);
      const stagedRef = normalizeRecordRef(command.stagedRef);
      const outputHash = normalizeOptionalOutputHash(command.outputHash ?? null);
      const promotion = command.promotion ? normalizePromotionRequest(command.promotion) : null;
      const writtenAt = normalizeRequiredTimestamp(command.writtenAt ?? new Date(), "writtenAt");

      if (job.status !== "producing" && !(job.status === "awaiting-gate" && promotion)) {
        throw new RuntimeError("INVALID_STAGING_WRITE", "Runtime staging writes are only allowed while producing.", {
          status: job.status,
        });
      }

      const dedupeKey = createStagingWriteDedupeKey(tenantId, job.jobId, idempotencyKey, outputRef);
      const existingResult = store.stagingWriteResultsByDedupeKey.get(dedupeKey);
      if (existingResult) {
        return deepFreeze({ ...existingResult, replayed: true });
      }
      const existing = store.stagingWritesByDedupeKey.get(dedupeKey);
      if (existing) {
        return deepFreeze({ write: existing, replayed: true });
      }

      const conflictingWrite = findRuntimeStagingWriteForOutput(store, job, outputRef);
      if (conflictingWrite) {
        const failure = deepFreeze({
          class: "conflict" as const,
          detailRef: deepFreeze({
            objectType: "staging_conflict",
            objectId: conflictingWrite.writeId,
          }),
        });
        const updatedJob = deepFreeze({
          ...job,
          status: "failed" as const,
          failure,
          retry: deepFreeze({
            ...job.retry,
            nextRetryAt: null,
            lastFailure: failure,
            poisonEntryId: null,
          }),
          updatedAt: writtenAt,
        });

        replaceRuntimeJob(store, updatedJob);
        emitRunEvent(store, updatedJob, "run.failed", writtenAt, {
          status: updatedJob.status,
          failure,
          outputRef: stringifyRuntimeRef(outputRef),
          existingWriteId: conflictingWrite.writeId,
          attemptedStagedRef: stringifyRuntimeRef(stagedRef),
        });

        throw new RuntimeError("STAGING_CONFLICT", "Runtime staging writes cannot compete for the same output ref.", {
          outputRef: stringifyRuntimeRef(outputRef),
          existingWriteId: conflictingWrite.writeId,
          attemptedStagedRef: stringifyRuntimeRef(stagedRef),
        });
      }

      const gateRequest = promotion
        ? requestRuntimePromotionGate(store, job, idempotencyKey, outputRef, promotion, writtenAt)
        : null;
      const write = deepFreeze({
        writeId: createRuntimeUlid(),
        tenantId,
        jobId: job.jobId,
        idempotencyKey,
        outputRef,
        stagedRef,
        outputHash,
        ...(gateRequest ? { stagingId: gateRequest.stagingObject.stagingId } : {}),
        ...(gateRequest ? { gateRef: deepFreeze({ objectType: "gate", objectId: gateRequest.gate.gateId }) } : {}),
        writtenAt,
      });
      const status = gateRequest ? ("awaiting-gate" as const) : job.status;
      const updatedJob = deepFreeze({
        ...job,
        stagingWrites: [...job.stagingWrites, write],
        status,
        updatedAt: writtenAt,
      });
      const result = deepFreeze({
        write,
        ...(gateRequest
          ? {
              stagingObject: gateRequest.stagingObject,
              gate: gateRequest.gate,
            }
          : {}),
      });

      store.stagingWritesByDedupeKey.set(dedupeKey, write);
      replaceRuntimeJob(store, updatedJob);
      store.stagingWriteResultsByDedupeKey.set(dedupeKey, result);
      if (gateRequest) {
        emitRunEvent(store, updatedJob, "gate.requested", gateRequest.gate.requestedAt, {
          gateId: gateRequest.gate.gateId,
          stagingId: gateRequest.stagingObject.stagingId,
          objectRef: stringifyRuntimeRef(gateRequest.gate.objectRef),
          slaDue: gateRequest.gate.slaDue,
        });
        emitRunEvent(store, updatedJob, "run.awaiting_gate", writtenAt, {
          status,
          gateId: gateRequest.gate.gateId,
          stagingId: gateRequest.stagingObject.stagingId,
        });
      }

      return deepFreeze({ ...result, replayed: false });
    },

    decideGate(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      assertRuntimeUlid(command.gateId, "gateId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const actor = normalizeInitiator(command.actor);
      const decision = normalizeGateDecision(command.decision);
      const reason = command.reason?.trim() || null;
      const decidedAt = normalizeRequiredTimestamp(command.decidedAt ?? new Date(), "decidedAt");
      const fingerprint = stableStringify({
        tenantId,
        jobId: command.jobId,
        gateId: command.gateId,
        actor,
        decision,
        reason,
        decidedAt,
      });
      const commandKey = `${tenantId}:gate:decide:${idempotencyKey}`;
      const existing = store.gateCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as DecideRuntimeGateResult;
      }

      assertRuntimeRecordGateService(store, "decideGate");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      const gate = findRuntimeGateForJob(store, job, command.gateId);

      assertRuntimeGatePolicyAllowsDecision(store, tenantId, gate, actor, decision);
      assertRuntimeRecordGateOpen(store, tenantId, command.gateId, {
        code: "GATE_NOT_OPEN",
        message: "Runtime gate is no longer open.",
      });

      const recordDecision = store.recordService.decideGate({
        tenantId,
        idempotencyKey,
        actor: runtimeInitiatorToRecordActor(actor),
        gateId: command.gateId,
        decision,
        ...(reason ? { reason } : {}),
        decidedAt,
      });
      const nextStatus = decision === "approved" ? ("producing" as const) : ("failed" as const);
      const updatedJob = deepFreeze({
        ...job,
        status: nextStatus,
        failure:
          decision === "approved"
            ? null
            : deepFreeze({ class: "validation" as const, detailRef: deepFreeze({ objectType: "gate", objectId: command.gateId }) }),
        updatedAt: decidedAt,
      });
      const result = deepFreeze({ job: updatedJob, decision: recordDecision });

      replaceRuntimeJob(store, updatedJob);
      emitRunEvent(store, updatedJob, "gate.decided", decidedAt, {
        gateId: command.gateId,
        decision,
        reason,
        status: updatedJob.status,
      });
      store.gateCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    decideGateBatch(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      const gateIds = normalizeGateIds(command.gateIds, "gateIds");
      const confirmedGateIds = normalizeGateIds(command.confirmation.gateIds, "confirmation.gateIds");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const actor = normalizeInitiator(command.actor);
      const decision = normalizeGateDecision(command.decision);
      const reason = command.reason?.trim() || null;
      const decidedAt = normalizeRequiredTimestamp(command.decidedAt ?? new Date(), "decidedAt");
      const confirmation = deepFreeze({
        gateIds: confirmedGateIds,
        objectType: normalizeObjectType(command.confirmation.objectType),
        diffFields: uniqueStrings(command.confirmation.diffFields ?? []),
      });
      const fingerprint = stableStringify({
        tenantId,
        jobId: command.jobId,
        gateIds,
        actor,
        decision,
        reason,
        decidedAt,
        confirmation,
      });
      const commandKey = `${tenantId}:gate:batch_decide:${idempotencyKey}`;
      const existing = store.gateCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as DecideRuntimeGateBatchResult;
      }

      assertRuntimeRecordGateService(store, "decideGateBatch");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      const gates = gateIds.map((gateId) => findRuntimeGateForJob(store, job, gateId));

      assertBatchGateConfirmation(gates, gateIds, confirmation);
      gates.forEach((gate) => assertRuntimeGatePolicyAllowsDecision(store, tenantId, gate, actor, decision));
      assertRuntimeRecordGatesOpenForBatch(store, tenantId, gateIds);

      const decisions = gateIds.map((gateId) =>
        store.recordService!.decideGate({
          tenantId,
          idempotencyKey: `${idempotencyKey}:${gateId}`,
          actor: runtimeInitiatorToRecordActor(actor),
          gateId,
          decision,
          ...(reason ? { reason } : {}),
          decidedAt,
        }),
      );
      const updatedJob = deepFreeze({
        ...job,
        status: decision === "approved" ? ("producing" as const) : ("failed" as const),
        failure:
          decision === "approved"
            ? null
            : deepFreeze({ class: "validation" as const, detailRef: deepFreeze({ objectType: "gate", objectId: gateIds[0] }) }),
        updatedAt: decidedAt,
      });
      const result = deepFreeze({ job: updatedJob, decisions });

      replaceRuntimeJob(store, updatedJob);
      gateIds.forEach((gateId) => {
        emitRunEvent(store, updatedJob, "gate.decided", decidedAt, {
          gateId,
          decision,
          reason,
          batch: true,
          status: updatedJob.status,
        });
      });
      store.gateCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    delegateGate(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      assertRuntimeUlid(command.gateId, "gateId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const actor = normalizeInitiator(command.actor);
      const delegatedTo = normalizeRequiredText(command.delegatedTo, "delegatedTo");
      const delegatedAt = normalizeRequiredTimestamp(command.delegatedAt ?? new Date(), "delegatedAt");
      const expiresAt =
        command.expiresAt === undefined || command.expiresAt === null
          ? null
          : normalizeRequiredTimestamp(command.expiresAt, "expiresAt");
      const reason = command.reason?.trim() || null;
      const fingerprint = stableStringify({
        tenantId,
        jobId: command.jobId,
        gateId: command.gateId,
        actor,
        delegatedTo,
        delegatedAt,
        expiresAt,
        reason,
      });
      const commandKey = `${tenantId}:gate:delegate:${idempotencyKey}`;
      const existing = store.gateCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as DelegateRuntimeGateResult;
      }

      assertRuntimeRecordGateService(store, "delegateGate");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      assertGateActionableForJob(store, job, command.gateId);
      assertRuntimeRecordGateOpen(store, tenantId, command.gateId, {
        code: "GATE_NOT_OPEN",
        message: "Runtime gate is no longer open.",
      });
      const delegation = store.recordService.delegateGate({
        tenantId,
        idempotencyKey,
        actor: runtimeInitiatorToRecordActor(actor),
        gateId: command.gateId,
        delegatedTo,
        delegatedAt,
        expiresAt,
        reason,
      });
      const result = deepFreeze({ job, delegation });

      emitRunEvent(store, job, "gate.delegated", delegatedAt, {
        gateId: command.gateId,
        delegatedTo,
        expiresAt,
        reason,
      });
      store.gateCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    escalateGate(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      assertRuntimeUlid(command.gateId, "gateId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const actor = normalizeInitiator(command.actor);
      const escalatedTo = normalizeRequiredText(command.escalatedTo, "escalatedTo");
      const reason = normalizeRequiredText(command.reason, "reason");
      const escalatedAt = normalizeRequiredTimestamp(command.escalatedAt ?? new Date(), "escalatedAt");
      const fingerprint = stableStringify({
        tenantId,
        jobId: command.jobId,
        gateId: command.gateId,
        actor,
        escalatedTo,
        reason,
        escalatedAt,
      });
      const commandKey = `${tenantId}:gate:escalate:${idempotencyKey}`;
      const existing = store.gateCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as EscalateRuntimeGateResult;
      }

      assertRuntimeRecordGateService(store, "escalateGate");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      assertGateActionableForJob(store, job, command.gateId);
      assertRuntimeRecordGateOpen(store, tenantId, command.gateId, {
        code: "GATE_NOT_OPEN",
        message: "Runtime gate is no longer open.",
      });
      const escalation = store.recordService.escalateGate({
        tenantId,
        idempotencyKey,
        actor: runtimeInitiatorToRecordActor(actor),
        gateId: command.gateId,
        escalatedTo,
        reason,
        escalatedAt,
      });
      const result = deepFreeze({ job, escalation });

      emitRunEvent(store, job, "gate.escalated", escalatedAt, {
        gateId: command.gateId,
        escalatedTo,
        reason,
      });
      store.gateCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    escalateOverdueGates(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const actor = normalizeInitiator(command.actor);
      const asOf = normalizeRequiredTimestamp(command.asOf ?? new Date(), "asOf");
      const escalationPath = normalizeEscalationPath(command.escalationPath);
      const reason = command.reason?.trim() || "SLA breached";
      const fingerprint = stableStringify({
        tenantId,
        actor,
        asOf,
        escalationPath,
        reason,
      });
      const commandKey = `${tenantId}:gate:escalate_overdue:${idempotencyKey}`;
      const existing = store.gateCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as EscalateOverdueRuntimeGatesResult;
      }

      assertRuntimeRecordGateService(store, "escalate overdue gates");
      const runtimeGates = store.recordService
        .listGates({ tenantId })
        .map((gate) => ({ gate, job: findRuntimeJobOwningGate(store, tenantId, gate.gateId) }))
        .filter((entry): entry is { gate: RecordGate; job: RuntimeJob } => entry.job !== null)
        .filter(({ job }) => !isTerminalStatus(job.status))
        .filter(({ gate, job }) => !hasRuntimeGateChangeRequest(store, job.tenantId, job.jobId, gate.gateId));
      const overdueGates = runtimeGates.filter(({ gate }) => isRuntimeGateOverdue(gate, asOf));
      const escalations: EscalateGateResult[] = [];

      overdueGates.forEach(({ gate, job }) => {
        const escalatedTo = escalationPath[gate.escalations.length];

        if (!escalatedTo) {
          return;
        }

        const escalation = store.recordService!.escalateGate({
          tenantId,
          idempotencyKey: `${idempotencyKey}:${gate.gateId}:${gate.escalations.length}`,
          actor: runtimeInitiatorToRecordActor(actor),
          gateId: gate.gateId,
          escalatedTo,
          reason,
          escalatedAt: asOf,
        });

        emitRunEvent(store, job, "gate.escalated", asOf, {
          gateId: gate.gateId,
          escalatedTo,
          reason,
        });
        escalations.push(escalation);
      });

      const result = deepFreeze({
        inspectedGateCount: runtimeGates.length,
        overdueGateCount: overdueGates.filter(({ gate }) => Boolean(escalationPath[gate.escalations.length])).length,
        escalations,
      });
      store.gateCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    requestGateChanges(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      assertRuntimeUlid(command.gateId, "gateId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const actor = normalizeInitiator(command.actor);
      const comments = normalizeGateChangeComments(command.comments);
      const requestedAt = normalizeRequiredTimestamp(command.requestedAt ?? new Date(), "requestedAt");
      const fingerprint = stableStringify({
        tenantId,
        jobId: command.jobId,
        gateId: command.gateId,
        actor,
        comments,
        requestedAt,
      });
      const commandKey = `${tenantId}:gate:request_changes:${idempotencyKey}`;
      const existing = store.gateCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result as RequestRuntimeGateChangesResult;
      }

      assertRuntimeRecordGateService(store, "requestGateChanges");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      assertGateBelongsToJob(job, command.gateId);
      if (job.status !== "awaiting-gate") {
        throw new RuntimeError("INVALID_GATE_CHANGE_REQUEST", "Gate change requests require a run awaiting a gate.", {
          status: job.status,
        });
      }
      assertRuntimeRecordGateOpen(store, tenantId, command.gateId, {
        code: "GATE_NOT_OPEN",
        message: "Runtime gate is no longer open.",
      });

      const changeRequest = deepFreeze({
        changeRequestId: createRuntimeUlid(),
        tenantId,
        jobId: job.jobId,
        gateId: command.gateId,
        requestedBy: actor,
        comments,
        requestedAt,
      });
      const updatedJob = deepFreeze({
        ...job,
        status: "producing" as const,
        failure: null,
        updatedAt: requestedAt,
      });
      const result = deepFreeze({ job: updatedJob, changeRequest });

      replaceRuntimeJob(store, updatedJob);
      store.gateChangeRequestsByTenant.set(tenantId, [
        ...(store.gateChangeRequestsByTenant.get(tenantId) ?? []),
        changeRequest,
      ]);
      emitRunEvent(store, updatedJob, "gate.changes_requested", requestedAt, {
        gateId: command.gateId,
        comments,
        status: updatedJob.status,
      });
      store.gateCommands.set(commandKey, { fingerprint, result });

      return result;
    },

    transitionJob(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      const job = findRuntimeJob(store, tenantId, command.jobId);
      const status = normalizeJobStatus(command.status);
      const failure = normalizeTransitionFailure(status, command.failure ?? null);

      assertTransitionAllowed(job.status, status);
      if (status === "running") {
        assertSchedulingAllowed(store, tenantId, job.kind);
        assertTenantConcurrencyAvailable(store, job);
      }
      if (status === "completed") {
        assertTraceComplete(job);
        assertNoOpenRuntimeRecordGatesForCompletion(store, job);
      }

      const updatedAt = normalizeTimestamp(command.transitionedAt ?? new Date(), "transitionedAt");
      if (updatedAt === null) {
        throw new RuntimeError("INVALID_TIMESTAMP", "Runtime transitionedAt is required.");
      }

      let updatedJob = deepFreeze({
        ...job,
        status,
        failure,
        updatedAt,
      });
      const manifest = status === "completed" ? registerRuntimeCompletionManifest(store, updatedJob, updatedAt) : null;

      if (manifest) {
        updatedJob = deepFreeze({
          ...updatedJob,
          manifestRef: deepFreeze({ objectType: "manifest", objectId: manifest.manifest.manifestId }),
        });
      }

      replaceRuntimeJob(store, updatedJob);
      if (status === "running") {
        markActiveClaimStarted(store, updatedJob, updatedAt);
      }
      emitRunEvent(store, updatedJob, getRunEventType(status), updatedAt, {
        status,
        failure,
        manifestRef: updatedJob.manifestRef,
      });
      refreshParentCompositeAfterChildTransition(store, updatedJob, updatedAt);

      return deepFreeze({ job: updatedJob, ...(manifest ? { manifest } : {}) });
    },

    raiseBudget(command) {
      const tenantId = normalizeTenantId(command.tenantId);
      assertRuntimeUlid(command.jobId, "jobId");
      const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
      const approvedBy = normalizeInitiator(command.approvedBy);
      const reason = normalizeRequiredText(command.reason, "reason");
      const requestedApprovedAt =
        command.approvedAt === undefined ? null : normalizeRequiredTimestamp(command.approvedAt, "approvedAt");
      const fingerprint = stableStringify({
        tenantId,
        jobId: command.jobId,
        approvedBy,
        reason,
        budget: command.budget,
        approvedAt: requestedApprovedAt,
      });
      const commandKey = `${tenantId}:raise_budget:${idempotencyKey}`;
      const existing = store.budgetCommands.get(commandKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError("IDEMPOTENCY_CONFLICT", "Runtime idempotency key was reused with different input.", {
            idempotencyKey,
          });
        }

        return existing.result;
      }

      const job = findRuntimeJob(store, tenantId, command.jobId);
      const approvedAt = requestedApprovedAt ?? new Date().toISOString();
      if (job.status !== "budget-exceeded") {
        throw new RuntimeError("BUDGET_NOT_RAISABLE", "Only budget-exceeded runs can be raised and retried.", {
          status: job.status,
        });
      }

      const budget = normalizeRaisedBudget(job.budget, command.budget, job.meter);
      const budgetRaise = deepFreeze({
        tenantId,
        jobId: job.jobId,
        approvedBy,
        previousBudget: job.budget,
        budget,
        reason,
        approvedAt,
      });
      const updatedJob = deepFreeze({
        ...job,
        budget,
        status: "queued" as const,
        failure: null,
        retry: deepFreeze({
          ...job.retry,
          nextRetryAt: null,
          lastFailure: job.failure,
          poisonEntryId: null,
        }),
        updatedAt: approvedAt,
      });
      const result = deepFreeze({ job: updatedJob, budgetRaise });

      replaceRuntimeJob(store, updatedJob);
      store.budgetCommands.set(commandKey, { fingerprint, result });
      emitRunEvent(store, updatedJob, "run.queued", approvedAt, {
        status: updatedJob.status,
        budgetRaise,
      });

      return result;
    },

    getRun(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      assertRuntimeUlid(input.jobId, "jobId");
      return (store.jobsByTenant.get(tenantId) ?? []).find((job) => job.jobId === input.jobId) ?? null;
    },

    listRuns(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      const status = input.status === undefined ? null : normalizeJobStatus(input.status);
      return (store.jobsByTenant.get(tenantId) ?? []).filter((job) => !status || job.status === status);
    },

    getPlan(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      assertRuntimeUlid(input.planId, "planId");
      return findRuntimePlan(store, tenantId, input.planId);
    },

    getSchedule(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      assertRuntimeUlid(input.scheduleId, "scheduleId");
      return findRuntimeScheduleOrNull(store, tenantId, input.scheduleId);
    },

    listSchedules(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      const status = input.status === undefined ? null : normalizeScheduleStatus(input.status);
      return (store.schedulesByTenant.get(tenantId) ?? []).filter((schedule) => !status || schedule.status === status);
    },

    getCompositeManifest(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      assertRuntimeUlid(input.jobId, "jobId");
      return findRuntimeJob(store, tenantId, input.jobId).composite?.manifest ?? null;
    },

    listPlans(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      const status = input.status === undefined ? null : normalizePlanStatus(input.status);
      return (store.plansByTenant.get(tenantId) ?? []).filter((plan) => !status || plan.status === status);
    },

    listPoisonQueue(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      return store.poisonQueueByTenant.get(tenantId) ?? [];
    },

    listCostTelemetry(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      return store.costTelemetryByTenant.get(tenantId) ?? [];
    },

    getOperationalMetrics(input) {
      return getRuntimeOperationalMetrics(store, input);
    },

    listStagingWrites(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      assertRuntimeUlid(input.jobId, "jobId");
      return findRuntimeJob(store, tenantId, input.jobId).stagingWrites;
    },

    streamRun(input) {
      const tenantId = normalizeTenantId(input.tenantId);
      assertRuntimeUlid(input.jobId, "jobId");
      const job = findRuntimeJob(store, tenantId, input.jobId);
      const events = (store.eventsByTenant.get(tenantId) ?? []).filter((event) => event.jobId === input.jobId);

      if (!input.afterEventId) {
        return deepFreeze({ job, events });
      }

      const afterIndex = events.findIndex((event) => event.eventId === input.afterEventId);
      return deepFreeze({
        job,
        events: afterIndex === -1 ? events : events.slice(afterIndex + 1),
      });
    },
  };
}

function normalizeTenantId(value: string) {
  if (!value?.trim()) {
    throw new RuntimeError("INVALID_TENANT", "Runtime tenantId is required.");
  }
  return value.trim();
}

function normalizeIdempotencyKey(value: string) {
  if (!value?.trim()) {
    throw new RuntimeError("IDEMPOTENCY_KEY_REQUIRED", "Runtime commands require an idempotency key.");
  }
  return value.trim();
}

function normalizeJobKind(value: RuntimeJobKind) {
  if (!RUNTIME_JOB_KINDS.includes(value)) {
    throw new RuntimeError("INVALID_JOB_KIND", "Runtime job kind is invalid.", { kind: value });
  }
  return value;
}

function normalizeKillSwitchScope(scope: SetRuntimeKillSwitchCommand["scope"]): RuntimeKillSwitchScope {
  if (!scope || scope.kind === "tenant") {
    return deepFreeze({ kind: "tenant" as const, jobKind: null });
  }
  if (scope.kind === "job-kind") {
    return deepFreeze({ kind: "job-kind" as const, jobKind: normalizeJobKind(scope.jobKind) });
  }

  throw new RuntimeError("INVALID_KILL_SWITCH", "Runtime kill switch scope is invalid.", { scope });
}

function sameKillSwitchScope(left: RuntimeKillSwitchScope, right: RuntimeKillSwitchScope) {
  return left.kind === right.kind && left.jobKind === right.jobKind;
}

function assertSchedulingAllowed(store: RuntimeStore, tenantId: string, jobKind: RuntimeJobKind) {
  const killSwitch = findActiveKillSwitch(store, tenantId, jobKind);
  if (!killSwitch) return;

  throw new RuntimeError("RUNTIME_KILL_SWITCH_ACTIVE", "Runtime scheduling is halted by an active kill switch.", {
    tenantId,
    jobKind,
    scope: killSwitch.scope,
    reason: killSwitch.reason,
  });
}

function assertTenantDispatchAllowed(store: RuntimeStore, tenantId: string) {
  const killSwitch = (store.killSwitchesByTenant.get(tenantId) ?? []).find(
    (candidate) => candidate.enabled && candidate.scope.kind === "tenant",
  );
  if (!killSwitch) return;

  throw new RuntimeError("RUNTIME_KILL_SWITCH_ACTIVE", "Runtime dispatch is halted by an active kill switch.", {
    tenantId,
    scope: killSwitch.scope,
    reason: killSwitch.reason,
  });
}

function findActiveKillSwitch(store: RuntimeStore, tenantId: string, jobKind: RuntimeJobKind) {
  return (store.killSwitchesByTenant.get(tenantId) ?? []).find(
    (killSwitch) =>
      killSwitch.enabled &&
      (killSwitch.scope.kind === "tenant" ||
        (killSwitch.scope.kind === "job-kind" && killSwitch.scope.jobKind === jobKind)),
  );
}

function registerRuntimeModel(store: RuntimeStore, command: RegisterRuntimeModelCommand) {
  const model = normalizeRuntimeModel(command);
  const key = createModelKey(model);
  const existing = store.modelsByKey.get(key);

  if (existing) {
    if (stableStringify(existing) !== stableStringify(model)) {
      throw new RuntimeError("MODEL_ALREADY_REGISTERED", "Runtime model version is already registered.", {
        modelId: model.modelId,
        version: model.version,
      });
    }

    return existing;
  }

  store.modelsByKey.set(key, model);
  return model;
}

function normalizeRuntimeModel(command: RegisterRuntimeModelCommand): RuntimeModel {
  if (command.registeredBy !== "deploy") {
    throw new RuntimeError("INVALID_MODEL", "Runtime models can only be registered at deploy time.", {
      registeredBy: command.registeredBy,
    });
  }

  return deepFreeze({
    modelId: normalizeModelId(command.modelId),
    version: normalizeModelVersion(command.version),
    provider: normalizeRequiredText(command.provider, "provider"),
    capabilityTags: uniqueStrings((command.capabilityTags ?? []).map((tag) => normalizeCapabilityTag(tag))),
    costWeight: normalizePositiveNumber(command.costWeight, "costWeight"),
    evalStatusRef: normalizeRecordRef(command.evalStatusRef),
    available: true,
    registeredBy: "deploy" as const,
  });
}

function configureRuntimeModelRoute(store: RuntimeStore, command: ConfigureRuntimeModelRouteCommand) {
  const route = normalizeModelRoute(command);
  assertModelRegistered(store, route.preferredModel);
  route.fallbackModels.forEach((fallback) => assertModelRegistered(store, fallback));
  store.modelRoutesByKey.set(route.routeKey, route);
  return route;
}

function configureRuntimeGatePolicy(store: RuntimeStore, command: ConfigureRuntimeGatePolicyCommand) {
  const policy = normalizeRuntimeGatePolicy(command);
  const tenantPolicies = store.gatePoliciesByTenant.get(policy.tenantId) ?? new Map<string, RuntimeGatePolicy>();

  tenantPolicies.set(policy.objectType, policy);
  store.gatePoliciesByTenant.set(policy.tenantId, tenantPolicies);

  return policy;
}

function normalizeRuntimeGatePolicy(command: ConfigureRuntimeGatePolicyCommand): RuntimeGatePolicy {
  if (typeof command.fourEyes !== "boolean") {
    throw new RuntimeError("INVALID_GATE_POLICY", "Runtime gate policy fourEyes must be boolean.", {
      fourEyes: command.fourEyes,
    });
  }

  return deepFreeze({
    tenantId: normalizeTenantId(command.tenantId),
    objectType: normalizeObjectType(command.objectType),
    fourEyes: command.fourEyes,
    configuredBy: normalizeInitiator(command.configuredBy),
    configuredAt: normalizeRequiredTimestamp(command.configuredAt ?? new Date(), "configuredAt"),
  });
}

function getRuntimeGatePolicy(store: RuntimeStore, tenantId: string, objectType: string) {
  return store.gatePoliciesByTenant.get(tenantId)?.get(objectType) ?? null;
}

function normalizeModelRoute(command: ConfigureRuntimeModelRouteCommand): RuntimeModelRoute {
  if (command.configuredBy !== "prd-15-release-gate") {
    throw new RuntimeError("INVALID_MODEL_ROUTE", "Model routing policy changes require a PRD-15 release gate.", {
      configuredBy: command.configuredBy,
    });
  }

  return deepFreeze({
    routeKey: normalizeModelRouteKey(command.routeKey),
    preferredModel: normalizeModelRef(command.preferredModel),
    fallbackModels: (command.fallbackModels ?? []).map((fallback) => normalizeModelRef(fallback)),
    requiredCapabilityTags: uniqueStrings(
      (command.requiredCapabilityTags ?? []).map((tag) => normalizeCapabilityTag(tag)),
    ),
    configuredBy: "prd-15-release-gate" as const,
    version: normalizeModelVersion(command.version),
  });
}

function routeRuntimeModel(store: RuntimeStore, command: RouteRuntimeModelCommand): RouteRuntimeModelResult {
  const routeKey = normalizeModelRouteKey(command.routeKey);
  const route = store.modelRoutesByKey.get(routeKey);

  if (!route) {
    throw new RuntimeError("MODEL_ROUTE_NOT_FOUND", "Runtime model route is not configured.", { routeKey });
  }

  const preferred = findRuntimeModel(store, route.preferredModel);
  if (modelUsableForRoute(preferred, route)) {
    return deepFreeze({ route, model: preferred, failover: false });
  }

  const fallback = route.fallbackModels
    .map((ref) => findRuntimeModel(store, ref))
    .find(
      (candidate) =>
        modelUsableForRoute(candidate, route) &&
        stableStringify(candidate.evalStatusRef) === stableStringify(preferred.evalStatusRef),
    );

  if (!fallback) {
    throw new RuntimeError("MODEL_ROUTE_UNAVAILABLE", "No equivalent-eval model is available for this route.", {
      routeKey,
      preferredModel: route.preferredModel,
    });
  }

  return deepFreeze({ route, model: fallback, failover: true });
}

function modelUsableForRoute(model: RuntimeModel, route: RuntimeModelRoute) {
  return model.available && route.requiredCapabilityTags.every((tag) => model.capabilityTags.includes(tag));
}

function findRuntimeModel(store: RuntimeStore, ref: RuntimeModelRef) {
  const model = store.modelsByKey.get(createModelKey(ref));

  if (!model) {
    throw new RuntimeError("MODEL_NOT_REGISTERED", "Runtime model is not registered.", { model: ref });
  }

  return model;
}

function assertModelRegistered(store: RuntimeStore, ref: RuntimeModelRef) {
  findRuntimeModel(store, ref);
}

function normalizeModelRouteKey(value: RuntimeModelRouteKey) {
  if (!RUNTIME_MODEL_ROUTE_KEYS.includes(value)) {
    throw new RuntimeError("INVALID_MODEL_ROUTE", "Runtime model route key is invalid.", { routeKey: value });
  }
  return value;
}

function normalizeModelRef(value: RuntimeModelRef): RuntimeModelRef {
  return deepFreeze({
    modelId: normalizeModelId(value.modelId),
    version: normalizeModelVersion(value.version),
  });
}

function normalizeModelId(value: string) {
  if (!MODEL_ID_PATTERN.test(value?.trim())) {
    throw new RuntimeError("INVALID_MODEL", "Runtime model id is invalid.", { modelId: value });
  }
  return value.trim();
}

function normalizeModelVersion(value: string) {
  if (!value?.trim()) {
    throw new RuntimeError("INVALID_MODEL", "Runtime model version is required.");
  }
  return value.trim();
}

function normalizeCapabilityTag(value: string) {
  if (!OBJECT_TYPE_PATTERN.test(value?.trim())) {
    throw new RuntimeError("INVALID_MODEL", "Runtime model capability tag is invalid.", { capabilityTag: value });
  }
  return value.trim();
}

function createModelKey(ref: RuntimeModelRef) {
  return `${ref.modelId}@${ref.version}`;
}

function registerRuntimeTool(store: RuntimeStore, command: RegisterRuntimeToolCommand) {
  const tool = normalizeRuntimeTool(command);
  const existing = store.toolsByName.get(tool.name);

  if (existing) {
    if (stableStringify(existing) !== stableStringify(tool)) {
      throw new RuntimeError("TOOL_ALREADY_REGISTERED", "Runtime tool name is already registered.", {
        name: tool.name,
      });
    }

    return existing;
  }

  store.toolsByName.set(tool.name, tool);
  return tool;
}

function normalizeRuntimeTool(command: RegisterRuntimeToolCommand): RuntimeTool {
  if (command.registeredBy !== "deploy") {
    throw new RuntimeError("INVALID_TOOL", "Runtime tools can only be registered at deploy time.", {
      registeredBy: command.registeredBy,
    });
  }

  const name = normalizeToolName(command.name);
  const capabilityClass = normalizeToolCapabilityClass(command.capabilityClass);

  return deepFreeze({
    name,
    capabilityClass,
    scopeRequirements: normalizeToolScopeRequirements(command.scopeRequirements),
    sensitivityCeiling: normalizeSensitivityCeiling(command.sensitivityCeiling),
    costWeight: normalizePositiveNumber(command.costWeight, "costWeight"),
    rateLimits: normalizeToolRateLimits(command.rateLimits),
    registeredBy: "deploy" as const,
  });
}

function normalizeToolName(value: string) {
  if (!TOOL_NAME_PATTERN.test(value?.trim())) {
    throw new RuntimeError("INVALID_TOOL", "Runtime tool name is invalid.", { name: value });
  }
  return value.trim();
}

function getCircuitBreakerState(store: RuntimeStore, tenantId: string, toolName: string) {
  return store.circuitBreakersByTenant.get(tenantId)?.get(toolName) ?? null;
}

function setCircuitBreakerState(
  store: RuntimeStore,
  tenantId: string,
  toolName: string,
  circuitBreaker: RuntimeCircuitBreaker,
) {
  const tenantBreakers = new Map(store.circuitBreakersByTenant.get(tenantId) ?? []);
  tenantBreakers.set(toolName, circuitBreaker);
  store.circuitBreakersByTenant.set(tenantId, tenantBreakers);
}

function isCircuitBreakerOpen(store: RuntimeStore, tenantId: string, toolName: string, asOf: string) {
  const existing = getCircuitBreakerState(store, tenantId, toolName);

  if (!existing || existing.state !== "open") return false;
  if (existing.openUntil && new Date(existing.openUntil).getTime() <= new Date(asOf).getTime()) {
    setCircuitBreakerState(
      store,
      tenantId,
      toolName,
      deepFreeze({
        ...existing,
        state: "closed" as const,
        recentFailures: 0,
        failureTimes: [],
        openedAt: null,
        openUntil: null,
      }),
    );

    return false;
  }

  return true;
}

function recordCircuitBreakerFailure(store: RuntimeStore, tenantId: string, toolName: string, occurredAt: string) {
  if (!getCircuitBreakerState(store, tenantId, toolName)) return;
  isCircuitBreakerOpen(store, tenantId, toolName, occurredAt);
  const existing = getCircuitBreakerState(store, tenantId, toolName);
  if (!existing) return;

  const occurredAtMs = new Date(occurredAt).getTime();
  const failureTimes = [...existing.failureTimes, occurredAt]
    .filter((timestamp) => occurredAtMs - new Date(timestamp).getTime() <= existing.windowMs)
    .sort();
  const opened = failureTimes.length >= existing.failureThreshold;
  const openUntil =
    opened && existing.cooldownMs !== null
      ? new Date(occurredAtMs + existing.cooldownMs).toISOString()
      : existing.openUntil;
  const circuitBreaker = deepFreeze({
    ...existing,
    state: opened ? ("open" as const) : existing.state,
    recentFailures: failureTimes.length,
    failureTimes,
    openedAt: opened ? occurredAt : existing.openedAt,
    openUntil,
  });

  setCircuitBreakerState(store, tenantId, toolName, circuitBreaker);
}

function normalizeToolCapabilityClass(value: RuntimeToolCapabilityClass) {
  if (!RUNTIME_TOOL_CAPABILITY_CLASSES.includes(value)) {
    throw new RuntimeError("INVALID_TOOL", "Runtime tool capability class is invalid. Egress tools are not allowed.", {
      capabilityClass: value,
    });
  }
  return value;
}

function normalizeToolScopeRequirements(value: RuntimeToolScopeRequirements): RuntimeToolScopeRequirements {
  if (!value) {
    throw new RuntimeError("INVALID_TOOL", "Runtime tool scope requirements are required.");
  }

  return deepFreeze({
    objectTypes: uniqueStrings((value.objectTypes ?? []).map((objectType) => normalizeObjectType(objectType))),
    jurisdictionsRequired: Boolean(value.jurisdictionsRequired),
    objectRefsRequired: Boolean(value.objectRefsRequired),
  });
}

function normalizeSensitivityCeiling(value: RuntimeSensitivityCeiling) {
  if (!RUNTIME_SENSITIVITY_CEILINGS.includes(value)) {
    throw new RuntimeError("INVALID_TOOL", "Runtime tool sensitivity ceiling is invalid.", {
      sensitivityCeiling: value,
    });
  }
  return value;
}

function normalizeToolRateLimits(value: RuntimeToolRateLimits): RuntimeToolRateLimits {
  if (!value) {
    throw new RuntimeError("INVALID_TOOL", "Runtime tool rate limits are required.");
  }

  return deepFreeze({
    perMinute: normalizePositiveInteger(value.perMinute, "perMinute"),
    burst: normalizePositiveInteger(value.burst, "burst"),
  });
}

function normalizePositiveNumber(value: number, key: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RuntimeError("INVALID_TOOL", `Runtime tool ${key} must be positive.`, { [key]: value });
  }
  return value;
}

function authorizeRuntimeToolUse(
  job: RuntimeJob,
  tool: RuntimeTool | null,
  requestedScope: RuntimeScope,
  requestedSensitivity: RuntimeSensitivityCeiling,
  capabilityMap: RuntimeCapabilityMap,
  circuitOpen = false,
): RuntimeToolAuthorization {
  if (!tool) {
    return toolAuthorization(false, "tool_not_registered", null, requestedScope);
  }

  if (circuitOpen) {
    return toolAuthorization(false, "tool_circuit_open", tool, requestedScope);
  }

  if (!getJobToolSet(job.kind).includes(tool.capabilityClass)) {
    return toolAuthorization(false, "tool_not_allowed_for_job_kind", tool, requestedScope);
  }

  if (!capabilityMap.toolClasses.includes(tool.capabilityClass)) {
    return toolAuthorization(false, "capability_missing", tool, requestedScope);
  }

  if (!toolScopeRequirementsMet(tool, requestedScope)) {
    return toolAuthorization(false, "scope_requirements_not_met", tool, requestedScope);
  }

  if (!scopeContains(job.scope, requestedScope)) {
    return toolAuthorization(false, "scope_outside_job", tool, requestedScope);
  }

  if (!scopeContains(capabilityMapToScope(capabilityMap), requestedScope)) {
    return toolAuthorization(false, "scope_outside_initiator", tool, requestedScope);
  }

  if (!sensitivityAllows(tool.sensitivityCeiling, requestedSensitivity)) {
    return toolAuthorization(false, "sensitivity_exceeds_tool", tool, requestedScope);
  }

  if (!sensitivityAllows(capabilityMap.sensitivityCeiling, requestedSensitivity)) {
    return toolAuthorization(false, "sensitivity_exceeds_capability", tool, requestedScope);
  }

  return toolAuthorization(true, null, tool, requestedScope);
}

function toolAvailableForJob(job: RuntimeJob, tool: RuntimeTool, capabilityMap: RuntimeCapabilityMap) {
  return (
    getJobToolSet(job.kind).includes(tool.capabilityClass) &&
    capabilityMap.toolClasses.includes(tool.capabilityClass) &&
    toolVisibleForScope(tool, job.scope) &&
    toolVisibleForScope(tool, capabilityMapToScope(capabilityMap)) &&
    sensitivityAllows(capabilityMap.sensitivityCeiling, tool.sensitivityCeiling)
  );
}

function toolAuthorization(
  allowed: boolean,
  reason: RuntimeToolDenialReason | null,
  tool: RuntimeTool | null,
  effectiveScope: RuntimeScope,
): RuntimeToolAuthorization {
  return deepFreeze({
    allowed,
    reason,
    tool,
    effectiveScope,
  });
}

function isRuntimeToolRateLimited(store: RuntimeStore, tenantId: string, tool: RuntimeTool, requestedAt: string) {
  const recentTimes = getRuntimeToolAuthorizationTimes(store, tenantId, tool.name, requestedAt);

  return (
    recentTimes.filter((timestamp) => isWithinWindow(timestamp, requestedAt, 60_000)).length >= tool.rateLimits.perMinute ||
    recentTimes.filter((timestamp) => isWithinWindow(timestamp, requestedAt, 1_000)).length >= tool.rateLimits.burst
  );
}

function recordRuntimeToolAuthorization(store: RuntimeStore, tenantId: string, tool: RuntimeTool, requestedAt: string) {
  const toolsByTenant = getRuntimeToolAuthorizationMap(store, tenantId);
  const recentTimes = getRuntimeToolAuthorizationTimes(store, tenantId, tool.name, requestedAt);

  toolsByTenant.set(tool.name, [...recentTimes, requestedAt]);
}

function getRuntimeToolAuthorizationTimes(
  store: RuntimeStore,
  tenantId: string,
  toolName: string,
  requestedAt: string,
) {
  return (getRuntimeToolAuthorizationMap(store, tenantId).get(toolName) ?? []).filter((timestamp) =>
    isWithinWindow(timestamp, requestedAt, 60_000),
  );
}

function getRuntimeToolAuthorizationMap(store: RuntimeStore, tenantId: string) {
  const existing = store.toolAuthorizationTimesByTenant.get(tenantId);

  if (existing) {
    return existing;
  }

  const toolsByTenant = new Map<string, string[]>();
  store.toolAuthorizationTimesByTenant.set(tenantId, toolsByTenant);
  return toolsByTenant;
}

function isWithinWindow(timestamp: string, requestedAt: string, windowMs: number) {
  const atMs = new Date(requestedAt).getTime();
  const timestampMs = new Date(timestamp).getTime();

  return timestampMs <= atMs && timestampMs > atMs - windowMs;
}

function normalizeCapabilityMap(value: RuntimeCapabilityMap): RuntimeCapabilityMap {
  if (!value) {
    throw new RuntimeError("INVALID_CAPABILITY_MAP", "Runtime capability map is required.");
  }

  return deepFreeze({
    toolClasses: uniqueToolClasses(value.toolClasses ?? []),
    entityIds: uniqueStrings(value.entityIds ?? []),
    jurisdictions: uniqueStrings((value.jurisdictions ?? []).map((jurisdiction) => jurisdiction.toUpperCase())),
    objectRefs: uniqueRecordRefs((value.objectRefs ?? []).map((ref) => normalizeRecordRef(ref))),
    sensitivityCeiling: normalizeSensitivityCeiling(value.sensitivityCeiling),
  });
}

function uniqueToolClasses(values: RuntimeToolCapabilityClass[]) {
  return Array.from(new Set(values.map((value) => normalizeToolCapabilityClass(value)))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function getJobToolSet(kind: RuntimeJobKind): readonly RuntimeToolCapabilityClass[] {
  return RUNTIME_JOB_TOOL_SETS[kind] as readonly RuntimeToolCapabilityClass[];
}

function toolScopeRequirementsMet(tool: RuntimeTool, requestedScope: RuntimeScope) {
  if (tool.scopeRequirements.jurisdictionsRequired && requestedScope.jurisdictions.length === 0) {
    return false;
  }
  if (tool.scopeRequirements.objectRefsRequired && requestedScope.objectRefs.length === 0) {
    return false;
  }
  if (requestedScope.objectRefs.length === 0) {
    return true;
  }

  return requestedScope.objectRefs.every((ref) => tool.scopeRequirements.objectTypes.includes(ref.objectType));
}

function toolVisibleForScope(tool: RuntimeTool, scope: RuntimeScope) {
  if (!tool.scopeRequirements.objectRefsRequired) {
    return true;
  }

  return scope.objectRefs.some((ref) => tool.scopeRequirements.objectTypes.includes(ref.objectType));
}

function capabilityMapToScope(capabilityMap: RuntimeCapabilityMap): RuntimeScope {
  return deepFreeze({
    entityIds: capabilityMap.entityIds,
    jurisdictions: capabilityMap.jurisdictions,
    objectRefs: capabilityMap.objectRefs,
    period: null,
  });
}

function scopeContains(container: RuntimeScope, requested: RuntimeScope) {
  return (
    includesAll(container.entityIds, requested.entityIds) &&
    includesAll(container.jurisdictions, requested.jurisdictions) &&
    includesAllRefs(container.objectRefs, requested.objectRefs) &&
    (requested.period === null || container.period === requested.period)
  );
}

function includesAll(container: string[], requested: string[]) {
  return requested.every((value) => container.includes(value));
}

function includesAllRefs(container: RuntimeRecordRef[], requested: RuntimeRecordRef[]) {
  const allowed = new Set(container.map((ref) => stringifyRuntimeRef(ref)));
  return requested.every((ref) => allowed.has(stringifyRuntimeRef(ref)));
}

function sensitivityAllows(ceiling: RuntimeSensitivityCeiling, requested: RuntimeSensitivityCeiling) {
  return sensitivityRank(ceiling) >= sensitivityRank(requested);
}

function sensitivityRank(value: RuntimeSensitivityCeiling) {
  return RUNTIME_SENSITIVITY_CEILINGS.indexOf(value);
}

function normalizePlanJobKind(value: Extract<RuntimeJobKind, "agent" | "composite">) {
  if (value !== "agent" && value !== "composite") {
    throw new RuntimeError("INVALID_PLAN", "Runtime plans can only approve agentic or composite jobs.", { kind: value });
  }
  return value;
}

function normalizeJobPlanRef(kind: RuntimeJobKind, planRef: RuntimeRecordRef | null) {
  if ((kind === "agent" || kind === "composite") && planRef === null) {
    throw new RuntimeError("PLAN_REQUIRED", "Agentic and composite runtime jobs require a plan ref.", { kind });
  }
  if (planRef && planRef.objectType !== "plan") {
    throw new RuntimeError("INVALID_REF", "Runtime job planRef must reference a plan.", { planRef });
  }

  return planRef;
}

function normalizeCompositeChildSpecs(
  childJobs: SubmitRuntimeCompositeChildCommand[],
  inheritedPriorityLane: RuntimePriorityLane,
) {
  if (!Array.isArray(childJobs) || childJobs.length === 0) {
    throw new RuntimeError("INVALID_COMPOSITE", "Composite jobs require at least one child job.");
  }

  const keySet = new Set<string>();
  const specs = childJobs.map((child) => {
    const key = normalizeCompositeChildKey(child.key);
    if (keySet.has(key)) {
      throw new RuntimeError("INVALID_COMPOSITE", "Composite child keys must be unique.", { key });
    }
    keySet.add(key);

    const kind = normalizeCompositeChildKind(child.kind);
    const requestedPlanRef =
      child.planRef === undefined || child.planRef === null ? null : normalizeRecordRef(child.planRef);

    return deepFreeze({
      key,
      kind,
      scope: normalizeScope(child.scope ?? {}),
      planRef: normalizeJobPlanRef(kind, requestedPlanRef),
      priorityLane: normalizePriorityLane(child.priorityLane ?? inheritedPriorityLane),
      dependsOn: uniqueStrings(child.dependsOn ?? []),
    });
  });

  specs.forEach((child) => {
    child.dependsOn.forEach((dependency) => {
      if (!keySet.has(dependency)) {
        throw new RuntimeError("INVALID_COMPOSITE", "Composite child dependency is missing.", {
          key: child.key,
          dependency,
        });
      }
      if (dependency === child.key) {
        throw new RuntimeError("INVALID_COMPOSITE", "Composite child cannot depend on itself.", { key: child.key });
      }
    });
  });
  assertAcyclicComposite(specs);

  return deepFreeze(specs);
}

function normalizeCompositeChildKey(value: string) {
  if (!STEP_ID_PATTERN.test(value?.trim())) {
    throw new RuntimeError("INVALID_COMPOSITE", "Composite child key is invalid.", { key: value });
  }
  return value.trim();
}

function normalizeCompositeChildKind(value: RuntimeJobKind): Exclude<RuntimeJobKind, "composite"> {
  if (value === "composite" || !RUNTIME_JOB_KINDS.includes(value)) {
    throw new RuntimeError("INVALID_COMPOSITE", "Composite child job kind is invalid.", { kind: value });
  }
  return value;
}

function assertAcyclicComposite(
  specs: Array<{
    key: string;
    dependsOn: string[];
  }>,
) {
  const byKey = new Map(specs.map((spec) => [spec.key, spec.dependsOn]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (key: string) => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new RuntimeError("INVALID_COMPOSITE", "Composite child dependencies must form a DAG.", { key });
    }

    visiting.add(key);
    (byKey.get(key) ?? []).forEach(visit);
    visiting.delete(key);
    visited.add(key);
  };

  specs.forEach((spec) => visit(spec.key));
}

function normalizeStepId(value: string) {
  if (!STEP_ID_PATTERN.test(value?.trim())) {
    throw new RuntimeError("INVALID_STEP", "Runtime stepId is invalid.", { stepId: value });
  }
  return value.trim();
}

function normalizeStepType(value: RuntimeStepType) {
  if (!RUNTIME_STEP_TYPES.includes(value)) {
    throw new RuntimeError("INVALID_STEP", "Runtime step type is invalid.", { type: value });
  }
  return value;
}

function normalizeModelIORefs(value: RuntimeModelIORefs | undefined, type: RuntimeStepType) {
  if (type !== "model") {
    if (value !== undefined) {
      throw new RuntimeError("INVALID_STEP", "Runtime model I/O refs are only valid for model steps.", {
        type,
      });
    }

    return null;
  }
  if (!value) {
    throw new RuntimeError("INVALID_STEP", "Runtime model steps require prompt and output refs with a retention class.");
  }

  return deepFreeze({
    promptRef: normalizeRecordRef(value.promptRef),
    outputRef: normalizeRecordRef(value.outputRef),
    retentionClass: normalizeModelIORetentionClass(value.retentionClass),
  });
}

function normalizeModelIORetentionClass(value: RuntimeModelIORetentionClass) {
  if (!RUNTIME_MODEL_IO_RETENTION_CLASSES.includes(value)) {
    throw new RuntimeError("INVALID_STEP", "Runtime model I/O retention class is invalid.", {
      retentionClass: value,
    });
  }

  return value;
}

function normalizePlanStatus(value: RuntimePlanStatus) {
  if (!RUNTIME_PLAN_STATUSES.includes(value)) {
    throw new RuntimeError("INVALID_PLAN_STATUS", "Runtime plan status is invalid.", { status: value });
  }
  return value;
}

function normalizeCostClass(value: RuntimeCostClass) {
  if (!RUNTIME_COST_CLASSES.includes(value)) {
    throw new RuntimeError("INVALID_COST_CLASS", "Runtime cost class is invalid.", { costClass: value });
  }
  return value;
}

function createRuntimeBudget(costClass: RuntimeCostClass | null): RuntimeBudget {
  if (costClass === null) {
    return deepFreeze({
      costClass: null,
      tokenCeiling: null,
      toolCallCeiling: null,
      wallclockMs: null,
    });
  }

  const profile = RUNTIME_COST_CLASS_BUDGETS[costClass];

  return deepFreeze({
    costClass,
    tokenCeiling: profile.tokenCeiling,
    toolCallCeiling: profile.toolCallCeiling,
    wallclockMs: profile.wallclockMs,
  });
}

function normalizeRaisedBudget(current: RuntimeBudget, patch: RuntimeBudgetPatch, meter: RuntimeMeter): RuntimeBudget {
  const budget = deepFreeze({
    costClass: current.costClass,
    tokenCeiling: normalizeBudgetCeiling(patch.tokenCeiling, current.tokenCeiling, "tokenCeiling"),
    toolCallCeiling: normalizeBudgetCeiling(patch.toolCallCeiling, current.toolCallCeiling, "toolCallCeiling"),
    wallclockMs: normalizeBudgetCeiling(patch.wallclockMs, current.wallclockMs, "wallclockMs"),
  });

  assertBudgetCoversMeter(budget, meter);

  if (!budgetRaised(current, budget)) {
    throw new RuntimeError("BUDGET_NOT_RAISED", "Raised budget must increase at least one ceiling.", {
      current,
      budget,
    });
  }

  return budget;
}

function normalizeBudgetCeiling(value: number | undefined, current: number | null, key: string) {
  if (value === undefined) return current;
  if (!Number.isInteger(value) || value < 0) {
    throw new RuntimeError("INVALID_BUDGET", `Runtime budget ${key} must be a non-negative integer.`, {
      [key]: value,
    });
  }

  return value;
}

function assertBudgetCoversMeter(budget: RuntimeBudget, meter: RuntimeMeter) {
  if (budget.tokenCeiling !== null && meter.tokens > budget.tokenCeiling) {
    throw new RuntimeError("BUDGET_TOO_LOW", "Raised token ceiling must cover the current meter.", {
      tokenCeiling: budget.tokenCeiling,
      tokens: meter.tokens,
    });
  }
  if (budget.toolCallCeiling !== null && meter.toolCalls > budget.toolCallCeiling) {
    throw new RuntimeError("BUDGET_TOO_LOW", "Raised tool-call ceiling must cover the current meter.", {
      toolCallCeiling: budget.toolCallCeiling,
      toolCalls: meter.toolCalls,
    });
  }
  if (budget.wallclockMs !== null && meter.wallclockMs > budget.wallclockMs) {
    throw new RuntimeError("BUDGET_TOO_LOW", "Raised wallclock ceiling must cover the current meter.", {
      wallclockMs: budget.wallclockMs,
      consumedWallclockMs: meter.wallclockMs,
    });
  }
}

function budgetRaised(current: RuntimeBudget, budget: RuntimeBudget) {
  return (
    ceilingRaised(current.tokenCeiling, budget.tokenCeiling) ||
    ceilingRaised(current.toolCallCeiling, budget.toolCallCeiling) ||
    ceilingRaised(current.wallclockMs, budget.wallclockMs)
  );
}

function ceilingRaised(current: number | null, next: number | null) {
  if (current === null || next === null) return false;
  return next > current;
}

function initialRuntimeMeter(): RuntimeMeter {
  return deepFreeze({
    tokens: 0,
    toolCalls: 0,
    engineCalls: 0,
    modelCalls: 0,
    wallclockMs: 0,
    costWeight: 0,
  });
}

function meterFromStep(step: RuntimeStep): RuntimeMeter {
  return deepFreeze({
    tokens: readCostMetric(step.cost, "tokens"),
    toolCalls: readCostMetric(step.cost, "toolCalls"),
    engineCalls: readCostMetric(step.cost, "engineCalls"),
    modelCalls: readCostMetric(step.cost, "modelCalls"),
    wallclockMs: getStepWallclockMs(step),
    costWeight: readCostMetric(step.cost, "costWeight"),
  });
}

function addRuntimeMeters(left: RuntimeMeter, right: RuntimeMeter): RuntimeMeter {
  return deepFreeze({
    tokens: left.tokens + right.tokens,
    toolCalls: left.toolCalls + right.toolCalls,
    engineCalls: left.engineCalls + right.engineCalls,
    modelCalls: left.modelCalls + right.modelCalls,
    wallclockMs: left.wallclockMs + right.wallclockMs,
    costWeight: left.costWeight + right.costWeight,
  });
}

function readCostMetric(cost: Record<string, unknown>, key: string) {
  const value = cost[key];
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RuntimeError("INVALID_STEP", `Runtime step cost ${key} must be a non-negative number.`, { [key]: value });
  }

  return value;
}

function getStepWallclockMs(step: RuntimeStep) {
  if (step.t0 && step.t1) {
    const durationMs = new Date(step.t1).getTime() - new Date(step.t0).getTime();
    if (durationMs < 0) {
      throw new RuntimeError("INVALID_TIMESTAMP", "Runtime step t1 must be after t0.", { t0: step.t0, t1: step.t1 });
    }
    return durationMs;
  }

  return readCostMetric(step.cost, "wallclockMs");
}

function createCostTelemetryEntry(
  job: RuntimeJob,
  step: RuntimeStep,
  occurredAt: string,
): RuntimeCostTelemetryEntry {
  return deepFreeze({
    tenantId: job.tenantId,
    jobId: job.jobId,
    stepId: step.stepId,
    type: step.type,
    costClass: job.budget.costClass,
    occurredAt,
    cost: step.cost,
    meter: job.meter,
  });
}

function getRuntimeOperationalMetrics(
  store: RuntimeStore,
  input: GetRuntimeOperationalMetricsInput,
): RuntimeOperationalMetrics {
  const tenantId = normalizeTenantId(input.tenantId);
  const asOf = normalizeRequiredTimestamp(input.asOf ?? new Date(), "asOf");
  const killSwitchDrillWindowDays =
    input.killSwitchDrillWindowDays === undefined || input.killSwitchDrillWindowDays === null
      ? 90
      : normalizePositiveInteger(input.killSwitchDrillWindowDays, "killSwitchDrillWindowDays");
  const jobs = store.jobsByTenant.get(tenantId) ?? [];
  const plans = store.plansByTenant.get(tenantId) ?? [];
  const schedules = store.schedulesByTenant.get(tenantId) ?? [];
  const orphanResolutions = store.scheduleOrphanResolutionsByTenant.get(tenantId) ?? [];
  const events = store.eventsByTenant.get(tenantId) ?? [];
  const killSwitchChanges = store.killSwitchChangesByTenant.get(tenantId) ?? [];

  return deepFreeze({
    tenantId,
    asOf,
    planFidelity: getRuntimePlanFidelityMetrics(plans),
    traceCompleteness: getRuntimeTraceCompletenessMetrics(jobs),
    gateLatency: getRuntimeGateLatencyMetrics(events),
    costByClass: getRuntimeCostByClassMetrics(jobs),
    watcherOrphans: getRuntimeWatcherOrphanMetrics(schedules, orphanResolutions),
    killSwitchDrill: getRuntimeKillSwitchDrillMetrics(killSwitchChanges, asOf, killSwitchDrillWindowDays),
    canonicalWriteGuard: {
      outsidePromotePathViolations: 0,
    },
  });
}

function getRuntimePlanFidelityMetrics(plans: RuntimePlan[]): RuntimePlanFidelityMetrics {
  const approvedPlans = plans.filter((plan) => plan.status === "approved");
  const editedBeforeApprovalCount = approvedPlans.filter((plan) => plan.supersedesPlanId !== null).length;

  return deepFreeze({
    approvedPlanCount: approvedPlans.length,
    editedBeforeApprovalCount,
    editedBeforeApprovalRate:
      approvedPlans.length === 0 ? null : editedBeforeApprovalCount / approvedPlans.length,
  });
}

function getRuntimeTraceCompletenessMetrics(jobs: RuntimeJob[]): RuntimeTraceCompletenessMetrics {
  const completedExecutableRuns = jobs.filter((job) => job.status === "completed" && job.composite === null);
  const completedWithTraceCount = completedExecutableRuns.filter((job) => job.steps.length > 0).length;

  return deepFreeze({
    completedExecutableRunCount: completedExecutableRuns.length,
    completedWithTraceCount,
    violationCount: completedExecutableRuns.length - completedWithTraceCount,
    rate: completedExecutableRuns.length === 0 ? null : completedWithTraceCount / completedExecutableRuns.length,
  });
}

function getRuntimeGateLatencyMetrics(events: RuntimeEvent[]): RuntimeGateLatencyMetrics {
  const requestedByGate = new Map<string, RuntimeEvent>();
  const decidedLatencies: number[] = [];
  const requestedGateIds = new Set<string>();
  const escalatedGateIds = new Set<string>();

  events.forEach((event) => {
    if (event.type !== "gate.requested") return;
    const gateId = getRuntimeEventGateId(event);
    if (!gateId) return;
    requestedGateIds.add(gateId);
    requestedByGate.set(gateId, event);
  });

  events.forEach((event) => {
    const gateId = getRuntimeEventGateId(event);
    if (!gateId) return;
    if (event.type === "gate.decided") {
      const requested = requestedByGate.get(gateId);
      if (requested) {
        decidedLatencies.push(new Date(event.occurredAt).getTime() - new Date(requested.occurredAt).getTime());
      }
    }
    if (event.type === "gate.escalated" && requestedGateIds.has(gateId)) {
      escalatedGateIds.add(gateId);
    }
  });

  return deepFreeze({
    requestedGateCount: requestedGateIds.size,
    decidedGateCount: decidedLatencies.length,
    p50Ms: percentileNearestRank(decidedLatencies, 50),
    p95Ms: percentileNearestRank(decidedLatencies, 95),
    escalatedGateCount: escalatedGateIds.size,
    escalationRate: requestedGateIds.size === 0 ? null : escalatedGateIds.size / requestedGateIds.size,
  });
}

function getRuntimeCostByClassMetrics(jobs: RuntimeJob[]): Record<RuntimeCostClass, RuntimeCostClassMetrics> {
  const byClass = Object.fromEntries(
    RUNTIME_COST_CLASSES.map((costClass) => [costClass, { ...initialRuntimeMeter(), jobCount: 0 }]),
  ) as Record<RuntimeCostClass, RuntimeCostClassMetrics>;

  jobs.forEach((job) => {
    const costClass = job.budget.costClass;
    if (!costClass) return;
    const current = byClass[costClass];
    byClass[costClass] = {
      jobCount: current.jobCount + 1,
      tokens: current.tokens + job.meter.tokens,
      toolCalls: current.toolCalls + job.meter.toolCalls,
      engineCalls: current.engineCalls + job.meter.engineCalls,
      modelCalls: current.modelCalls + job.meter.modelCalls,
      wallclockMs: current.wallclockMs + job.meter.wallclockMs,
      costWeight: current.costWeight + job.meter.costWeight,
    };
  });

  return deepFreeze(byClass);
}

function getRuntimeWatcherOrphanMetrics(
  schedules: RuntimeSchedule[],
  resolutions: RuntimeScheduleOrphanResolution[],
): RuntimeWatcherOrphanMetrics {
  const activeOrphanCount = schedules.filter((schedule) => schedule.status === "orphaned").length;
  const resolutionMs = resolutions.map((resolution) => resolution.resolutionMs);

  return deepFreeze({
    orphanedCount: activeOrphanCount + resolutions.length,
    reassignedCount: resolutions.length,
    averageResolutionMs: averageNumber(resolutionMs),
  });
}

function getRuntimeKillSwitchDrillMetrics(
  killSwitchChanges: RuntimeKillSwitch[],
  asOf: string,
  windowDays: number,
): RuntimeKillSwitchDrillMetrics {
  const asOfMs = new Date(asOf).getTime();
  const windowStartMs = asOfMs - windowDays * 24 * 60 * 60 * 1000;
  const drillRecoveries = killSwitchChanges
    .filter((killSwitch) => !killSwitch.enabled && killSwitch.reason.toLowerCase().includes("drill"))
    .filter((killSwitch) => {
      const recoveredAtMs = new Date(killSwitch.changedAt).getTime();
      return recoveredAtMs <= asOfMs && recoveredAtMs >= windowStartMs;
    })
    .filter((recovery) =>
      killSwitchChanges.some((candidate) => {
        const startedAtMs = new Date(candidate.changedAt).getTime();

        return (
          candidate.enabled &&
          sameKillSwitchScope(candidate.scope, recovery.scope) &&
          candidate.reason.toLowerCase().includes("drill") &&
          startedAtMs <= new Date(recovery.changedAt).getTime()
        );
      }),
    )
    .sort((left, right) => right.changedAt.localeCompare(left.changedAt));
  const lastDrillAt = drillRecoveries[0]?.changedAt ?? null;

  return deepFreeze({
    windowDays,
    lastDrillAt,
    passed: lastDrillAt !== null,
  });
}

function getRuntimeEventGateId(event: RuntimeEvent) {
  const gateId = event.payload.gateId;
  return typeof gateId === "string" ? gateId : null;
}

function percentileNearestRank(values: number[], percentile: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[index];
}

function averageNumber(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function normalizeReadRefs(refs: RuntimeRecordRef[]) {
  return uniqueVersionedRecordRefs(refs.map((ref) => normalizeVersionedRecordRef(ref)));
}

function normalizeVersionedRecordRef(ref: RuntimeRecordRef): RuntimeVersionedRecordRef {
  const normalized = normalizeRecordRef(ref);

  if (normalized.version === undefined) {
    throw new RuntimeError("UNPINNED_RECORD_READ", "Runtime Record reads must include the consumed version.", { ref });
  }

  return deepFreeze({
    ...normalized,
    version: normalized.version,
  });
}

function uniqueVersionedRecordRefs(refs: RuntimeVersionedRecordRef[]) {
  const byKey = new Map<string, RuntimeVersionedRecordRef>();

  refs.forEach((ref) => {
    byKey.set(stringifyRuntimeRef(ref), ref);
  });

  return Array.from(byKey.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref);
}

function uniqueRuntimeReadPins(pins: RuntimeReadPin[]) {
  const byKey = new Map<string, RuntimeReadPin>();

  pins.forEach((pin) => {
    const existing = byKey.get(stringifyRuntimeRef(pin.ref));

    if (!existing || pin.readAt.localeCompare(existing.readAt) < 0) {
      byKey.set(stringifyRuntimeRef(pin.ref), pin);
    }
  });

  return Array.from(byKey.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, pin]) => pin);
}

function normalizeOptionalOutputHash(value: string | null) {
  if (value === null) return null;
  const hash = value.trim();

  if (!hash) {
    throw new RuntimeError("INVALID_OUTPUT_HASH", "Runtime output hashes cannot be blank.");
  }

  return hash;
}

function registerRuntimeCompletionManifest(
  store: RuntimeStore,
  job: RuntimeJob,
  completedAt: string,
): RuntimeManifestRegistration | null {
  if (job.readPins.length === 0) return null;
  assertRuntimeManifestRecordService(store, job.jobId);
  if (job.pins.corpusVersion === null) {
    throw new RuntimeError("MANIFEST_REQUIRES_CORPUS_PIN", "Runtime manifests require a frozen corpus version.", {
      jobId: job.jobId,
    });
  }

  const jobRef = deepFreeze({ objectType: "run", objectId: job.jobId });
  const inputPins = uniqueVersionedRecordRefs(job.readPins.map((pin) => pin.ref)).map((ref) =>
    deepFreeze({
      ref,
      version: ref.version,
    }),
  );
  const outputHashes = createRuntimeManifestOutputHashes(job.stagingWrites);
  const manifestResult = store.recordService.registerManifest({
    tenantId: job.tenantId,
    idempotencyKey: `manifest:${job.jobId}`,
    actor: { kind: "system", id: "runtime" },
    jobRef,
    corpusVersion: job.pins.corpusVersion,
    rulepackVersions: job.pins.rulepackVersions,
    modelVersions: job.pins.modelVersions,
    instructionRefs: normalizeInstructionRefsForRecord(job.instructionSet.refs),
    gateRefs: getRuntimeManifestGateRefs(store, job),
    inputPins,
    outputHashes,
    registeredAt: completedAt,
  });
  const dependencyEdges = uniqueRecordRefs(job.stagingWrites.map((write) => write.outputRef)).flatMap((downstreamRef) => {
    const existingDependencies = store.recordService!.listDependencies({
      tenantId: job.tenantId,
      downstreamRef,
    });
    const missingInputPins = inputPins.filter(
      (pin) =>
        !existingDependencies.some(
          (dependency) =>
            stringifyRuntimeRef(dependency.downstreamRef) === stringifyRuntimeRef(downstreamRef) &&
            stringifyRuntimeRef(dependency.upstreamRef) === stringifyRuntimeRef(pin.ref) &&
            dependency.kind === "record-read",
        ),
    );

    if (missingInputPins.length === 0) return [];

    return [
      {
        downstreamRef,
        upstreamRefs: missingInputPins.map((pin) => ({ ref: pin.ref, kind: "record-read" })),
      },
    ];
  });
  const dependencies =
    dependencyEdges.length === 0
      ? []
      : [
          store.recordService.declareDependenciesBatch({
            tenantId: job.tenantId,
            idempotencyKey: `deps:${job.jobId}`,
            actor: { kind: "system", id: "runtime" },
            declaredByRun: jobRef,
            edges: dependencyEdges,
            declaredAt: completedAt,
          }),
        ];

  return deepFreeze({
    manifest: manifestResult.manifest,
    dependencies,
  });
}

function assertRuntimeManifestRecordService(store: RuntimeStore, jobId: string): asserts store is RuntimeStore & {
  recordService: NonNullable<RuntimeStore["recordService"]>;
} {
  if (!store.recordService) {
    throw new RuntimeError("MANIFEST_REGISTRATION_UNAVAILABLE", "Runtime needs the Record service to register read pins.", {
      jobId,
    });
  }
}

function createRuntimeManifestOutputHashes(stagingWrites: RuntimeStagingWrite[]) {
  const entries = stagingWrites
    .filter((write) => write.outputHash)
    .map((write) => [stringifyRuntimeRef(write.outputRef), write.outputHash as string] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(entries);
}

function getRuntimeManifestGateRefs(
  store: RuntimeStore & { recordService: NonNullable<RuntimeStore["recordService"]> },
  job: RuntimeJob,
) {
  return uniqueStrings(
    job.stagingWrites
      .map((write) => write.gateRef?.objectId ?? null)
      .filter((gateId): gateId is string => Boolean(gateId))
      .filter((gateId) => isRuntimeManifestGateRef(store, job, gateId)),
  );
}

function isRuntimeManifestGateRef(
  store: RuntimeStore & { recordService: NonNullable<RuntimeStore["recordService"]> },
  job: RuntimeJob,
  gateId: string,
) {
  if (hasRuntimeGateChangeRequest(store, job.tenantId, job.jobId, gateId)) {
    return false;
  }

  const gate = findRuntimeRecordGate(store, job.tenantId, gateId);
  return gate.status === "approved" && gate.decision === "approved";
}

function normalizeInstructionRefsForRecord(refs: string[]) {
  return refs
    .map((ref) => {
      const [, objectId = ref] = ref.split(":");
      return objectId.trim();
    })
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

interface NormalizedPromotionRequest {
  proposedValue: Record<string, unknown>;
  lens: RecordLens;
  slaDue: string | Date;
  requestedAt: string | Date | null;
}

function normalizePromotionRequest(command: RecordRuntimeStagingWriteCommand["promotion"]): NormalizedPromotionRequest {
  if (!command) {
    throw new RuntimeError("INVALID_PROMOTION_GATE", "Runtime promotion gate details are required.");
  }
  if (!command.proposedValue || typeof command.proposedValue !== "object" || Array.isArray(command.proposedValue)) {
    throw new RuntimeError("INVALID_PROMOTION_GATE", "Runtime promotion gates require a proposed value.", {
      proposedValue: command.proposedValue,
    });
  }
  if (!command.lens?.validAt || !command.lens?.knownAt) {
    throw new RuntimeError("INVALID_PROMOTION_GATE", "Runtime promotion gates require a Record lens.", {
      lens: command.lens,
    });
  }

  return deepFreeze({
    proposedValue: deepFreeze(sortJson(command.proposedValue) as Record<string, unknown>),
    lens: deepFreeze({
      validAt: command.lens.validAt,
      knownAt: command.lens.knownAt,
    }),
    slaDue: command.slaDue,
    requestedAt: command.requestedAt ?? null,
  });
}

function requestRuntimePromotionGate(
  store: RuntimeStore,
  job: RuntimeJob,
  idempotencyKey: string,
  outputRef: RuntimeRecordRef,
  promotion: NormalizedPromotionRequest,
  writtenAt: string,
) {
  assertRuntimeRecordGateService(store, "requestGate");
  const actor = runtimeInitiatorToRecordActor(job.initiator);
  const staged = store.recordService!.stageObject({
    tenantId: job.tenantId,
    idempotencyKey: `stage:${job.jobId}:${idempotencyKey}:${stringifyRuntimeRef(outputRef)}`,
    actor,
    ref: outputRef,
    proposedValue: promotion.proposedValue,
    producedByRun: job.jobId,
    lens: promotion.lens,
    stagedAt: writtenAt,
  });
  const requestedAt =
    promotion.requestedAt === null ? writtenAt : normalizeRequiredTimestamp(promotion.requestedAt, "requestedAt");

  return store.recordService!.requestGate({
    tenantId: job.tenantId,
    idempotencyKey: `gate:${job.jobId}:${idempotencyKey}:${stringifyRuntimeRef(outputRef)}`,
    actor,
    stagingId: staged.stagingObject.stagingId,
    requestedAt,
    slaDue: promotion.slaDue,
  });
}

function assertRuntimeRecordGateService(store: RuntimeStore, operation: string): asserts store is RuntimeStore & {
  recordService: NonNullable<RuntimeStore["recordService"]>;
} {
  if (!store.recordService) {
    throw new RuntimeError("RECORD_GATE_UNAVAILABLE", `Runtime requires the Record service to ${operation}.`);
  }
}

function runtimeInitiatorToRecordActor(initiator: RuntimeInitiator): RecordActor {
  const id = initiator.ref.includes(":") ? initiator.ref.split(":").slice(1).join(":") : initiator.ref;

  if (initiator.kind === "user") {
    return deepFreeze({ kind: "user" as const, id });
  }
  if (initiator.kind === "system") {
    return deepFreeze({ kind: "system" as const, id });
  }

  return deepFreeze({ kind: "agent" as const, id });
}

function assertRuntimeGatePolicyAllowsDecision(
  store: RuntimeStore,
  tenantId: string,
  gate: RecordGate,
  actor: RuntimeInitiator,
  decision: "approved" | "rejected",
) {
  if (decision !== "approved") return;

  const policy = getRuntimeGatePolicy(store, tenantId, gate.objectRef.objectType);

  if (!policy?.fourEyes) return;

  const decider = runtimeInitiatorToRecordActor(actor);

  if (!sameRecordActor(gate.requestedBy, decider)) return;

  throw new RuntimeError(
    "GATE_FOUR_EYES_REQUIRED",
    "Runtime four-eyes gate policy requires a different approver than requester.",
    {
      tenantId,
      gateId: gate.gateId,
      objectType: gate.objectRef.objectType,
      requester: gate.requestedBy,
      decider,
      policy,
    },
  );
}

function sameRecordActor(left: RecordActor, right: RecordActor) {
  const leftOnBehalfOf = "onBehalfOf" in left ? left.onBehalfOf ?? null : null;
  const rightOnBehalfOf = "onBehalfOf" in right ? right.onBehalfOf ?? null : null;

  return left.kind === right.kind && left.id === right.id && leftOnBehalfOf === rightOnBehalfOf;
}

function normalizeGateDecision(value: "approved" | "rejected") {
  if (value !== "approved" && value !== "rejected") {
    throw new RuntimeError("INVALID_GATE_DECISION", "Runtime gate decisions must be approved or rejected.", {
      decision: value,
    });
  }

  return value;
}

function normalizeGateId(value: string, key: string) {
  assertRuntimeUlid(value, key);
  return value;
}

function normalizeGateIds(values: string[], key: string) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RuntimeError("INVALID_GATE_BATCH", "Runtime gate batches require at least one gate.", { [key]: values });
  }

  return uniqueStrings(
    values.map((value) => {
      assertRuntimeUlid(value, key);
      return value;
    }),
  );
}

function normalizeEscalationPath(values: string[]) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RuntimeError("INVALID_GATE_ESCALATION", "Runtime gate escalation sweeps require at least one escalation target.", {
      escalationPath: values,
    });
  }

  return values.map((value, index) => {
    const target = value?.trim();

    if (!target) {
      throw new RuntimeError("INVALID_GATE_ESCALATION", "Runtime gate escalation targets are required.", {
        index,
      });
    }

    return target;
  });
}

function isRuntimeGateOverdue(gate: RecordGate, asOf: string) {
  if (gate.status !== "pending" && gate.status !== "delegated" && gate.status !== "escalated") {
    return false;
  }

  return new Date(gate.slaDue).getTime() <= new Date(asOf).getTime();
}

function findRuntimeGateForJob(store: RuntimeStore, job: RuntimeJob, gateId: string) {
  assertGateActionableForJob(store, job, gateId);

  for (const result of store.stagingWriteResultsByDedupeKey.values()) {
    if (result.gate?.gateId === gateId) {
      return result.gate;
    }
  }

  throw new RuntimeError("GATE_NOT_FOUND", "Runtime gate was not found for this run.", {
    jobId: job.jobId,
    gateId,
  });
}

function findRuntimeRecordGate(store: RuntimeStore & { recordService: NonNullable<RuntimeStore["recordService"]> }, tenantId: string, gateId: string) {
  const gate = store.recordService.listGates({ tenantId }).find((candidate) => candidate.gateId === gateId);

  if (!gate) {
    throw new RuntimeError("GATE_NOT_FOUND", "Runtime gate was not found in the Record service.", {
      tenantId,
      gateId,
    });
  }

  return gate;
}

function assertRuntimeRecordGateOpen(
  store: RuntimeStore & { recordService: NonNullable<RuntimeStore["recordService"]> },
  tenantId: string,
  gateId: string,
  error: { code: string; message: string },
) {
  const gate = findRuntimeRecordGate(store, tenantId, gateId);

  if (!isRuntimeRecordGateOpen(gate)) {
    throw new RuntimeError(error.code, error.message, {
      gateId,
      status: gate.status,
      ...(gate.decision ? { decision: gate.decision } : {}),
    });
  }

  return gate;
}

function isRuntimeRecordGateOpen(gate: RecordGate) {
  return !gate.decision && (gate.status === "pending" || gate.status === "delegated" || gate.status === "escalated");
}

function assertNoOpenRuntimeRecordGatesForCompletion(store: RuntimeStore, job: RuntimeJob) {
  const gateIds = uniqueStrings(job.stagingWrites.map((write) => write.gateRef?.objectId ?? ""));
  if (gateIds.length === 0) return;

  assertRuntimeRecordGateService(store, "complete run with gates");
  const unresolvedChangeGateIds = findUnresolvedGateChangeRequestsForCompletion(store, job);

  if (unresolvedChangeGateIds.length > 0) {
    throw new RuntimeError(
      "UNRESOLVED_GATE_CHANGES_BLOCK_COMPLETION",
      "Runtime runs cannot complete while requested gate changes are unresolved.",
      {
        jobId: job.jobId,
        gateIds: unresolvedChangeGateIds,
      },
    );
  }

  const openGateIds = gateIds.filter((gateId) => {
    if (hasRuntimeGateChangeRequest(store, job.tenantId, job.jobId, gateId)) {
      return false;
    }

    return isRuntimeRecordGateOpen(findRuntimeRecordGate(store, job.tenantId, gateId));
  });

  if (openGateIds.length > 0) {
    throw new RuntimeError("OPEN_GATES_BLOCK_COMPLETION", "Runtime runs cannot complete while Record gates are open.", {
      jobId: job.jobId,
      gateIds: openGateIds,
    });
  }
}

function findUnresolvedGateChangeRequestsForCompletion(
  store: RuntimeStore & { recordService: NonNullable<RuntimeStore["recordService"]> },
  job: RuntimeJob,
) {
  const changeRequests = (store.gateChangeRequestsByTenant.get(job.tenantId) ?? [])
    .filter((request) => request.jobId === job.jobId)
    .sort((left, right) => left.gateId.localeCompare(right.gateId));

  return changeRequests
    .filter((request) => {
      const originalWrite = job.stagingWrites.find((write) => write.gateRef?.objectId === request.gateId);
      if (!originalWrite) return true;

      return !job.stagingWrites.some((write) => {
        if (write.gateRef === undefined) return false;
        if (write.gateRef.objectId === request.gateId) return false;
        if (stringifyRuntimeRef(write.outputRef) !== stringifyRuntimeRef(originalWrite.outputRef)) return false;
        if (write.writtenAt <= request.requestedAt) return false;

        const gate = findRuntimeRecordGate(store, job.tenantId, write.gateRef.objectId);
        return gate.decision === "approved" && gate.status === "approved";
      });
    })
    .map((request) => request.gateId);
}

function assertRuntimeRecordGatesOpenForBatch(
  store: RuntimeStore & { recordService: NonNullable<RuntimeStore["recordService"]> },
  tenantId: string,
  gateIds: string[],
) {
  gateIds.forEach((gateId) => {
    assertRuntimeRecordGateOpen(store, tenantId, gateId, {
      code: "INVALID_GATE_BATCH",
      message: "Runtime gate batch can only decide open gates.",
    });
  });
}

function findRuntimeJobOwningGate(store: RuntimeStore, tenantId: string, gateId: string) {
  return (
    (store.jobsByTenant.get(tenantId) ?? []).find((job) =>
      job.stagingWrites.some((write) => write.gateRef?.objectId === gateId),
    ) ?? null
  );
}

function assertBatchGateConfirmation(
  gates: RecordGate[],
  gateIds: string[],
  confirmation: { gateIds: string[]; objectType: string; diffFields: string[] },
) {
  if (stableStringify(gateIds) !== stableStringify(confirmation.gateIds)) {
    throw new RuntimeError("INVALID_GATE_BATCH", "Runtime gate batch confirmation must enumerate the same gates.", {
      gateIds,
      confirmedGateIds: confirmation.gateIds,
    });
  }

  gates.forEach((gate) => {
    const diffFields = uniqueStrings(gate.diffSnapshot.changes.map((change) => change.field));

    if (gate.objectRef.objectType !== confirmation.objectType) {
      throw new RuntimeError("INVALID_GATE_BATCH", "Runtime gate batch contains mixed object types.", {
        gateId: gate.gateId,
        expectedObjectType: confirmation.objectType,
        actualObjectType: gate.objectRef.objectType,
      });
    }
    if (stableStringify(diffFields) !== stableStringify(confirmation.diffFields)) {
      throw new RuntimeError("INVALID_GATE_BATCH", "Runtime gate batch contains mixed diff classes.", {
        gateId: gate.gateId,
        expectedDiffFields: confirmation.diffFields,
        actualDiffFields: diffFields,
      });
    }
  });
}

function assertGateBelongsToJob(job: RuntimeJob, gateId: string) {
  const ownsGate = job.stagingWrites.some((write) => write.gateRef?.objectId === gateId);

  if (!ownsGate) {
    throw new RuntimeError("GATE_NOT_FOUND", "Runtime gate does not belong to this run.", {
      jobId: job.jobId,
      gateId,
    });
  }
}

function assertGateActionableForJob(store: RuntimeStore, job: RuntimeJob, gateId: string) {
  assertGateBelongsToJob(job, gateId);

  if (isTerminalStatus(job.status)) {
    throw new RuntimeError("RUN_TERMINAL", "Runtime terminal runs cannot mutate gates.", {
      jobId: job.jobId,
      gateId,
      status: job.status,
    });
  }

  if (hasRuntimeGateChangeRequest(store, job.tenantId, job.jobId, gateId)) {
    throw new RuntimeError("GATE_CHANGES_REQUESTED", "Runtime gate was returned for changes and is no longer actionable.", {
      jobId: job.jobId,
      gateId,
    });
  }
}

function hasRuntimeGateChangeRequest(store: RuntimeStore, tenantId: string, jobId: string, gateId: string) {
  return (store.gateChangeRequestsByTenant.get(tenantId) ?? []).some(
    (request) => request.jobId === jobId && request.gateId === gateId,
  );
}

function getBudgetExceededReason(budget: RuntimeBudget, meter: RuntimeMeter) {
  if (budget.tokenCeiling !== null && meter.tokens > budget.tokenCeiling) {
    return deepFreeze({ metric: "tokens", ceiling: budget.tokenCeiling, actual: meter.tokens });
  }
  if (budget.toolCallCeiling !== null && meter.toolCalls > budget.toolCallCeiling) {
    return deepFreeze({ metric: "toolCalls", ceiling: budget.toolCallCeiling, actual: meter.toolCalls });
  }
  if (budget.wallclockMs !== null && meter.wallclockMs > budget.wallclockMs) {
    return deepFreeze({ metric: "wallclockMs", ceiling: budget.wallclockMs, actual: meter.wallclockMs });
  }

  return null;
}

function assertTenantConcurrencyAvailable(store: RuntimeStore, job: RuntimeJob) {
  const guard = store.tenantBudgetGuards.get(job.tenantId);
  if (!guard?.maxConcurrentRunningJobs) return;

  const runningJobs = (store.jobsByTenant.get(job.tenantId) ?? []).filter(
    (candidate) => candidate.status === "running" && candidate.jobId !== job.jobId,
  );

  if (runningJobs.length >= guard.maxConcurrentRunningJobs) {
    throw new RuntimeError("TENANT_CONCURRENCY_LIMIT", "Tenant running-job concurrency guard blocked this run.", {
      tenantId: job.tenantId,
      maxConcurrentRunningJobs: guard.maxConcurrentRunningJobs,
      runningJobs: runningJobs.map((runningJob) => runningJob.jobId),
    });
  }
}

function getTenantSpendExceededReason(store: RuntimeStore, tenantId: string, stepMeter: RuntimeMeter) {
  const guard = store.tenantBudgetGuards.get(tenantId);
  if (guard?.monthlyCostWeightCeiling === null || guard?.monthlyCostWeightCeiling === undefined) {
    return null;
  }

  const spent = getTenantCostWeightSpent(store, tenantId);
  const actual = spent + stepMeter.costWeight;

  if (actual > guard.monthlyCostWeightCeiling) {
    return deepFreeze({
      metric: "tenantMonthlyCostWeight",
      ceiling: guard.monthlyCostWeightCeiling,
      actual,
    });
  }

  return null;
}

function getTenantCostWeightSpent(store: RuntimeStore, tenantId: string) {
  return (store.costTelemetryByTenant.get(tenantId) ?? []).reduce(
    (total, entry) => total + readCostMetric(entry.cost, "costWeight"),
    0,
  );
}

function normalizePins(pins: RuntimePinSnapshot) {
  const corpusVersion =
    pins.corpusVersion === undefined || pins.corpusVersion === null
      ? null
      : normalizePositiveInteger(pins.corpusVersion, "corpusVersion");

  return deepFreeze({
    corpusVersion,
    rulepackVersions: normalizeStringMap(pins.rulepackVersions ?? {}, "rulepackVersions"),
    modelVersions: normalizeStringMap(pins.modelVersions ?? {}, "modelVersions"),
  });
}

function normalizePriorityLane(value: RuntimePriorityLane) {
  if (!RUNTIME_PRIORITY_LANES.includes(value)) {
    throw new RuntimeError("INVALID_PRIORITY_LANE", "Runtime priority lane is invalid.", { priorityLane: value });
  }
  return value;
}

function normalizeClaimLanes(values?: RuntimePriorityLane[]) {
  if (values === undefined || values.length === 0) {
    return [...RUNTIME_PRIORITY_LANES] as RuntimePriorityLane[];
  }
  const allowed = new Set(values.map((value) => normalizePriorityLane(value)));

  return RUNTIME_PRIORITY_LANES.filter((lane) => allowed.has(lane)) as RuntimePriorityLane[];
}

function normalizeJobStatus(value: RuntimeJobStatus) {
  if (!RUNTIME_JOB_STATUSES.includes(value)) {
    throw new RuntimeError("INVALID_JOB_STATUS", "Runtime job status is invalid.", { status: value });
  }
  return value;
}

function normalizeTimestamp(value: string | Date | null, key: string) {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RuntimeError("INVALID_TIMESTAMP", `Runtime step ${key} must be an ISO timestamp.`, { [key]: value });
  }

  return date.toISOString();
}

function normalizeRequiredTimestamp(value: string | Date, key: string) {
  const timestamp = normalizeTimestamp(value, key);
  if (timestamp === null) {
    throw new RuntimeError("INVALID_TIMESTAMP", `Runtime ${key} is required.`);
  }
  return timestamp;
}

function normalizeStepCost(value: Record<string, unknown>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RuntimeError("INVALID_STEP", "Runtime step cost must be an object.", { cost: value });
  }

  return deepFreeze(sortJson(value) as Record<string, unknown>);
}

function initialRetryState(): RuntimeRetryState {
  return deepFreeze({
    attempts: 0,
    nextRetryAt: null,
    lastFailure: null,
    poisonEntryId: null,
  });
}

function normalizePlanSteps(
  steps: Array<{
    action: string;
    scope?: Partial<RuntimeScope>;
    toolClass: RuntimePlanToolClass;
  }>,
) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new RuntimeError("INVALID_PLAN", "Runtime plans require at least one step.");
  }

  return deepFreeze(
    steps.map((step) => ({
      action: normalizeRequiredText(step.action, "step.action"),
      scope: normalizeScope(step.scope ?? {}),
      toolClass: normalizePlanToolClass(step.toolClass),
    })),
  );
}

function normalizePlanToolClass(value: RuntimePlanToolClass) {
  if (!RUNTIME_PLAN_TOOL_CLASSES.includes(value)) {
    throw new RuntimeError("INVALID_PLAN", "Runtime plan step toolClass is invalid.", { toolClass: value });
  }
  return value;
}

function normalizePlanPreviewItems(items: RuntimePlanPreviewItem[]) {
  if (!Array.isArray(items)) {
    throw new RuntimeError("INVALID_PLAN", "Runtime plan preview items must be an array.", { items });
  }

  return deepFreeze(
    items.map((item) => ({
      objectType: normalizeObjectType(item.objectType),
      label: normalizeRequiredText(item.label, "label"),
      reason: item.reason?.trim() || null,
    })),
  );
}

function normalizePermissionVerdict(value: RuntimePlanPermissionVerdict): RuntimePlanPermissionVerdict {
  if (!value || typeof value.allowed !== "boolean") {
    throw new RuntimeError("INVALID_PLAN", "Runtime plan permission verdict requires an allowed boolean.", {
      permissionVerdict: value,
    });
  }

  return deepFreeze({
    allowed: value.allowed,
    reason: value.reason?.trim() || null,
  });
}

function normalizePlanSource(value: { kind: RuntimePlanSourceKind; ref?: string | null }): RuntimePlanSource {
  if (!value || !RUNTIME_PLAN_SOURCES.includes(value.kind)) {
    throw new RuntimeError("INVALID_PLAN", "Runtime plan source kind is invalid.", { source: value });
  }

  return deepFreeze({
    kind: value.kind,
    ref: value.ref?.trim() || null,
  });
}

function normalizeScheduleTrigger(value: RuntimeScheduleTrigger): RuntimeScheduleTrigger {
  if (!value || !["calendar", "record-change", "manual"].includes(value.kind)) {
    throw new RuntimeError("INVALID_SCHEDULE", "Runtime schedule trigger kind is invalid.", { trigger: value });
  }

  return deepFreeze({
    kind: value.kind,
    ref: normalizeRequiredText(value.ref, "trigger.ref"),
    cadence: normalizeRequiredText(value.cadence, "trigger.cadence"),
    timezone: normalizeRequiredText(value.timezone ?? "UTC", "trigger.timezone"),
    nextFireAt:
      value.nextFireAt === undefined || value.nextFireAt === null
        ? null
        : normalizeRequiredTimestamp(value.nextFireAt, "trigger.nextFireAt"),
  });
}

function normalizeSchedulePlanTemplate(
  value: RegisterRuntimeScheduleCommand["planTemplate"],
): RuntimeSchedulePlanTemplate {
  const permissionVerdict = normalizePermissionVerdict(value.permissionVerdict ?? { allowed: true, reason: null });
  if (!permissionVerdict.allowed) {
    throw new RuntimeError("SCHEDULE_TEMPLATE_NOT_APPROVED", "Schedule plan templates must be pre-approved.", {
      reason: permissionVerdict.reason,
    });
  }

  return deepFreeze({
    kind: normalizePlanJobKind(value.kind),
    scope: normalizeScope(value.scope ?? {}),
    intentRestated: normalizeRequiredText(value.intentRestated, "intentRestated"),
    steps: normalizePlanSteps(value.steps),
    invalidationsPreview: normalizePlanPreviewItems(value.invalidationsPreview ?? []),
    produces: normalizePlanPreviewItems(value.produces ?? []),
    estDurationMs: normalizeNonNegativeInteger(value.estDurationMs, "estDurationMs"),
    costClass: normalizeCostClass(value.costClass),
    instructionEcho: value.instructionEcho?.trim() ?? "",
    permissionVerdict,
    priorityLane: normalizePriorityLane(value.priorityLane ?? "background"),
  });
}

function normalizeScheduleStatus(value: RuntimeScheduleStatus) {
  if (value !== "active" && value !== "orphaned") {
    throw new RuntimeError("INVALID_SCHEDULE", "Runtime schedule status is invalid.", { status: value });
  }
  return value;
}

function capabilityMapCoversScheduleTemplate(
  capabilityMap: RuntimeCapabilityMap,
  template: RuntimeSchedulePlanTemplate,
) {
  const capabilityScope = capabilityMapToScope(capabilityMap);
  if (!scopeContains(capabilityScope, scopeWithoutPeriod(template.scope))) return false;

  return template.steps.every(
    (step) => capabilityMap.toolClasses.includes(step.toolClass) && scopeContains(capabilityScope, scopeWithoutPeriod(step.scope)),
  );
}

function scopeWithoutPeriod(scope: RuntimeScope): RuntimeScope {
  return deepFreeze({
    ...scope,
    period: null,
  });
}

function createScheduleOrphan(previousOwner: RuntimeInitiator, orphanedAt: string): RuntimeScheduleOrphan {
  return deepFreeze({
    reason: "owner_scope_lost" as const,
    previousOwner,
    orphanedAt,
    reassignmentPrompt: deepFreeze({
      target: "workspace-owner" as const,
      message: "Watcher owner no longer has the scope required by this schedule.",
    }),
  });
}

function createScheduledPlanRun(
  store: RuntimeStore,
  schedule: RuntimeSchedule,
  idempotencyKey: string,
  pins: ReturnType<typeof normalizePins>,
  firedAt: string,
) {
  const planId = createRuntimeUlid();
  const jobId = createRuntimeUlid();
  const initiator = deepFreeze({ kind: "watcher" as const, ref: `schedule:${schedule.scheduleId}` });
  const planRef = deepFreeze({ objectType: "plan", objectId: planId });
  const plan = deepFreeze({
    tenantId: schedule.tenantId,
    planId,
    planRef,
    kind: schedule.planTemplate.kind,
    initiator,
    scope: schedule.planTemplate.scope,
    status: "approved" as const,
    intentRestated: schedule.planTemplate.intentRestated,
    steps: schedule.planTemplate.steps,
    invalidationsPreview: schedule.planTemplate.invalidationsPreview,
    produces: schedule.planTemplate.produces,
    estDurationMs: schedule.planTemplate.estDurationMs,
    costClass: schedule.planTemplate.costClass,
    instructionEcho: schedule.planTemplate.instructionEcho,
    permissionVerdict: schedule.planTemplate.permissionVerdict,
    source: deepFreeze({ kind: "schedule_ref" as const, ref: schedule.scheduleId }),
    supersedesPlanId: null,
    approvedJobId: jobId,
    createdAt: firedAt,
    updatedAt: firedAt,
  });
  const instructionSet = composeRuntimeInstructionSet(store, schedule.tenantId, plan.scope);
  const job = deepFreeze({
    tenantId: schedule.tenantId,
    jobId,
    parentJobId: null,
    kind: schedule.planTemplate.kind,
    initiator,
    scope: schedule.planTemplate.scope,
    planRef,
    manifestRef: null,
    instructionSet: {
      setHash: instructionSet.setHash,
      refs: instructionSet.refs,
    },
    pins,
    budget: createRuntimeBudget(schedule.planTemplate.costClass),
    meter: initialRuntimeMeter(),
    idempotencyKey,
    priorityLane: schedule.planTemplate.priorityLane,
    steps: [],
    readPins: [],
    stagingWrites: [],
    composite: null,
    retry: initialRetryState(),
    status: "queued" as const,
    failure: null,
    createdAt: firedAt,
    updatedAt: firedAt,
  });

  store.plansByTenant.set(schedule.tenantId, [...(store.plansByTenant.get(schedule.tenantId) ?? []), plan]);
  store.jobsByTenant.set(schedule.tenantId, [...(store.jobsByTenant.get(schedule.tenantId) ?? []), job]);
  emitRunEvent(store, job, "run.queued", firedAt, {
    status: job.status,
    kind: job.kind,
    planRef,
    scheduleId: schedule.scheduleId,
  });

  return { plan, job };
}

function normalizeRequiredText(value: string, key: string) {
  if (!value?.trim()) {
    throw new RuntimeError("INVALID_PLAN", `Runtime plan ${key} is required.`);
  }
  return value.trim();
}

function normalizeObjectType(value: string) {
  if (!OBJECT_TYPE_PATTERN.test(value?.trim())) {
    throw new RuntimeError("INVALID_REF", "Runtime objectType is invalid.", { objectType: value });
  }
  return value.trim();
}

function normalizeNonNegativeInteger(value: number, key: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RuntimeError("INVALID_PLAN", `Runtime plan ${key} must be a non-negative integer.`, { [key]: value });
  }
  return value;
}

function normalizePositiveInteger(value: number, key: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RuntimeError("INVALID_PLAN", `Runtime ${key} must be a positive integer.`, { [key]: value });
  }
  return value;
}

function normalizeStringMap(value: Record<string, string>, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RuntimeError("INVALID_PLAN", `Runtime ${key} must be an object.`, { [key]: value });
  }

  return deepFreeze(
    Object.fromEntries(
      Object.entries(value)
        .map(([entryKey, entryValue]) => [entryKey.trim(), entryValue.trim()] as const)
        .filter(([entryKey, entryValue]) => entryKey && entryValue)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function normalizeTransitionFailure(status: RuntimeJobStatus, failure: RuntimeFailure | null) {
  if (status === "failed") {
    if (!failure) {
      throw new RuntimeError("INVALID_FAILURE", "Failed runs require a failure detail.", { status });
    }
    if (failure.class === "budget") {
      throw new RuntimeError("INVALID_FAILURE", "Budget failures must use the budget-exceeded status.", { failure });
    }

    return normalizeFailure(failure);
  }

  if (status === "budget-exceeded") {
    if (failure && failure.class !== "budget") {
      throw new RuntimeError("INVALID_FAILURE", "Budget-exceeded runs require a budget failure class.", { failure });
    }

    return normalizeFailure(failure ?? { class: "budget", detailRef: null });
  }

  if (status === "completed" || status === "cancelled") {
    if (failure) {
      throw new RuntimeError("INVALID_FAILURE", "Completed and cancelled runs cannot carry failure details.", {
        status,
      });
    }
    return null;
  }

  if (failure) {
    throw new RuntimeError("INVALID_FAILURE", "Failure details are only allowed on terminal failure statuses.", {
      status,
    });
  }

  return null;
}

function normalizeFailure(failure: RuntimeFailure): RuntimeFailure {
  if (!RUNTIME_FAILURE_CLASSES.includes(failure.class)) {
    throw new RuntimeError("INVALID_FAILURE", "Runtime failure class is invalid.", { failure });
  }

  return deepFreeze({
    class: failure.class,
    detailRef: failure.detailRef === null ? null : normalizeRecordRef(failure.detailRef),
  });
}

function assertTransitionAllowed(current: RuntimeJobStatus, next: RuntimeJobStatus) {
  const allowed = getAllowedTransitions(current);

  if (!allowed.includes(next)) {
    throw new RuntimeError("INVALID_TRANSITION", "Runtime job status transition is invalid.", { current, next });
  }
}

function assertTraceComplete(job: RuntimeJob) {
  if (job.kind === "composite") {
    return;
  }
  if (job.steps.length === 0) {
    throw new RuntimeError("TRACE_INCOMPLETE", "Runtime runs cannot complete without at least one recorded trace step.", {
      jobId: job.jobId,
      kind: job.kind,
    });
  }
}

function getAllowedTransitions(status: RuntimeJobStatus): RuntimeJobStatus[] {
  switch (status) {
    case "queued":
      return ["planning", "cancelled"];
    case "planning":
      return ["running", "failed", "cancelled", "budget-exceeded"];
    case "running":
      return ["producing", "failed", "cancelled", "budget-exceeded"];
    case "producing":
      return ["awaiting-gate", "completed", "failed", "cancelled", "budget-exceeded"];
    case "awaiting-gate":
      return ["completed", "failed", "cancelled", "budget-exceeded"];
    case "completed":
    case "failed":
    case "cancelled":
    case "budget-exceeded":
      return [];
  }
}

function getRunEventType(status: RuntimeJobStatus): RuntimeEventType {
  switch (status) {
    case "queued":
      return "run.queued";
    case "planning":
      return "run.planning";
    case "running":
      return "run.started";
    case "producing":
      return "run.producing";
    case "awaiting-gate":
      return "run.awaiting_gate";
    case "completed":
      return "run.completed";
    case "failed":
      return "run.failed";
    case "cancelled":
      return "run.cancelled";
    case "budget-exceeded":
      return "run.budget_exceeded";
  }
}

function emitRunEvent(
  store: RuntimeStore,
  job: RuntimeJob,
  type: RuntimeEventType,
  occurredAt: string,
  payload: Record<string, unknown>,
) {
  const event = deepFreeze({
    eventId: createRuntimeUlid(),
    tenantId: job.tenantId,
    jobId: job.jobId,
    type,
    occurredAt,
    payload: deepFreeze(sortJson(payload) as Record<string, unknown>),
  });

  store.eventsByTenant.set(job.tenantId, [...(store.eventsByTenant.get(job.tenantId) ?? []), event]);

  return event;
}

function createCompositeManifest(
  parentJobId: string,
  failFast: boolean,
  childJobs: RuntimeCompositeChild[],
  children: RuntimeJob[],
): RuntimeCompositeManifest {
  const childByJobId = new Map(children.map((child) => [child.jobId, child]));
  const statusByKey = Object.fromEntries(
    childJobs.map((child) => [child.key, childByJobId.get(child.jobId)?.status ?? "queued"]),
  ) as Record<string, RuntimeJobStatus>;
  const completedChildKeys = childJobs
    .filter((child) => statusByKey[child.key] === "completed")
    .map((child) => child.key);
  const failedChildKeys = childJobs
    .filter((child) => statusByKey[child.key] === "failed" || statusByKey[child.key] === "budget-exceeded")
    .map((child) => child.key);
  const cancelledChildKeys = childJobs
    .filter((child) => statusByKey[child.key] === "cancelled")
    .map((child) => child.key);
  const terminal = childJobs.every((child) => isTerminalStatus(statusByKey[child.key]));

  return deepFreeze({
    parentJobId,
    failFast,
    childJobs,
    statusByKey,
    completedChildKeys,
    failedChildKeys,
    cancelledChildKeys,
    terminal,
  });
}

function isTerminalStatus(status: RuntimeJobStatus) {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "budget-exceeded";
}

function isFailureStatus(status: RuntimeJobStatus) {
  return status === "failed" || status === "budget-exceeded";
}

function normalizeInstructionText(value: string) {
  const text = value.trim();

  if (!text) {
    throw new RuntimeError("INVALID_INSTRUCTION", "Runtime instruction text is required.");
  }

  return text;
}

function normalizeInstructionScope(scope: Partial<RuntimeInstructionScope> & { kind: RuntimeInstructionScopeKind }) {
  if (!scope || !RUNTIME_INSTRUCTION_SCOPE_KINDS.includes(scope.kind)) {
    throw new RuntimeError("INVALID_INSTRUCTION_SCOPE", "Runtime instruction scope kind is invalid.", { scope });
  }

  const normalized = deepFreeze({
    kind: scope.kind,
    jurisdictions: uniqueStrings((scope.jurisdictions ?? []).map((jurisdiction) => jurisdiction.toUpperCase())),
    objectRefs: uniqueRecordRefs((scope.objectRefs ?? []).map((ref) => normalizeRecordRef(ref))),
    docType: scope.docType?.trim() || null,
    section: scope.section?.trim() || null,
  });

  if (normalized.kind === "jurisdiction" && normalized.jurisdictions.length === 0) {
    throw new RuntimeError("INVALID_INSTRUCTION_SCOPE", "Jurisdiction instructions require at least one jurisdiction.");
  }
  if (normalized.kind === "object" && normalized.objectRefs.length === 0) {
    throw new RuntimeError("INVALID_INSTRUCTION_SCOPE", "Object instructions require at least one object ref.");
  }
  if (normalized.kind === "doc-type" && !normalized.docType) {
    throw new RuntimeError("INVALID_INSTRUCTION_SCOPE", "Document-type instructions require a docType.");
  }
  if (normalized.kind === "section" && !normalized.section) {
    throw new RuntimeError("INVALID_INSTRUCTION_SCOPE", "Section instructions require a section.");
  }

  return normalized;
}

function normalizeInstructionStatus(value: RuntimeInstructionStatus) {
  if (!RUNTIME_INSTRUCTION_STATUSES.includes(value)) {
    throw new RuntimeError("INVALID_INSTRUCTION_STATUS", "Runtime instruction status is invalid.", { status: value });
  }

  return value;
}

function compileRuntimeInstruction(text: string): RuntimeCompiledInstruction {
  const lower = text.toLowerCase();

  if (isAmbiguousInstruction(lower)) {
    return deepFreeze({
      target: "generation-constraints" as const,
      directives: [deepFreeze({ key: "run.text", value: text })],
      confidence: 0.42,
    });
  }

  if (isStyleInstruction(lower)) {
    return deepFreeze({
      target: "generation-constraints" as const,
      directives: [deepFreeze({ key: "style.text", value: text })],
      confidence: 0.92,
    });
  }

  if (isScopeInstruction(lower)) {
    return deepFreeze({
      target: "scope-definition" as const,
      directives: [deepFreeze({ key: "scope.text", value: text })],
      confidence: 0.88,
    });
  }

  if (isMethodologyInstruction(lower)) {
    return deepFreeze({
      target: "engine-parameters" as const,
      directives: [deepFreeze({ key: "methodology.text", value: text })],
      confidence: 0.9,
    });
  }

  return deepFreeze({
    target: "generation-constraints" as const,
    directives: [deepFreeze({ key: "run.text", value: text })],
    confidence: 0.82,
  });
}

function classifyInstructionTier(text: string, compiled: RuntimeCompiledInstruction): RuntimeInstructionTier {
  const lower = text.toLowerCase();

  if (isStyleInstruction(lower)) return "style";
  if (isMethodologyInstruction(lower)) return "methodology";
  if (compiled.target === "scope-definition") return "run";

  return "run";
}

function isStyleInstruction(lower: string) {
  return [
    "plain english",
    "plain language",
    "concise",
    "tone",
    "voice",
    "format",
    "narrative",
    "spelling",
    "capitalization",
  ].some((marker) => lower.includes(marker));
}

function isScopeInstruction(lower: string) {
  return ["scope", "only", "exclude", "include", "watch", "ignore"].some((marker) => lower.includes(marker));
}

function isMethodologyInstruction(lower: string) {
  return [
    "method",
    "methodology",
    "range",
    "interquartile",
    "pli",
    "comparable",
    "comparables",
    "engine",
    "election",
    "suppress",
    "screen",
  ].some((marker) => lower.includes(marker));
}

function isAmbiguousInstruction(lower: string) {
  return [
    "usual approach",
    "normal approach",
    "appropriate approach",
    "best approach",
    "as needed",
    "whatever is needed",
    "do what is needed",
  ].some((marker) => lower.includes(marker));
}

function emitInstructionEvent(
  store: RuntimeStore,
  tenantId: string,
  type: RuntimeInstructionEvent["type"],
  occurredAt: string,
  payload: Record<string, unknown>,
) {
  const event = deepFreeze({
    eventId: createRuntimeUlid(),
    tenantId,
    type,
    occurredAt,
    payload: deepFreeze(payload),
  });

  store.instructionEventsByTenant.set(tenantId, [...(store.instructionEventsByTenant.get(tenantId) ?? []), event]);
  return event;
}

function findRuntimeInstruction(store: RuntimeStore, tenantId: string, instructionId: string) {
  return (
    (store.instructionsByTenant.get(tenantId) ?? []).find((instruction) => instruction.instructionId === instructionId) ??
    null
  );
}

function replaceRuntimeInstruction(store: RuntimeStore, instruction: RuntimeInstruction) {
  store.instructionsByTenant.set(
    instruction.tenantId,
    (store.instructionsByTenant.get(instruction.tenantId) ?? []).map((candidate) =>
      candidate.instructionId === instruction.instructionId ? instruction : candidate,
    ),
  );
}

function findRuntimeInstructionShadowPreview(
  store: RuntimeStore,
  tenantId: string,
  tier: RuntimeInstructionTier,
  scope: RuntimeInstructionScope,
) {
  const scopeKey = stableStringify(scope);
  const specificity = getInstructionScopeSpecificity(scope);

  return deepFreeze(
    (store.instructionsByTenant.get(tenantId) ?? [])
      .filter((instruction) => {
        if (instruction.tier !== tier || instruction.status !== "active") return false;
        if (!instructionScopesOverlap(instruction.scope, scope)) return false;

        const candidateScopeKey = stableStringify(instruction.scope);
        if (candidateScopeKey === scopeKey) return true;

        return getInstructionScopeSpecificity(instruction.scope) < specificity;
      })
      .sort(compareInstructionsForPrecedence),
  );
}

function instructionScopesOverlap(left: RuntimeInstructionScope, right: RuntimeInstructionScope) {
  if (left.kind === "org" || right.kind === "org") return true;
  if (left.kind === "object" || right.kind === "object") {
    return instructionObjectScopesOverlap(left, right);
  }
  if (left.kind === "jurisdiction" && right.kind === "jurisdiction") {
    const rightJurisdictions = new Set(right.jurisdictions);
    return left.jurisdictions.some((jurisdiction) => rightJurisdictions.has(jurisdiction));
  }
  if (left.kind === "doc-type" && right.kind === "doc-type") return left.docType === right.docType;
  if (left.kind === "section" && right.kind === "section") return left.section === right.section;

  return left.kind === "section" || right.kind === "section" || left.kind === "doc-type" || right.kind === "doc-type";
}

function instructionObjectScopesOverlap(left: RuntimeInstructionScope, right: RuntimeInstructionScope) {
  if (left.kind !== "object" || right.kind !== "object") {
    const objectScope = left.kind === "object" ? left : right;
    const otherScope = left.kind === "object" ? right : left;

    if (otherScope.kind === "org" || otherScope.kind === "section" || otherScope.kind === "doc-type") return true;
    if (otherScope.kind === "jurisdiction" && objectScope.jurisdictions.length > 0) {
      const objectJurisdictions = new Set(objectScope.jurisdictions);
      return otherScope.jurisdictions.some((jurisdiction) => objectJurisdictions.has(jurisdiction));
    }

    return false;
  }

  const rightRefs = new Set(right.objectRefs.map((ref) => stringifyRuntimeRef(ref)));
  return left.objectRefs.some((ref) => rightRefs.has(stringifyRuntimeRef(ref)));
}

function supersedeIdenticalInstructionScope(
  store: RuntimeStore,
  tenantId: string,
  tier: RuntimeInstructionTier,
  scope: RuntimeInstructionScope,
  occurredAt: string,
) {
  const scopeKey = stableStringify(scope);
  const existing = (store.instructionsByTenant.get(tenantId) ?? []).find(
    (instruction) =>
      instruction.tier === tier && instruction.status === "active" && stableStringify(instruction.scope) === scopeKey,
  );

  if (!existing) return null;

  const superseded = deepFreeze({
    ...existing,
    status: "superseded" as const,
    updatedAt: occurredAt,
  });

  replaceRuntimeInstruction(store, superseded);
  emitInstructionEvent(store, tenantId, "instruction.superseded", occurredAt, {
    instructionRef: superseded.instructionRef,
    tier,
    scope,
  });

  return superseded;
}

function requestRuntimeInstructionApprovalGate(
  store: RuntimeStore,
  instruction: RuntimeInstruction,
  requestedAt: string,
  slaDue: string,
) {
  assertRuntimeRecordGateService(store, "request methodology instruction approval gate");
  const actor = runtimeInitiatorToRecordActor(instruction.author);
  const instructionRef = deepFreeze({ objectType: "instruction", objectId: instruction.instructionId });
  const staged = store.recordService.stageObject({
    tenantId: instruction.tenantId,
    idempotencyKey: `instruction:${instruction.instructionId}:approval-stage`,
    actor,
    ref: instructionRef,
    proposedValue: runtimeInstructionCanonicalValue(instruction, "active"),
    lens: {
      validAt: requestedAt.slice(0, 10),
      knownAt: requestedAt,
    },
    stagedAt: requestedAt,
  });

  return store.recordService.requestGate({
    tenantId: instruction.tenantId,
    idempotencyKey: `instruction:${instruction.instructionId}:approval-gate`,
    actor,
    stagingId: staged.stagingObject.stagingId,
    requestedAt,
    slaDue,
  });
}

function decideRuntimeInstructionApprovalGate(
  store: RuntimeStore,
  instruction: RuntimeInstruction,
  approvedBy: RuntimeInitiator,
  approvedAt: string,
  gateId: string,
  idempotencyKey: string,
) {
  assertRuntimeRecordGateService(store, "decide methodology instruction approval gate");
  const gate = findRuntimeRecordGate(store, instruction.tenantId, gateId);

  assertRuntimeGatePolicyAllowsDecision(store, instruction.tenantId, gate, approvedBy, "approved");

  return store.recordService.decideGate({
    tenantId: instruction.tenantId,
    idempotencyKey: `instruction:${instruction.instructionId}:approval-decision:${idempotencyKey}`,
    actor: runtimeInitiatorToRecordActor(approvedBy),
    gateId,
    decision: "approved",
    decidedAt: approvedAt,
  });
}

function runtimeInstructionCanonicalValue(
  instruction: RuntimeInstruction,
  status: RuntimeInstructionStatus,
): Record<string, unknown> {
  return deepFreeze({
    instrId: instruction.instructionId,
    tier: RUNTIME_INSTRUCTION_TIER_NUMBERS[instruction.tier],
    scope: sortJson(instruction.scope) as Record<string, unknown>,
    text: instruction.text,
    compiled: sortJson(instruction.compiled) as Record<string, unknown>,
    status,
    author: instruction.author.ref,
    approvedBy: null,
    sensitivity: 0,
  });
}

function defaultRuntimeInstructionApprovalSlaDue(requestedAt: string) {
  return new Date(new Date(requestedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function composeRuntimeInstructionSet(store: RuntimeStore, tenantId: string, scope: RuntimeScope): RuntimeInstructionSet {
  const instructions = (store.instructionsByTenant.get(tenantId) ?? [])
    .filter((instruction) => instruction.status === "active" && instructionAppliesToScope(instruction, scope))
    .sort(compareInstructionsForPrecedence);
  const refs = instructions.map((instruction) => instruction.instructionRef);

  return deepFreeze({
    setHash: refs.length === 0 ? null : `instruction-set:${hashStableString(stableStringify(refs))}`,
    refs,
    instructions,
  });
}

function instructionAppliesToScope(instruction: RuntimeInstruction, scope: RuntimeScope) {
  if (instruction.scope.kind === "org") return true;
  if (instruction.scope.kind === "section" || instruction.scope.kind === "doc-type") return true;
  if (instruction.scope.kind === "jurisdiction") {
    return instruction.scope.jurisdictions.some((jurisdiction) => scope.jurisdictions.includes(jurisdiction));
  }
  if (instruction.scope.kind === "object") {
    const scopeRefs = new Set(scope.objectRefs.map((ref) => stringifyRuntimeRef(ref)));
    return instruction.scope.objectRefs.some((ref) => scopeRefs.has(stringifyRuntimeRef(ref)));
  }

  return false;
}

function compareInstructionsForPrecedence(left: RuntimeInstruction, right: RuntimeInstruction) {
  if (left.tier !== right.tier) {
    return left.createdAt.localeCompare(right.createdAt) || left.instructionId.localeCompare(right.instructionId);
  }

  const specificityDelta = getInstructionScopeSpecificity(right.scope) - getInstructionScopeSpecificity(left.scope);
  if (specificityDelta !== 0) return specificityDelta;

  return right.createdAt.localeCompare(left.createdAt) || right.instructionId.localeCompare(left.instructionId);
}

function getInstructionScopeSpecificity(scope: RuntimeInstructionScope) {
  switch (scope.kind) {
    case "object":
      return 5;
    case "section":
    case "doc-type":
      return 4;
    case "jurisdiction":
      return 3;
    case "org":
      return 1;
  }
}

function hashStableString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeInitiator(value: RuntimeInitiator): RuntimeInitiator {
  if (!value || !RUNTIME_INITIATOR_KINDS.includes(value.kind)) {
    throw new RuntimeError("INVALID_INITIATOR", "Runtime initiator kind is invalid.", { initiator: value });
  }
  if (!value.ref?.trim()) {
    throw new RuntimeError("INVALID_INITIATOR", "Runtime initiator ref is required.");
  }
  return deepFreeze({
    kind: value.kind,
    ref: value.ref.trim(),
  });
}

function normalizeScope(scope: Partial<RuntimeScope>): RuntimeScope {
  return deepFreeze({
    entityIds: uniqueStrings(scope.entityIds ?? []),
    jurisdictions: uniqueStrings((scope.jurisdictions ?? []).map((jurisdiction) => jurisdiction.toUpperCase())),
    objectRefs: uniqueRecordRefs((scope.objectRefs ?? []).map((ref) => normalizeRecordRef(ref))),
    period: scope.period?.trim() || null,
  });
}

function normalizeRecordRef(ref: RuntimeRecordRef): RuntimeRecordRef {
  if (!ref || !OBJECT_TYPE_PATTERN.test(ref.objectType)) {
    throw new RuntimeError("INVALID_REF", "Runtime record refs require a valid objectType.", { ref });
  }
  if (!RUNTIME_ULID_PATTERN.test(ref.objectId)) {
    throw new RuntimeError("INVALID_REF", "Runtime record refs require a ULID objectId.", { ref });
  }
  if (ref.version !== undefined && (!Number.isInteger(ref.version) || ref.version < 1)) {
    throw new RuntimeError("INVALID_REF", "Runtime record ref versions must be positive integers.", { ref });
  }
  return deepFreeze({
    objectType: ref.objectType,
    objectId: ref.objectId,
    ...(ref.version === undefined ? {} : { version: ref.version }),
  });
}

function normalizeGateChangeComments(comments: RuntimeGateChangeComment[]) {
  if (!Array.isArray(comments) || comments.length === 0) {
    throw new RuntimeError("INVALID_GATE_CHANGE_REQUEST", "Gate change requests require at least one anchored comment.");
  }

  return deepFreeze(
    comments.map((comment) => ({
      anchorRef: normalizeRecordRef(comment.anchorRef),
      text: normalizeRequiredText(comment.text, "comment.text"),
    })),
  );
}

function createRuntimeUlid() {
  let value = "";
  for (let index = 0; index < 26; index += 1) {
    value += RUNTIME_ULID_ALPHABET[Math.floor(Math.random() * RUNTIME_ULID_ALPHABET.length)];
  }
  return value;
}

function assertRuntimeUlid(value: string, key: string) {
  if (!RUNTIME_ULID_PATTERN.test(value)) {
    throw new RuntimeError("INVALID_JOB_ID", `Runtime ${key} must be a ULID.`, { [key]: value });
  }
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function uniqueRecordRefs(refs: RuntimeRecordRef[]) {
  const byKey = new Map<string, RuntimeRecordRef>();
  refs.forEach((ref) => {
    byKey.set(stringifyRuntimeRef(ref), ref);
  });
  return Array.from(byKey.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref);
}

function stringifyRuntimeRef(ref: RuntimeRecordRef) {
  return `${ref.objectType}:${ref.objectId}${ref.version === undefined ? "" : `@${ref.version}`}`;
}

function createStagingWriteDedupeKey(
  tenantId: string,
  jobId: string,
  idempotencyKey: string,
  outputRef: RuntimeRecordRef,
) {
  return `${tenantId}:${jobId}:staging:${idempotencyKey}:${stringifyRuntimeRef(outputRef)}`;
}

function findRuntimeStagingWriteForOutput(store: RuntimeStore, job: RuntimeJob, outputRef: RuntimeRecordRef) {
  const outputKey = stringifyRuntimeRef(outputRef);
  return (
    job.stagingWrites.find((write) => {
      if (stringifyRuntimeRef(write.outputRef) !== outputKey) return false;
      if (!write.gateRef) return true;

      return !hasRuntimeGateChangeRequest(store, job.tenantId, job.jobId, write.gateRef.objectId);
    }) ?? null
  );
}

function findRuntimeJob(store: RuntimeStore, tenantId: string, jobId: string) {
  const job = (store.jobsByTenant.get(tenantId) ?? []).find((candidate) => candidate.jobId === jobId);

  if (!job) {
    throw new RuntimeError("RUN_NOT_FOUND", "Runtime run was not found.", { tenantId, jobId });
  }

  return job;
}

function findNextDispatchableJob(store: RuntimeStore, tenantId: string, lanes: RuntimePriorityLane[]) {
  const laneRank = new Map(lanes.map((lane, index) => [lane, index]));

  return (store.jobsByTenant.get(tenantId) ?? [])
    .filter((job) => job.status === "queued")
    .filter((job) => laneRank.has(job.priorityLane))
    .filter((job) => !findActiveKillSwitch(store, tenantId, job.kind))
    .filter((job) => isRuntimeJobReadyForDispatch(store, job))
    .sort((left, right) => {
      const laneDelta = laneRank.get(left.priorityLane)! - laneRank.get(right.priorityLane)!;
      if (laneDelta !== 0) return laneDelta;

      return left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId);
    })[0] ?? null;
}

function isRuntimeJobReadyForDispatch(store: RuntimeStore, job: RuntimeJob) {
  if (job.kind === "composite") {
    return false;
  }
  if (!job.parentJobId) {
    return true;
  }

  const parent = findRuntimeJob(store, job.tenantId, job.parentJobId);
  if (!parent.composite) {
    return false;
  }

  const child = parent.composite.childJobs.find((candidate) => candidate.jobId === job.jobId);
  if (!child) {
    return false;
  }

  return child.dependsOn.every((dependencyKey) => {
    const dependency = parent.composite!.childJobs.find((candidate) => candidate.key === dependencyKey);
    if (!dependency) return false;

    return findRuntimeJob(store, job.tenantId, dependency.jobId).status === "completed";
  });
}

function findRuntimeJobClaim(store: RuntimeStore, tenantId: string, claimId: string) {
  const claim = (store.jobClaimsByTenant.get(tenantId) ?? []).find((candidate) => candidate.claimId === claimId);

  if (!claim) {
    throw new RuntimeError("CLAIM_NOT_FOUND", "Runtime job claim was not found.", { tenantId, claimId });
  }

  return claim;
}

function replaceRuntimeJobClaim(store: RuntimeStore, claim: RuntimeJobClaim) {
  store.jobClaimsByTenant.set(
    claim.tenantId,
    (store.jobClaimsByTenant.get(claim.tenantId) ?? []).map((candidate) =>
      candidate.claimId === claim.claimId ? claim : candidate,
    ),
  );
}

function markActiveClaimStarted(store: RuntimeStore, job: RuntimeJob, startedAt: string) {
  const activeClaim = (store.jobClaimsByTenant.get(job.tenantId) ?? []).find(
    (claim) => claim.jobId === job.jobId && claim.status === "active",
  );
  if (!activeClaim) return;

  replaceRuntimeJobClaim(
    store,
    deepFreeze({
      ...activeClaim,
      status: "started" as const,
      startedAt,
    }),
  );
}

function findRuntimePlan(store: RuntimeStore, tenantId: string, planId: string) {
  return (store.plansByTenant.get(tenantId) ?? []).find((candidate) => candidate.planId === planId) ?? null;
}

function findRuntimePlanOrThrow(store: RuntimeStore, tenantId: string, planId: string) {
  const plan = findRuntimePlan(store, tenantId, planId);

  if (!plan) {
    throw new RuntimeError("PLAN_NOT_FOUND", "Runtime plan was not found.", { tenantId, planId });
  }

  return plan;
}

function findRuntimeScheduleOrNull(store: RuntimeStore, tenantId: string, scheduleId: string) {
  return (store.schedulesByTenant.get(tenantId) ?? []).find((candidate) => candidate.scheduleId === scheduleId) ?? null;
}

function findRuntimeSchedule(store: RuntimeStore, tenantId: string, scheduleId: string) {
  const schedule = findRuntimeScheduleOrNull(store, tenantId, scheduleId);

  if (!schedule) {
    throw new RuntimeError("SCHEDULE_NOT_FOUND", "Runtime schedule was not found.", { tenantId, scheduleId });
  }

  return schedule;
}

function replaceRuntimeJob(store: RuntimeStore, job: RuntimeJob) {
  store.jobsByTenant.set(
    job.tenantId,
    (store.jobsByTenant.get(job.tenantId) ?? []).map((candidate) =>
      candidate.jobId === job.jobId ? job : candidate,
    ),
  );
}

function refreshParentCompositeAfterChildTransition(store: RuntimeStore, child: RuntimeJob, occurredAt: string) {
  if (!child.parentJobId) return;

  const parent = findRuntimeJob(store, child.tenantId, child.parentJobId);
  if (!parent.composite) return;

  let childJobs = parent.composite.childJobs.map((compositeChild) =>
    findRuntimeJob(store, child.tenantId, compositeChild.jobId),
  );

  if (parent.composite.failFast && isFailureStatus(child.status)) {
    childJobs = childJobs.map((candidate) => {
      if (candidate.jobId === child.jobId || isTerminalStatus(candidate.status)) {
        return candidate;
      }

      const cancelled = deepFreeze({
        ...candidate,
        status: "cancelled" as const,
        failure: null,
        updatedAt: occurredAt,
      });

      replaceRuntimeJob(store, cancelled);
      emitRunEvent(store, cancelled, "run.cancelled", occurredAt, {
        status: "cancelled",
        failure: null,
        parentJobId: parent.jobId,
      });

      return cancelled;
    });
  } else {
    childJobs = cancelCompositeDescendantsWithUnavailableDependencies(
      store,
      parent,
      parent.composite,
      childJobs,
      occurredAt,
    );
  }

  const manifest = createCompositeManifest(
    parent.jobId,
    parent.composite.failFast,
    parent.composite.childJobs,
    childJobs,
  );
  const rolledUp = rollupCompositeParent(parent, manifest, occurredAt);
  const updatedParent = deepFreeze({
    ...parent,
    ...rolledUp,
    composite: deepFreeze({
      ...parent.composite,
      manifest,
    }),
  });

  replaceRuntimeJob(store, updatedParent);

  if (rolledUp.status !== parent.status) {
    emitRunEvent(store, updatedParent, getRunEventType(rolledUp.status), occurredAt, {
      status: rolledUp.status,
      failure: rolledUp.failure,
    });
  }
}

function cancelCompositeDescendantsWithUnavailableDependencies(
  store: RuntimeStore,
  parent: RuntimeJob,
  composite: RuntimeCompositeState,
  childJobs: RuntimeJob[],
  occurredAt: string,
) {
  const childByKey = new Map(
    composite.childJobs.map((child) => [
      child.key,
      childJobs.find((candidate) => candidate.jobId === child.jobId)!,
    ]),
  );
  const findBlockedChildren = () =>
    composite.childJobs.flatMap((child) => {
      const candidate = childByKey.get(child.key)!;
      if (isTerminalStatus(candidate.status)) return [];

      const blockingDependencyKeys = child.dependsOn.filter((dependencyKey) => {
        const dependency = childByKey.get(dependencyKey);
        return dependency && isTerminalStatus(dependency.status) && dependency.status !== "completed";
      });

      return blockingDependencyKeys.length === 0 ? [] : [{ child, candidate, blockingDependencyKeys }];
    });

  let blockedChildren = findBlockedChildren();
  while (blockedChildren.length > 0) {
    for (const { child, candidate, blockingDependencyKeys } of blockedChildren) {
      const cancelled = deepFreeze({
        ...candidate,
        status: "cancelled" as const,
        failure: null,
        updatedAt: occurredAt,
      });

      replaceRuntimeJob(store, cancelled);
      emitRunEvent(store, cancelled, "run.cancelled", occurredAt, {
        status: "cancelled",
        failure: null,
        parentJobId: parent.jobId,
        blockingDependencyKeys,
      });
      childByKey.set(child.key, cancelled);
    }

    blockedChildren = findBlockedChildren();
  }

  return composite.childJobs.map((child) => childByKey.get(child.key)!);
}
function rollupCompositeParent(parent: RuntimeJob, manifest: RuntimeCompositeManifest, occurredAt: string) {
  if (!manifest.terminal) {
    return {
      status: parent.status,
      failure: parent.failure,
      updatedAt: occurredAt,
    };
  }

  if (manifest.failedChildKeys.length > 0) {
    return {
      status: "failed" as const,
      failure: deepFreeze({ class: "tool_error" as const, detailRef: null }),
      updatedAt: occurredAt,
    };
  }

  if (manifest.cancelledChildKeys.length > 0) {
    return {
      status: "cancelled" as const,
      failure: null,
      updatedAt: occurredAt,
    };
  }

  return {
    status: "completed" as const,
    failure: null,
    updatedAt: occurredAt,
  };
}

function replaceRuntimePlan(store: RuntimeStore, plan: RuntimePlan) {
  store.plansByTenant.set(
    plan.tenantId,
    (store.plansByTenant.get(plan.tenantId) ?? []).map((candidate) =>
      candidate.planId === plan.planId ? plan : candidate,
    ),
  );
}

function replaceRuntimeSchedule(store: RuntimeStore, schedule: RuntimeSchedule) {
  store.schedulesByTenant.set(
    schedule.tenantId,
    (store.schedulesByTenant.get(schedule.tenantId) ?? []).map((candidate) =>
      candidate.scheduleId === schedule.scheduleId ? schedule : candidate,
    ),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortJson(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  Object.values(value).forEach((child) => {
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  });
  return value;
}
