# PRD: Controlled Transaction Mapping

## Status

**Priority:** P0

**Owner:** AI Platform

**Scope:** Full application feature, not a staged demo or temporary implementation.

**Dependencies:**

* Document Classification & Source Validation
* Structured Extraction & Entity Resolution

**Blocks:**

* Requirement Matching & Evidence Sufficiency
* GraphRAG
* Contradiction Detection
* Draft Generation
* Risks

---

# Overview

Controlled Transaction Mapping transforms isolated extracted facts into complete, evidence-backed transfer pricing transactions.

The feature establishes Veritax's understanding of who transacted with whom, what the transaction was, which fiscal period it belongs to, what documents support it, what financial activity is linked to it, and which parts of the evidence chain are still missing.

This is a neutral evidence-structure layer. It does not decide whether a position is arm's length, compliant, sufficient, risky, or defensible.

---

# Locked Product Decisions

1. Canonical controlled transactions require resolved canonical provider and recipient entities.
2. Unresolved party evidence is preserved as unmapped evidence, but it does not create a canonical Transaction ID.
3. A transaction can be created without an agreement if invoices, ledger rows, or other financial activity provide resolved provider, resolved recipient, fiscal year, and transaction type or activity evidence.
4. Transaction type uses a controlled enum plus a source-backed raw label.
5. Transaction status describes evidence completeness only, never compliance or risk.
6. Mapping is a separate durable background job, automatically triggered after Requirements startup once usable extraction jobs settle.
7. Mapping is deterministic. LLMs may contribute upstream extracted facts only when quote-backed and schema-constrained; LLMs do not merge transactions or author conclusions.
8. Duplicate transaction records must not be stored. Deterministically identical evidence upserts into the same transaction. If sameness cannot be proven, the records remain distinct transactions without storing duplicate metadata.
9. One agreement can govern multiple controlled transactions.
10. One invoice or ledger row maps to one transaction by default. Splitting a row across multiple transactions requires explicit allocation evidence.
11. Mapping consumes active canonical facts for identity and merge keys, and raw extracted facts/fact sources for provenance and unmapped evidence.
12. Mapping rebuilds from active evidence with stable upserts instead of incrementally mutating document-by-document state.
13. If evidence disappears, transactions are downgraded when some active evidence remains and archived when no active evidence remains. Historical relationships are preserved inactive.
14. Unmapped evidence is user-visible only when it is actionable.
15. Practitioner correction is limited to traceable decisions such as confirming candidates, marking false positives archived, resolving entity mentions, or explaining why two apparent records are distinct. Users cannot directly overwrite sourced fields.
16. Transaction graph edges use internal uploaded or connected source evidence only, not web evidence.
17. Transaction amount is not required to create a canonical transaction.
18. Canonical identity is fiscal-year primary. Raw dates and date ranges are stored as timeline evidence.
19. Domestic controlled transactions are valid. Cross-border is common, not required.
20. Related-party relationship can be inferred from intercompany/TP evidence, but the proof status must be stored as `inferred`, `verified`, or `unknown`.
21. This PRD exposes backend graph/storage/APIs and minimal existing-page integration, not a standalone Transactions dashboard.
22. `PATCH /transactions/{id}` is for reviewer decisions only, not direct unsourced field editing.
23. Draft waits on Transaction Mapping for transaction-scoped/economic sections. Background/entity sections may proceed.
24. The graph is represented with ordinary Postgres relational tables. No separate graph database.
25. The graph is unified per engagement, with fiscal-year and jurisdiction filters in APIs.
26. Archived transactions are hidden by default and visible only with `include_archived=true`.
27. Financial totals aggregate only within the same currency unless source-backed FX evidence exists.
28. Agreement identity is not required to merge agreement-derived and financial-derived evidence when provider, recipient, type, fiscal year, and compatible activity/pricing match exactly.
29. Minimum canonical identity key is resolved provider entity, resolved recipient entity, transaction type enum, and fiscal year.
30. Mapping must never create arm's-length conclusions, method selections, tested-party conclusions, evidence sufficiency verdicts, or compliance verdicts.

---

# Problem

Transfer pricing is fundamentally about controlled transactions, not documents.

The same transaction can be spread across:

* service agreements
* amendments
* invoices
* general ledger entries
* trial balances
* segmented P&Ls
* TP policies
* benchmark studies
* local files

Without transaction mapping:

