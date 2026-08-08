# Issues: Structured Extraction & Entity Resolution

Parent PRD: [structured-extraction-entity-resolution.md](structured-extraction-entity-resolution.md)

Ponytail constraint: build the smallest evidence model that prevents Local File contamination. Do not build a standalone Entity Explorer, manual extraction button, correction workflow, PDF table reconstruction engine, global entity registry, or semantic duplicate merger in this PRD.

---

## SEER-01: Add Versioned Extraction Schema Registry

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** Upload Agreement, Preserve Evidence Without Overclaiming

### What to build

Create a backend JSON registry for extraction schemas and a small loader/validator that maps supported classification document types to allowed fact types, value rules, provenance requirements, entity roles, and permitted scope levels.

### Acceptance criteria

- [ ] Versioned extraction schema JSON exists in the backend.
- [ ] Registry covers v1 supported document types from the PRD.
- [ ] Schema entries define allowed fact types and allowed scope levels per fact type.
- [ ] Unsupported document types resolve to `skipped_not_supported`, not an error.
- [ ] Invalid or invented fact types are rejected by schema validation tests.

---

## SEER-02: Add Extraction Run And Fact Storage

**Type:** AFK

**Blocked by:** SEER-01

**User stories covered:** Upload Agreement, Verify Provenance

### What to build

Add database models, startup schema updates, and storage helpers for extraction runs, extracted facts, fact sources, expected-field diagnostics, and document aggregate extraction status.

### Acceptance criteria

- [ ] `extraction_runs` store document/schema/model fingerprint, status, active flag, supersession metadata, and diagnostics.
- [ ] `extracted_facts` reference both document and extraction run.
- [ ] `fact_sources` store document, page when applicable, locator, and quote.
- [ ] Facts do not have their own active flag; run activeness controls lifecycle.
- [ ] Storage tests cover create/read and source provenance persistence.

---

## SEER-03: Add Document Tombstone Lifecycle

**Type:** AFK

**Blocked by:** SEER-02

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Change document deletion from hard delete to tombstone by default and ensure active evidence paths ignore tombstoned documents while preserving audit history.

### Acceptance criteria

- [ ] Documents have lifecycle fields such as `is_active`, `deleted_at`, and `deleted_by`.
- [ ] `DELETE /documents/{id}` tombstones instead of hard-deleting.
- [ ] Active retrieval excludes tombstoned documents.
- [ ] Extraction/canonicalization excludes tombstoned documents from active evidence.
- [ ] Tests prove historical records remain while downstream active queries ignore tombstoned sources.

---

## SEER-04: Compute Extraction Eligibility From Classification

**Type:** AFK

**Blocked by:** SEER-01, SEER-02

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Add an internal eligibility function that selects extraction schemas for usable classified documents and records skipped statuses for unknown, out-of-scope, unsupported, ambiguous, or tombstoned documents.

### Acceptance criteria

- [ ] Relevant supported documents are eligible.
- [ ] Partially Relevant supported documents are eligible and carry scope warnings.
- [ ] Unknown documents are skipped for structured extraction.
- [ ] Out of Scope documents are skipped for structured extraction.
- [ ] Unsupported types become `skipped_not_supported`.
- [ ] Tests cover every eligibility branch.

---

## SEER-05: Add Extraction Fingerprint Reuse And Supersession

**Type:** AFK

**Blocked by:** SEER-02, SEER-04

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Make extraction runs idempotent using a document/schema/model fingerprint. Reuse matching active runs and supersede stale active runs without deleting old facts.

### Acceptance criteria

- [ ] Fingerprint includes document content hash, classification type/version, schema version, runner version, and model version.
- [ ] Fingerprint excludes general engagement scope unless a schema declares scope dependency.
- [ ] Matching active completed runs are reused.
- [ ] Changed fingerprints create a new run and mark prior runs inactive/superseded.
- [ ] Tests prove old facts remain historical but no longer active.

---

## SEER-06: Add Source Text Locators And Quote Validation

**Type:** AFK

**Blocked by:** SEER-02

**User stories covered:** Verify Provenance

### What to build

Create shared helpers that produce deterministic locators and verify quotes for PDF/text/DOCX and row locators for CSV/XLSX.

### Acceptance criteria

