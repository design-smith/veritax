# Issues: Structured Extraction & Entity Resolution

Parent PRD: [structured-extraction-entity-resolution.md](structured-extraction-entity-resolution.md)

Ponytail constraint: build the smallest evidence model that prevents Local File contamination. Do not build a standalone Entity Explorer, manual extraction button, correction workflow, PDF table reconstruction engine, global entity registry, or semantic duplicate merger in this PRD.

---

## SEER-01: Add Versioned Extraction Schema Registry

**Status:** Done

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** Upload Agreement, Preserve Evidence Without Overclaiming

### What to build

Create a backend JSON registry for extraction schemas and a small loader/validator that maps supported classification document types to allowed fact types, value rules, provenance requirements, entity roles, and permitted scope levels.

### Acceptance criteria

- [x] Versioned extraction schema JSON exists in the backend.
- [x] Registry covers v1 supported document types from the PRD.
- [x] Schema entries define allowed fact types and allowed scope levels per fact type.
- [x] Unsupported document types resolve to `skipped_not_supported`, not an error.
- [x] Invalid or invented fact types are rejected by schema validation tests.

### Implementation

- Added `backend/app/data/extraction_schemas.json`.
- Added `backend/app/extraction_schemas.py`.
- Added `backend/tests/test_extraction_schemas.py`.

### Verification

- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_schemas.py -q` -> `4 passed`
- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_schemas.py backend/tests/test_evidence_taxonomy.py -q` -> `6 passed`

---

## SEER-02: Add Extraction Run And Fact Storage

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-01

**User stories covered:** Upload Agreement, Verify Provenance

### What to build

Add database models, startup schema updates, and storage helpers for extraction runs, extracted facts, fact sources, expected-field diagnostics, and document aggregate extraction status.

### Acceptance criteria

- [x] `extraction_runs` store document/schema/model fingerprint, status, active flag, supersession metadata, and diagnostics.
- [x] `extracted_facts` reference both document and extraction run.
- [x] `fact_sources` store document, page when applicable, locator, and quote.
- [x] Facts do not have their own active flag; run activeness controls lifecycle.
- [x] Storage tests cover create/read and source provenance persistence.

### Implementation

- Added extraction run, extracted fact, fact source, and expected-field diagnostic models.
- Added `documents.extraction_status` aggregate field and startup column guard.
- Added `backend/app/extraction_store.py` storage helpers.
- Added `backend/tests/test_extraction_storage.py`.

### Verification

- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_storage.py -q` -> `3 passed`
- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_schemas.py backend/tests/test_extraction_storage.py -q` -> `7 passed`

---

## SEER-03: Add Document Tombstone Lifecycle

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-02

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Change document deletion from hard delete to tombstone by default and ensure active evidence paths ignore tombstoned documents while preserving audit history.

### Acceptance criteria

- [x] Documents have lifecycle fields such as `is_active`, `deleted_at`, and `deleted_by`.
- [x] `DELETE /documents/{id}` tombstones instead of hard-deleting.
- [x] Active retrieval excludes tombstoned documents.
- [x] Extraction/canonicalization excludes tombstoned documents from active evidence.
- [x] Tests prove historical records remain while downstream active queries ignore tombstoned sources.

### Implementation

- Added `documents.is_active`, `deleted_at`, and `deleted_by`.
- Changed `DELETE /documents/{id}` to tombstone documents.
- Hid tombstoned documents from engagement reads, search, and shared corpus retrieval.
- Preserved extraction runs, facts, and fact sources when documents are tombstoned.

### Verification

- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_documents.py -q` -> `9 passed`
- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_documents.py backend/tests/test_search.py backend/tests/test_draft.py::test_draft_retrieval_excludes_out_of_scope_documents backend/tests/test_risks.py::test_risks_retrieval_excludes_out_of_scope_documents -q` -> `13 passed`

---

## SEER-04: Compute Extraction Eligibility From Classification

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-01, SEER-02

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Add an internal eligibility function that selects extraction schemas for usable classified documents and records skipped statuses for unknown, out-of-scope, unsupported, ambiguous, or tombstoned documents.

