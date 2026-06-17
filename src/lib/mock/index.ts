export type {
  Role,
  Permission,
  Capability,
  CapabilityMap,
  RoleCapabilityMap,
  User,
  Entity,
  Flow,
  Finding,
  Document,
  Run,
  RunStep,
  RunOutput,
  Obligation,
  Commitment,
  GateRequest,
  Event,
  EventType,
} from "./types";

// ── Capability map (PRD §8) ─────────────────────────────────────────────────

import type { RoleCapabilityMap } from "./types";

export const ROLE_CAPABILITIES: RoleCapabilityMap = {
  vp: {
    see_sensitive_tier: "allowed",
    promote_gates: "allowed",
    methodology_instructions: "allowed",
    run_stages: "allowed",
    verification_answers: "allowed",
    connector_policy: "hidden",
    content_access: "allowed",
    view_admin: "hidden",
  },
  manager: {
    see_sensitive_tier: "allowed",
    promote_gates: "allowed",
    methodology_instructions: "allowed",
    run_stages: "allowed",
    verification_answers: "allowed",
    connector_policy: "hidden",
    content_access: "allowed",
    view_admin: "hidden",
  },
  analyst: {
    see_sensitive_tier: "hidden",
    promote_gates: "hidden",
    methodology_instructions: "visible-disabled",
    run_stages: "allowed",
    verification_answers: "allowed",
    connector_policy: "hidden",
    content_access: "allowed",
    view_admin: "hidden",
  },
  adjacent: {
    see_sensitive_tier: "hidden",
    promote_gates: "hidden",
    methodology_instructions: "hidden",
    run_stages: "hidden",
    verification_answers: "allowed",
    connector_policy: "hidden",
    content_access: "allowed",
    view_admin: "hidden",
  },
  admin: {
    see_sensitive_tier: "hidden",
    promote_gates: "hidden",
    methodology_instructions: "hidden",
    run_stages: "hidden",
    verification_answers: "hidden",
    connector_policy: "allowed",
    content_access: "hidden",
    view_admin: "allowed",
  },
};

// ── Users ───────────────────────────────────────────────────────────────────

import type { User } from "./types";

export const mockUsers: User[] = [
  { id: "u1", name: "Alexandra Chen", email: "a.chen@veritax.io", role: "vp" },
  { id: "u2", name: "Marcus Webb", email: "m.webb@veritax.io", role: "manager" },
  { id: "u3", name: "Ikaika Choi", email: "i.choi@veritax.io", role: "analyst" },
  { id: "u4", name: "Sarah Kimura", email: "s.kimura@veritax.io", role: "analyst" },
  { id: "u5", name: "Tom Feld", email: "t.feld@veritax.io", role: "adjacent" },
  { id: "u6", name: "Priya Nair", email: "p.nair@veritax.io", role: "admin" },
];

// ── Entities ────────────────────────────────────────────────────────────────

import type { Entity } from "./types";

export const mockEntities: Entity[] = [
  {
    id: "e1",
    name: "Veritax Corp (US)",
    role: "principal",
    jurisdiction: "United States",
    jurisdictionCode: "US",
    status: "active",
    taxResidency: "Delaware",
    functionalProfile: "Principal entity — IP ownership and group treasury",
    asOf: "2024-12-31",
  },
  {
    id: "e2",
    name: "Veritax UK Ltd",
    role: "limited-risk",
    jurisdiction: "United Kingdom",
    jurisdictionCode: "GB",
    status: "active",
    taxResidency: "England",
    functionalProfile: "Limited-risk distributor — UK market",
    asOf: "2024-12-31",
  },
  {
    id: "e3",
    name: "Veritax GmbH",
    role: "limited-risk",
    jurisdiction: "Germany",
    jurisdictionCode: "DE",
    status: "active",
    taxResidency: "Bavaria",
    functionalProfile: "Limited-risk distributor — DACH market",
    asOf: "2024-12-31",
  },
  {
    id: "e4",
    name: "Veritax APAC Pte Ltd",
    role: "services-hub",
    jurisdiction: "Singapore",
    jurisdictionCode: "SG",
    status: "active",
    taxResidency: "Singapore",
    functionalProfile: "Regional services hub — APAC coordination",
    asOf: "2024-12-31",
  },
  {
    id: "e5",
    name: "Veritax KK",
    role: "limited-risk",
    jurisdiction: "Japan",
    jurisdictionCode: "JP",
    status: "active",
    taxResidency: "Tokyo",
    functionalProfile: "Limited-risk distributor — Japan market",
    asOf: "2024-12-31",
  },
  {
    id: "e6",
    name: "Veritax France SAS",
    role: "commissionnaire",
    jurisdiction: "France",
    jurisdictionCode: "FR",
    status: "active",
    taxResidency: "Paris",
    functionalProfile: "Commissionnaire — French market",
    asOf: "2024-12-31",
  },
];

