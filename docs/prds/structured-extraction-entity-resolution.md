# PRD: Structured Extraction & Entity Resolution

## Status

**Priority:** P0

**Owner:** AI Platform

**Dependencies:**

* Document Classification & Source Validation

**Blocks:**

* Controlled Transaction Mapping
* Requirement Matching & Evidence Sufficiency V2
* GraphRAG
* Contradiction Detection

---

## Overview

Structured Extraction & Entity Resolution transforms usable classified documents into structured, cited, canonical business facts.

Classification answers: "What source is this, and does it appear usable for this engagement?"

Extraction answers:

* What atomic facts exist inside this document?
* Which entity mentions do those facts refer to?
* Which canonical entities can be resolved safely?
* Where exactly did each fact come from?
* Which facts are eligible to become active canonical evidence?

The output is not prose. The output is a durable evidence model.

---

## Problem

Searchable chunks are not enough for a Local File workflow.

For example, a Service Agreement may contain:

* provider
* recipient
* services
* pricing method
* markup
* effective date
* governing law

Without structured extraction, downstream agents repeatedly ask an LLM to rediscover the same facts. That causes inconsistent outputs, unnecessary token use, hallucinated values, weak entity resolution, and poor transaction mapping.

Veritax needs facts, not paragraphs.

---

## Goals

This feature should:

* extract structured facts from supported usable documents
* normalize typed fact values while preserving raw source values
* store complete deterministic provenance for every accepted fact
* store unresolved entity mentions instead of inventing canonical entities
* resolve strong entity references into engagement-scoped canonical entities
* promote eligible extracted facts into deterministic canonical facts
* preserve historical extraction runs instead of destructively replacing facts
* prepare active canonical facts for Controlled Transaction Mapping

---

## Non-Goals

This feature does not:

* determine requirement coverage
* determine evidence sufficiency
* detect contradictions
* build transaction graphs
* create controlled transaction records
* draft documentation
* add a standalone Entity Explorer page
* add a manual fact-correction workflow
* use web search or model prior knowledge as fact evidence
* run broad extraction on free-text supplements

---

## User Stories

### Upload Agreement

As a practitioner, when I upload an intercompany service agreement, Veritax extracts provider, recipient, pricing method, markup, services, and effective date without manual review.

### Resolve Entity Aliases

As a practitioner, when documents refer to "ABC BV", "ABC Netherlands BV", and "ABC Netherlands", Veritax resolves strong aliases to the same engagement-scoped canonical entity and keeps weak mentions unresolved.

### Verify Provenance

As a practitioner, when I click "Markup = 5%", Veritax opens the source document at the exact quoted clause, page, row, sheet, line, or paragraph that supports the fact.

### Preserve Evidence Without Overclaiming

As a practitioner, when an entity cannot be resolved safely, Veritax still stores the source-backed extracted fact with an unresolved entity mention, but does not promote it to a fully usable canonical fact.

---

## Operating Decisions

These decisions are part of the scope.

* Extraction starts automatically during Requirements startup, after classification and before Requirements Matching consumes evidence.
* Extraction and document indexing can run in parallel after classification.
* Extraction is queued/background work, not one giant synchronous request.
* Relevant and Partially Relevant documents are eligible for extraction.
* Unknown and Out of Scope documents are not auto-extracted.
* Supported but partially successful documents persist valid facts and become `partially_extracted`.
* Unsupported document types become `skipped_not_supported`, not `failed`.
* Uploaded supplements follow the same classification, scope validation, extraction, and provenance rules as normal uploaded documents.
* Text supplements remain targeted requirement context and do not enter the global fact model in this PRD.
* A supplement can provide new evidence, but never bypasses scope or sufficiency rules.
* No manual `POST /extract` product action is exposed in v1.
* No standalone Entity Explorer is built in v1.

---

## Supported Documents In V1

Auto-extraction supports the documents most important to Local File quality.

Agreement documents:

* Service Agreement
* Distribution Agreement
* Manufacturing Agreement
* License Agreement
* Loan Agreement
* Cost Sharing Agreement

Financial documents:

* Trial Balance
* General Ledger
* Invoice Population
* Segmented P&L

Entity and transfer-pricing documents:

* Registry Extract
* Organization Chart
* Benchmark Study
* Master File
* Local File

Other classified document types may remain indexed/searchable but are marked `skipped_not_supported` for structured extraction in v1.

---

## Functional Requirements

### 1. Schema-Based Extraction

Extraction uses versioned schemas selected from the document classification type.

Schemas live as versioned backend JSON files in v1. They define:

* schema key
* schema version
* supported document types
* allowed fact types
* required fields
* optional fields
* value type rules
* allowed scope levels per fact type
* required provenance fields
* candidate entity roles
* deterministic validation rules