* evidence stays fragmented
* Draft and Risks reason from loose paragraphs
* the same economic transaction can be represented more than once
* missing links are hidden instead of surfaced
* GraphRAG has no meaningful business structure to traverse
* practitioners cannot trace a Local File section back to the transaction evidence chain

---

# Goals

The system must:

* identify controlled transactions from active, in-scope evidence
* consolidate supporting facts, documents, entities, and financial records into one transaction representation
* preserve every relationship with deterministic provenance
* expose missing links without inventing them
* prevent duplicate transaction IDs for the same economic transaction
* produce a reusable transaction graph for Requirements, GraphRAG, Contradiction Detection, Draft, and Risks
* support limited traceable practitioner decisions without allowing unsourced fact editing

---

# Non-Goals

This feature does not:

* determine evidence sufficiency
* evaluate compliance
* determine or conclude arm's-length pricing
* select a transfer pricing method
* select a tested party
* detect contradictions
* generate Local Files
* create source facts from web evidence
* introduce a graph database
* introduce a standalone Transactions dashboard

---

# User Stories

## Transaction Discovery

As a practitioner, after uploading a large evidence set, I want Veritax to show the controlled transactions it can safely identify, so I do not have to manually infer transactions from hundreds of disconnected files.

## Partial Transaction Discovery

As a practitioner, when financial activity indicates a transaction but the agreement has not been found, I want Veritax to create a partial transaction and show the missing agreement link, so I know what evidence to chase.

## Unmapped Evidence

As a practitioner, when Veritax finds source-backed facts that cannot safely form a transaction, I want to see why they are unmapped, so I can resolve entity, period, or transaction-type gaps.

## Evidence Navigation

As a practitioner, I want every transaction component and edge to open the underlying source quote, locator, document, and extracted fact, so I can trust the map.

## Draft Protection

As a practitioner, I want transaction-scoped draft sections blocked when transaction mapping is incomplete, so the system does not manufacture economic analysis from insufficient evidence.

---

# Functional Requirements

## 1. Transaction Identity

Every active canonical controlled transaction must have a stable Transaction ID.

The minimum canonical identity key is:

* resolved provider canonical entity
* resolved recipient canonical entity
* controlled transaction type enum
* fiscal year

The transaction may also store:

* source-backed raw transaction label
* provider jurisdiction
* recipient jurisdiction
* relationship proof status
* pricing terms
* agreement references
* financial totals
* currencies
* timeline events
* supporting documents

Transaction amount is not part of the identity key.

## 2. Transaction Type

Transaction type must be a controlled enum.

Initial enum values:

* `management_services`
* `shared_services`
* `distribution`
* `manufacturing`
* `contract_manufacturing`
* `royalty`
* `license`
* `intercompany_loan`
* `guarantee`
* `procurement`
* `cost_sharing`
* `cost_contribution`
* `rd_services`
* `other`

The mapper must also preserve the source-backed raw label, such as "treasury and procurement support" or "brand support services."

## 3. Transaction Creation Rules

The mapper may create a transaction from agreement-derived evidence when provider, recipient, transaction type, and fiscal year are known.

The mapper may create a transaction from financial-derived evidence without an agreement when provider, recipient, transaction type or activity label, and fiscal year are known.

If provider or recipient is unresolved, the evidence must remain unmapped.

If transaction type cannot be mapped to the enum, the evidence must remain unmapped unless a deterministic rule maps it to `other` with a source-backed raw label.

## 4. Multi-Document Consolidation

Documents referring to the same transaction must consolidate into one transaction when the deterministic identity key matches.

Agreement-derived and financial-derived evidence can merge without exact agreement identity when:

* provider matches
* recipient matches
* transaction type matches
* fiscal year matches
* activity/pricing evidence is compatible

LLMs must not merge transactions.

## 5. Duplicate Handling

The system must not store duplicate transaction representations for the same economic transaction.

If evidence deterministically maps to an existing transaction key, it upserts into that transaction.

If sameness cannot be proven, the evidence creates a distinct transaction only when all identity requirements are met. The system must not store similarity-based duplicate records or duplicate metadata.

## 6. Transaction Components

A transaction can link to:

* provider entity
* recipient entity
* agreement document
* amendment document
* pricing terms
* invoices
* ledger entries
* trial balance facts
* segmented P&L facts
* financial statement facts
* benchmark study facts
* supporting documents
* reviewer decisions

Missing components remain explicit gaps.

## 7. Relationship Edges

Relationships become typed graph edges stored in Postgres.

Examples:

