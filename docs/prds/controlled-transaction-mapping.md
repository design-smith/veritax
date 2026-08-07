# PRD: Controlled Transaction Mapping

## Status

**Priority:** P0

**Owner:** AI Platform

**Dependencies:**

* ✅ Document Classification & Source Validation
* ✅ Structured Extraction & Entity Resolution

**Blocks:**

* Requirement Matching & Evidence Sufficiency
* GraphRAG
* Contradiction Detection
* Draft Generation

---

# Overview

Controlled Transaction Mapping is responsible for transforming isolated facts into complete transfer pricing transactions.

Rather than viewing documents independently, Veritax builds a unified representation of each controlled transaction by connecting all supporting evidence into a single graph.

This feature establishes the system's understanding of **who transacted with whom, under what agreement, for what purpose, during which period, and what evidence supports that transaction.**

This becomes the backbone of Veritax.

---

# Problem

Transfer Pricing is fundamentally about **controlled transactions**, not documents.

Today the same transaction may be spread across:

* Service Agreement
* Amendment
* Invoices
* General Ledger
* Trial Balance
* TP Policy
* Benchmark Study
* Local File

Without mapping these together:

* evidence becomes fragmented
* duplicate transactions appear
* drafting requires repeated reasoning
* contradictions become difficult to detect
* GraphRAG has no meaningful structure to traverse

---

# Goals

The system should:

* identify every controlled transaction
* consolidate evidence across documents
* build relationships between entities
* associate financial activity with legal agreements
* maintain complete provenance
* produce a reusable transaction graph for downstream AI agents

---

# Non-Goals

This feature does NOT:

* determine evidence sufficiency
* evaluate compliance
* determine arm's-length pricing
* detect contradictions
* generate Local Files

---

# User Stories

### Transaction Discovery

A user uploads 400 documents.

Instead of seeing 400 disconnected files,

Veritax identifies

```text
27 Controlled Transactions
```

---

### Transaction View

User selects

```text
Management Services
```

Veritax displays

Provider

↓

Recipient

↓

Agreement

↓

Invoices

↓

Ledger

↓

Financial Tie-out

↓

Supporting Documents

---

### Evidence Navigation

Clicking any component opens its supporting evidence.

---

# Functional Requirements

---

## 1. Controlled Transaction Identification

The system automatically identifies controlled transactions.

Examples

* Management Services
* Distribution
* Manufacturing
* Contract Manufacturing
* Licensing
* Royalty
* Financing
* Intercompany Loan
* Cost Sharing
* Cost Contribution
* Guarantee
* Procurement
* Shared Services
* R&D Services

Each transaction receives a canonical Transaction ID.

---

## 2. Transaction Construction

Every transaction consists of linked components.

Example

```text
Transaction

↓

Provider

↓

Recipient

↓

Agreement

↓

Pricing Terms

↓

Invoices

↓

Ledger

↓

Trial Balance

↓

Financial Statements

↓

Supporting Documents
```

---

## 3. Transaction Metadata

Every transaction stores

* Transaction ID
* Transaction Type
* Provider
* Recipient
* Jurisdiction Pair
* Fiscal Period
* Currency
* Status
* Supporting Documents

---

## 4. Relationship Building

Relationships become graph edges.

Examples

```text
Agreement

GOVERNS

Transaction
```

```text
Invoice

SUPPORTS

Transaction
```

```text
Ledger Entry

BELONGS_TO

Transaction
```

```text
Provider

PERFORMS

Services
```

---

## 5. Transaction Timeline

Track transaction lifecycle.

Example

```text
Agreement Executed

↓

Amendment

↓

Invoices

↓

Ledger Posting

↓

Year End Adjustment

↓

Local File
```

This allows Veritax to understand document chronology.

---

## 6. Evidence Chain

Every transaction exposes a complete evidence chain.

Example

```text
Royalty Transaction

↓

License Agreement

↓

Amendment

↓

Royalty Calculation

↓

Invoices

↓

Payments

↓

Ledger

↓

Trial Balance
```

Missing links remain visible.

---

