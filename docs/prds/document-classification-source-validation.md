# PRD: Document Classification & Source Validation

## Status

**Priority:** P0

**Owner:** AI Platform

**Dependencies:** None

**Blocks:**

* Structured Extraction & Entity Resolution
* Controlled Transaction Mapping
* Requirement Matching
* GraphRAG

---

# Overview

Document Classification & Source Validation is the first evidence-quality gate in the Local File pipeline.

It runs after uploads are stored and before Requirements Matching starts.

Its purpose is not to deeply extract transfer-pricing facts. Its purpose is to decide, cheaply and reproducibly:

* what kind of uploaded document this is
* whether it appears to belong to the current engagement
* which entity, jurisdiction, fiscal year, language, status, and version it appears to cover
* which extraction schemas may later process it
* which requirements it may potentially support

This feature is mostly invisible to the user. It protects downstream workflows from unnecessary or clearly out-of-scope processing, while storing classification intelligence for later product capabilities.

---

# Problem

Today uploaded documents are largely treated as searchable text.

That creates several quality and performance failures:

* every document is processed the same way
* wrong extraction logic may be applied
* documents from different entities become mixed
* documents from different tax years become mixed
* annual reports may incorrectly satisfy detailed transfer-pricing requirements
* downstream agents waste tokens on irrelevant documents
* out-of-scope files can contaminate Requirements, Draft, Risks, and GraphRAG

The system needs deterministic source understanding before intelligent reasoning begins.

---

# Goals

The feature should:

* add fiscal year as a first-class engagement field across backend, API, and Planning UI
* classify uploaded documents into a canonical Evidence Taxonomy
* validate uploaded documents against engagement scope
* identify entity, jurisdiction, fiscal year, language, document status, and document version
* identify possible transaction types
* identify candidate extraction schemas
* identify candidate requirements supported
* store classification and validation results for future workflows
* skip automatic downstream processing for documents clearly classified as Out of Scope
* avoid blocking the user from continuing through the product

The feature does not determine whether a requirement has been satisfied. That belongs to Requirement Matching.

---

# Non-Goals

This feature does not:

* extract detailed transfer-pricing facts
* build graphs
* determine evidence sufficiency
* draft Local Files
* detect contradictions
* create a visible document-management page
* expose manual classification or reclassification controls
* classify website sources, interview text, or connector records in this first slice

---

# User Stories

## Pre-Requirements Safety

As the platform,

I classify and validate uploaded documents before Requirements Matching starts,

so irrelevant or wrong-scope files do not pollute the evidence run.

---

## Out-of-Scope Visibility

As a user,

I only hear about classification when files were skipped,

so I know why those files were not used without being forced into a document-review workflow.

---

## Future Evidence Intelligence

As the platform,

I persist source classification and scope results,

so later extraction, graph, contradiction, and correction features can reuse them.

---

# Functional Requirements

## 1. Engagement Fiscal Year

The engagement must store fiscal year globally.

Required changes:

* backend `engagements.fiscal_year`
* API create/read/update support
* frontend Planning input
* persisted project rehydration
* classification scope fingerprint includes fiscal year

Classification can run without fiscal year only in degraded mode. In that case fiscal-year validation returns Unknown and documents cannot be marked Out of Scope solely because the fiscal year is missing from the engagement.

---

## 2. Evidence Taxonomy

This PRD owns the initial Evidence Taxonomy.

The taxonomy must be versioned and fixed. The classifier cannot invent document types.

Initial document types:

```text
Service Agreement
Distribution Agreement
Manufacturing Agreement
License Agreement
Loan Agreement
Cost Sharing Agreement
Annual Report
Trial Balance
General Ledger
Invoice Population
Segmented P&L
Master File
Local File
Benchmark Study
APA
Tax Ruling
Registry Extract
Organization Chart
Presentation
Email
Unknown
```

Each taxonomy entry may define:

* allowed tags
* deterministic signals
* candidate extraction schemas
* candidate requirement categories
* document-type-specific scope rules

Requirement Matching may later extend the taxonomy with evidence sufficiency rules.

---

## 3. Multi-Label Tags

Documents receive tags from the taxonomy.

Example tags:

```text
Intercompany
Royalty
Services
Manufacturing
Distribution
Financial
Legal
Benchmarking
Pillar Two
OECD
Dutch
FY2025
English
Executed
Draft
Global
Local
```

Tags assist later retrieval, extraction routing, and evidence matching. They are not user-facing in this slice.

---

## 4. Source Validation

Every uploaded document must be validated against the current engagement scope.

The engagement scope includes:

* entity name
* jurisdictions
* fiscal year

The document validation extracts or infers:

