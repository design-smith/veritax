# PRD: Requirement Matching & Evidence Sufficiency

> Consolidated PRD (product + engineering) for the deterministic evidence-policy engine that decides whether
> uploaded evidence substantiates each Local File requirement. Captures the decisions from the design review
> plus the architecture refinements: a versioned evolution toward a **capability/fact ontology**, and a
> split between **evidence policy** and **evaluation policy**.

## Problem Statement

A transfer-pricing practitioner uploads a pile of documents for an engagement and needs to know, before
drafting a Local File, whether the evidence actually **substantiates each jurisdiction requirement** — not
merely whether *related information* exists. Today Veritax answers the weaker question: an LLM reads retrieved
chunks and judges each requirement present/partial/missing. So an Annual Report, a website, and an investor
deck can nudge "Material Intercompany Agreements" toward looking satisfied even though no executed agreement
was ever uploaded. The verdicts aren't reproducible, aren't explainable in terms of *what specific document
is missing*, and rest on model judgement rather than a stated rule.

Document *presence* is itself only a proxy. Consider a Trial Balance that is uploaded but is for the wrong
legal entity, is missing the intercompany accounts, and uses the wrong cost centers. The document exists —
the requirement is still not satisfied. Ultimately the engine must reason about the **facts and capabilities**
the evidence actually provides, not merely that a document of the right type was uploaded.

## Solution

Replace the LLM coverage judge with a **deterministic evidence-policy engine** whose verdicts come from
declared rules over classified evidence — never from a model's judgement or confidence score. Every
requirement declares an **evidence policy** (which document types count, and in what role) and an
**evaluation policy** (the boolean combination that determines sufficiency). The engine filters candidate
evidence to what is in scope, applies the policies, and returns a status
(`present / partial / missing / invalid / blocked / conditional`) with a **templated explanation** naming the
exact evidence used and the exact evidence missing. The draft gate reads these results: a Local File may
proceed unless a **critical** requirement is `missing`, `invalid`, or `blocked`. A practitioner may still,
with an audit trail, override a requirement to satisfied.

The engine is designed toward a target **ontology** and ships as the first rung of it:

```
Document → Facts → Capabilities → Requirement → Draft Section
```

- **V1 (this release): document presence.** Sufficiency is decided by scoped **document types** matched to
  the evidence + evaluation policies. Facts, where available, refine the explanation. Ships off classification
  alone — no facts or transactions required.
- **V2: validated facts → capabilities.** The *same* evidence and evaluation policies are preserved, but the
  satisfaction check moves from "a document of the right type exists" to "the required **capabilities** are
  present as **validated facts** (correct entity, accounts, cost centers, terms)." This is a strategy swap
  inside the engine, not a rewrite of the policies.

## User Stories