* `AGREEMENT_GOVERNS_TRANSACTION`
* `INVOICE_SUPPORTS_TRANSACTION`
* `LEDGER_ENTRY_BELONGS_TO_TRANSACTION`
* `TRIAL_BALANCE_SUPPORTS_TRANSACTION`
* `PRICING_TERM_DEFINES_TRANSACTION`
* `PROVIDER_PERFORMS_ACTIVITY`
* `RECIPIENT_RECEIVES_ACTIVITY`
* `DOCUMENT_SUPPORTS_TRANSACTION`
* `REVIEWER_DECISION_APPLIES_TO_TRANSACTION`

Every edge must include provenance.

## 8. Provenance

Every transaction relationship must be traceable to source evidence.

Required provenance:

* source document ID
* extracted fact ID where applicable
* canonical fact ID where applicable
* locator
* page when available
* quote
* source type
* extraction run ID where applicable

No relationship may exist without provenance unless it is a reviewer decision, in which case it must store reviewer, timestamp, and reason.

## 9. Financial Mapping

Financial records attach to transactions through source-backed facts from invoice populations, general ledgers, trial balances, segmented P&Ls, or calculation schedules.

Same-currency amounts may aggregate.

Mixed-currency amounts must remain separated unless source-backed FX evidence exists.

One invoice or ledger row maps to one transaction by default. Allocation across multiple transactions requires explicit source-backed allocation evidence.

## 10. Timeline

The mapper must store source-backed timeline events, including:

* agreement execution date
* amendment date
* invoice dates
* ledger posting dates
* year-end adjustment dates
* local file period

Canonical transaction identity remains fiscal-year primary. Raw date detail enriches the timeline but must not fragment one annual transaction into monthly transaction IDs.

## 11. Status

Transaction status describes evidence completeness only.

Allowed statuses:

* `draft`
* `partial`
* `complete`
* `missing_evidence`
* `archived`

Status must not encode risk, compliance, defensibility, or arm's-length conclusions.

Archived transactions are hidden by default and returned only when `include_archived=true`.

## 12. Related-Party Proof

Store `relationship_proof_status` as:

* `verified`
* `inferred`
* `unknown`

`verified` requires direct ownership/control evidence from source documents.

`inferred` is allowed when intercompany or TP evidence plus resolved engagement entities support the relationship.

`unknown` means the relationship has not been proven or inferred from acceptable source context.

## 13. Unmapped Evidence

The system must store transaction-relevant evidence that cannot safely form a canonical transaction.

Common unmapped reasons:

* unresolved provider
* unresolved recipient
* missing fiscal year
* missing transaction type
* unsupported transaction type
* missing allocation evidence
* inactive or out-of-scope source

Unmapped evidence should be visible only when actionable and should include the required next action.

## 14. Practitioner Decisions

Practitioner correction is limited and traceable.

Allowed actions:

* confirm a transaction
* archive a false-positive transaction with reason
* resolve an unmapped entity mention to an existing or new canonical entity
* record that two apparent records are distinct, with reason
* add a reviewer note to a transaction

Not allowed:

* directly editing provider, recipient, transaction type, amount, pricing, or period without source evidence
* manual graph edge creation without provenance
* arbitrary graph editing
* mutation of extracted facts into unsourced facts

## 15. Rebuild And Lifecycle

Mapping runs as a durable background job.

The job reads active, in-scope, usable evidence for the engagement and rebuilds the transaction graph with stable upserts.

When a document is tombstoned, reclassified out of scope, or superseded by a new extraction run:

* inactive evidence is ignored by active mapping
* active transaction components are recomputed
* transactions downgrade if some active evidence remains
* transactions archive if no active evidence remains
* historical relationships remain preserved inactive

## 16. Downstream Gating

Transaction-scoped Requirements, Draft, GraphRAG, Contradiction Detection, and Risks must consume the transaction map when available.

Draft Generation must not produce transaction-scoped or economic-analysis sections when Transaction Mapping is blocked by unmapped transaction evidence.

Pure group/background sections may proceed without waiting on transaction mapping.

---

# Mapping Engine

Pipeline:

```text
Active classified documents
-> settled extraction runs
-> active canonical facts
-> raw extracted facts and fact sources
-> resolved canonical entities
-> transaction evidence candidates
-> deterministic transaction key construction
-> stable transaction upsert
-> edge and financial link replacement
-> archive/downgrade stale transactions
-> ready
```

The mapper must use existing active-evidence guards from the extraction layer.