### Acceptance criteria

- [x] Relevant supported documents are eligible.
- [x] Partially Relevant supported documents are eligible and carry scope warnings.
- [x] Unknown documents are skipped for structured extraction.
- [x] Out of Scope documents are skipped for structured extraction.
- [x] Unsupported types become `skipped_not_supported`.
- [x] Tests cover every eligibility branch.

### Implementation

- Added `backend/app/extraction_eligibility.py`.
- Added deterministic extraction eligibility statuses for supported, partial, unknown, out-of-scope, unsupported, ambiguous, and tombstoned documents.
- Added scope-warning propagation for Partially Relevant documents.
- Added `backend/tests/test_extraction_eligibility.py`.

### Verification

- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_eligibility.py -q` -> `6 passed`
- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_schemas.py backend/tests/test_extraction_storage.py backend/tests/test_extraction_eligibility.py backend/tests/test_documents.py -q` -> `22 passed`

---

## SEER-05: Add Extraction Fingerprint Reuse And Supersession

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-02, SEER-04

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Make extraction runs idempotent using a document/schema/model fingerprint. Reuse matching active runs and supersede stale active runs without deleting old facts.

### Acceptance criteria

- [x] Fingerprint includes document content hash, classification type/version, schema version, runner version, and model version.
- [x] Fingerprint excludes general engagement scope unless a schema declares scope dependency.
- [x] Matching active completed runs are reused.
- [x] Changed fingerprints create a new run and mark prior runs inactive/superseded.
- [x] Tests prove old facts remain historical but no longer active.

### Implementation

- Added `extraction_fingerprint`.
- Added `get_or_create_extraction_run` with matching-run reuse.
- Added run supersession that marks old runs inactive without deleting old facts.
- Hardened the test fixture so native Postgres enum types are cleaned after table teardown and stale setup recovers.
- Added `backend/tests/test_extraction_fingerprints.py`.

### Verification

- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_fingerprints.py -q` -> `3 passed`
- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_schemas.py backend/tests/test_extraction_storage.py backend/tests/test_extraction_eligibility.py backend/tests/test_extraction_fingerprints.py backend/tests/test_documents.py -q` -> `25 passed`

---

## SEER-06: Add Source Text Locators And Quote Validation

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-02

**User stories covered:** Verify Provenance

### What to build

Create shared helpers that produce deterministic locators and verify quotes for PDF/text/DOCX and row locators for CSV/XLSX.

### Acceptance criteria

- [x] PDF-backed facts require page when page text is available.
- [x] DOCX/TXT facts can use paragraph or line locators.
- [x] CSV facts can use row locators.
- [x] XLSX facts can use sheet plus row locators.
- [x] Facts with missing or unverifiable quotes are rejected.
- [x] Tests cover accepted and rejected provenance for each supported locator type.

### Implementation

- Added `backend/app/source_locators.py`.
- Added deterministic source regions for PDF pages, DOCX paragraphs, TXT lines, CSV rows, and XLSX sheet rows.
- Added quote validation that rejects blank, missing, or unverifiable quotes before a fact can use the source pointer.

### Verification

- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_source_locators.py -q` -> `6 passed`
- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_source_locators.py backend/tests/test_extraction_schemas.py backend/tests/test_extraction_storage.py backend/tests/test_extraction_eligibility.py backend/tests/test_extraction_fingerprints.py -q` -> `22 passed`

---

## SEER-07: Implement Agreement Text Extraction Tracer Bullet

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-01, SEER-02, SEER-06

**User stories covered:** Upload Agreement, Verify Provenance

### What to build

Add the first generic extraction runner path for Service Agreement-style text sources, producing provider, recipient, services, effective date, pricing method, and markup facts when source quotes validate.

### Acceptance criteria

- [x] Runner loads schema from the registry instead of hard-coded free-form fields.
- [x] LLM output is constrained to allowed fact types and source quotes.
- [x] Accepted facts persist with raw value, normalized value when safe, scope level, locator, and quote.
- [x] Missing expected agreement fields are stored as diagnostics, not fake facts.
- [x] Tests prove a service agreement produces facts and rejects a hallucinated unsupported fact.