1. As a TP practitioner, I want each requirement judged on whether the *right kind* of evidence exists, so that an Annual Report can't satisfy "Material Agreements" without an executed agreement.
2. As a TP practitioner, I want verdicts reproducible from the same evidence set, so that re-running never silently changes a result.
3. As a TP practitioner, I want each requirement to show the documents that satisfied it and their role (Primary/Supporting/Background), so that I can defend the file.
4. As a TP practitioner, I want a failed requirement to name the exact missing evidence, so that I know what to upload rather than guessing.
5. As a TP practitioner, I want missing evidence grouped by severity, so that I fix what blocks the file first.
6. As a TP practitioner, I want suggested sources for missing evidence (e.g. SAP / Oracle / NetSuite for a ledger), so that I know where to get it.
7. As a TP practitioner, I want a plain-language reason for each Partial/Missing/Invalid verdict, so that I understand *why* the evidence is insufficient.
8. As a TP practitioner, I want a right-type document for the wrong fiscal year or unsigned to be flagged Invalid with the reason, so that I don't mistake it for coverage.
9. As a TP practitioner, I want evidence for a different entity or jurisdiction ignored, so that cross-entity evidence never leaks into a verdict.
10. As a TP practitioner, I want a Trial Balance for the wrong entity or missing intercompany accounts to *not* satisfy the requirement even though the document exists, so that presence never masquerades as sufficiency (V2).
11. As a TP practitioner, I want transaction-specific requirements evaluated per controlled transaction, so that a missing benchmark on one transaction is visible even if another is covered.
12. As a TP practitioner, I want entity-level requirements evaluated once per jurisdiction, so that they aren't spuriously duplicated across transactions.
13. As a TP practitioner, I want one rolled-up status per requirement per jurisdiction (worst across its transactions), so that the dashboard stays readable.
14. As a TP practitioner, I want downstream requirements shown as Blocked when an upstream dependency isn't present, so that I fix root causes first.
15. As a TP practitioner, I want Draft blocked when any critical requirement is Missing/Invalid/Blocked, so that I never ship an unsupported Local File.
16. As a TP practitioner, I want to draft when only *non-critical* requirements are missing, so that minor gaps don't halt the file.
17. As a TP practitioner, I want a Partial critical requirement to warn but not hard-block, so that I can proceed deliberately when evidence is thin.
18. As a TP practitioner, I want to explicitly mark a requirement satisfied with my own justification, so that my professional judgement can override the rule.
19. As a TP practitioner, I want my override recorded with who/when/why, so that the audit trail shows it was a human decision.
20. As a TP practitioner, I want the dashboard to update automatically as I add/remove documents, so that I see live coverage.
21. As a TP practitioner, I want conditional requirements dormant until their trigger applies, so that irrelevant requirements don't show as missing.
22. As a TP practitioner, I want to be told when an agreement has expired or a benchmark is too old to rely on, so that I refresh stale evidence rather than defend a lapsed position (V2).
23. As a TP practitioner in different jurisdictions, I want a Statement of Work to satisfy the same requirement a Service Agreement does when it provides the same capabilities, so that equivalent evidence works without per-country rule rewrites (V2).
24. As a compliance reviewer, I want every decision traceable to an explicit rule and named evidence, so that I can audit without re-reading every document.
25. As the platform, I want statuses computed with no LLM call, so that outcomes are deterministic and cheap.
26. As a developer, I want the sufficiency engine to be a pure function of (policy, in-scope evidence), so that I can unit-test every status transition without a database or model.
27. As a developer, I want the engine to run off classification output alone in V1, so that it ships before extraction and transaction-mapping exist.
28. As a developer, I want facts and transactions supplied through optional providers that degrade gracefully, so that the engine produces correct (coarser) results when those upstreams are absent.
29. As a developer, I want the satisfaction check to be a pluggable strategy (document-presence vs capability), so that V2 is a strategy swap that reuses the same evidence/evaluation policies.
30. As a jurisdiction author, I want evidence policy, evaluation policy, capabilities, dependencies, and criticality declared as data inherited via the base template, so that a new jurisdiction is a data change, not a code change.
31. As a jurisdiction author, I want "what documents count" (evidence policy) separated from "how they combine" (evaluation policy), so that maintaining one doesn't disturb the other.
32. As a developer, I want the new engine to replace the LLM coverage path once classification lands, so that there's a single source of truth for coverage.

## Implementation Decisions

**Evaluation model (two-tier hybrid).** Requirements are tagged transaction-scoped or entity-scoped.
Transaction-scoped requirements evaluate per controlled transaction; entity-scoped ones once per
jurisdiction. Results roll up to one record per `(engagement, jurisdiction, requirement)` = the **worst**
status across its transactions. Until transaction mapping exists, transaction-scoped requirements degrade to
a single jurisdiction-level evaluation and upgrade automatically once transactions are available.

**Evidence atom — a versioned satisfaction check (not a fixed rule).** This is the one architectural axis that
evolves:
- **V1 — document presence.** Status is decided by scoped **document types** (from classification) matched to
  the evidence + evaluation policies. Facts, where available, only refine the explanation and link evidence to
  a transaction; they never change the status.
- **V2 — validated facts → capabilities.** Satisfaction is decided by whether the requirement's required
  **capabilities** are present as **validated facts** with correct scope (entity, accounts, cost centers,
  terms), not merely that a document of the right type exists. The evidence and evaluation policies are
  **preserved unchanged**; only the satisfaction strategy swaps.

The engine exposes the satisfaction check as a **pluggable strategy** behind one interface
(`DocumentPresenceStrategy` in V1, `CapabilityStrategy` in V2), so both are unit-tested against the same
policies and the migration is a swap, not a rewrite.

**Target ontology.** `Document → Facts → Capabilities → Requirement → Draft Section`. V1 collapses the
Facts/Capabilities layers into "document present"; V2 makes them real. All new schema and policy shapes are
designed so this layering can be filled in incrementally without breaking V1.

**Two policy layers (kept separate).**
- **Evidence Policy** — per requirement: *what evidence counts*. Maps document types to a role
  (Primary / Supporting / Background / Rejected). In V2 it also declares the **capabilities** each document
  type provides (the document side of the Capability Matrix).
- **Evaluation Policy (sufficiency rules)** — per requirement: *how evidence combines*. A boolean AND/OR tree
  whose operands are evidence slots in V1 and **required capabilities** in V2. Present = all required Primary
  slots (V1) / required capabilities (V2) satisfied in scope; Partial = some but not all; Missing = none.

Separating them means a jurisdiction author can change "an SOW also counts" (evidence policy) without touching
the combination logic, and vice-versa.

