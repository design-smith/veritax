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
| S1 | FAR ontology — controlled, versioned functions/assets/risks/capabilities/characterizations + validators | AFK | — | ✅ DONE |
| S2 | Functional fact model — functional assertions enter the existing fact pipeline (fact shape §7, scope §47, period §48, provenance) | AFK (risk centre) | S1 | ✅ DONE |
| S3 | Interview data model — interviews / questions / responses + provenance chain; raw answer immutable | AFK | — | ✅ DONE |
| S4 | Guided functional interview (Planning) — scope→controlled question modules→answers→list/screen/findings | AFK | S1, S3 | ✅ DONE |
| S5 | Interview extraction — responses → validated functional facts (§46 gate) → canonicalization; + transcript upload | AFK | S2, S3 | ▶ NEXT |
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

- [x] **S1 — FAR ontology** — DONE (purely additive; under `backend/app/functional/` so it deploys with `app`).
  - `app/functional/data/far_ontology.json` (versioned) + `app/functional/ontology.py`: `functions()` (35, grouped
    into commercial/operational/corporate_shared/intellectual_property/treasury_financing), `assets()`, `risks()`,
    `capabilities()` (the six §11 role dimensions — modeled separately from risk assumption), `characterizations()`
    (incl. `undetermined`); `valid_function/asset/risk/capability/characterization`; `valid_far_value(fact_type,
    value)` dispatching a functional fact's `far_type` to the right taxonomy (the bridge into S2).
  - **Verification:** `pytest tests/test_functional_ontology.py` **4 passed** (versioned; functions taxonomy +
    categories no-drift; asset/risk/capability/characterization membership incl. rejects; `valid_far_value`
    dispatch incl. wrong-taxonomy + unknown-fact_type → False). `app + app.functional` import clean; no existing
    file modified → the 273-suite is unaffected; no frontend change (backend-only slice).
  - Acceptance (Functional ontology, §60): functions ✓ · assets ✓ · risks ✓ · capability separate from risk
    assumption ✓ · versioned ✓.

- [ ] **S2 — Functional fact model** — BUILT, full-suite gate running (REUSE decision).
  - `ExtractedFact` + `CanonicalFact` gained nullable `far_type` / `transaction_id` / `evidence_type` (value
    reuses `value_normalized`); `ExtractedFactInput` carries them (flow via `model_dump()`). Registered a
    `functional` extraction schema (`function_performed`/`asset_used`/`risk_assumed`/`risk_controlled`/
    `capability`; scopes `local_entity`/`transaction`/`counterparty` per §47 — group excluded).
  - `canonicalization.py`: `functional_fact_ok` rejects an unknown `far_type` → not promoted (§46, §45); the
    canonical key adds `far_type`/`transaction_id` **only when present**, so non-functional keys are
    byte-identical (behaviour-preserving); `CanonicalFact` carries the new columns. `app/functional/facts.py`:
    `FUNCTIONAL_FACT_TYPES` + `is_functional_fact_type` + `functional_fact_ok`.
  - **Migration:** idempotent `ALTER TABLE extracted_facts|canonical_facts ADD COLUMN IF NOT EXISTS
    far_type|transaction_id|evidence_type text` added to `init_db` → auto-applies on deploy startup (conftest
    `create_all` covers tests).
  - **Verification:** `test_functional_facts.py` **3 passed** (functional fact promotes with far dimensions +
    provenance; far_type+transaction distinguish otherwise-identical facts; unknown far_type not promoted) +
    `test_canonical_facts.py` **4 passed** (existing behaviour preserved). **Full backend suite 280 passed**
    (273 baseline + 4 S1 + 3 S2). Acceptance (FAR traceability, §7/§43/§46): functional facts ride the existing
    evidence model ✓ · far_type validated vs ontology, unsupported not promoted ✓ · provenance preserved ✓ ·
    behaviour-preserving for existing facts ✓.

- [ ] **S3 — Interview data model** — BUILT, full-suite gate running (purely additive: 3 new tables).
  - `models.py`: `FunctionalInterview` (engagement + entity + participant name/title/role + `transaction_ids`
    JSONB + `fiscal_period` + `interview_date` + `status` §53 + `created_by`), `InterviewQuestion`
    (question_key/text/category/sequence + `parent_question_id` self-FK for §17 follow-ups), `InterviewResponse`
    (`response_raw` immutable §18 + summary + locator). Provenance chain response→question→interview→participant.
  - **Migration:** `create_all` in `init_db` creates the 3 tables (tests + deploy); no ALTER needed.
  - **Verification:** `test_interview_model.py` **3 passed** (chain + provenance; follow-up parent link;
    completion states not_started/in_progress/completed/completed_with_gaps). **Full backend suite 283 passed**
    (280 + 3). Acceptance (Interviews data-model portion, §43/§18-19/§53): interview/question/response with
    provenance chain ✓ · raw answer preserved ✓ · follow-up parent link ✓ · completion states incl.
    completed_with_gaps ✓. (S3 code committed in `7dfe094`; this entry finalizes it post-gate.)

- [ ] **S4 — Guided functional interview (Planning workflow)** — IN PROGRESS (backend built, gate running; frontend next).
  - **Backend (built, focused tests green):** `app/functional/questions.py` + `data/question_modules.json` —
    deterministic controlled modules (core + transaction: services/distribution/manufacturing/licensing/financing
    + role: finance/treasury/sales/operations/rnd) with `select_questions(role, transaction_types)` (deduped +
    sequenced, unrelated modules excluded; §16/§22, NOT 500 static). New `routers/interviews.py` (registered in
    main.py): POST create (auto-generates scoped questions), GET list (§37 counts), GET one (screen), POST
    response (raw immutable §18, status→in_progress), GET findings (§37 functions/risks/decision-makers/open).
    Schemas in schemas.py. `test_interviews_api.py` **4 passed** (role/transaction-aware generation; capture +
    findings + immutable raw; foreign-question rejected). Full backend suite = the gate (running).
  - **Frontend (DONE):** `lib/api.ts` interview types + client methods (`createInterview`/`listInterviews`/
    `getInterview`/`addInterviewResponse`/`getInterviewFindings`); `components/steps/planning.tsx` — the
    Interview source is now a guided **Functional Interviews** workflow (§35): a New-interview form (participant
    name/title/role + transaction type(s) via the existing MultiSelect + fiscal period) that auto-generates the
    scoped questions, an interview list (§37 participant/role/status/answered counts), a question-by-question
    screen (answer textarea → Save; saved answers render read-only = raw immutable §18; follow-ups indented), and
    a findings view (§37 functions/risks/decision-makers/open). Transcript upload stays (its extraction is S5).
    Fetch is fail-safe so the /demo route stays clean. `npx tsc --noEmit` clean; `pnpm build` clean.
  - **S4 DONE.** Backend suite **287** + `tsc` clean + `pnpm build` clean. Acceptance (Interviews, §60): create
    interview for entity/transaction ✓ · questions adapt to participant role + transaction type ✓ · raw answers
    preserved ✓ · question/response provenance ✓ · completion states incl. completed_with_gaps ✓. (Uploaded
    transcript *processing* into facts is S5.)