// ── Flows ───────────────────────────────────────────────────────────────────

import type { Flow } from "./types";

export const mockFlows: Flow[] = [
  { id: "f1", fromEntityId: "e1", toEntityId: "e2", kind: "royalty", method: "CUT", status: "exception", exposure: 4_200_000, currency: "USD", policyRate: 0.12, observedRate: 0.18, agreementId: "a1" },
  { id: "f2", fromEntityId: "e1", toEntityId: "e3", kind: "royalty", method: "CUT", status: "drift", exposure: 2_800_000, currency: "USD", policyRate: 0.12, observedRate: 0.135, agreementId: "a2" },
  { id: "f3", fromEntityId: "e1", toEntityId: "e4", kind: "service", method: "TNMM", status: "verified", exposure: 950_000, currency: "USD", policyRate: 0.07, observedRate: 0.069, agreementId: "a3" },
  { id: "f4", fromEntityId: "e4", toEntityId: "e5", kind: "service", method: "TNMM", status: "verified", exposure: 620_000, currency: "USD", policyRate: 0.065, observedRate: 0.065, agreementId: "a4" },
  { id: "f5", fromEntityId: "e1", toEntityId: "e5", kind: "royalty", method: "CUT", status: "exception", exposure: 1_100_000, currency: "USD", policyRate: 0.10, observedRate: 0.15 },
  { id: "f6", fromEntityId: "e2", toEntityId: "e1", kind: "goods", method: "CUP", status: "verified", exposure: 8_500_000, currency: "GBP", policyRate: 0.0, observedRate: 0.0, agreementId: "a5" },
  { id: "f7", fromEntityId: "e1", toEntityId: "e2", kind: "loan", method: "CUP", status: "drift", exposure: 5_000_000, currency: "USD", policyRate: 0.045, observedRate: 0.038 },
  { id: "f8", fromEntityId: "e1", toEntityId: "e3", kind: "service", method: "TNMM", status: "verified", exposure: 410_000, currency: "EUR", policyRate: 0.06, observedRate: 0.061, agreementId: "a6" },
  { id: "f9", fromEntityId: "e4", toEntityId: "e2", kind: "service", method: "TNMM", status: "verified", exposure: 290_000, currency: "USD", policyRate: 0.055, observedRate: 0.055 },
  { id: "f10", fromEntityId: "e1", toEntityId: "e6", kind: "royalty", method: "CUT", status: "exception", exposure: 1_750_000, currency: "EUR", policyRate: 0.11, observedRate: 0.17 },
  { id: "f11", fromEntityId: "e6", toEntityId: "e1", kind: "service", method: "cost-plus", status: "verified", exposure: 330_000, currency: "EUR", policyRate: 0.08, observedRate: 0.08, agreementId: "a7" },
  { id: "f12", fromEntityId: "e1", toEntityId: "e4", kind: "guarantee", method: "CUP", status: "verified", exposure: 2_000_000, currency: "USD", policyRate: 0.005, observedRate: 0.005, agreementId: "a8" },
];

// ── Findings ────────────────────────────────────────────────────────────────

import type { Finding } from "./types";