**Capability Matrix (designed now, enforced in V2).** Two halves, both declared as data:
- document type → **capabilities provided** (e.g. Service Agreement provides Provider, Recipient, Pricing,
  Term, Scope, Effective Date);
- requirement → **capabilities required** (e.g. Material Agreements requires Provider, Recipient, Pricing,
  Term).
The engine matches required against provided capabilities. This makes cross-jurisdiction document equivalence
free: if a Service Agreement and a Statement of Work both provide the required capabilities, the same rule is
satisfied by either — no per-country rule change. In V1 the matrix is reserved (capabilities are approximated
by document type); in V2 capabilities are derived from validated facts.

**Evidence aging / freshness (reserved now).** Each evidence-policy entry (and, in V2, each capability) may
carry a freshness rule — an agreement past its expiry date, or a benchmark older than N years, is stale.
Stale evidence yields `invalid` with a "refresh required" reason. This is a **policy decision**, distinct from
contradiction detection. The policy shape reserves a place for freshness in V1; enforcement lands with V2.

**Policies live in the JSON seed.** Evidence policy, evaluation policy, capability declarations, freshness
rules, dependencies, criticality, and scope-tier are co-located with each requirement's definition and
inherited via the base-template mechanism (author once on the shared spine; override per country). Resolved at
runtime like requirement definitions. Only *results* live in the database.

**Status set.** `present`, `partial`, `missing`, `invalid`, `blocked`, `conditional`. `conflicted` is reserved
but never written here — Contradiction Detection sets it. `invalid` = the right evidence exists but is
disqualified by a soft scope or freshness check. `blocked` = a requirement whose `depends_on` set is not all
present.

**Scope → status mapping.** Hard keys (jurisdiction, entity) failing **exclude** the evidence → trends toward
`missing`. Soft keys (fiscal year, executed status, version, freshness) failing on otherwise-sufficient
evidence → `invalid` with the reason. Minor mismatches → usable + warning. This feature *consumes* resolved
scope; it does not resolve entities.

**Deterministic engine, templated explanations.** No LLM call in the matcher. Explanations are generated from
the rule evaluation (which slots/capabilities matched, which are unmet, which evidence was excluded and why).

**Draft gate.** Explicit `critical: true` per requirement (replaces the current name-matching heuristic).
Draft blocked iff a critical requirement is `missing`, `invalid`, or `blocked` (Conflicted later). `partial`
never hard-blocks (warning). Only critical requirements gate; non-critical gaps warn.

**Human override.** A practitioner may mark a requirement satisfied; stored as an audited override (actor,
timestamp, justification) that sets the effective status to present while preserving the underlying rule
outcome. Human judgement allowed; model judgement not.

**Dependencies.** Each requirement may declare `depends_on`; if any dependency isn't `present`, the requirement
is `blocked`, propagating transitively. Blocked on a critical requirement gates the draft like missing.

**Cutover.** Hard cutover: the deterministic engine + result tables replace the LLM coverage path the moment
classification is available. The Requirements step moves to the new model in one change.

**Build contract.** Classification (document type + scope) is the only hard dependency. Facts and transactions
arrive through optional provider interfaces with fake implementations for tests, mirroring the existing
fake-double pattern. Orchestration reuses the durable pipeline-job queue and an idempotent evaluate entry
point; evaluation recomputes reactively when inputs change.

**Modules (deep where marked).**
- **Policy Resolver** *(deep, pure)* — resolves per-jurisdiction requirement policies (definition + evidence
  policy + evaluation policy + capabilities + freshness + dependencies + criticality + scope-tier) from the
  JSON seed with base-template inheritance and per-country overrides.
- **Sufficiency Engine** *(deep, pure — the core)* — given one requirement policy, a set of candidate evidence
  (classified docs with type+scope; optional facts; optional transaction context), and a **satisfaction
  strategy**, returns a result (status, matched evidence with roles, unmet slots/capabilities, templated
  explanation, freshness/scope warnings). No I/O, no model.
- **Satisfaction Strategy** *(pluggable, pure)* — `DocumentPresenceStrategy` (V1) and `CapabilityStrategy`
  (V2) implement the same interface over the same policies.
- **Dependency & Roll-up Resolver** *(pure)* — derives `blocked` across the requirement set and rolls
  transaction-level results up to the per-jurisdiction record (worst status).
- **Draft Gate** *(pure)* — reads rolled-up results, returns ready/blocked + the blocking critical
  requirements. Replaces the current readiness function.
- **Evidence Providers** *(thin adapters)* — `ClassifiedDocumentsProvider` (hard), `FactsProvider` and
  `TransactionsProvider` (optional); real DB impls + fakes for tests.
- **Evaluation Orchestrator** *(thin coordinator)* — gathers inputs, runs the engine per requirement in two
  tiers, persists results + evidence, idempotent, via the pipeline-job queue.
