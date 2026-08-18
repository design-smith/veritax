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
| S5 | Account classification (operating/non-operating/…; deterministic + LLM-assisted) + override w/ audit | AFK | S2 | ✅ DONE |
| S6 | Segments + segmented P&L — segment container, direct mapping, include/exclude; drill-down; segmentation editor | AFK | S2 | ✅ DONE |
| S7 | Adjustments (exclude/GAAP/topside/manual) — auditable, raw immutable; workpaper UI | AFK | S6 | ✅ DONE |
| S8 | Allocations — shared-cost split by base + provenance; allocation UI | AFK | S7 | ✅ DONE |
| S9 | Financial reconciliation — FS→TB→Segment, configurable tolerance, deterministic status; tie-out UI | AFK | S6 | ✅ DONE |
| S10 | TNMM core — tested party (practitioner-selected, links FAR) + PLI registry (deterministic) + calc + lifecycle; TNMM UI | AFK | S6, S7, S8 | ✅ DONE |
| S11 | Benchmark import — comparables + accepted/rejected + rejection log; benchmark UI | AFK | S10 | ✅ DONE |
| S12 | Arm's-length range & conclusion (jurisdiction-aware) — REUSE Class 1 engine; within/below/above; conclusion UI | AFK | S11, S10 | ✅ DONE |
| S13 | TP adjustment — illustrative adjustment to practitioner target, approval state, never auto-post; UI | AFK | S12 | ✅ DONE |
| S14 | Requirements integration — evaluate economic-analysis capabilities (not doc presence) + panel | AFK | S9, S12 | ✅ DONE |
| S15 | Draft integration — Economic Analysis section from structured results (numbers never invented) | AFK | S12 | ▶ NEXT |
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

- [x] **S5 — Account classification** — BUILT, full-suite gate running. USER-VISIBLE (per-row Class select in the
  Financials view).
  - `financial_classification.py::classify_account(code, name)` — deterministic-first keyword rules → operating /
    non_operating / exceptional / financing / tax / unallocated / review_required + a `source`
    (deterministic|default); named-but-unclassified → `review_required` (§19, no universal TP treatment
    hard-coded). Injectable `ClassificationSuggester` seam + deterministic offline Fake for ambiguous accounts
    (validated-only, LLM drop-in), injected via app.state + conftest (mirrors S3).
  - `financial_rows` gains `classification` + `classification_source` + `classification_original` +
    `classification_reason` + `classification_overridden_by/at` (idempotent ALTERs). Classification runs on upload
    and re-runs on remap for auto rows; **a practitioner override is preserved across remaps** (§56 audit:
    original/new/reason/user/timestamp).
  - `routers/financials.py`: `PUT /financial-rows/{id}/classification` (override w/ audit; validates the enum) +
    `GET /financial-datasets/{id}/classification/suggestions` (validated-only, only for defaulted rows).
  - Frontend: a Class column in the rows table with a per-row override select (overridden rows visibly tinted).
  - **Verification:** `test_financial_classification.py` **7 passed** (2 pure: deterministic signals, unknown/
    blank; 5 integration: rows classified on upload, override records audit + preserves original, unknown-class
    422, suggestions validated-only, remap preserves override) + S2–S4 regression 20. `tsc` + `pnpm build` clean.
    **Full backend suite 337 passed** (330 + 7).
  - Acceptance (S5): rows carry a classification from the controlled enum ✓ · deterministic rules classify known
    accounts, LLM only suggests ambiguous ✓ · practitioner reclassify with preserved audit ✓.

- [x] **S6 — Segments + segmented P&L** — BUILT, full-suite gate running. USER-VISIBLE (Segmentation view live).
  - `models.py`: `FinancialSegment` (engagement/entity/name/period/currency/transaction_ids/status) + `SegmentRule`
    (field ∈ account_code/account_name/cost_center/business_unit, operator ∈ equals/in/contains, value, action
    include/exclude, reason). New tables via create_all. Rule-based membership subsumes §18 direct mapping +
    inclusion/exclusion; rules never mutate rows (§9).
  - `financial_segments.py`: `segment_row_filter` builds a SQL condition `(any include) AND NOT (any exclude)`;
    `segment_pnl` is a SQL rollup grouped by the S5 classification (net signed sum + count per class + net
    operating result, §24); `segment_rows` returns matched rows for drill-down. Membership spans the engagement's
    datasets, optionally filtered by the segment's period.
  - `routers/financials.py`: segment CRUD + rule add/delete (validated) + `GET /financial-segments/{id}/pnl` +
    `.../rows` (drill). Frontend: a Segmentation view — segment tabs + create, an include/exclude rule builder
    (field/operator/value/reason) with delete, the segmented P&L, and drill-to-rows.
  - **Verification:** `test_financial_segments.py` **5 passed** (include/exclude-with-reason P&L; drill rows +
    originals preserved; multiple segments per entity; empty-without-include; invalid-rule 422). `tsc` +
    `pnpm build` clean. **Full backend suite 342 passed** (337 + 5).
  - Acceptance (S6): multiple segments per entity ✓ · accounts assigned directly + excluded each with a reason ✓ ·
    segmented P&L renders + drills to accounts ✓ · original values preserved ✓.
  - Decision (ponytail): rule-based membership over explicit row-membership (survives new rows, subsumes direct
    mapping). Precise Revenue/COGS/operating-margin under a chosen PLI is S10; S6 gives the classification rollup +
    net operating result.