## 7. Financial Mapping

Attach financial evidence.

Example

```text
Transaction

↓

Invoice Population

↓

GL Entries

↓

Trial Balance

↓

Segmented P&L
```

Later features validate financial consistency.

---

## 8. Multi-Document Consolidation

Documents referring to the same transaction are merged.

Example

```text
Agreement

↓

Invoice

↓

Ledger

↓

TP Policy

↓

Benchmark

↓

One Transaction
```

Not five independent objects.

---

## 9. Transaction Status

Each transaction receives

```text
Draft

Partial

Complete

Missing Evidence

Archived
```

Status is based only on discovered evidence.

Not compliance.

---

# Transaction Graph

Example

```text
Management Services

├── Provider
│      Switzerland AG
│
├── Recipient
│      Netherlands BV
│
├── Agreement
│      Service Agreement 2025
│
├── Pricing
│      Cost Plus 5%
│
├── Financials
│      €4.2M
│
├── Invoices
│      12
│
├── Ledger Entries
│      48
│
├── Trial Balance
│      Linked
│
└── Supporting Documents
```

---

# Mapping Engine

Pipeline

```text
Structured Facts

↓

Entity Resolution

↓

Relationship Detection

↓

Transaction Candidate Generation

↓

Duplicate Resolution

↓

Transaction Graph Update

↓

Ready
```

---

# Duplicate Resolution

Multiple documents may describe one transaction.

Example

Agreement

↓

Invoices

↓

Benchmark

↓

Local File

↓

One Transaction ID

---

# Deterministic Rules

Transactions are merged using

* provider
* recipient
* transaction type
* fiscal period
* agreement
* pricing method
* supporting references

LLMs do not merge transactions.

Rules do.

---

# Provenance

Every relationship stores provenance.

Example

```text
Provider

↓

Agreement

↓

Clause 2.1

↓

Agreement.pdf

↓

Page 4
```

Every edge is explainable.

---

# UI

## Transactions Dashboard

Displays

```text
27 Controlled Transactions

Management Services

Royalty

Distribution

Manufacturing

Loans

Guarantees
```

---

## Transaction Detail

Displays

```text
Summary

Relationships

Documents

Financials

Timeline

Evidence

Supporting Facts
```

---

## Evidence Explorer

Interactive graph

```text
Agreement

↓

Invoices

↓

Ledger

↓

Trial Balance

↓

Financial Statement
```

Every node clickable.

---

# Database

## transactions

Stores

* transaction_id
* type
* provider
* recipient
* period
* status

---

## transaction_relationships

Stores

* source_node
* target_node
* relationship
* provenance

---

## transaction_documents

Stores

* transaction
* document

---

## transaction_financials

Stores

* transaction
* invoice totals
* ledger totals
* financial summaries

---

# APIs

```text
POST /transactions/build

GET /transactions

GET /transactions/{id}

GET /transactions/{id}/graph

PATCH /transactions/{id}
```

---

# Success Metrics

* ≥95% of related evidence correctly grouped into the same transaction
* ≥90% automatic transaction identification accuracy
* 100% relationship provenance
* Zero duplicate transaction IDs for the same economic transaction
* Transaction graph generated incrementally after document ingestion
* Average graph construction time <30 seconds for 500 uploaded documents

---

# Future Enhancements

* Cross-year transaction continuity
* Automatic amendment detection
* ERP transaction synchronization
* Cross-jurisdiction transaction visualization
* Transaction lineage across multiple Local Files
* Economic substance visualization
* Multi-entity value chain mapping

---

# Acceptance Criteria

The feature is complete when:

1. Every controlled transaction receives a canonical Transaction ID.
2. Documents, facts, entities, and financial records are consolidated into a single transaction representation.
3. Every relationship is backed by deterministic provenance.
4. Duplicate transaction representations are merged automatically using rule-based logic.
5. The transaction graph is available for downstream features, including Requirement Matching, GraphRAG, Contradiction Detection, Draft Generation, and Risks.
6. Users can inspect any transaction and trace every relationship back to its originating evidence.
