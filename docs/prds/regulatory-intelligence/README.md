# Class 1 — Regulatory Intelligence: slice tracker

Source: PRD **"Class 1 — Regulatory Intelligence"** (versioned, deterministic jurisdiction rules threaded
UNDER the existing Planning → Requirements → Draft → Risks workflow; no new top-level page). Product
principle: deterministic versioned rules decide; the LLM only summarizes/generates prose (§2).

## Decisions (resolved with the user)
- **Registry model = SUBSUME / rule-derived.** The regulatory registry becomes the single source of truth;
  `jurisdiction_requirements.json` is migrated into it and `resolve_requirements()`/`draft_elements()` re-point
  at the registry. **Sequencing refinement (transparent):** the risky re-point is isolated in **S2**, not S1 —
  `resolve_requirements(country)`'s exact output is pinned by `test_coverage`/`test_draft`/
  `test_industry_analysis`/`test_assess_batch`, so S1 stays **purely additive** (new `backend/regulatory/`
  module) and can't destabilise the 235-test pipeline; S2 does the behaviour-preserving migration with the full
  suite as the gate.
- **Content rides alongside (HITL).** Code/engine is AFK, seeded with Qatar (already researched). Verifying
  additional jurisdictions' rule content against primary sources is ongoing HITL content work, not a code slice.
- **Granularity:** 8 slices as approved.

## Slices

| # | Title | Type | Blocked by | Status |
|---|-------|------|-----------|--------|
| S1 | Regulatory registry + engine + resolver foundation (+ Qatar applicability) | AFK | — | ✅ DONE |
| S2 | Requirements rule-derived (subsume re-point) + plain-English/legal-basis drawer | AFK | S1 | ▶ NEXT |
| S3 | Transaction scope & materiality (jurisdiction-specific) | AFK | S1 | pending |
| S4 | Fiscal-year compatibility | AFK | S1 | pending |
| S5 | Jurisdiction-specific benchmarking rules + statistical config | AFK | S1 | pending |
| S6 | Draft: Local Regulations section + regulatory snapshot | AFK | S1 (richer w/ S2,S3,S5) | pending |
| S7 | Risks: deterministic regulatory findings | AFK | S3, S5 | pending |
| S8 | Practitioner overrides + audit trail | AFK | S2 | pending |

**DAG:** S1 → {S2, S3, S4, S5} → S6, S7 (after S3/S5), S8 (after S2).
**Non-goals honoured (§42):** no regulatory CMS, no standalone regs page, no research-agent auto-approval, no
comparable search / TNMM / FAR workflow.

## Working-tree note
Unrelated demo tweaks (confetti direction, Planning autofill timing) are uncommitted in the tree from a prior
task; they are kept OUT of every regulatory commit (staged files are explicit).

## Status / verification log

- [x] **S1 — Regulatory registry + engine + resolver foundation** — DONE (purely additive — no existing file touched).
  - New `backend/regulatory/` package: `schemas.py` (pydantic `RegulatorySource`/`RegulatoryRule`/`JurisdictionProfile` with `verification_status` + effective dates), `engine.py` (pure three-valued condition evaluator — `all`/`any`/`not` + `>,>=,<,<=,=,in,exists`; `all`/`any` short-circuit on a decisive branch so a missing fact only surfaces as `unknown` when it changes the answer, PRD §36), `resolver.py` (`resolve_rules(jurisdiction, fiscal_year)` picks the version in force at the fiscal year-end — latest `effective_from` wins; `evaluate_applicability` → `applied`/`unknown`+`missing_input`), `validators.py` (referential integrity: rules cite declared sources; operators within the limited grammar; `verified` needs a source).
  - `jurisdictions/QA/2026.json`: Qatar seeded from the researched GTA rules — `local_file_required` + `master_file_required` (QAR 50M turnover-or-assets AND a foreign associated enterprise), `verification_status: verified`, provenance to GTA Resolution No. 4/2020 + Income Tax Law No. 24/2018. Matches the PRD §6 example exactly.
  - **Verification:** `pytest tests/test_regulatory.py` **9 passed** (comparators/membership; `exists` never raises; AND/OR/NOT three-valued incl. decisive-branch short-circuit and `unknown` propagation; fiscal-year version selection incl. future-rule-never-applies; Qatar applicability true/false/**unknown+missing_input**; provenance + `validate_profile` clean; bad-data flagged). `app + regulatory` import clean; existing `tests/test_requirements.py` **5 passed** (no regression). No existing file modified → the 235-suite is unaffected; no frontend change (backend-only slice).
  - Acceptance (Registry + Planning, §44): versioned files ✓ · effective dates ✓ · primary-source provenance ✓ · coexisting versions ✓ · verification statuses ✓ · resolve by jurisdiction+fiscal year ✓ · missing input → `unknown` not guessed ✓.

- [ ] **S2 — Requirements rule-derived (subsume re-point) + plain-English/legal-basis drawer** — IN PROGRESS.
  - **Part A (subsume re-point) — DONE + verified.** The regulatory registry now owns jurisdiction requirements:
    `jurisdiction_requirements.json` moved `backend/app/data/` → `backend/regulatory/data/`; resolution
    (`ResolvedElement` + `resolve_requirements` + `draft_elements` + `available_jurisdictions`) moved into
    `backend/regulatory/requirements.py`; `backend/app/requirements.py` is now a thin re-export shim so every
    caller (`matching.py`, `routers/coverage.py`, `routers/draft.py`, `document_classifier.py`) and test keeps
    working unchanged. Ponytail: the data + resolution were relocated (registry = single source of truth), NOT
    atomised element-by-element into `RegulatoryRule` objects — that would add risk without changing the subsume
    outcome; the structured element list is the registry's requirement-content form.
    - **Verification:** captured `tests/data/golden_requirements.json` from the PRE-migration code, then
      `tests/test_requirements_golden.py` recomputes through the registry path and asserts byte-identical
      `resolve_requirements` + `draft_elements` output (all fields) for **all 17 jurisdictions** — passes.
      **Full backend suite: 246 passed** (was 235; +11 = 9 regulatory + 2 golden) against the pgvector test DB.
      No behaviour change.
  - **Part B (Requirements plain-English/legal-basis drawer) — TODO.** Attach the registry's applicability +
    plain-English + source (Qatar is real; per-element citations are HITL content, not fabricated) to the
    Requirements rows + a compact source drawer (§12); preserve the deterministic status flow.
