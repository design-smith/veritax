export const FRONTEND_COMMAND_TYPES = [
  "run_stage",
  "submit_instruction",
  "answer_verification",
  "triage_finding",
  "gate_decision",
  "assign",
  "export",
  "connect_source",
  "ask",
] as const;

const RECORD_WRITE_COMMAND_TYPES = new Set([
  "append_event",
  "submit_assertions",
  "request_gate",
  "decide_gate",
  "governed_edit",
  "seal_period",
  "declare_dependencies",
  "stage",
]);

const DIRECT_WRITE_KEYS = new Set([
  "appendEvent",
  "canonicalPatch",
  "canonicalState",
  "directWrite",
  "domainObject",
  "recordWrite",
  "sql",
  "tableMutation",
]);

export type FrontendCommandType = (typeof FRONTEND_COMMAND_TYPES)[number];

export interface CommandActor {
  kind: "user" | "agent" | "system";
  id: string;
  onBehalfOf?: string;
}

export interface CommandObjectRef {
  objectType: string;
  objectId: string;
  version?: string | number;
}

export interface CommandScope {
  tenantId: string;
  workspaceId?: string;
  entityIds?: string[];
  jurisdictions?: string[];
  objectRefs?: CommandObjectRef[];
  period?: string;
}

export type CommandPayload = Record<string, unknown>;

export interface FrontendCommandInput {
  type: FrontendCommandType | string;
  actor: CommandActor;
  scope: CommandScope;
  payload?: CommandPayload;
  idempotencyKey?: string;
}

export interface FrontendCommandEnvelope {
  schemaVersion: 1;
  type: FrontendCommandType;
  actor: Readonly<CommandActor>;
  scope: Readonly<CommandScope>;
  payload: Readonly<CommandPayload>;
  idempotencyKey: string;
  createdAt: string;
}

export interface CommandDispatchResult {
  accepted: boolean;
  commandId?: string;
  error?: string;
}

export interface CommandDispatcherOptions {
  transport: (envelope: FrontendCommandEnvelope) => Promise<CommandDispatchResult>;
}

const FRONTEND_COMMAND_TYPE_SET = new Set<string>(FRONTEND_COMMAND_TYPES);

export function createFrontendCommandEnvelope(input: FrontendCommandInput): FrontendCommandEnvelope {
  assertFrontendCommandType(input.type);
  assertActor(input.actor);
  assertScope(input.scope);

  const payload = input.payload ?? {};
  assertPayloadHasNoDirectRecordWrite(payload);

  return deepFreeze({
    schemaVersion: 1 as const,
    type: input.type,
    actor: { ...input.actor },
    scope: cloneJson(input.scope),
    payload: cloneJson(payload),
    idempotencyKey: input.idempotencyKey ?? createIdempotencyKey(input.type),
    createdAt: new Date().toISOString(),
  });
}

export function createCommandDispatcher(options: CommandDispatcherOptions) {
  return {
    dispatch(envelope: FrontendCommandEnvelope) {
      assertEnvelope(envelope);
      return options.transport(envelope);
    },
  };
}

function assertFrontendCommandType(type: string): asserts type is FrontendCommandType {
  if (FRONTEND_COMMAND_TYPE_SET.has(type)) {
    return;
  }

  if (RECORD_WRITE_COMMAND_TYPES.has(type)) {
    throw new Error(`"${type}" is a Record write command. The frontend command layer only emits user intents.`);
  }

  throw new Error(`Unknown frontend command type "${type}".`);
}

function assertActor(actor: CommandActor) {
  if (!actor?.kind || !actor.id) {
    throw new Error("A frontend command requires an actor with kind and id.");
  }
}

function assertScope(scope: CommandScope) {
  if (!scope?.tenantId) {
    throw new Error("A frontend command requires tenant scope.");
  }
}

function assertEnvelope(envelope: FrontendCommandEnvelope) {
  assertFrontendCommandType(envelope.type);
  assertActor(envelope.actor);
  assertScope(envelope.scope);
  assertPayloadHasNoDirectRecordWrite(envelope.payload);
}

function assertPayloadHasNoDirectRecordWrite(value: unknown, path = "payload") {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (DIRECT_WRITE_KEYS.has(key)) {
      throw new Error(`Frontend command payload contains a direct Record write key at ${path}.${key}.`);
    }
    assertPayloadHasNoDirectRecordWrite(child, `${path}.${key}`);
  }
}

function createIdempotencyKey(type: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${type}:${random}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value;
}
