import { describe, it, expect } from "vitest";
import {
  mockEntities,
  mockFlows,
  mockFindings,
  mockDocuments,
  mockRuns,
  mockObligations,
  mockCommitments,
  mockGateRequests,
  mockEvents,
  mockUsers,
  ROLE_CAPABILITIES,
} from "../index";

describe("Mock data layer", () => {
  it("provides at least 5 entities", () => {
    expect(mockEntities.length).toBeGreaterThanOrEqual(5);
  });

  it("provides at least 10 flows", () => {
    expect(mockFlows.length).toBeGreaterThanOrEqual(10);
  });

  it("provides at least 15 findings with mixed severity and status", () => {
    expect(mockFindings.length).toBeGreaterThanOrEqual(15);
    const severities = new Set(mockFindings.map((f) => f.severity));
    expect(severities.size).toBeGreaterThanOrEqual(3);
    const statuses = new Set(mockFindings.map((f) => f.status));
    expect(statuses.size).toBeGreaterThanOrEqual(3);
  });

  it("provides at least 8 documents", () => {
    expect(mockDocuments.length).toBeGreaterThanOrEqual(8);
  });

  it("provides at least 3 runs", () => {
    expect(mockRuns.length).toBeGreaterThanOrEqual(3);
  });

  it("provides obligations, commitments, gate requests, events, users", () => {
    expect(mockObligations.length).toBeGreaterThanOrEqual(1);
    expect(mockCommitments.length).toBeGreaterThanOrEqual(1);
    expect(mockGateRequests.length).toBeGreaterThanOrEqual(1);
    expect(mockEvents.length).toBeGreaterThanOrEqual(1);
    expect(mockUsers.length).toBeGreaterThanOrEqual(5);
  });

  it("capability map covers all 5 roles", () => {
    expect(ROLE_CAPABILITIES).toHaveProperty("vp");
    expect(ROLE_CAPABILITIES).toHaveProperty("manager");
    expect(ROLE_CAPABILITIES).toHaveProperty("analyst");
    expect(ROLE_CAPABILITIES).toHaveProperty("adjacent");
    expect(ROLE_CAPABILITIES).toHaveProperty("admin");
  });

  it("all flows reference valid entity IDs", () => {
    const entityIds = new Set(mockEntities.map((e) => e.id));
    for (const flow of mockFlows) {
      expect(entityIds.has(flow.fromEntityId)).toBe(true);
      expect(entityIds.has(flow.toEntityId)).toBe(true);
    }
  });

  it("all findings reference valid flow IDs", () => {
    const flowIds = new Set(mockFlows.map((f) => f.id));
    for (const finding of mockFindings) {
      expect(flowIds.has(finding.flowId)).toBe(true);
    }
  });
});