---

# Database

Use ordinary Postgres relational tables.

## controlled_transactions

Stores:

* `id`
* `engagement_id`
* `transaction_key`
* `transaction_type`
* `raw_label`
* `provider_entity_id`
* `recipient_entity_id`
* `provider_jurisdiction`
* `recipient_jurisdiction`
* `fiscal_year`
* `status`
* `relationship_proof_status`
* `archived_at`
* `archive_reason`
* timestamps

Unique constraint:

* `engagement_id`, `transaction_key`

## transaction_edges

Stores:

* `id`
* `engagement_id`
* `transaction_id`
* `source_node_type`
* `source_node_id`
* `target_node_type`
* `target_node_id`
* `relationship_type`
* `active`
* `provenance`
* timestamps

## transaction_documents

Stores:

* `transaction_id`
* `document_id`
* `role`
* `active`
* provenance

## transaction_financials

Stores:

* `transaction_id`
* `source_fact_id`
* `amount_raw`
* `amount_normalized`
* `currency`
* `period`
* `financial_source_type`
* `active`
* provenance

## transaction_unmapped_evidence

Stores:

* `engagement_id`
* `document_id`
* `extracted_fact_id`
* `reason`
* `required_action`
* `active`
* provenance

## transaction_reviewer_decisions

Stores:

* `transaction_id`
* `decision_type`
* `reason`
* `created_by`
* `created_at`

---

# APIs

## POST /engagements/{id}/transactions/build

Queues or restarts the durable mapping job.

## GET /engagements/{id}/transactions

Lists active transactions by default.

Filters:

* `jurisdiction`
* `fiscal_year`
* `transaction_type`
* `status`
* `include_archived`

## GET /transactions/{id}

Returns transaction summary, metadata, status, linked documents, financials, timeline, unmapped gaps, and supporting facts.

## GET /transactions/{id}/graph

Returns typed nodes and edges with provenance.

## GET /engagements/{id}/transactions/unmapped

Returns actionable unmapped transaction evidence.

## PATCH /transactions/{id}

Applies limited reviewer decisions only. It must not directly edit sourced transaction fields.

---

# UI

This PRD does not add a standalone Transactions dashboard.

Existing surfaces should consume the transaction APIs where useful:

* Requirements can show transaction-linked evidence when a requirement is transaction-scoped.
* Draft can block transaction-scoped sections when mapping is incomplete.
* Risks can inspect transaction edges and financial links.
* Graph can render controlled transactions as nodes and edges.
* Document Viewer can show which transactions a source fact supports.

Unmapped evidence should appear only when actionable, with a clear next step such as resolving an entity mention or uploading an agreement.

---

# Success Metrics

* At least 95% of related evidence is grouped into the correct transaction in curated evaluation sets.
* At least 90% automatic transaction identification accuracy in curated evaluation sets.
* 100% of transaction relationships have deterministic provenance.
* Zero duplicate Transaction IDs for the same deterministic transaction key.
* Zero canonical transactions created from unresolved provider or recipient entities.
* Zero arm's-length, method-selection, tested-party, sufficiency, or compliance conclusions created by Transaction Mapping.
* Average graph construction time is under 30 seconds for 500 uploaded documents after extraction has settled.

---

# Acceptance Criteria

The feature is complete when:

1. Every controlled transaction receives a stable canonical Transaction ID only when the minimum identity key is satisfied.
2. Agreement-derived and financial-derived evidence consolidate into one transaction when deterministic rules prove sameness.
3. No duplicate transaction records are stored for the same deterministic transaction key.
4. Unresolved entity-dependent evidence is preserved as unmapped evidence and does not create a canonical transaction.
5. Documents, facts, entities, financial records, and reviewer decisions are consolidated into one transaction representation.
6. Every edge and component is backed by provenance.
7. Transaction status reflects evidence completeness only.
8. Tombstoned, out-of-scope, or superseded evidence is ignored by active mapping while historical relationships remain preserved inactive.
9. Archived transactions are hidden by default.
10. Transaction graph APIs are available for Requirements, GraphRAG, Contradiction Detection, Draft, and Risks.
11. Users can inspect a transaction and trace every relationship back to source evidence.
12. Draft Generation is blocked for transaction-scoped/economic sections when mapping is incomplete or blocked by unmapped transaction evidence.
13. Transaction Mapping never creates arm's-length conclusions, method selections, tested-party conclusions, evidence sufficiency verdicts, or compliance verdicts.