### Implementation

- Added `backend/app/agreement_extraction.py`.
- Added a provider-agnostic agreement extraction runner that reads `agreement_core` from the schema registry.
- Added fact validation for allowed fact types, allowed scope levels, and source-backed quotes before persistence.
- Added expected-field diagnostics for missing agreement fields instead of manufacturing facts.

### Verification

- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_agreement_extraction.py -q` -> `2 passed`
- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_schemas.py backend/tests/test_extraction_storage.py backend/tests/test_extraction_eligibility.py backend/tests/test_extraction_fingerprints.py backend/tests/test_source_locators.py backend/tests/test_agreement_extraction.py -q` -> `24 passed`

---

## SEER-08: Add Deterministic Trial Balance CSV/XLSX Extraction

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-01, SEER-02, SEER-06

**User stories covered:** Verify Provenance

### What to build

Extract trial balance facts from CSV/XLSX headers and rows without sending every row to an LLM.

### Acceptance criteria

- [x] Trial balance headers are detected from CSV and XLSX previews/full rows.
- [x] Account, amount, period, entity/counterparty mentions, and row provenance are persisted.
- [x] Numeric values are normalized while raw cell values are preserved.
- [x] Ambiguous column mapping becomes partial extraction diagnostics.
- [x] Tests prove row-level facts and locators for CSV and XLSX.

### Implementation

- Added `backend/app/financial_extraction.py`.
- Added deterministic CSV/XLSX full-row parsing for Trial Balance documents.
- Added row-level `gl_account`, amount, `entity_name`, and `counterparty_name` facts with quote-validated row locators.
- Added partial-extraction diagnostics for ambiguous account/amount columns.
- Added `entity_name` to the `financial_table` extraction schema.

### Verification

- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_financial_extraction.py -q` -> `3 passed`
- `.\backend\.venv\Scripts\python -m pytest backend/tests/test_extraction_schemas.py backend/tests/test_extraction_storage.py backend/tests/test_extraction_eligibility.py backend/tests/test_extraction_fingerprints.py backend/tests/test_source_locators.py backend/tests/test_agreement_extraction.py backend/tests/test_financial_extraction.py -q` -> `27 passed`

---

## SEER-09: Add Deterministic Ledger And Invoice Extraction

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-08

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Extend deterministic table extraction to General Ledger and Invoice Population documents, producing row-level amount/account/counterparty facts with provenance.

### Acceptance criteria

- [x] General Ledger rows produce account/date/amount/entity/counterparty facts.
- [x] Invoice Population rows produce invoice/date/amount/entity/counterparty facts.
- [x] Facts keep source row or sheet-row locators.
- [x] Unsupported or missing required columns produce partial extraction diagnostics.
- [x] Tests cover both successful and partial table extraction.

### Implementation

- Extended `backend/app/financial_extraction.py` with General Ledger and Invoice Population entry points.
- Reused the deterministic CSV/XLSX header/row parser for GL and invoice rows.
- Added row-level `transaction_date`, `transaction_amount`, `invoice_number`, and `invoice_amount` facts.
- Added partial diagnostics for missing GL/invoice required columns.
- Added `transaction_date` and `invoice_number` to the `financial_table` extraction schema.
- Stabilized the backend test fixture with clean setup and a shared test-database lock so schema teardown cannot race the next client fixture.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_financial_extraction.py -q` from `backend/` -> `6 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_schemas.py tests/test_extraction_storage.py tests/test_extraction_eligibility.py tests/test_extraction_fingerprints.py tests/test_source_locators.py tests/test_agreement_extraction.py tests/test_financial_extraction.py -q` from `backend/` -> `30 passed`

---

## SEER-10: Store Entity Mentions Without Forcing Resolution

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-02, SEER-07

**User stories covered:** Entity Resolution, Preserve Evidence Without Overclaiming

### What to build

Persist entity mentions from extracted facts, link them to provenance, and allow facts to remain accepted with `resolution_status = unresolved`.

### Acceptance criteria