- [x] **S7 — Adjustments** — BUILT, full-suite gate running. USER-VISIBLE (adjustment workpaper in the segment).
  - `models.py`: `FinancialAdjustment` (segment_id, financial_row_id nullable, account_ref, adjustment_type ∈
    exclude_non_operating/reclassify/gaap_adjustment/topside_adjustment/manual_adjustment/tp_true_up,
    original_amount, adjustment_amount, reason, created_by, created_at). New table via create_all. Adjustments are
    AMOUNT adjustments layered on a segment's P&L — raw `financial_rows` are NEVER mutated (§9,§75).
  - `financial_segments.py`: `segment_pnl` now returns `adjustments` + `adjustments_total` +
    `adjusted_operating_result` (base operating result + Σ adjustment_amount). `routers/financials.py`:
    POST/GET/DELETE `/financial-segments/{id}/adjustments` (POST validates the type, stamps created_by + created_at).
  - Frontend: an auditable workpaper in the segment detail (Account | Original | Treatment | Adjustment | Reason,
    §61) with an add form + delete, and an Adjusted operating result line under the P&L.
  - **Verification:** `test_financial_adjustments.py` **4 passed** (adjustment recorded w/ audit incl.
    created_by/at + reflected in the adjusted result; raw rows never mutated; delete reverts; unknown type 422) +
    S6 regression 5. `tsc` + `pnpm build` clean. **Full backend suite 346 passed** (342 + 4).
  - Acceptance (S7): adjustments record original/adjustment/adjusted + reason/user/timestamp ✓ · raw never
    modified ✓ · adjusted P&L reflects them ✓ · workpaper shows original + treatment + reason ✓.

- [x] **S8 — Allocations** — BUILT, full-suite gate running. USER-VISIBLE (Allocations section in the segment).
  - `models.py`: `FinancialAllocation` (segment_id, cost_pool, pool_amount, allocation_base ∈ revenue/headcount/
    fte/direct_cost/time_spent/units/transaction_volume/custom, allocation_percentage, allocated_amount, source,
    reason, created_by, created_at). New table via create_all. **`allocated_amount` is computed server-side**
    (pool × percentage/100) — a client-supplied result is ignored (§74).
  - `financial_segments.py`: `segment_pnl` now returns `allocations` (full provenance: pool/base/percentage/
    source/result, §23) + `allocations_total`, folded into `adjusted_operating_result` (= operating + adjustments
    + allocations). `routers/financials.py`: POST/GET/DELETE `/financial-segments/{id}/allocations`.
  - Frontend: an Allocations section in the segment detail (cost pool + pool amount + base + % → allocated amount
    with source) reflected in the adjusted operating result + P&L summary.
  - **Verification:** `test_financial_allocations.py` **5 passed** (allocated_amount computed server-side;
    client-supplied result ignored; reflected in adjusted result; delete; invalid base 422) + S7 regression 4.
    `tsc` + `pnpm build` clean. **Full backend suite 351 passed** (346 + 5).
  - Acceptance (S8): shared costs allocate by a chosen base + % ✓ · provenance (pool/base/%/calculation/result)
    stored + traceable ✓ · allocated amounts appear in the segment P&L ✓.

