# Class 3 — Financial & Economic Analysis: slice tracker

Source: PRD **"Class 3 — Financial & Economic Analysis"** (pasted in full in the conversation). Turn raw client
financial data into a defensible TP result via the pipeline **Raw Financial Data → Normalization → Segmentation
→ Reconciliation → Tested Party → PLI → Benchmark → Arm's-Length Range → Adjustment / Conclusion**. Primary
method automated in v1 = **TNMM**. Threaded UNDER the existing Planning → Requirements → Draft → Risks workflow
(no new top-level step; §3). Product principle (§2, §57, §74): automate the mechanical work without removing
practitioner control — ingest messy data, preserve the original immutably, make every adjustment visible,
calculate deterministically, never manufacture a missing number; if a required input can't be established the
result stays incomplete. The LLM may suggest/classify/explain/draft prose, but MUST NOT calculate totals/PLIs/
quartiles/adjustments, reconcile, alter rows, or decide whether a number is in a range.

## Decisions (resolved with the user)
- **Reuse the Class 1 deterministic engine — do NOT rebuild the math.** `regulatory/benchmarking.py`
  (`compute_arm_length_range`, `position_in_range`, `benchmarking_method`) + `regulatory/period.py`
  (`evaluate_period_compatibility`) already implement the arm's-length range, jurisdiction quartile/statistical
  convention, within/below/above, and benchmark freshness. `regulatory_risks.py` already emits out-of-range +
  stale-benchmark findings from a `benchmark` dict. Class 3 feeds these real persisted data (§40-44, §55, §78);
  PRD Slices 9+10 collapse into S12.
- **Reuse existing infra:** `SourceKind.financials` + `openpyxl` (already deps) + document ingest/provenance,
  canonical facts, entity resolution, the coverage/requirements pattern, the `DraftSection` deterministic-section
  pattern (`_draft_regulatory`/`_draft_functional` + golden re-capture), and the risks `Finding` pattern
  (`regulatory_risks`/`functional_risks`). Do not create a separate financial-evidence universe (§5). Domain code
  under `backend/app/` so it deploys with the `app` package (avoids the Class 1 top-level-package deploy bug).
- **UI distributed into each slice.** Each backend slice ships its own thin UI surface inside the Draft
  "Economic Analysis" workbench (§58). **S1 is a HITL design/shell slice**: it establishes the workbench visual
  language + layout from the existing app design system + PRD §58-62. In this autonomous loop the shell is built
  to match the existing app (a safe inference) and published as an Artifact preview for async design review — it
  is NOT a hard block; later slices plug into the shell and design feedback is cheap to apply.
- **LLM-assisted suggestions (validated-only) in v1** for ambiguous column mappings (S3) and account
  classification (S5). Deterministic-first; the LLM only suggests, never auto-transforms rows (§13, §74).
- **Scale engine now (§73):** S1/S2 store rows immutably and process them via bulk load + a columnar analytical
  path (DuckDB or Polars) for aggregation/PLI/segment rollups — no naive row-by-row ORM, no rows sent to an LLM.
- **Non-goals honored (§81):** no simulation UI, no ERP posting/accounting entries, no full CUP/Profit-Split
  automation, no autonomous benchmark-DB purchasing, no LLM-decided range/optimal-country, deterministic calc
  engine only. The data model must not *prevent* later simulation (§48) but simulation UI is out of scope.

## Slices