- [x] Entity mentions store raw name, normalized name, role, document, run, fact, locator, and quote.
- [x] Facts can reference unresolved entity mentions.
- [x] Entity resolution failure does not reject otherwise valid extracted facts.
- [x] Entity-dependent facts with unresolved mentions are marked not promotable to canonical facts.
- [x] Tests prove unresolved mentions preserve evidence without canonical promotion.

### Implementation

- Added the `entity_mentions` model.
- Added `EntityMentionInput`, `add_entity_mention`, and `extracted_fact_promotable`.
- Linked unresolved entity mentions back to their extracted facts without rejecting the facts.
- Marked unresolved entity-reference facts as not promotable to canonical evidence.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_entity_mentions.py -q` from `backend/` -> `1 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_schemas.py tests/test_extraction_storage.py tests/test_extraction_eligibility.py tests/test_extraction_fingerprints.py tests/test_source_locators.py tests/test_agreement_extraction.py tests/test_financial_extraction.py tests/test_entity_mentions.py -q` from `backend/` -> `31 passed`

---

## SEER-11: Add Engagement-Scoped Canonical Entity Resolution

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-10

**User stories covered:** Entity Resolution

### What to build

Resolve strong entity mentions to engagement-scoped canonical entities and aliases using deterministic rules only.

### Acceptance criteria

- [x] Exact legal-name matches resolve.
- [x] Existing alias matches resolve.
- [x] Strong legal-name mentions with suffix and role can create canonical entities.
- [x] Vague mentions remain unresolved.
- [x] LLM suggestions are not authoritative resolution.
- [x] Tests prove aliases like `ABC BV`, `ABC Netherlands BV`, and `ABC Netherlands` resolve only when rules are strong enough.

### Implementation

- Added engagement-scoped `canonical_entities` and `entity_aliases` tables.
- Added deterministic resolution for exact legal names, existing aliases, and strong legal suffix mentions.
- Left vague names and model suggestions unresolved unless deterministic rules support the match.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_entity_resolution.py -q` from `backend/` -> `3 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_schemas.py tests/test_extraction_storage.py tests/test_extraction_eligibility.py tests/test_extraction_fingerprints.py tests/test_source_locators.py tests/test_agreement_extraction.py tests/test_financial_extraction.py tests/test_entity_mentions.py tests/test_entity_resolution.py -q` from `backend/` -> `34 passed`

---

## SEER-12: Add Canonical Fact Promotion And Exact Dedupe

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-10, SEER-11

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Create deterministic canonicalization that promotes eligible active extracted facts into canonical facts and merges exact normalized duplicates while preserving all source links.

### Acceptance criteria

- [x] Promotion requires active run, active document, valid provenance, and required entity resolution.
- [x] Exact normalized duplicate facts merge into one canonical fact.
- [x] Multiple extracted facts can link to one canonical fact.
- [x] Conflicting values stay separate or become conflict candidates.
- [x] Tests prove duplicates merge and unresolved entity-dependent facts do not promote.

### Implementation

- Added `canonical_facts` and `canonical_fact_sources` tables.
- Added deterministic canonical promotion with exact canonical-key dedupe.
- Preserved conflicting values as separate canonical facts.
- Blocked promotion for inactive runs, inactive documents, missing provenance, invalid fact types, and unresolved entity-dependent facts.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_canonical_facts.py -q` from `backend/` -> `4 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_schemas.py tests/test_extraction_storage.py tests/test_extraction_eligibility.py tests/test_extraction_fingerprints.py tests/test_source_locators.py tests/test_agreement_extraction.py tests/test_financial_extraction.py tests/test_entity_mentions.py tests/test_entity_resolution.py tests/test_canonical_facts.py -q` from `backend/` -> `38 passed`

---

## SEER-13: Add Scope-Level Constraints For Group And Local Facts

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-01, SEER-07, SEER-12

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Enforce schema plus fact-type `scope_level` rules so group-level documents cannot produce local-entity conclusions.

### Acceptance criteria

- [x] Scope levels are limited to group, local_entity, transaction, counterparty, and unknown.
- [x] Annual Report/Master File schemas allow group-level facts but not local tested-party/method/amount conclusions.
- [x] Benchmark Study facts use transaction scope where applicable, not a benchmark scope.
- [x] Validation rejects facts with disallowed scope levels.
- [x] Tests prove group-level sources cannot create local facts.

### Implementation

- Added `validate_fact_scope()` and enforced it during extracted-fact storage and canonical promotion.
- Split transfer-pricing schemas into `tp_group_document`, `benchmark_study`, and `tp_local_file`.
- Kept Master File and Annual Report group-only, while Benchmark Study facts remain transaction-scoped.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_schemas.py -q` from `backend/` -> `7 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_schemas.py tests/test_extraction_storage.py tests/test_extraction_eligibility.py tests/test_extraction_fingerprints.py tests/test_source_locators.py tests/test_agreement_extraction.py tests/test_financial_extraction.py tests/test_entity_mentions.py tests/test_entity_resolution.py tests/test_canonical_facts.py -q` from `backend/` -> `41 passed`