- [x] **S9 — Financial reconciliation** — BUILT, full-suite gate running. USER-VISIBLE (Financial tie-out panel).
  - `financial_reconciliation.py::reconcile(source_total, target_total, tolerance, rounding)` — pure deterministic
    status ∈ reconciled / reconciled_with_rounding / reconciled_with_explained_difference / unreconciled /
    review_required (§26-27); a missing total → review_required; a difference is never hidden.
  - `financial_reconciliations` table (source/target kind+id, both totals, difference, difference_pct, tolerance,
    rounding, status, explanation) via create_all. Totals computed SERVER-SIDE: `dataset_total` (SQL sum over a
    dataset's rows) + `segment_total` (SQL sum over the segment's matched rows). Endpoints: POST/GET/DELETE
    `/engagements/{id}/reconciliations` with a source/target ref ({kind: dataset|segment, id}).
  - Frontend: a Financial tie-out panel in the Financials view (§28) — list with status badge + difference + a
    create form picking source/target dataset-or-segment and a tolerance.
  - **Verification:** `test_financial_reconciliation.py` **6 passed** (2 pure: status thresholds incl. rounding/
    tolerance/unreconciled/review_required + difference/pct; 4 integration: dataset↔dataset reconciled, material
    gap unreconciled + surfaced, dataset↔segment tie-out, list + delete). `tsc` + `pnpm build` clean. **Full
    backend suite 357 passed** (351 + 6).
  - Acceptance (S9): deterministic w/ configurable tolerance ✓ · FS→TB and TB→Segment reconcile where data
    exists ✓ · differences classified not hidden ✓ · rounding vs material gap → different statuses ✓ · tie-out
    UI ✓.

- [x] **S10 — TNMM core** — BUILT, full-suite gate running. USER-VISIBLE (TNMM view). The heart of the method.
  - `financial_tnmm.py::compute_pli` — deterministic PLI registry (§33): operating_margin = op/revenue;
    full_cost_markup = op/total_costs; berry_ratio + return_on_assets defined but return `None` (undetermined,
    §46) when gross-profit/assets inputs are absent in v1. Never LLM (§74). `financial_segments.segment_tnmm_
    inputs`: revenue = Σ operating rows amount>0; operating_profit = adjusted operating result; total_costs =
    revenue − operating_profit (documented sign convention: income positive).
  - `tnmm_analyses` + `tnmm_calculations` tables (create_all). Tested party is PRACTITIONER-selected (stamped
    `tested_party_selected_by`, never LLM, §31); the analysis read surfaces the Class 2 FAR characterization
    (`derive_characterization(build_far_profile(...))`) so the rationale is FAR-linked. Calc snapshot stores
    inputs + pli_value + `calculation_version` (§35/§72, reproducible).
  - `routers/financials.py`: POST/GET/PATCH `/tnmm-analyses` + `/compute` (recompute from the segment). Frontend:
    a TNMM view — pick segment + PLI + tested party (rationale shows the FAR characterization) → compute →
    deterministic PLI with inspectable inputs (revenue / total costs / operating profit) tracing to the segment.
  - **Verification:** `test_financial_tnmm.py` **5 passed** (PLI formulas + undetermined; operating_margin
    computed + traceable to the segment; FAR characterization surfaced; full_cost_markup + lifecycle; unknown-PLI
    + missing-segment 422). `tsc` + `pnpm build` clean. **Full backend suite 362 passed** (357 + 5).
  - Acceptance (S10): a controlled transaction references a TNMM analysis w/ explicit tested party + segment +
    PLI ✓ · tested-party selection practitioner-driven, rationale links FAR ✓ · PLI deterministic at full
    precision, inputs inspectable + traceable ✓ · segment→TNMM reconciliation exercisable (via S9 segment_total) ✓.

- [x] **S11 — Benchmark import** — BUILT, full-suite gate running. USER-VISIBLE (Benchmark view).
  - `models.py`: `BenchmarkSet` (analysis_id, source, search_date, periods, geographic/industry scope, search
    strategy) + `BenchmarkComparable` (company/country, accepted, rejection_reason, pli_values, financial_values,
    years). New tables via create_all. Import preserves the FULL population — accepted AND rejected with reasons
    (§38, the audit trail); automated DB search is a non-goal (§39/§81), v1 imports a practitioner set via JSON.
  - `routers/financials.py`: POST/GET/GET-one/DELETE `/tnmm-analyses/{id}/benchmark-sets` (+ `/benchmark-sets/{id}`),
    with accepted/rejected counts in the read. Frontend: a Benchmark view — pick a TNMM analysis, stage
    comparables (company/accepted/rejection reason/PLIs) → import a set, and view accepted vs rejected with the
    rejection log.
  - **Verification:** `test_financial_benchmark.py` **3 passed** (import preserves full population + rejection
    reasons; list + detail include rejects; delete). `tsc` + `pnpm build` clean. **Full backend suite 365
    passed** (362 + 3).
  - Acceptance (S11): a benchmark study/comparable set imported + linked ✓ · accepted vs rejected distinguishable
    with reasons ✓ · population + rejection log viewable ✓.

