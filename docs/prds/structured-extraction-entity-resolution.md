# PRD: Structured Extraction & Entity Resolution

## Status

**Priority:** P0

**Owner:** AI Platform

**Dependencies:**

* ✅ Document Classification & Source Validation

**Blocks:**

* Controlled Transaction Mapping
* Requirement Matching
* GraphRAG
* Contradiction Detection

---

# Overview

Structured Extraction & Entity Resolution transforms classified documents into structured, cited, canonical business facts.

Instead of storing documents as searchable text, Veritax converts them into a normalized evidence model that downstream agents can reason over.

Every extracted fact must have deterministic provenance.

The purpose of this feature is to answer:

* What facts exist inside this document?
* Which entities do they refer to?
* Which transaction do they belong to?
* Where exactly did this fact come from?

---

# Problem

Searching documents with embeddings alone is insufficient.

For example, a Service Agreement contains:

* Provider
* Recipient
* Services
* Pricing
* Effective Date
* Governing Law

Without extraction, downstream agents repeatedly ask the LLM to rediscover those facts.

This leads to:

* inconsistent outputs
* unnecessary token usage
* duplicated reasoning
* hallucinated values
* poor relationship building

Veritax needs facts—not paragraphs.

---

# Goals

The system should:

* extract structured facts from every supported document
* normalize those facts
* resolve entities into canonical records
* preserve complete provenance
* prepare data for transaction mapping

---

# Non-Goals

This feature does NOT:

* determine requirement coverage
* determine evidence sufficiency
* detect contradictions
* build transaction graphs
* draft documentation

---

# User Stories

### Upload Agreement

User uploads

```text
Intercompany Service Agreement.pdf
```

Veritax extracts

* Provider
* Recipient
* Pricing Method
* Markup
* Services
* Effective Date

without manual review.

---

### Entity Resolution

User uploads documents referring to

```text
ABC BV

ABC Netherlands BV

ABC Netherlands
```

Veritax resolves all three to the same canonical entity.

---

### Provenance

User clicks

```text
Markup = 5%
```

Veritax immediately opens

* document
* page
* clause
* highlighted text

---

# Functional Requirements

---

## 1. Schema-Based Extraction

Every document type has one or more extraction schemas.

Example

Service Agreement

↓

Agreement Schema

Pricing Schema

Entity Schema

Legal Schema

---

Annual Report

↓

Business Schema

Entity Schema

Financial Summary Schema

Related Party Schema

---

Trial Balance

↓

Financial Schema

Account Schema

Entity Schema

Schemas are independently versioned.

---

## 2. Structured Facts

Every extracted value becomes a fact.

Example

```json
{
  "fact_type": "pricing_method",
  "value": "Cost Plus",
  "entity": "Netherlands BV"
}
```

Another

```json
{
  "fact_type": "markup",
  "value": "5%"
}
```

Facts are atomic.

Never extract paragraphs.

---

## 3. Provenance

Every fact must include provenance.

Required

* source document
* page
* source quote
* location
* extraction model version

Example

```json
{
  "fact_type":"markup",
  "value":"5%",
  "document":"Agreement.pdf",
  "page":12,
  "locator":"Clause 6.2",
  "quote":"The service fee shall equal relevant costs plus five percent."
}
```

Facts without provenance are rejected.

---

## 4. Canonical Fact Types

Facts must come from controlled schemas.

Examples

Agreement

* provider
* recipient
* agreement type
* effective date
* expiry date

Pricing

* pricing method
* royalty rate
* markup
* payment terms

Financial

* revenue
* operating margin
* transaction amount

Business

* function
* asset
* risk

No free-form fact types.

---

## 5. Entity Resolution

Every entity reference resolves to a canonical entity.

Example

```text
ABC BV

ABC Netherlands BV

ABC Netherlands
```

↓

```text
Entity ID

entity_00024
```

All future references use the Entity ID.

---

## 6. Counterparty Resolution

Relationships are also normalized.

Example

```text
Provider

↓

ABC Switzerland AG

Recipient

↓

ABC Netherlands BV
```

Later documents reuse these entities.

---

## 7. Duplicate Resolution

When two documents produce identical facts

Veritax stores

multiple sources

instead of duplicate facts.

Example

```text
Royalty Rate

5%

Sources

Agreement

APA

Prior Local File
```

---

## 8. Fact Validation

Every extracted fact must pass validation.

Checks

* value exists
* source exists
* quote exists
* page exists
* required fields complete
* schema valid

Invalid facts never enter storage.

---

## 9. Extraction Status

Each document receives

```text
Pending

Extracted

Partially Extracted

Needs Review

Failed
```

---

# Extraction Pipeline

```text
Document

↓

Classifier

↓

Schema Selection

↓

LLM Extraction

↓

Validation

↓

Entity Resolution

↓

Fact Storage

↓

Ready for Transaction Mapping
```

---

# LLM Responsibilities

The LLM may

* identify facts
* populate schemas
* identify supporting quotes

The LLM may NOT

* invent facts
* assign confidence
* determine evidence sufficiency
* merge entities
* determine contradictions

---

# Deterministic Validation

Every fact passes

Document Exists

↓

Page Exists

↓

Quote Exists

↓

Value Present

↓

Schema Valid

↓

Accepted

Otherwise

↓

Rejected

---

# UI

## Document Viewer

Displays

Original Document

↓

Extracted Facts

↓

Source Quotes

↓

Highlighted Pages

---

## Fact Inspector

Example

```text
Markup

5%

Agreement.pdf

Page 12

Clause 6.2

Verified
```

Clicking opens the document.

---

## Entity Explorer

Displays

```text
Entity

ABC Netherlands BV

Aliases

ABC BV

ABC Netherlands

Related Documents

Relationships

Facts
```

---

# Database

## extracted_facts

Stores

* fact_id
* document_id
* schema
* fact_type
* value
* unit
* entity_id
* period
* created_at

---

## fact_sources

Stores

* fact_id
* document
* page
* locator
* quote

---

## canonical_entities

Stores

* entity_id
* legal_name
* aliases
* jurisdiction
* entity_type

---

## entity_aliases

Stores

* alias
* canonical_entity

---

# APIs

```text
POST /extract

GET /facts

GET /facts/{id}

GET /entities

GET /entities/{id}

PATCH /facts/{id}
```

---

# Success Metrics

* ≥95% required fields extracted for supported document types
* 100% of accepted facts include source document, page, and quote
* ≥95% entity resolution accuracy on known entities
* <10 seconds average extraction time per document (excluding OCR)
* Zero accepted facts without deterministic provenance
* Duplicate fact detection across documents with source aggregation

---

# Future Enhancements

* Table-specific extractors for complex financial schedules
* OCR confidence-aware extraction
* Jurisdiction-specific extraction schemas
* Multi-language extraction
* Human-assisted extraction review
* Continuous schema evolution through versioning

---

# Acceptance Criteria

The feature is complete when:

1. Every classified document is processed using the correct extraction schema.
2. Structured facts are produced instead of free-form summaries.
3. Every fact contains complete, verifiable provenance.
4. All entity references are resolved to canonical entities.
5. Duplicate facts are merged while preserving multiple supporting sources.
6. Only validated facts are persisted and made available to downstream features such as Controlled Transaction Mapping.
