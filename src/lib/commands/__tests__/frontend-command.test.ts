import { describe, expect, it, vi } from "vitest";
import {
  createCommandDispatcher,
  createFrontendCommandEnvelope,
} from "../frontend-command";

const actor = { kind: "user" as const, id: "user-1" };
const scope = {
  tenantId: "tenant-1",
  workspaceId: "workspace-1",
  objectRefs: [{ objectType: "finding", objectId: "finding-1" }],
};

describe("frontend command envelope", () => {
  it("wraps user intents with actor, scope, and an idempotency key", () => {
    const envelope = createFrontendCommandEnvelope({
      type: "gate_decision",
      actor,
      scope,
      payload: { gateId: "gate-1", decision: "approve" },
      idempotencyKey: "cmd-1",
    });

    expect(envelope).toMatchObject({
      schemaVersion: 1,
      type: "gate_decision",
      actor,
      scope,
      payload: { gateId: "gate-1", decision: "approve" },
      idempotencyKey: "cmd-1",
    });
    expect(envelope.createdAt).toEqual(expect.any(String));
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.payload)).toBe(true);
  });

  it("refuses Record write commands and direct canonical patches", () => {
    expect(() =>
      createFrontendCommandEnvelope({
        type: "governed_edit",
        actor,
        scope,
        payload: { objectRef: { objectType: "entity", objectId: "e-1" } },
      }),
    ).toThrow(/frontend command/i);

    expect(() =>
      createFrontendCommandEnvelope({
        type: "triage_finding",
        actor,
        scope,
        payload: { canonicalPatch: { status: "resolved" } },
      }),
    ).toThrow(/direct record write/i);
  });

  it("dispatches only valid command envelopes through the configured transport", async () => {
    const transport = vi.fn().mockResolvedValue({ accepted: true, commandId: "cmd-1" });
    const dispatcher = createCommandDispatcher({ transport });
    const envelope = createFrontendCommandEnvelope({
      type: "ask",
      actor,
      scope,
      payload: { question: "What changed?" },
      idempotencyKey: "cmd-ask-1",
    });

    await expect(dispatcher.dispatch(envelope)).resolves.toEqual({
      accepted: true,
      commandId: "cmd-1",
    });
    expect(transport).toHaveBeenCalledWith(envelope);
  });
});