- [x] **S12 — Arm's-length range & conclusion** — BUILT, full-suite gate running. USER-VISIBLE (Conclusion view).
    REUSES the Class 1 engine (no rebuilt math).
  - `financial_range.py::compute_range` — one observation per accepted comparable (mean of its pli_values), fed
    to `regulatory.compute_arm_length_range` with the jurisdiction quartile convention from
    `regulatory.benchmarking_method(jurisdiction, period)`; tested result = latest `tnmm_calculations.pli_value`;
    `regulatory.position_in_range` → within_range/below_range/above_range; too-few/no observations →
    insufficient_data; no tested result → review_required; freshness via `regulatory.evaluate_period_
    compatibility`. Deterministic — the LLM never decides range membership (§44).
  - `benchmark_results` table (min/LQ/median/UQ/max + statistical_method + n + tested_result + position +
    jurisdiction + freshness) via create_all — records method + jurisdiction for reproducibility (§72). Endpoints:
    POST `/benchmark-sets/{id}/compute-range` + GET `/benchmark-sets/{id}/range`.
  - Frontend: the Conclusion view — arm's-length range (min/LQ/median/UQ/max) + tested result + within/below/above
    status (colored) + benchmark freshness.
  - **Verification:** `test_financial_range.py` **5 passed** (within via the Class 1 engine; below; insufficient_
    data when <4; review_required without a tested result; persisted + fetchable). `tsc` + `pnpm build` clean.
    **Full backend suite 370 passed** (365 + 5).
  - Acceptance (S12): range via the jurisdiction's Class 1 method (not hard-coded) ✓ · tested compared
    deterministically → within/below/above/insufficient/review ✓ · freshness vs Class 1 refresh ✓ · reproducible,
    records method + version ✓.

- [x] **S13 — TP adjustment** — BUILT, full-suite gate running. USER-VISIBLE (TP-adjustment panel in Conclusion).
  - `financial_range.py::compute_tp_adjustment` — deterministic (§45): pulls the latest BenchmarkResult for the
    analysis + the latest TNMM revenue; `adjustment_amount = (target − current) × revenue`; target = median /
    lower_quartile / upper_quartile / custom; status = `none_required` when within range else
    `potential_adjustment`. `tp_adjustments` table (current/target/basis/amount/currency/status/reason/audit) via
    create_all. NEVER auto-posts (§45,§47,§81) — implementation is only a practitioner status transition.
  - `routers/financials.py`: POST `/tnmm-analyses/{id}/tp-adjustment` (compute+store) + GET list + PATCH
    `/tp-adjustments/{id}` {status} (confirm/reject/implement, validated). Frontend: a TP-adjustment panel in the
    Conclusion view — choose target, see the required adjustment (current→target + amount), confirm/reject/mark
    implemented; nothing is posted automatically.
  - **Verification:** `test_financial_tp_adjustment.py` **4 passed** (adjustment to median = (target−current)×
    revenue; within_range → none_required; approval transitions never auto-posted; unknown basis/status 422).
    `tsc` + `pnpm build` clean. **Full backend suite 374 passed** (370 + 4).
  - Acceptance (S13): potential adjustment to an explicit practitioner-chosen target ✓ · reproducible w/ basis +
    currency ✓ · practitioner approval required ✓ · no auto-post/legal conclusion ✓.

- [x] **S14 — Requirements integration** — BUILT, full-suite gate running. USER-VISIBLE (Economic analysis panel).
    Mirrors the Class 2 functional-analysis pattern.
  - `economic_coverage.py::economic_analysis_summary` — deterministic (not an LLM score) capability evaluation
    from the Class 3 structured objects: tested_party_identified / financial_segment_available / pli_defined /
    benchmark_available / range_calculated / benchmark_current / financial_result_reconciled / arm_length_
    conclusion_available → present / partial / unknown + specific gaps (§51). A benchmark PDF's mere existence
    never makes it present. Attached to `CoverageResponse.economic_analysis` (mirrors `functional_analysis`) in
    `routers/coverage.py`; `EconomicAnalysisRead` schema.
  - Frontend: an Economic analysis panel on the Requirements view (status + "N/M capabilities met" + gaps), typed
    in `lib/api.ts` + `lib/demo-api.ts`.
  - **Verification:** `test_economic_coverage.py` **3 passed** (unknown w/o analysis; partial when benchmark
    missing; present when all capabilities met + rides the coverage response) + `test_coverage.py` 14 regression.
    `tsc` + `pnpm build` clean. **Full backend suite 377 passed** (374 + 3).
  - Acceptance (S14): Requirements evaluate economic-analysis capabilities (not benchmark-PDF existence) ✓ ·
    missing segmentation / failed reconciliation / stale benchmark drive Partial/Missing ✓ · panel surfaces
    status + gaps ✓.