---

## SEER-14: Queue Extraction During Requirements Startup

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-04, SEER-05, SEER-07

**User stories covered:** Upload Agreement, Preserve Evidence Without Overclaiming

### What to build

Wire Requirements startup so classification runs first, then indexing and extraction jobs are queued for eligible documents.

### Acceptance criteria

- [x] Requirements startup queues extraction after classification.
- [x] Extraction and indexing can run in parallel after classification.
- [x] Existing run recovery patterns handle queued/stale extraction work.
- [x] Requirements progress reflects evidence preparation without a giant synchronous wait.
- [x] Tests prove starting Requirements creates extraction runs/jobs for eligible documents only.

### Implementation

- Added `extract_document` as a durable `PipelineJobKind`.
- Added extraction job queueing after Requirements classification and alongside document indexing.
- Added extraction job execution through the existing pipeline worker/retry boundary.
- Ran deterministic financial extraction from jobs and marked non-configured extractors as `needs_review` instead of inventing facts.
- Marked unsupported and out-of-scope classified documents with skipped extraction statuses.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_document_classifications.py::test_requirements_start_queues_extraction_jobs_for_eligible_supported_documents_only -q` from `backend/` -> `1 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_document_classifications.py tests/test_pipeline_improvements.py tests/test_extraction_schemas.py tests/test_extraction_storage.py tests/test_extraction_eligibility.py tests/test_extraction_fingerprints.py tests/test_source_locators.py tests/test_agreement_extraction.py tests/test_financial_extraction.py tests/test_entity_mentions.py tests/test_entity_resolution.py tests/test_canonical_facts.py -q` from `backend/` -> `68 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_coverage.py -q` from `backend/` -> `12 passed`

---

## SEER-15: Settle Extraction Before Transaction Mapping Readiness

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-14

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Expose internal readiness checks showing whether supported usable documents have settled extraction statuses, so Controlled Transaction Mapping can wait for facts without waiting forever.

### Acceptance criteria

- [x] Settled statuses include extracted, partially_extracted, failed, skipped_not_supported, and skipped_out_of_scope.
- [x] Pending/extracting supported documents are not settled.
- [x] Unknown, unsupported, out-of-scope, and tombstoned documents do not block readiness.
- [x] Tests prove readiness across mixed document states.

### Implementation

- Added `extraction_readiness_for_documents()` as a pure internal readiness helper.
- Reused extraction eligibility rules so unsupported, unknown, out-of-scope, and tombstoned documents do not block downstream readiness.
- Treated pending, extracting, or unset extraction status on supported usable documents as not settled.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_readiness.py -q` from `backend/` -> `3 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_readiness.py tests/test_extraction_eligibility.py tests/test_document_classifications.py tests/test_pipeline_improvements.py tests/test_extraction_schemas.py tests/test_extraction_storage.py tests/test_extraction_fingerprints.py tests/test_source_locators.py tests/test_agreement_extraction.py tests/test_financial_extraction.py tests/test_entity_mentions.py tests/test_entity_resolution.py tests/test_canonical_facts.py -q` from `backend/` -> `71 passed`

---

## SEER-16: Feed Canonical Facts Into Requirements Matching Context

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-12, SEER-14