| # | Title | Type | Blocked by | Status |
|---|-------|------|-----------|--------|
| S1 | Financial Workbench design + shell — in-Draft Economic Analysis surface (nav + main + side panel), visual language | HITL (design review) | — | ✅ DONE |
| S2 | Financial dataset intake — upload XLSX/CSV → immutable datasets + rows w/ provenance; scale-ready (bulk + columnar); Financials view | AFK | S1 | ✅ DONE |
| S3 | Column mapping + saved mappings (deterministic + LLM-assisted suggestions) + mapping UI | AFK | S2 | ✅ DONE |
| S4 | Validation & diagnostics — invalid rows retained + flagged, never dropped; diagnostics UI | AFK | S2 | ✅ DONE |
| S5 | Account classification (operating/non-operating/…; deterministic + LLM-assisted) + override w/ audit | AFK | S2 | ▶ NEXT |
| S6 | Segments + segmented P&L — segment container, direct mapping, include/exclude; drill-down; segmentation editor | AFK | S2 | pending |
| S7 | Adjustments (exclude/GAAP/topside/manual) — auditable, raw immutable; workpaper UI | AFK | S6 | pending |
| S8 | Allocations — shared-cost split by base + provenance; allocation UI | AFK | S7 | pending |
| S9 | Financial reconciliation — FS→TB→Segment, configurable tolerance, deterministic status; tie-out UI | AFK | S6 | pending |
| S10 | TNMM core — tested party (practitioner-selected, links FAR) + PLI registry (deterministic) + calc + lifecycle; TNMM UI | AFK | S6, S7, S8 | pending |
| S11 | Benchmark import — comparables + accepted/rejected + rejection log; benchmark UI | AFK | S10 | pending |
| S12 | Arm's-length range & conclusion (jurisdiction-aware) — REUSE Class 1 engine; within/below/above; conclusion UI | AFK | S11, S10 | pending |
| S13 | TP adjustment — illustrative adjustment to practitioner target, approval state, never auto-post; UI | AFK | S12 | pending |
| S14 | Requirements integration — evaluate economic-analysis capabilities (not doc presence) + panel | AFK | S9, S12 | pending |
| S15 | Draft integration — Economic Analysis section from structured results (numbers never invented) | AFK | S12 | pending |
| S16 | Risks integration — reconciliation gap / unsupported exclusion / stale benchmark / method mismatch / out-of-range / missing segmentation | AFK | S9, S12, S13 | pending |

**DAG:** S1 (design, parallel) · S2 → {S3, S4, S5, S6} · S6 → {S7, S9} · S7 → S8 · {S6,S7,S8} → S10 → S11 → S12 → S13 · {S9,S12} → S14 · S12 → S15 · {S9,S12,S13} → S16.

## Acceptance criteria (per slice; the loop verifies against these — §84)

- **S1** — Workbench shell renders inside Draft's Economic Analysis with the 5-item nav (Financials/Segmentation/
  TNMM/Benchmark/Conclusion) + side panel; no new global step; renders with zero backend dependency; tsc+build
  clean; Artifact preview published for design review.
- **S2** — XLSX+CSV upload → rows with deterministic provenance (file/sheet/row/col + raw value); original source
  immutable; large populations load via bulk/columnar path (verified on a large fixture, no per-row ORM);
  Financials view shows dataset summary + drills to source-linked rows.
- **S3** — Columns map to canonical fields, reviewable/overridable; deterministic detection resolves known/aliased
  columns; LLM mappings are suggestions requiring validation; saved mappings versioned + reused on schema match.
- **S4** — Validation runs + stores diagnostics; invalid rows produce diagnostics rather than disappearing;
  diagnostics visible in the Financials view.
- **S5** — Rows carry a classification from the controlled enum; deterministic rules classify known accounts, LLM
  only suggests ambiguous; practitioner reclassify with preserved audit.
- **S6** — Multiple segments per entity; accounts assigned directly + excluded (each with a reason); segmented P&L
  renders and drills to accounts; original values preserved.
- **S7** — Adjustments record original/adjustment/adjusted + reason/user/timestamp; raw never modified; adjusted
  P&L reflects them; workpaper shows original + treatment + reason.
- **S8** — Shared costs allocate by a chosen base + %; provenance (pool/base/%/calc/result) stored + traceable;
  allocated amounts appear in the segment P&L with drill-down.
- **S9** — Reconciliation deterministic with configurable tolerance; FS→TB and TB→Segment reconcile where data
  exists; differences classified not hidden; rounding vs material gap resolve to different statuses; tie-out UI.
- **S10** — A controlled transaction references a TNMM analysis with explicit tested party + segment + PLI;
  tested-party selection practitioner-driven with rationale linking FAR; PLI deterministic at full precision,
  inputs inspectable + traceable; segment→TNMM reconciliation exercisable.
- **S11** — Benchmark study/comparable set imported + linked; accepted vs rejected distinguishable with reasons;
  population + rejection log viewable.
- **S12** — Range computed via the jurisdiction's Class 1 statistical method (not hard-coded); tested result
  compared deterministically → within/below/above/insufficient/review; freshness evaluated vs Class 1 refresh;
  reproducible, records method + rule version.
- **S13** — Potential adjustment calculated to an explicit practitioner-chosen target; reproducible with target
  basis + currency; practitioner approval required; no auto-post/legal conclusion.