export const mockFindings: Finding[] = [
  { id: "fn1", severity: "critical", title: "UK royalty rate exceeds benchmark upper quartile by 50%", summary: "The royalty charged to Veritax UK Ltd is 18%, materially above the CUT comparable range of 10–14%. Potential UK CIT adjustment of £3.2M.", status: "detected", exposure: 3_200_000, currency: "GBP", reviewerState: "unreviewed", flowId: "f1", age: 4, ruleId: "R-IC-001", confidence: 92 },
  { id: "fn2", severity: "critical", title: "France royalty rate exceeds arm's length range", summary: "Royalty to Veritax France SAS at 17% versus 9–13% benchmark. French TP adjustment risk: €850K.", status: "triaged", exposure: 850_000, currency: "EUR", assigneeId: "u3", reviewerState: "unreviewed", flowId: "f10", age: 7, ruleId: "R-IC-001", confidence: 89 },
  { id: "fn3", severity: "high", title: "Japan royalty — no executed ICA found in corpus", summary: "Flow F5 charges royalties to Veritax KK but no executed agreement was found. Gap represents a documentation risk under local TP rules.", status: "detected", exposure: 1_100_000, currency: "USD", reviewerState: "unreviewed", flowId: "f5", age: 2, ruleId: "R-DOC-003", confidence: 97 },
  { id: "fn4", severity: "high", title: "UK intercompany loan rate below EURIBOR floor", summary: "The loan from US to UK carries 3.8% versus policy 4.5%. Potential UK thin-cap and TP exposure.", status: "in-remediation", exposure: 600_000, currency: "USD", assigneeId: "u3", reviewerState: "confirmed", flowId: "f7", age: 21, ruleId: "R-IC-002", confidence: 84 },
  { id: "fn5", severity: "high", title: "DE royalty drift — rate increased without policy amendment", summary: "Germany royalty moved from 12% to 13.5% without a policy gate. Triggers staleness on master file section 4.2.", status: "triaged", exposure: 420_000, currency: "EUR", assigneeId: "u4", reviewerState: "unreviewed", flowId: "f2", age: 9, ruleId: "R-IC-001", confidence: 78 },
  { id: "fn6", severity: "medium", title: "APAC hub service margin below TNMM lower quartile", summary: "SG hub operating margin at 6.5% is at the lower quartile boundary. Monitor for Q4 true-up.", status: "detected", exposure: 180_000, currency: "USD", reviewerState: "unreviewed", flowId: "f3", age: 1, ruleId: "R-IC-004", confidence: 71 },
  { id: "fn7", severity: "medium", title: "Local file missing for SG→UK service flow", summary: "F9 (SG→UK services) lacks a Singapore local file for FY2024. Singaporean TP documentation deadline is 30 days post-filing.", status: "detected", exposure: 290_000, currency: "USD", reviewerState: "unreviewed", flowId: "f9", age: 3, ruleId: "R-DOC-001", confidence: 95 },
  { id: "fn8", severity: "medium", title: "France commissionnaire agreement expired 31 Dec 2023", summary: "Agreement A7 expired. Services continued in FY2024 under expired terms.", status: "in-remediation", exposure: 330_000, currency: "EUR", assigneeId: "u3", reviewerState: "unreviewed", flowId: "f11", age: 15, ruleId: "R-AGR-002", confidence: 99 },
  { id: "fn9", severity: "medium", title: "Benchmark set for CUT comparables last refreshed FY2022", summary: "The CUT dataset used for royalty benchmarking is 2 years stale. Refresh required before filing.", status: "triaged", exposure: 0, currency: "USD", reviewerState: "unreviewed", flowId: "f1", age: 11, ruleId: "R-BMK-001", confidence: 88 },
  { id: "fn10", severity: "low", title: "US→SG guarantee fee — minor basis point drift", summary: "Guarantee fee observed at 0.51% vs policy 0.50%. Within tolerance but logged for monitoring.", status: "resolved", exposure: 20_000, currency: "USD", reviewerState: "confirmed", flowId: "f12", age: 30, ruleId: "R-IC-003", confidence: 65 },
  { id: "fn11", severity: "low", title: "UK goods resale documentation below 80% coverage", summary: "Only 72% of invoices in F6 are matched to signed purchase orders in the corpus.", status: "detected", exposure: 0, currency: "USD", reviewerState: "unreviewed", flowId: "f6", age: 5, ruleId: "R-DOC-002", confidence: 82 },
  { id: "fn12", severity: "critical", title: "Pillar 2 — DE GloBE ETR below 15% threshold", summary: "Effective GloBE ETR for Germany entity is 12.4% after adjustments. QDMTT top-up liability estimated at €240K.", status: "detected", exposure: 240_000, currency: "EUR", reviewerState: "unreviewed", flowId: "f2", age: 6, ruleId: "R-P2-001", confidence: 90 },
  { id: "fn13", severity: "high", title: "Japan local file substance section incomplete", summary: "Headcount and payroll data for Veritax KK not extracted from payroll system. Blocking local file sign-off.", status: "in-remediation", exposure: 0, currency: "USD", assigneeId: "u4", reviewerState: "unreviewed", flowId: "f4", age: 18, ruleId: "R-DOC-004", confidence: 96 },
  { id: "fn14", severity: "medium", title: "DE services cost allocation key not documented", summary: "The basis for allocating IT costs to Germany (F8) is not described in any local file or master file section.", status: "triaged", exposure: 85_000, currency: "EUR", assigneeId: "u3", reviewerState: "unreviewed", flowId: "f8", age: 8, ruleId: "R-DOC-003", confidence: 80 },
  { id: "fn15", severity: "low", title: "APAC hub — payroll data lag 45 days", summary: "Headcount data for the Singapore hub is 45 days stale (threshold: 30 days). Affects substance analysis for safe harbour.", status: "detected", exposure: 0, currency: "USD", reviewerState: "unreviewed", flowId: "f3", age: 2, ruleId: "R-STALE-001", confidence: 99 },
];