**User stories covered:** Preserve Evidence Without Overclaiming, Verify Provenance

### What to build

Pass compact active canonical facts with source links into Requirements Matching as structured context while preserving raw retrieval fallback.

### Acceptance criteria

- [x] Requirements Matching still works when no facts exist.
- [x] Active canonical facts are included as structured context when available.
- [x] Facts from tombstoned documents are excluded.
- [x] Unresolved entity-dependent facts are excluded or marked unusable.
- [x] Tests prove facts can strengthen context without replacing source provenance.

### Implementation

- Added canonical fact context loading for Requirements Matching.
- Mapped active fact-backed invoice, ledger, and benchmark evidence into the existing matcher document roles.
- Preserved source provenance by carrying the original source document id into requirement evidence.
- Excluded tombstoned documents and unresolved/failed entity-dependent facts from canonical context.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_requirement_matching.py::test_active_canonical_facts_strengthen_requirements_without_replacing_source_provenance tests/test_requirement_matching.py::test_canonical_facts_from_tombstoned_documents_are_excluded -q` from `backend/` -> `2 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_matching.py tests/test_requirement_matching.py tests/test_canonical_facts.py tests/test_extraction_readiness.py tests/test_document_classifications.py -q` from `backend/` -> `68 passed`

---

## SEER-17: Apply Same Rules To Uploaded Supplements

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-04, SEER-14

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Run uploaded supplements through normal classification, scope validation, extraction, and provenance rules while preserving their target requirement context.

### Acceptance criteria

- [x] Uploaded supplements store `source_context = supplement` and `target_requirement_id`.
- [x] Uploaded supplements do not bypass scope validation.
- [x] Out-of-scope supplements are stored but not accepted as usable evidence.
- [x] Relevant supplements can produce extracted facts for their target context.
- [x] Text supplements remain targeted context and do not enter the global fact model.

### Implementation

- Added supplement metadata columns for `source_context` and `target_requirement_id`.
- Classified uploaded supplements against the same engagement scope before accepting them.
- Stored out-of-scope uploaded supplements without marking the target requirement present or indexing them.
- Queued extraction for usable supported upload supplements while preserving text supplements as targeted context only.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_document_classifications.py::test_shared_usable_source_filter_is_the_future_graphrag_guard tests/test_document_classifications.py::test_out_of_scope_uploaded_supplement_is_stored_but_not_accepted tests/test_document_classifications.py::test_relevant_uploaded_supplement_records_target_and_extracts_facts -q` from `backend/` -> `3 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_document_classifications.py tests/test_coverage.py tests/test_pipeline_improvements.py -q` from `backend/` -> `40 passed`

---

## SEER-18: Add Extraction Retry And Degradation Handling

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-14

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Add bounded retries and clear terminal statuses for extraction failures, reusing existing pipeline recovery where possible.

### Acceptance criteria

- [x] Provider timeout, malformed JSON, transient storage read, and temporary extraction failures retry automatically.
- [x] Unsupported schema, no extractable text, quote validation failure, schema validation failure, and out-of-scope classification do not loop forever.
- [x] Persistent failures store diagnostics and terminal status.
- [x] Failed extraction does not block navigation forever.
- [x] Tests cover retry success and terminal failure.

### Implementation