- [ ] PDF-backed facts require page when page text is available.
- [ ] DOCX/TXT facts can use paragraph or line locators.
- [ ] CSV facts can use row locators.
- [ ] XLSX facts can use sheet plus row locators.
- [ ] Facts with missing or unverifiable quotes are rejected.
- [ ] Tests cover accepted and rejected provenance for each supported locator type.

---

## SEER-07: Implement Agreement Text Extraction Tracer Bullet

**Type:** AFK

**Blocked by:** SEER-01, SEER-02, SEER-06

**User stories covered:** Upload Agreement, Verify Provenance

### What to build

Add the first generic extraction runner path for Service Agreement-style text sources, producing provider, recipient, services, effective date, pricing method, and markup facts when source quotes validate.

### Acceptance criteria

- [ ] Runner loads schema from the registry instead of hard-coded free-form fields.
- [ ] LLM output is constrained to allowed fact types and source quotes.
- [ ] Accepted facts persist with raw value, normalized value when safe, scope level, locator, and quote.
- [ ] Missing expected agreement fields are stored as diagnostics, not fake facts.
- [ ] Tests prove a service agreement produces facts and rejects a hallucinated unsupported fact.

---

## SEER-08: Add Deterministic Trial Balance CSV/XLSX Extraction

**Type:** AFK

**Blocked by:** SEER-01, SEER-02, SEER-06

**User stories covered:** Verify Provenance

### What to build

Extract trial balance facts from CSV/XLSX headers and rows without sending every row to an LLM.

### Acceptance criteria

- [ ] Trial balance headers are detected from CSV and XLSX previews/full rows.
- [ ] Account, amount, period, entity/counterparty mentions, and row provenance are persisted.
- [ ] Numeric values are normalized while raw cell values are preserved.
- [ ] Ambiguous column mapping becomes partial extraction diagnostics.
- [ ] Tests prove row-level facts and locators for CSV and XLSX.

---

## SEER-09: Add Deterministic Ledger And Invoice Extraction

**Type:** AFK

**Blocked by:** SEER-08

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Extend deterministic table extraction to General Ledger and Invoice Population documents, producing row-level amount/account/counterparty facts with provenance.

### Acceptance criteria

- [ ] General Ledger rows produce account/date/amount/entity/counterparty facts.
- [ ] Invoice Population rows produce invoice/date/amount/entity/counterparty facts.
- [ ] Facts keep source row or sheet-row locators.
- [ ] Unsupported or missing required columns produce partial extraction diagnostics.
- [ ] Tests cover both successful and partial table extraction.

---

## SEER-10: Store Entity Mentions Without Forcing Resolution

**Type:** AFK

**Blocked by:** SEER-02, SEER-07

**User stories covered:** Entity Resolution, Preserve Evidence Without Overclaiming

### What to build

Persist entity mentions from extracted facts, link them to provenance, and allow facts to remain accepted with `resolution_status = unresolved`.

### Acceptance criteria

- [ ] Entity mentions store raw name, normalized name, role, document, run, fact, locator, and quote.
- [ ] Facts can reference unresolved entity mentions.
- [ ] Entity resolution failure does not reject otherwise valid extracted facts.
- [ ] Entity-dependent facts with unresolved mentions are marked not promotable to canonical facts.
- [ ] Tests prove unresolved mentions preserve evidence without canonical promotion.

---

## SEER-11: Add Engagement-Scoped Canonical Entity Resolution

**Type:** AFK

**Blocked by:** SEER-10

**User stories covered:** Entity Resolution

### What to build

Resolve strong entity mentions to engagement-scoped canonical entities and aliases using deterministic rules only.

### Acceptance criteria

- [ ] Exact legal-name matches resolve.
- [ ] Existing alias matches resolve.
- [ ] Strong legal-name mentions with suffix and role can create canonical entities.
- [ ] Vague mentions remain unresolved.
- [ ] LLM suggestions are not authoritative resolution.
- [ ] Tests prove aliases like `ABC BV`, `ABC Netherlands BV`, and `ABC Netherlands` resolve only when rules are strong enough.

---

## SEER-12: Add Canonical Fact Promotion And Exact Dedupe

**Type:** AFK

**Blocked by:** SEER-10, SEER-11

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Create deterministic canonicalization that promotes eligible active extracted facts into canonical facts and merges exact normalized duplicates while preserving all source links.

### Acceptance criteria