// ── Documents ───────────────────────────────────────────────────────────────

import type { Document } from "./types";

export const mockDocuments: Document[] = [
  { id: "d1", name: "Veritax Group Master File FY2024", type: "master-file", custody: "materialized", sensitivity: "sensitive", jurisdiction: "US", fy: "2024", version: 3, hash: "sha256:a1b2c3d4", sourcePath: "/sharepoint/tp/master-file-fy2024-v3.docx", entityIds: ["e1", "e2", "e3", "e4", "e5", "e6"] },
  { id: "d2", name: "Veritax UK Local File FY2024", type: "local-file", custody: "materialized", sensitivity: "standard", jurisdiction: "GB", fy: "2024", version: 2, hash: "sha256:b2c3d4e5", sourcePath: "/sharepoint/tp/uk-local-file-fy2024-v2.docx", entityIds: ["e2"] },
  { id: "d3", name: "Veritax GmbH Local File FY2024", type: "local-file", custody: "extract-only", sensitivity: "standard", jurisdiction: "DE", fy: "2024", version: 1, hash: "sha256:c3d4e5f6", sourcePath: "/sharepoint/tp/de-local-file-fy2024-v1.docx", entityIds: ["e3"] },
  { id: "d4", name: "IC Royalty Agreement — US↔UK (2021)", type: "ica", custody: "materialized", sensitivity: "standard", jurisdiction: "US", fy: "2021", version: 1, hash: "sha256:d4e5f6a7", sourcePath: "/legal/ica/us-uk-royalty-2021.pdf", entityIds: ["e1", "e2"] },
  { id: "d5", name: "CUT Benchmark Study — Software Royalties FY2022", type: "benchmark", custody: "reference", sensitivity: "standard", jurisdiction: "US", fy: "2022", version: 1, hash: "sha256:e5f6a7b8", sourcePath: "/vendor/benchmarks/cut-software-royalties-2022.pdf", entityIds: ["e1"] },
  { id: "d6", name: "Japan Local File FY2024 (draft)", type: "local-file", custody: "extract-only", sensitivity: "standard", jurisdiction: "JP", fy: "2024", version: 1, hash: "sha256:f6a7b8c9", sourcePath: "/sharepoint/tp/jp-local-file-fy2024-draft.docx", entityIds: ["e5"] },
  { id: "d7", name: "Veritax Group TP Policy FY2024", type: "memo", custody: "materialized", sensitivity: "sensitive", jurisdiction: "US", fy: "2024", version: 4, hash: "sha256:a7b8c9d0", sourcePath: "/legal/policy/tp-policy-fy2024-v4.pdf", entityIds: ["e1", "e2", "e3", "e4", "e5", "e6"] },
  { id: "d8", name: "Commissionnaire Agreement — US↔France (2020)", type: "ica", custody: "materialized", sensitivity: "standard", jurisdiction: "FR", fy: "2020", version: 1, hash: "sha256:b8c9d0e1", sourcePath: "/legal/ica/us-fr-commissionnaire-2020.pdf", entityIds: ["e1", "e6"] },
  { id: "d9", name: "Singapore Local File FY2024", type: "local-file", custody: "extract-only", sensitivity: "standard", jurisdiction: "SG", fy: "2024", version: 1, hash: "sha256:c9d0e1f2", sourcePath: "/sharepoint/tp/sg-local-file-fy2024-v1.docx", entityIds: ["e4"] },
];