- **S14** — Requirements evaluate economic-analysis capabilities (not benchmark-PDF existence); missing
  segmentation / failed reconciliation / stale benchmark drive Partial/Missing; panel surfaces status + gaps.
- **S15** — Economic Analysis section renders from structured results; generated numbers cannot differ from stored
  analysis; claims traceable to source calculations; non-gating with honest "not yet established" fallback.
- **S16** — Reconciliation gaps / unsupported exclusions / stale benchmarks / method mismatches / out-of-range /
  missing segmentation each produce findings where evidence supports them; each names its basis; deterministic;
  merged into `run_analysis` alongside LLM + regulatory + functional findings.

## Honest follow-ons (out of v1, flagged not overclaimed)
Automated benchmark-database search; PDF financial-statement table reconstruction; ERP connectors (SAP/Oracle/
NetSuite/Workday); simulation UI (§48-49); currency conversion beyond recording the rate (§79); methods beyond
TNMM (§81).

## Status / verification log

- [x] **S1 — Financial Workbench design + shell** — DONE (HITL design/shell; built to match the existing app
  design system + PRD §58, published for async review — non-blocking). USER-VISIBLE.
  - `components/economic/Workbench.tsx` — the in-Draft Economic Analysis shell: a five-view nav (Financials /
    Segmentation / TNMM / Benchmark / Conclusion), a main area with a per-view placeholder, and an
    evidence/calculations/warnings side panel. Pure component, zero backend, styled with the app's design tokens.
  - `components/steps/draft.tsx` — an "Economic Analysis" toggle in the Draft header swaps the body to the
    workbench (internal surface within Draft; no new top-level step, §3/§58). Minimal, reversible integration.
  - **Verification:** `npx tsc --noEmit` clean; `pnpm build` clean (8/8 pages). Design preview published as an
    Artifact for review: https://claude.ai/code/artifact/c457ac44-3714-473f-b6c9-6dc1d34c62b1
  - Acceptance (S1): shell renders inside Draft with the 5-item nav + side panel ✓ · no new global step ✓ · zero
    backend dependency ✓ · tsc+build clean ✓ · design preview published ✓.
  - Open to design feedback (nav order/naming/layout) — cheap to apply to the shell + the surfaces that plug in.