One generic extraction runner loads schemas and executes the same pipeline. Do not create bespoke code paths per document type unless the document is table-structured CSV/XLSX financial data.

### 2. Extraction Eligibility

Only usable classified documents are auto-extracted.

Eligible:

* classification state `accepted` with relevance `relevant`
* classification state `accepted` with relevance `partially_relevant`
* classification state `needs_review` if document type and schema selection are unambiguous

Not auto-extracted:

* `unknown`
* `out_of_scope`
* unsupported document types
* ambiguous `needs_review` classifications
* soft-deleted documents

### 3. Extraction Runs And Fingerprints

Extraction lifecycle is controlled by `extraction_runs`.

Each run stores:

* document id
* schema key
* schema version
* document classification type snapshot
* document classification version
* extraction runner version
* extraction model version
* fingerprint
* status
* active flag
* superseded timestamp
* started timestamp
* completed timestamp
* diagnostics

Fingerprint includes:

* document content hash
* classification type
* classification version
* extraction schema version
* extraction runner version
* extraction model version

Fingerprint does not include general engagement scope such as jurisdiction, fiscal year, or Planning entity unless a schema explicitly declares that scope as extraction-relevant.

If the fingerprint matches an active completed run, reuse it. If the fingerprint changes, create a new extraction run, supersede the prior active run, and make the newest validated run active. Do not destructively replace historical runs or facts.

### 4. Extraction Status

Documents may expose a lightweight aggregate `extraction_status` for polling and UI speed, but `extraction_runs` remain the source of truth.

Statuses:

* pending
* extracting
* extracted
* partially_extracted
* needs_review
* failed
* skipped_not_supported
* skipped_out_of_scope

Extraction failure does not block the app forever. It blocks only the failed document from contributing accepted structured facts.

### 5. Structured Extracted Facts

Every accepted value becomes an atomic extracted fact.

Facts are not paragraphs.

Each extracted fact stores:

* extraction run id
* document id
* schema key
* schema version
* fact type
* value raw
* value normalized
* value type
* unit
* period
* scope level
* entity mention id when applicable
* resolution status
* created timestamp

There is no independent `active` flag on extracted facts. A fact is active only when its extraction run is active.

### 6. Canonical Fact Types

Fact types must come from controlled extraction schemas. The extractor cannot invent fact types.

Example agreement fact types:

* provider
* recipient
* agreement_type
* effective_date
* expiry_date
* services_description
* pricing_method
* markup
* royalty_rate
* payment_terms
* governing_law

Example financial fact types:

* revenue
* expense
* transaction_amount
* operating_margin
* gl_account
* invoice_amount
* counterparty_name

Example business fact types:

* function
* asset
* risk
* group_business_description
* local_business_description

### 7. Scope Levels

Each extracted fact has a scope level.

Allowed scope levels:

* group
* local_entity
* transaction
* counterparty
* unknown

Schema plus fact-type rules constrain allowed scope levels. The extractor can only choose among permitted values. Benchmark Study facts are usually `transaction` scoped; benchmarking is evidence type, not a scope level.

Annual Reports and Master Files may produce group-level facts. They must not produce local tested-party facts, local transaction amounts, local P&L facts, local method-selection facts, or local arm's-length conclusions.

### 8. Provenance

Every accepted fact must include deterministic provenance.

Required for every fact:

* document id
* source quote
* deterministic locator
* extraction schema version
* extraction runner/model version

Page is required when the source format has stable pages, such as PDF. For non-paginated formats, use deterministic locators:

* CSV: row number or row range
* Excel: sheet name plus row number or row range
* DOCX: paragraph number or heading/paragraph
* TXT: line or paragraph number

Facts without verifiable provenance are rejected.

### 9. Validation And Missing Expected Fields

Every extracted fact passes deterministic validation before persistence as accepted evidence.

Validation checks:

* schema exists
* fact type is allowed by schema
* value raw exists
* value type is valid
* source document exists and is active
* quote exists in the extracted source text/table region
* locator is present
* page exists where page is required
* scope level is allowed for schema/fact type

Missing expected fields are stored as extraction diagnostics or expected-field results, not as facts.

Example:

* `pricing_method`: missing
* `markup`: missing
* reason: no pricing clause found in searched text

Do not store `pricing_method = not_found` as an extracted fact.

### 10. LLM Responsibilities

The LLM may:

* identify candidate facts
* populate allowed schema fields
* identify supporting quotes and locators
* suggest entity mentions

The LLM may not:

* invent facts
* use web search
* use model prior knowledge
* assign confidence
* create free-form fact types
* merge entities
* determine evidence sufficiency
* decide contradictions
* create controlled transaction records

Any model output without source-grounded quotes is rejected.

### 11. CSV And Excel Financial Extraction

CSV and Excel financial documents should use deterministic row/header parsing before LLM extraction.