// ── Runs ────────────────────────────────────────────────────────────────────

import type { Run } from "./types";

export const mockRuns: Run[] = [
  {
    id: "r1",
    stage: "ic-scan",
    scope: "FY2024 full group",
    initiator: "user",
    initiatorId: "u2",
    status: "done",
    steps: [
      { id: "r1s1", name: "Load corpus", status: "done", durationMs: 4200 },
      { id: "r1s2", name: "Extract IC flows", status: "done", durationMs: 18_500 },
      { id: "r1s3", name: "Apply rulepack", status: "done", durationMs: 9_800 },
      { id: "r1s4", name: "Score findings", status: "done", durationMs: 3_100 },
    ],
    outputs: [
      { id: "r1o1", type: "finding-set", name: "IC Scan FY2024 — 15 findings", objectRef: "/findings?run=r1" },
    ],
    corpusVersion: "v.418",
    rulepackVersion: "rp-2024.11",
    modelVersion: "claude-sonnet-4-6",
    costClass: "standard",
    startedAt: "2025-11-15T09:30:00Z",
  },
  {
    id: "r2",
    stage: "local-file-generate",
    scope: "Veritax UK Ltd — FY2024",
    initiator: "user",
    initiatorId: "u3",
    status: "done",
    steps: [
      { id: "r2s1", name: "Fetch entity profile", status: "done", durationMs: 1_200 },
      { id: "r2s2", name: "Extract financials", status: "done", durationMs: 6_400 },
      { id: "r2s3", name: "Draft sections", status: "done", durationMs: 22_000 },
      { id: "r2s4", name: "Self-check assertions", status: "done", durationMs: 8_900 },
    ],
    outputs: [
      { id: "r2o1", type: "document", name: "Veritax UK Local File FY2024 v2", objectRef: "/library/d2" },
    ],
    corpusVersion: "v.418",
    rulepackVersion: "rp-2024.11",
    modelVersion: "claude-sonnet-4-6",
    costClass: "fast",
    startedAt: "2025-11-20T14:15:00Z",
  },
  {
    id: "r3",
    stage: "benchmark-refresh",
    scope: "CUT comparables — royalty",
    initiator: "watcher",
    initiatorId: "u2",
    status: "failed",
    steps: [
      { id: "r3s1", name: "Connect to license database", status: "done", durationMs: 800 },
      { id: "r3s2", name: "Query comparables", status: "failed", durationMs: 2_100 },
    ],
    outputs: [],
    corpusVersion: "v.418",
    rulepackVersion: "rp-2024.11",
    modelVersion: "claude-sonnet-4-6",
    costClass: "fast",
    startedAt: "2025-11-22T08:00:00Z",
  },
];

// ── Obligations ─────────────────────────────────────────────────────────────

import type { Obligation } from "./types";

export const mockObligations: Obligation[] = [
  { id: "ob1", name: "UK Corporate Tax Return FY2024", entityId: "e2", jurisdiction: "GB", due: "2025-01-31", status: "upcoming", ownerId: "u2" },
  { id: "ob2", name: "Germany Transfer Pricing Documentation Deadline", entityId: "e3", jurisdiction: "DE", due: "2025-03-31", status: "upcoming", ownerId: "u3" },
  { id: "ob3", name: "Singapore TP Documentation — FY2024", entityId: "e4", jurisdiction: "SG", due: "2025-02-28", status: "upcoming", ownerId: "u3" },
  { id: "ob4", name: "Japan Local File Filing", entityId: "e5", jurisdiction: "JP", due: "2025-03-15", status: "upcoming", ownerId: "u4" },
  { id: "ob5", name: "France CbCR Notification", entityId: "e6", jurisdiction: "FR", due: "2025-01-15", status: "overdue", ownerId: "u2" },
];

// ── Commitments ─────────────────────────────────────────────────────────────

import type { Commitment } from "./types";