- [ ] Promotion requires active run, active document, valid provenance, and required entity resolution.
- [ ] Exact normalized duplicate facts merge into one canonical fact.
- [ ] Multiple extracted facts can link to one canonical fact.
- [ ] Conflicting values stay separate or become conflict candidates.
- [ ] Tests prove duplicates merge and unresolved entity-dependent facts do not promote.

---

## SEER-13: Add Scope-Level Constraints For Group And Local Facts

**Type:** AFK

**Blocked by:** SEER-01, SEER-07, SEER-12

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Enforce schema plus fact-type `scope_level` rules so group-level documents cannot produce local-entity conclusions.

### Acceptance criteria

- [ ] Scope levels are limited to group, local_entity, transaction, counterparty, and unknown.
- [ ] Annual Report/Master File schemas allow group-level facts but not local tested-party/method/amount conclusions.
- [ ] Benchmark Study facts use transaction scope where applicable, not a benchmark scope.
- [ ] Validation rejects facts with disallowed scope levels.
- [ ] Tests prove group-level sources cannot create local facts.

---

## SEER-14: Queue Extraction During Requirements Startup

**Type:** AFK

**Blocked by:** SEER-04, SEER-05, SEER-07

**User stories covered:** Upload Agreement, Preserve Evidence Without Overclaiming

### What to build

Wire Requirements startup so classification runs first, then indexing and extraction jobs are queued for eligible documents.

### Acceptance criteria

- [ ] Requirements startup queues extraction after classification.
- [ ] Extraction and indexing can run in parallel after classification.
- [ ] Existing run recovery patterns handle queued/stale extraction work.
- [ ] Requirements progress reflects evidence preparation without a giant synchronous wait.
- [ ] Tests prove starting Requirements creates extraction runs/jobs for eligible documents only.

---

## SEER-15: Settle Extraction Before Transaction Mapping Readiness

**Type:** AFK

**Blocked by:** SEER-14

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Expose internal readiness checks showing whether supported usable documents have settled extraction statuses, so Controlled Transaction Mapping can wait for facts without waiting forever.

### Acceptance criteria

- [ ] Settled statuses include extracted, partially_extracted, failed, skipped_not_supported, and skipped_out_of_scope.
- [ ] Pending/extracting supported documents are not settled.
- [ ] Unknown, unsupported, out-of-scope, and tombstoned documents do not block readiness.
- [ ] Tests prove readiness across mixed document states.

---

## SEER-16: Feed Canonical Facts Into Requirements Matching Context

**Type:** AFK

**Blocked by:** SEER-12, SEER-14

**User stories covered:** Preserve Evidence Without Overclaiming, Verify Provenance

### What to build

Pass compact active canonical facts with source links into Requirements Matching as structured context while preserving raw retrieval fallback.

### Acceptance criteria

- [ ] Requirements Matching still works when no facts exist.
- [ ] Active canonical facts are included as structured context when available.
- [ ] Facts from tombstoned documents are excluded.
- [ ] Unresolved entity-dependent facts are excluded or marked unusable.
- [ ] Tests prove facts can strengthen context without replacing source provenance.

---

## SEER-17: Apply Same Rules To Uploaded Supplements

**Type:** AFK

**Blocked by:** SEER-04, SEER-14

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Run uploaded supplements through normal classification, scope validation, extraction, and provenance rules while preserving their target requirement context.

### Acceptance criteria

- [ ] Uploaded supplements store `source_context = supplement` and `target_requirement_id`.
- [ ] Uploaded supplements do not bypass scope validation.
- [ ] Out-of-scope supplements are stored but not accepted as usable evidence.
- [ ] Relevant supplements can produce extracted facts for their target context.
- [ ] Text supplements remain targeted context and do not enter the global fact model.

---

## SEER-18: Add Extraction Retry And Degradation Handling

**Type:** AFK

**Blocked by:** SEER-14

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Add bounded retries and clear terminal statuses for extraction failures, reusing existing pipeline recovery where possible.

### Acceptance criteria

- [ ] Provider timeout, malformed JSON, transient storage read, and temporary extraction failures retry automatically.
- [ ] Unsupported schema, no extractable text, quote validation failure, schema validation failure, and out-of-scope classification do not loop forever.
- [ ] Persistent failures store diagnostics and terminal status.
- [ ] Failed extraction does not block navigation forever.
- [ ] Tests cover retry success and terminal failure.