- Added terminal extraction classification for no-text/OCR, source quote, schema validation, and unsupported-schema failures.
- Persisted terminal extraction failures as failed extraction runs with diagnostics instead of retrying forever.
- Left transient/provider/storage failures to the existing bounded pipeline retry.
- Marked documents `failed` with diagnostics when an extraction job exhausts its retry budget.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_jobs.py -q` from `backend/` -> `4 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_jobs.py tests/test_document_classifications.py tests/test_extraction_readiness.py tests/test_pipeline_improvements.py -q` from `backend/` -> `35 passed`

---

## SEER-19: Add Fact Read APIs

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-12

**User stories covered:** Verify Provenance

### What to build

Expose read-only APIs for active document facts, individual fact details, and canonical entities needed by the Document Viewer.

### Acceptance criteria

- [x] `GET /documents/{id}/facts` returns active extracted/canonical fact rows for the document.
- [x] `GET /facts/{id}` returns value, scope, entity resolution, and source provenance.
- [x] `GET /entities` and `GET /entities/{id}` return engagement-scoped canonical entities and aliases.
- [x] Tombstoned document evidence is hidden from active reads by default.
- [x] APIs do not expose internal model diagnostics by default.

### Implementation

- Added a read-only facts router with `GET /documents/{id}/facts`, `GET /facts/{id}`, `GET /entities`, and `GET /entities/{id}`.
- Returned active extracted facts with active canonical fact links, source locators, quotes, and resolved entity context.
- Enforced engagement ownership and hid tombstoned/inactive document facts from active reads.
- Added response schemas that omit diagnostics, schema JSON, model versions, and normalized alias internals.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_fact_read_apis.py -q` from `backend/` -> `4 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_fact_read_apis.py tests/test_canonical_facts.py tests/test_entity_resolution.py tests/test_documents.py -q` from `backend/` -> `20 passed`

---

## SEER-20: Show Extracted Facts In Document Viewer

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-19

**User stories covered:** Verify Provenance

### What to build

Add the minimal Document Viewer UI for extracted facts: fact label, value, scope level, source locator, quote, and resolved entity when available.

### Acceptance criteria

- [x] Document Viewer shows an Extracted Facts section when facts exist.
- [x] Fact rows show label, value, scope level, locator, quote, and resolved entity if available.
- [x] Clicking a fact opens or highlights the source quote where existing viewer capability supports it.
- [x] No standalone Entity Explorer is added.
- [x] UI hides schema JSON, diagnostics, model scores, and superseded runs by default.

### Implementation

- Added frontend fact read types and `api.getDocumentFacts(documentId)`.
- Extended the existing source/document preview in Risks to fetch facts alongside document text.
- Rendered a compact Extracted facts section with label, value, scope, resolved entity, locator, and quote.
- Clicking a fact recenters the preview snippet on that fact's source quote and highlights the selected fact row.
- Kept the UI to the existing preview surface; no standalone Entity Explorer or new top-level page was added.

### Verification

- `pnpm build` from repo root -> passed
- `.\backend\.venv\Scripts\python -m pytest tests/test_fact_read_apis.py -q` from `backend/` -> `4 passed`

---

## SEER-21: Add Extraction Status To Planning And Requirements Progress

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-14, SEER-18

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Show quiet extraction status only where it prevents the pipeline from feeling stuck: document chips and Requirements evidence-preparation progress.

### Acceptance criteria

- [x] Document metadata includes aggregate extraction status.
- [x] Planning document chips can show extracting/extracted/needs-attention without classification internals.
- [x] Requirements progress includes extraction/indexing preparation state.
- [x] Extraction failure is quiet unless it blocks a user action later.
- [x] No classification scores, schema versions, or diagnostics are shown in normal UI.

### Implementation

- Added `extraction_status` to backend `DocumentRead` responses and engagement document rehydration.
- Added frontend `DocumentRead.extraction_status`.
- Added quiet Planning chip labels for `Extracting`, `Extracted`, and `Needs attention`.
- Extended Requirements preparation progress to show indexing plus structured-evidence extraction counts.
- Kept extraction failure as quiet needs-attention text; no classification scores, schema versions, or diagnostics are shown in normal UI.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_documents.py::test_document_reads_include_aggregate_extraction_status -q` from `backend/` -> `1 passed`
- `pnpm build` from repo root -> passed
- `.\backend\.venv\Scripts\python -m pytest tests/test_documents.py tests/test_pipeline_improvements.py -q` from `backend/` -> `17 passed`

---

## SEER-22: Add Active Evidence Filters For Downstream Consumers

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-03, SEER-12

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Create shared filters/services so Draft, Risks, Requirements, GraphRAG, and Transaction Mapping only read active, in-scope, non-tombstoned evidence.

### Acceptance criteria

- [x] Shared active-evidence filter excludes tombstoned documents.
- [x] Shared filter excludes inactive superseded extraction runs.
- [x] Shared filter excludes out-of-scope classified documents.
- [x] Targeted supplement evidence remains eligible only when normal rules pass.
- [x] Tests prove at least Requirements/Draft/Risks use the same active-evidence guard.

### Implementation

- Reused `usable_source_filter()` for document filename maps as well as retrieval contexts, so cited document labels cannot resolve to tombstoned or out-of-scope documents.
- Removed the supplement bypass from `usable_source_filter()`; supplements stay eligible only when no out-of-scope classification blocks them.
- Applied the shared active-evidence guard to Requirements canonical fact context.
- Excluded canonical facts from inactive/superseded extraction runs before they can strengthen requirement matching.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_requirement_matching.py::test_canonical_facts_from_out_of_scope_documents_are_excluded tests/test_requirement_matching.py::test_canonical_facts_from_inactive_extraction_runs_are_excluded -q` from `backend/` -> `2 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_requirement_matching.py tests/test_draft.py::test_draft_retrieval_excludes_out_of_scope_documents tests/test_risks.py::test_risks_retrieval_excludes_out_of_scope_documents tests/test_document_classifications.py::test_shared_usable_source_filter_is_the_future_graphrag_guard -q` from `backend/` -> `19 passed`