export const mockCommitments: Commitment[] = [
  { id: "cm1", text: "Refresh benchmark study for royalty comparables before year-end", source: "meeting", sourceRef: "mtg-2025-11-10", due: "2025-12-15", ownerId: "u3", linkedObjectId: "d5", planState: "pending" },
  { id: "cm2", text: "Obtain executed renewal for France commissionnaire agreement", source: "meeting", sourceRef: "mtg-2025-11-10", due: "2025-12-31", ownerId: "u2", planState: "external" },
  { id: "cm3", text: "Complete Japan substance section with payroll data", source: "email", sourceRef: "email-2025-11-14", due: "2025-12-20", ownerId: "u4", linkedObjectId: "d6", planState: "approved" },
  { id: "cm4", text: "Request Germany payroll data from HR system", source: "email", sourceRef: "email-2025-11-14", due: "2025-12-10", ownerId: "u3", planState: "pending" },
];

// ── Gate requests ───────────────────────────────────────────────────────────

import type { GateRequest } from "./types";

export const mockGateRequests: GateRequest[] = [
  { id: "g1", objectId: "d2", objectType: "document", objectName: "Veritax UK Local File FY2024 v2", requesterId: "u3", slaHours: 48, slaStarted: "2025-11-20T16:00:00Z", escalationPath: "Manager → VP" },
  { id: "g2", objectId: "fn4", objectType: "finding", objectName: "UK intercompany loan rate remediation", requesterId: "u3", slaHours: 24, slaStarted: "2025-11-21T10:00:00Z", escalationPath: "Manager" },
  { id: "g3", objectId: "d7", objectType: "document", objectName: "Veritax Group TP Policy FY2024 v4 — methodology change", requesterId: "u2", slaHours: 72, slaStarted: "2025-11-19T14:00:00Z", escalationPath: "VP" },
];

// ── Events ───────────────────────────────────────────────────────────────────

import type { Event } from "./types";

export const mockEvents: Event[] = [
  { id: "ev1", type: "finding_created", timestamp: "2025-11-22T09:00:00Z", actorId: "u1", description: "IC scan created 15 new findings for FY2024", objectRef: "/findings?run=r1", objectType: "finding-set" },
  { id: "ev2", type: "gate_requested", timestamp: "2025-11-20T16:00:00Z", actorId: "u3", description: "Review requested for Veritax UK Local File FY2024 v2", objectRef: "/library/d2", objectType: "document" },
  { id: "ev3", type: "run_completed", timestamp: "2025-11-20T14:47:00Z", actorId: "u3", description: "Local file generation for UK completed in 38s", objectRef: "/runs/r2", objectType: "run" },
  { id: "ev4", type: "obligation_due", timestamp: "2025-11-22T08:00:00Z", actorId: "u1", description: "France CbCR Notification is overdue by 7 days", objectRef: "/calendar?obligation=ob5", objectType: "obligation" },
  { id: "ev5", type: "staleness_detected", timestamp: "2025-11-21T06:00:00Z", actorId: "u1", description: "3 artifacts affected by corpus v.419 changes — review proposals", objectRef: "/findings", objectType: "finding-set" },
  { id: "ev6", type: "document_ingested", timestamp: "2025-11-19T11:30:00Z", actorId: "u1", description: "Singapore Local File FY2024 v1 ingested (24 pages)", objectRef: "/library/d9", objectType: "document" },
  { id: "ev7", type: "finding_resolved", timestamp: "2025-11-18T15:00:00Z", actorId: "u3", description: "Finding fn10 resolved — guarantee fee within tolerance", objectRef: "/findings/fn10", objectType: "finding" },
  { id: "ev8", type: "gate_requested", timestamp: "2025-11-19T14:00:00Z", actorId: "u2", description: "VP sign-off requested for TP Policy FY2024 methodology change", objectRef: "/library/d7", objectType: "document" },
  { id: "ev9", type: "run_completed", timestamp: "2025-11-22T08:02:00Z", actorId: "u1", description: "Benchmark refresh failed — license database unavailable", objectRef: "/runs/r3", objectType: "run" },
  { id: "ev10", type: "finding_created", timestamp: "2025-11-22T09:01:00Z", actorId: "u1", description: "Pillar 2 GloBE ETR breach detected for Germany (12.4%)", objectRef: "/findings/fn12", objectType: "finding" },
];