---

## SEER-19: Add Fact Read APIs

**Type:** AFK

**Blocked by:** SEER-12

**User stories covered:** Verify Provenance

### What to build

Expose read-only APIs for active document facts, individual fact details, and canonical entities needed by the Document Viewer.

### Acceptance criteria

- [ ] `GET /documents/{id}/facts` returns active extracted/canonical fact rows for the document.
- [ ] `GET /facts/{id}` returns value, scope, entity resolution, and source provenance.
- [ ] `GET /entities` and `GET /entities/{id}` return engagement-scoped canonical entities and aliases.
- [ ] Tombstoned document evidence is hidden from active reads by default.
- [ ] APIs do not expose internal model diagnostics by default.

---

## SEER-20: Show Extracted Facts In Document Viewer

**Type:** AFK

**Blocked by:** SEER-19

**User stories covered:** Verify Provenance

### What to build

Add the minimal Document Viewer UI for extracted facts: fact label, value, scope level, source locator, quote, and resolved entity when available.

### Acceptance criteria

- [ ] Document Viewer shows an Extracted Facts section when facts exist.
- [ ] Fact rows show label, value, scope level, locator, quote, and resolved entity if available.
- [ ] Clicking a fact opens or highlights the source quote where existing viewer capability supports it.
- [ ] No standalone Entity Explorer is added.
- [ ] UI hides schema JSON, diagnostics, model scores, and superseded runs by default.

---

## SEER-21: Add Extraction Status To Planning And Requirements Progress

**Type:** AFK

**Blocked by:** SEER-14, SEER-18

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Show quiet extraction status only where it prevents the pipeline from feeling stuck: document chips and Requirements evidence-preparation progress.

### Acceptance criteria

- [ ] Document metadata includes aggregate extraction status.
- [ ] Planning document chips can show extracting/extracted/needs-attention without classification internals.
- [ ] Requirements progress includes extraction/indexing preparation state.
- [ ] Extraction failure is quiet unless it blocks a user action later.
- [ ] No classification scores, schema versions, or diagnostics are shown in normal UI.

---

## SEER-22: Add Active Evidence Filters For Downstream Consumers

**Type:** AFK

**Blocked by:** SEER-03, SEER-12

**User stories covered:** Preserve Evidence Without Overclaiming

### What to build

Create shared filters/services so Draft, Risks, Requirements, GraphRAG, and Transaction Mapping only read active, in-scope, non-tombstoned evidence.

### Acceptance criteria

- [ ] Shared active-evidence filter excludes tombstoned documents.
- [ ] Shared filter excludes inactive superseded extraction runs.
- [ ] Shared filter excludes out-of-scope classified documents.
- [ ] Targeted supplement evidence remains eligible only when normal rules pass.
- [ ] Tests prove at least Requirements/Draft/Risks use the same active-evidence guard.

---

## SEER-23: Add Extraction Provider Configuration

**Type:** AFK

**Blocked by:** SEER-07

**User stories covered:** Upload Agreement

### What to build

Add extraction provider/model configuration that defaults to the existing assessment provider/model when unset.

### Acceptance criteria

- [ ] Backend settings support optional extraction provider/model.
- [ ] Extraction falls back to assessment provider/model when unset.
- [ ] No duplicate provider client stack is introduced.
- [ ] Tests prove configuration defaults and explicit override.

---

## SEER-24: Add End-To-End Local File Evidence Tracer Test

**Type:** AFK

**Blocked by:** SEER-16, SEER-20, SEER-22

**User stories covered:** Upload Agreement, Entity Resolution, Verify Provenance, Preserve Evidence Without Overclaiming

### What to build

Add one end-to-end test fixture that uploads an agreement plus a financial table, starts Requirements, waits for extraction, verifies canonical facts, verifies unresolved mentions are preserved, and verifies the Document Viewer/API can show source-backed facts.

### Acceptance criteria

- [ ] Test covers classification to extraction to canonical fact promotion.
- [ ] Test proves exact duplicate facts merge with multiple sources.
- [ ] Test proves unresolved entity facts are preserved but not promoted.
- [ ] Test proves tombstoned source evidence disappears from active reads.
- [ ] Test proves Requirements still works when extraction is partial.