---

## SEER-23: Add Extraction Provider Configuration

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-07

**User stories covered:** Upload Agreement

### What to build

Add extraction provider/model configuration that defaults to the existing assessment provider/model when unset.

### Acceptance criteria

- [x] Backend settings support optional extraction provider/model.
- [x] Extraction falls back to assessment provider/model when unset.
- [x] No duplicate provider client stack is introduced.
- [x] Tests prove configuration defaults and explicit override.

### Implementation

- Added optional `extraction_provider` and `extraction_model` backend settings.
- Added settings resolvers for selected LLM provider, assessment model, extraction provider, and extraction model.
- Wired unsupported/non-configured extraction runs to record the resolved extraction provider/model in run metadata and fingerprints.
- Did not add a separate extraction provider client stack; this slice is configuration only.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_config.py tests/test_extraction_jobs.py::test_not_configured_extractor_records_resolved_extraction_config -q` from `backend/` -> `3 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_extraction_config.py tests/test_extraction_jobs.py tests/test_extraction_fingerprints.py -q` from `backend/` -> `10 passed`

---

## SEER-24: Add End-To-End Local File Evidence Tracer Test

**Status:** Done

**Type:** AFK

**Blocked by:** SEER-16, SEER-20, SEER-22

**User stories covered:** Upload Agreement, Entity Resolution, Verify Provenance, Preserve Evidence Without Overclaiming

### What to build

Add one end-to-end test fixture that uploads an agreement plus a financial table, starts Requirements, waits for extraction, verifies canonical facts, verifies unresolved mentions are preserved, and verifies the Document Viewer/API can show source-backed facts.

### Acceptance criteria

- [x] Test covers classification to extraction to canonical fact promotion.
- [x] Test proves exact duplicate facts merge with multiple sources.
- [x] Test proves unresolved entity facts are preserved but not promoted.
- [x] Test proves tombstoned source evidence disappears from active reads.
- [x] Test proves Requirements still works when extraction is partial.

### Implementation

- Added a Local File evidence tracer test that uploads agreement, invoice-population, and partial-ledger fixtures through the API.
- The test starts Requirements, drains the durable pipeline, verifies classification/extraction runs, promotes canonical facts, checks active fact APIs, then tombstones the source document and verifies active reads hide it while history remains.
- Added unresolved `EntityMention` creation for financial-table entity-reference facts so table extraction preserves entity/counterparty mentions instead of only storing raw facts.

### Verification

- `.\backend\.venv\Scripts\python -m pytest tests/test_local_file_evidence_tracer.py -q` from `backend/` -> `1 passed`
- `.\backend\.venv\Scripts\python -m pytest tests/test_local_file_evidence_tracer.py tests/test_financial_extraction.py tests/test_entity_mentions.py tests/test_canonical_facts.py tests/test_fact_read_apis.py tests/test_document_classifications.py::test_requirements_start_queues_extraction_jobs_for_eligible_supported_documents_only -q` from `backend/` -> `17 passed`
