# Class 2 — Functional & Evidence Intelligence: slice tracker

Source: PRD **"Class 2 — Functional & Evidence Intelligence"**. Build the layer that understands **what the
business actually does** (functions/assets/risks/capabilities) vs what documents claim — evidence-backed,
deterministic where possible, threaded UNDER the existing Planning → Requirements → Draft → Risks workflow (no
new top-level step). Product principle (§2): preserve BOTH "what documents say" and "what the business does";
the LLM extracts/summarizes/classifies/suggests/drafts, but must NOT decide control/arm's-length/sufficiency —
those are evidence-backed + rule-driven (§45).

## Decisions (resolved with the user)
- **Functional fact model = REUSE existing facts.** Functional assertions ARE `ExtractedFact`/`CanonicalFact`
  rows (`fact_type` ∈ function_performed / asset_used / risk_assumed / risk_controlled / capability), extending
  those tables with the few functional fields (`far_type`, `transaction_id`, `value`, `evidence_type`) validated
  against the S1 ontology. One evidence model, one canonicalization path (§43 "prefer reuse"). **S2 is the risk
  centre** — it touches the shipped extraction/canonicalization pipeline, so it must be behaviour-preserving for
  existing facts and gated on the full backend suite (like Class 1's subsume slice).
- **Characterization = deterministic rules + `undetermined`.** A controlled rule maps the FAR profile →
  a characterization value, or returns `undetermined` when evidence is insufficient. No LLM conclusion (§2,§45).
- **Granularity:** 13 slices as approved.
- **Placement:** Class 2 domain code under `backend/app/functional/` (inside the already-copied `app` package)
  → deploys automatically (no Dockerfile `COPY` needed; avoids the Class 1 top-level-package deploy bug).

## Slices

| # | Title | Type | Blocked by | Status |
|---|-------|------|-----------|--------|
| S1 | FAR ontology — controlled, versioned functions/assets/risks/capabilities/characterizations + validators | AFK | — | ▶ IN PROGRESS |
| S2 | Functional fact model — functional assertions enter the existing fact pipeline (fact shape §7, scope §47, period §48, provenance) | AFK (risk centre) | S1 | pending |
| S3 | Interview data model — interviews / questions / responses + provenance chain; raw answer immutable | AFK | — | pending |
| S4 | Guided functional interview (Planning) — scope→controlled question modules→answers→list/screen/findings | AFK | S1, S3 | pending |
| S5 | Interview extraction — responses → validated functional facts (§46 gate) → canonicalization; + transcript upload | AFK | S2, S3 | pending |
| S6 | TP questionnaire integration — import responses → same functional evidence model (not a silo) | AFK | S1, S2 | pending |
| S7 | Org-chart intelligence — key roles + reporting lines as scoped evidence; supports but never proves control | AFK | S2 | pending |
| S8 | Invoice evidence — basic transaction-existence facts, properly scoped; cannot establish FAR | AFK | S2 | pending |
| S9 | FAR builder — aggregate facts → per entity/txn FAR profile + deterministic characterization (undetermined allowed) + evidence-strength hierarchy | AFK | S1, S2, S5 | pending |
| S10 | Risk control & capability — risk_control_profiles (bearer/exposure/decision/control/capability/financial capacity), evidence-linked, mismatches preserved + risk table | AFK | S1, S2, S9 | pending |
| S11 | Requirements integration — evaluate FAR concept sufficiency (partial when risk-control unknown); gap-driven interview recommendation | AFK | S9, S10 | pending |
| S12 | Draft integration — FAR sections from structured evidence, traceable (DraftSection pattern) | AFK | S9, S10 | pending |
| S13 | Risks integration — unsupported risk allocation, capability gap, functional inconsistency, contract-vs-conduct mismatch, missing-interview findings | AFK | S9, S10 | pending |

**DAG:** S1 → S2 → {S3, S6, S7, S8}; S3 → {S4, S5}; S5 → S9 → S10 → {S11, S12, S13}.
**Non-goals honoured (§57):** no video/STT, HR/ERP integration, financial segmentation, TNMM/benchmarking, full
contradiction adjudication (candidates only), Traceable-Fact-Correction UI, standalone Entity Explorer / FAR page.

## Reused infrastructure (do not build a competing architecture, §4)
`ExtractedFact` → `canonicalization.py` → `CanonicalFact`/`CanonicalFactSource`; `EntityMention`/
`CanonicalEntity`/`EntityAlias` (entity resolution); `document_classifier.py`; `extraction_jobs`/
`extraction_store`/`extraction_schemas`; scope levels group/local_entity/transaction/counterparty/unknown;
the Class 1 `backend/regulatory/` versioned-registry + validators pattern (for the ontology); the
`DraftSection`/research deterministic-section pattern (Draft) and the deterministic risks `Finding` pattern (Risks).

## Honest limitation (carried forward)
S9–S13 only produce visible value once real functional evidence is flowing (needs S5–S8 + captured content).
The deterministic cores are test-verified but may sit dormant on live data until evidence exists — "done" =
engine + tests + integration point; evidence/content is the ongoing part. No fabricated conclusions (§46, §60).

## Working-tree note
Unrelated demo tweaks (confetti direction, Planning autofill timing) are uncommitted from a prior task; kept OUT
of every Class 2 commit (staged files are explicit). `.claude/settings.json` and `backend/.env` are never staged.

## Status / verification log

- [ ] **S1 — FAR ontology** — IN PROGRESS.