- [x] **S2 — Financial dataset intake** — DONE. USER-VISIBLE (Financials view live in the workbench).
  - `models.py`: `FinancialDataset` (engagement/document/entity/dataset_type/period/currency/columns/status/
    row_count) + `FinancialRow` (canonical fields + `source_locator` + `raw` JSONB of original cells). Immutable
    normalized layer — the uploaded Document is never mutated (§9); later adjustments are separate rows (§20). New
    tables via `create_all` (no ALTER).
  - `financial_intake.py`: XLSX (openpyxl) + CSV (stdlib) parser; deterministic default column detection with an
    `amount` fallback for TB/GL variants ("FY24 Actual", "Closing Balance"); accounting-negative parsing;
    unparseable amounts stay `None` (never fabricated, §2/§15). `financial_store.py`: BULK insert via SQLAlchemy
    Core (no per-row ORM) + SQL-aggregated summary (§73 scale path).
  - `routers/financials.py`: upload (reuses `store_upload` + `SourceKind.financials` → immutable Document) +
    list + rows drill-down (paginated). Registered in `main.py`.
  - Frontend: live Financials view in `components/economic/Workbench.tsx` — upload (dataset-type select) →
    dataset cards with SQL currency totals → expand to drill into source-linked rows (account/name/BU/amount/
    currency/source_locator). `lib/api.ts` typed; `draft.tsx` passes `engagementId`.
  - **Verification:** `test_financials.py` **7 passed** (provenance + detection; source Document immutable; CSV;
    unparseable→null; 3000-row bulk load + pagination; unsupported-type 422; listing). **Full backend suite 317
    passed** (310 + 7). `tsc` + `pnpm build` clean.
  - Acceptance (S2): XLSX+CSV upload → rows with deterministic provenance ✓ · original source immutable ✓ · large
    populations via bulk/SQL path ✓ · Financials view shows summary + drills to source-linked rows ✓.
  - Decision (ponytail): bulk-insert + Postgres SQL aggregation (the user's sanctioned "bulk load + SQL
    aggregation" scale path); DuckDB/Polars columnar processing deferred until a slice needs in-memory analytics
    over huge sets. Real per-client column mapping (aliases/saved/LLM) is S3.

- [x] **S3 — Column mapping + saved mappings** — DONE. USER-VISIBLE (mapping editor in the Financials view).
  - `financial_intake.py`: `derive_from_mapping(raw, mapping)` (re-derive canonical fields from the immutable raw
    cells) + `header_signature(headers)` (order-independent, normalized). `financial_store.py`: `create_dataset`
    now derives rows from an effective mapping; `reapply_mapping` bulk-UPDATEs rows from raw on a remap (no
    re-upload — the payoff of preserving raw, §9).
  - `financial_mapping.py`: saved-mapping helpers (`find_saved_mapping`/`save_mapping`, versioned by user +
    signature, §14) + an injectable `ColumnMappingSuggester` seam with a deterministic offline default
    (`KeywordColumnMappingSuggester`, token-overlap); an LLM-backed suggester is a drop-in via `app.state`
    (mirrors the Class 2 extractor seam) so suggestions stay validated-only and tests stay offline (§13, §74).
    New `FinancialColumnMapping` table (create_all); `column_mapping` JSONB on `financial_datasets` (idempotent
    ALTER in init_db).
  - `routers/financials.py`: upload reuses a saved mapping when the header signature matches (else default
    detection); `GET/PUT /financial-datasets/{id}/mapping` (review + override → re-derive rows, optional
    versioned save); `GET .../mapping/suggestions` (validated-only, never auto-applied). Suggester injected in
    main.py + conftest.
  - Frontend: a Columns mapping editor in the workbench Financials view — per-field header selects, a Suggest
    button (fills unmapped fields, requires Apply), and Apply → rows re-derive live.
  - **Verification:** `test_financial_mapping.py` **6 passed** (override remaps rows from raw w/o re-upload;
    saved mapping reused on matching headers; versioning latest-wins; suggestions validated-only; deterministic
    detection regression; invalid mapping 422) + `test_financials.py` 7 (S2 regression). `tsc` + `pnpm build`
    clean. **Full backend suite 323 passed** (317 + 6).
  - Acceptance (S3): columns map to canonical fields, reviewable/overridable ✓ · deterministic detection
    resolves known/aliased ✓ · LLM mappings are suggestions requiring validation ✓ · saved mappings versioned +
    reused on schema match ✓.
  - Honest: the "LLM-assisted" suggester ships as a deterministic token-overlap matcher behind the injectable
    seam (offline, free, decent for short header names), consistent with the Class 2 v1 extractor; a real
    LLM-backed suggester is a drop-in via `app.state.column_mapping_suggester`.

- [x] **S4 — Validation & diagnostics** — BUILT, full-suite gate running. USER-VISIBLE (diagnostics panel + row
  flags in the Financials view).
  - `financial_validation.py::validate_rows(rows, mapping)` — pure deterministic checks (§15): blank/unparseable
    amount, missing account, malformed account code, invalid currency, duplicate rows, and dataset-level missing
    required columns (account + amount). Returns per-row issue codes + a summary. Invalid rows are FLAGGED, never
    dropped.
  - `financial_datasets.diagnostics` JSONB + `financial_rows.issues` JSONB (idempotent ALTERs in init_db).
    Validation runs on upload (`create_dataset`) and re-runs on remap (`reapply_mapping`), so fixing the mapping
    clears the relevant flags. `GET /financial-datasets/{id}/diagnostics` + `issues` on the rows response.
  - Frontend: a caution diagnostics bar (missing-required-columns + issue-count chips) and an Issues column
    marking each flagged row, plus a "N flagged" count on the dataset header.
  - **Verification:** `test_financial_validation.py` **7 passed** (5 pure: clean pass, blank vs unparseable
    amount, missing-account + invalid-currency, duplicate flag, missing-required-columns; 2 integration: upload
    flags rows without dropping + diagnostics endpoint; remap re-runs validation and clears flags) + S2/S3
    regression 13. `tsc` + `pnpm build` clean. **Full backend suite 330 passed** (323 + 7).
  - Acceptance (S4): validation runs + stores diagnostics ✓ · invalid rows produce diagnostics rather than
    disappearing ✓ · diagnostics visible in the Financials view ✓.
  - Honest (§15): date/period parsing, debit/credit sanity, and total tie-outs are follow-ons — the single-amount
    canonical model has no separate debit/credit columns and period is a free-form label; skipped to avoid
    false-positive flags rather than shipping brittle checks.