For Trial Balance, General Ledger, Invoice Population, and Segmented P&L:

* detect headers
* normalize dates, periods, amounts, accounts, entity names, and counterparty names
* create row-level facts with sheet/row provenance
* use LLM only for ambiguous column mapping or messy narrative content

Do not use the LLM to interpret every ledger row when deterministic parsing can do it.

### 12. Entity Mentions And Resolution

Extraction and entity resolution are separate.

Pipeline:

1. Extract candidate facts.
2. Validate schema, value, and provenance.
3. Persist accepted extracted facts and entity mentions.
4. Resolve entity mentions.
5. Promote eligible facts into canonical facts.

Entity mentions store:

* extracted name
* normalized name
* role or context
* document id
* extraction run id
* fact id when applicable
* source provenance
* resolved canonical entity id, nullable
* resolution status

Do not reject an otherwise valid extracted fact solely because canonical entity resolution failed. Persist the fact with unresolved `entity_mention_id` and `resolution_status = unresolved`.

Do not promote entity-dependent facts into canonical facts until required entities resolve.

### 13. Canonical Entities And Aliases

Canonical entities are engagement-scoped in v1.

Entity resolution rules:

* exact legal-name match resolves
* existing alias match resolves
* strong normalized match with legal suffix and compatible context may resolve
* strong legal-name signal in provider/recipient/lender/borrower roles may create a canonical entity
* vague mentions such as "the Group", "local entity", "affiliate", or bare geography references remain unresolved
* LLM-suggested matches are hints only and do not resolve without deterministic validation

Entity aliases are engagement-scoped or inherit engagement scope through their canonical entity.

### 14. Canonical Facts And Duplicate Resolution

Raw extracted facts and canonical facts are separate.

`extracted_facts` record what a specific source said.

`canonical_facts` record what the active evidence record can currently use.

Canonicalization is a separate deterministic step after extraction and entity resolution.

Promotion requires:

* active extraction run
* active source document
* valid provenance
* schema-valid fact type
* required entity references resolved when the fact type requires them

Duplicate merging in v1 is exact normalized matching only.

Same canonical fact when these match:

* engagement id
* fact type
* normalized value
* unit
* period
* scope level
* resolved entity ids required by the fact type
* compatible schema/fact rules

When duplicates match, one canonical fact stores multiple linked sources.

Do not use an LLM to authoritatively merge facts in v1.

Conflicting values are preserved as separate canonical facts or conflict candidates. Contradiction Detection decides how to surface them.

### 15. Source Supplements

Uploaded supplements go through the same classification, scope validation, extraction, and provenance rules as normal documents.

Store supplement context:

* source_context = supplement
* target_requirement_id
* normal classification metadata
* normal extraction metadata

If a supplement is out of scope, it is stored but not accepted as usable evidence for the target requirement. The target can report that the supplement was received but unusable because entity, jurisdiction, or fiscal year did not match.

Text supplements remain targeted requirement context and are not broadly promoted into the global fact model in this PRD.

### 16. Document Tombstone Lifecycle

Default document deletion becomes soft-delete/tombstone.

Documents store lifecycle fields such as:

* is_active
* deleted_at
* deleted_by

Document processing status remains separate from lifecycle status.

When a document is tombstoned:

* extraction runs, extracted facts, entity mentions, and fact source links remain preserved for audit history
* evidence from that document becomes unusable as active evidence
* canonical facts are recalculated
* canonical facts stay active if other active sources remain
* canonical facts become inactive if the deleted document was the only active source
* Requirements, Draft, Risks, GraphRAG, and Transaction Mapping ignore evidence from deleted documents

Only an explicit permanent purge hard-deletes documents and derived records. Permanent purge is not required for this PRD.

### 17. Failure Handling And Retries

Extraction retries are bounded.

Auto-retry:

* provider timeout
* malformed LLM JSON
* transient storage read failure
* temporary OCR/text extraction failure

Do not endlessly retry:

* unsupported schema
* no extractable text/OCR needed
* quote validation failure
* schema validation failure
* out-of-scope classification

Persistent failures store status and diagnostics. They do not create user-facing noise unless they block a later user action.

### 18. Downstream Consumption

Requirements Matching may consume active canonical facts as compact structured context, alongside retrieved source passages.

For this PRD:

* Requirements still works if extraction is incomplete
* accepted canonical facts can strengthen explanations
* facts alone cannot satisfy a requirement unless they have source provenance
* entity-dependent facts are ignored or blocked until required entities resolve

Controlled Transaction Mapping should wait until extraction jobs for supported usable documents are settled. Settled statuses include extracted, partially_extracted, failed, skipped_not_supported, and skipped_out_of_scope.

### 19. UI

No new top-level page is required in v1.

Minimum UI:

* existing Document Viewer shows an Extracted Facts section
* fact row shows label, value, scope level, source locator, quote, and resolved entity if available
* clicking a fact opens or highlights the source quote

Do not show by default:

* model scores
* raw schema JSON
* internal diagnostics
* all historical superseded runs
* a standalone Entity Explorer
* a manual fact correction workflow

Extraction statuses may appear lightly where they prevent the workflow from feeling stuck, such as document chips or Requirements "Preparing evidence" progress.

---

## Database

### extraction_runs

Stores:

* id
* engagement_id
* document_id
* schema_key
* schema_version
* classification_type
* classification_version
* runner_version
* model_version
* fingerprint
* status
* active
* superseded_at
* diagnostics
* started_at
* completed_at

### extracted_facts

Stores:

* id
* engagement_id
* extraction_run_id
* document_id
* schema_key
* schema_version
* fact_type
* value_raw
* value_normalized
* value_type
* unit
* period
* scope_level
* entity_mention_id
* resolution_status
* created_at

### fact_sources

Stores:

* id
* fact_id
* document_id
* page
* locator
* quote
* created_at

### entity_mentions

Stores:

* id
* engagement_id
* document_id
* extraction_run_id
* extracted_fact_id
* raw_name
* normalized_name
* role
* locator
* quote
* resolved_entity_id
* resolution_status

### canonical_entities

Stores:

* id
* engagement_id
* legal_name
* normalized_name
* jurisdiction
* entity_type
* created_at

### entity_aliases

Stores:

* id
* engagement_id
* canonical_entity_id
* alias
* normalized_alias
* source_entity_mention_id
* created_at

### canonical_facts

Stores:

* id
* engagement_id
* fact_type
* value_normalized
* value_type
* unit
* period
* scope_level
* canonical_key
* active
* conflict_candidate
* created_at
* updated_at

### canonical_fact_sources

Stores:

* canonical_fact_id
* extracted_fact_id

### documents

Add lifecycle and aggregate fields:

* extraction_status
* is_active
* deleted_at
* deleted_by

---

## APIs

No user-facing manual extraction endpoint is required in v1.

Existing Requirements startup should internally trigger:

```text
classification -> extraction/indexing jobs -> requirements matching
```

Required read APIs:

```text
GET /documents/{id}/facts
GET /facts/{id}
GET /entities
GET /entities/{id}
```

Existing document deletion should tombstone by default:

```text
DELETE /documents/{id}
```

The response and UI should treat tombstoned documents as unavailable for active evidence while preserving history.

---

## Success Metrics

* At least 95% required fields extracted for supported document types on a labeled evaluation set.
* 100% of accepted facts include source document, quote, and deterministic locator.
* 100% of PDF-backed accepted facts include page when page text is available.
* At least 95% entity resolution accuracy on known legal entities in a labeled evaluation set.
* Under 10 seconds average extraction time per supported document, excluding OCR.
* Zero active canonical facts from soft-deleted documents.
* Duplicate canonical fact detection across documents with source aggregation.

---

## Future Enhancements

* complex PDF table extraction
* OCR confidence-aware extraction
* jurisdiction-specific extraction schemas
* multi-language extraction
* standalone Entity Explorer
* human-assisted extraction review
* traceable fact correction and audit overrides
* custom client schemas
* global/client-level entity registry
* semantic duplicate suggestions for reviewer approval
* permanent purge administration

---

## Acceptance Criteria

The feature is complete when:

1. Requirements startup automatically queues extraction for supported Relevant and Partially Relevant documents after classification.
2. Supported documents are processed with versioned extraction schemas selected from classification output.
3. Unsupported, Unknown, Out of Scope, ambiguous, and tombstoned documents are skipped without blocking the user.
4. Structured extracted facts are produced instead of free-form summaries.
5. Every accepted extracted fact contains complete verifiable provenance: document, quote, deterministic locator, and page where applicable.
6. Invalid facts are rejected and missing expected fields are stored as diagnostics, not fake facts.
7. Entity mentions are stored even when unresolved.
8. Entity resolution creates or matches engagement-scoped canonical entities only when deterministic rules are strong enough.
9. Entity-dependent facts with unresolved mentions are preserved but not promoted into active canonical facts.
10. Canonical facts are promoted by a deterministic canonicalization step and exact duplicate matching only.
11. Reruns supersede extraction runs without destructively deleting historical extraction output.
12. Uploaded supplements follow normal classification, scope, extraction, and provenance rules.
13. Document deletion tombstones sources and removes them from active downstream evidence without hard-deleting audit history.
14. Requirements can consume active canonical facts as structured context while continuing to function when extraction is incomplete.
15. The Document Viewer exposes extracted facts with source quotes and locators, without adding a new top-level Entity Explorer or correction workflow.