* entity
* jurisdiction
* fiscal year
* language
* document status
* document version

Each validation check returns:

```text
Pass
Warning
Fail
Unknown
```

Checks:

```text
Entity Match
Jurisdiction Match
Fiscal Period Match
Language
Version
Executed Status
```

---

## 5. Engagement Match

Every uploaded document receives one relevance result:

```text
Relevant
Partially Relevant
Out of Scope
Unknown
```

Meaning:

* Relevant: entity, jurisdiction, and fiscal year pass or are strongly inferable.
* Partially Relevant: at least one major scope dimension matches, and at least one dimension is warning or unknown.
* Out of Scope: there is a clear fail on entity, jurisdiction, or fiscal year.
* Unknown: there is not enough signal to decide.

Unknown is usable. It is treated as low-trust context by downstream matching.

Partially Relevant is usable. Its scope warnings must travel with the evidence.

Out of Scope is skipped from automatic processing.

---

## 6. Out-of-Scope Handling

Classification must not block the user from continuing.

Classification may block a file from automatic downstream processing.

Out-of-scope files are:

* stored
* classified
* shown only if skipped
* excluded from automatic extraction, embedding, Requirements Matching, Draft retrieval, Risks, and GraphRAG

The user can still continue the workflow.

If the user later uploads or uses an out-of-scope file as a supplement for a specific requirement, accept it as an explicit targeted override and process it for that requirement.

---

## 7. Candidate Requirements

The system identifies which requirements a document may contribute to.

Example:

```text
Annual Report
-> Business Description
-> Management Structure
-> Competitor Discussion
```

Not:

```text
Annual Report
-> Method Selection
-> Financial Tie-out
-> Controlled Transactions
```

This is only a candidate list. Requirement Matching determines actual coverage.

---

## 8. Candidate Extraction Schemas

Every classified document maps to candidate extraction pipelines.

Example:

```text
Service Agreement
-> Agreement Extractor
-> Pricing Extractor
-> Entity Extractor
```

Unknown documents must either map to a safe generic extractor or explicitly map to no extractor.

---

# Pipeline Timing

Upload should stay lightweight.

Upload flow:

1. Store bytes and metadata.
2. Do not full extract, embed, or run Requirements Matching immediately.

Requirements start flow:

1. Classify and validate uploaded documents.
2. Store classification results.
3. List any skipped Out of Scope documents.
4. Extract and embed only usable uploaded documents:
   * Relevant
   * Partially Relevant
   * Unknown
5. Run Requirements Matching.

Supplement flow:

1. User adds source material to a specific requirement.
2. Process the supplement for that targeted requirement.
3. Do not reject it merely because it would otherwise look out of scope.

---

# Classification Preview

Classification must be cheaper than full indexing.

For PDF/Word-like files, use:

* filename
* content type
* file size
* first extracted page or first approximately 4,000 characters
* OCR fallback only when preview text is empty or too thin

For Excel files, use:

* filename
* content type
* workbook sheet names
* first rows and headers
* approximate row/column dimensions

For CSV files, use:

* filename
* content type
* delimiter/shape
* headers
* first rows

If the preview is insufficient, classify as Unknown and continue.

---

# Classification Engine

Classification is hybrid.

## Stage 1: Deterministic Rules

Inspect:

* filename
* extension
* MIME type
* preview text
* first page title
* spreadsheet sheet names and headers
* OCR preview when needed
* known templates

Deterministic rules should classify obvious documents without an LLM call.

---

## Stage 2: LLM Classification

The LLM is used only when deterministic rules are inconclusive.

The LLM receives:

* preview text
* metadata
* deterministic signals
* engagement scope
* allowed taxonomy values

The LLM returns:

```text
Primary Type
Observed Signals
Supporting Quotes
Candidate Tags
Candidate Scope Values
```

The LLM must not return a confidence score.

---

## Stage 3: Rule Engine

Veritax computes the final classification score using deterministic weights.

Example:

```text
Contains defined parties: +15
Contains pricing clause: +20
Contains signature: +10
Contains auditor opinion: -30
```

The rule engine determines final classification state and relevance.

---

# Classification States

```text
Accepted
Needs Review
Unknown
Rejected
```

For this slice, Needs Review is stored but does not create a user-facing review queue.

---

# Failure Handling

Classification failure must not trap the user.

Rules:

* deterministic classification always runs
* transient LLM failures are retried automatically
* malformed LLM output is retried automatically
* if LLM classification still fails, store diagnostics and continue as Unknown
* if deterministic rules clearly identify Out of Scope, skip the file even if LLM classification fails
* no user-facing error modal is shown solely because classification degraded

---

# Outputs

Every uploaded document produces and stores:

```text
Primary Type
Tags
Entity
Jurisdiction
Fiscal Year
Language
Document Status
Version
Relevance
Classification Score
Classification State
Candidate Requirements
Candidate Extractors
Deterministic Signals
LLM Supporting Quotes
Source Validation Checks
Scope Fingerprint
Classifier Version
Classified At
Diagnostics
```

Scope fingerprint is derived from:

* document content hash
* engagement entity name
* engagement jurisdictions
* engagement fiscal year
* classifier version

If the fingerprint changes, classification must rerun automatically before Requirements Matching.

---

# UI

This feature should not create a visible Documents page, classification dashboard, filters, badges, or review queue.

Normal state:

* no visible classification results
* no manual classification action
* no manual reclassification action
* no document-type badges during Planning
* no source-review workflow before Requirements

Exception state:

If files were skipped as Out of Scope during the Requirements run, show a compact notice inside Requirements:

```text
Some uploaded files were skipped because they appear outside this engagement scope.

Skipped files:
- UK FY2023 Annual Report.pdf - fiscal year does not match FY2025
- Germany Services Agreement.pdf - jurisdiction does not match Netherlands
```

The notice should be informational, not blocking.

The user may continue. If the user intentionally supplies the skipped file later as a requirement supplement, the system accepts it for that targeted requirement.

---

# Database

## engagements

Add:

* fiscal_year

---

## evidence_taxonomy

Stores:

* taxonomy_version
* document_type
* allowed_tags
* deterministic_signals
* candidate_extractors
* candidate_requirement_categories
* scope_rules

This may be implemented as a versioned JSON registry in the first slice if a table is unnecessary.

---

## document_classifications

Stores:

* document_id
* taxonomy_version
* document_type
* classification_score
* classification_state
* relevance
* deterministic_signals
* llm_supporting_quotes
* candidate_requirements
* candidate_extractors
* scope_fingerprint
* classifier_version
* diagnostics
* classified_at

---

## document_tags

Stores:

* document_id
* tag

---

## document_scope

Stores:

* document_id
* entity
* jurisdiction
* fiscal_year
* language
* document_status
* version
* source_validation_result

---

# API

No manual classify or reclassify endpoint is required for users.

Classification is invoked internally by Requirements startup.

Required API changes:

```text
PATCH /engagements/{id}
```

Adds fiscal_year support.

```text
GET /engagements/{id}
```

Returns fiscal_year.

```text
POST /engagements/{id}/coverage/{jurisdiction}/start
```

Runs classification first, then Requirements Matching.

```text
GET /engagements/{id}/coverage/{jurisdiction}
```

Returns any skipped Out of Scope documents for the Requirements notice.

Internal helpers may expose classification reads for tests, diagnostics, and future admin tools, but there is no user-facing manual classification action in this PRD.

---

# Success Metrics

* >=95% primary document classification accuracy on supported document types
* >=98% entity and fiscal-year scope detection accuracy on documents with explicit scope signals
* >=90% automatic classification rate without LLM escalation for obvious documents
* <5 seconds average classification time per document, excluding OCR
* Zero automatic downstream processing for documents classified Out of Scope
* Every uploaded document is routed to at least one valid candidate extraction pipeline or explicitly classified as Unknown
* No user is blocked from continuing solely because classification is incomplete or degraded

---

# Future Enhancements

* visible document intelligence page
* reviewer override workflow
* manual reclassification
* custom client document templates
* ERP-specific classifiers for SAP, Oracle, and NetSuite exports
* jurisdiction-specific document variants
* continuous classifier improvement from reviewer feedback
* duplicate and superseded document detection
* classification for website, interview, and connector sources

---

# Acceptance Criteria

The feature is complete when:

1. Engagements support fiscal year across backend, API, Planning UI, and persisted project loading.
2. A fixed Evidence Taxonomy exists and the classifier cannot invent document types.
3. Requirements startup classifies and validates uploaded documents before Requirements Matching.
4. Upload no longer full-indexes every file immediately by default.
5. Relevant, Partially Relevant, and Unknown uploaded documents are processed for Requirements Matching.
6. Out of Scope uploaded documents are stored but skipped from automatic extraction, embedding, Requirements Matching, Draft retrieval, Risks, and GraphRAG.
7. Requirements displays a compact informational notice only when files were skipped as Out of Scope.
8. Supplements are accepted as targeted user overrides even if they would otherwise look out of scope.
9. Classification failures degrade to stored Unknown results with diagnostics rather than blocking the user.
10. Classification and source-validation results are persisted with scope fingerprint and classifier version.
11. All classification decisions are explainable, reproducible, and based on deterministic scoring rather than model-reported confidence.