- **API + UI** — evaluation/read endpoints; the Requirements step evolves into
  Dashboard + Detail + Evidence Viewer + Missing-grouped-by-severity, plus the audited override control.

**Schema (results only; definitions/policies stay in JSON).** `requirement_results` (engagement, jurisdiction,
requirement, optional transaction reference, status, explanation, override metadata) and `requirement_evidence`
(result → supporting documents with role, and — in V2 — the satisfying capabilities/facts). The result shape
reserves room for capability/fact linkage so V2 doesn't require a migration of V1 rows. The current
coverage/evidence result tables are retired on cutover.

**API contracts.** An idempotent evaluate action (per engagement, optionally per jurisdiction); read actions
for the requirement list, a requirement's detail, its supporting evidence, and its missing evidence; and an
override action carrying the practitioner's justification.

## Testing Decisions

Good tests exercise **observable behavior through the public interface**, not internal structure — a status
verdict is behavior; an intermediate dict is not. Tests should survive refactors of the engine internals and,
crucially, survive the V1→V2 strategy swap.

- **Sufficiency Engine + Satisfaction Strategy (primary target).** Pure unit tests over
  `(policy, evidence, strategy) → result`, one behavior per test: present/partial/missing/invalid transitions;
  hard-scope exclusion; soft-scope and freshness → Invalid; role assignment; AND/OR combinations; explanation
  names the right matched/missing evidence. The **same policy fixtures** run against both
  `DocumentPresenceStrategy` (V1) and, when built, `CapabilityStrategy` (V2) — the shared suite proves the
  swap preserves behavior on the parts that shouldn't change and only sharpens the fact/capability cases.
  Prior art: the existing readiness unit tests (`test_coverage_readiness.py`) — pure, no DB.
- **Capability matching (V2).** Unit tests: a requirement's required capabilities satisfied by a document that
  provides them; cross-jurisdiction equivalence (two different document types providing the same capabilities
  satisfy the same rule); a present document that fails to provide a required capability → not satisfied.
- **Dependency & Roll-up Resolver.** Unit tests: transitive `blocked`; per-transaction roll-up to worst
  per-jurisdiction status.
- **Draft Gate.** Pure unit tests: blocked iff a critical requirement is missing/invalid/blocked; partial and
  non-critical gaps never block; override flips the effective status.
- **Policy Resolver.** Unit tests: base-template inheritance; per-country override; evidence-policy vs
  evaluation-policy resolved independently; criticality/scope-tier correct.
- **Evaluation Orchestrator (integration).** End-to-end through the API against **fake providers**
  (classification present; facts/transactions absent, then present) asserting persisted results and the draft
  gate flip — mirroring the existing coverage integration tests that use the fake assessor, on the
  containerized pgvector test database.

Confirmed must-test modules: the **Sufficiency Engine / Satisfaction Strategy** and the **Draft Gate**.

## Out of Scope

- Document classification and source validation (separate, in-progress dependency; consumed here).
- Structured extraction / entity resolution and controlled-transaction mapping (consumed optionally, with
  graceful degradation; the source of V2 facts/capabilities).
- Contradiction detection — this feature reserves `conflicted` but never sets it.
- Draft generation and risk analysis (downstream consumers of the gate).
- **V2 capability/fact-based satisfaction and evidence-aging enforcement** — *designed for and reserved in the
  schema/policy shapes, but not built in V1.* V1 ships document-presence satisfaction.
- Authoring full per-country policy/capability content for all jurisdictions at once; the engine ships on the
  shared base-template policies and grows per country over time.
- Practitioner-configurable / runtime-editable policies (future; definitions are git-versioned JSON for now).

## Further Notes

- **Evolution path (the point of the versioning).** V1 answers "is the right kind of document present?"; V2
  answers "does the validated evidence provide the required capabilities for this entity, period, and
  transaction?" Because the evidence and evaluation policies are stable across both and satisfaction is a
  pluggable strategy, V2 is an additive upgrade — not a re-platform.
- **Why capabilities matter.** They decouple requirements from document *forms*. A requirement needs
  *capabilities* (Provider, Recipient, Pricing, Term); many document types (Service Agreement, Statement of
  Work, Master Service Agreement) can provide them. One rule, many acceptable documents, across jurisdictions.
- **Sequencing.** Hard cutover means the old coverage path is deleted only when classification is ready to
  feed the engine. Until then the engine is built and tested against fake providers.
- **Behavior change to communicate.** Today a Partial requirement hard-blocks drafting (ratio 1.0). Here
  Partial no longer blocks — only critical Missing/Invalid/Blocked does.
- **Determinism guardrail.** Borderline handling belongs in explicit policy/rule/capability data, never in a
  model judgement at match time. The model's role ended at classification and extraction.
