# PRD: Contradiction Detection

## Status

**Priority:** P1

**Owner:** AI Platform

**Dependencies**

* ✅ Document Classification & Source Validation
* ✅ Structured Extraction & Entity Resolution
* ✅ Controlled Transaction Mapping
* ✅ Requirement Matching & Evidence Sufficiency
* ✅ GraphRAG

**Blocks**

* Draft Approval
* Final Local File Generation
* Audit Readiness
* Review Agent

---

# Overview

Contradiction Detection is Veritax's evidence consistency engine.

Its purpose is to continuously analyze all structured facts and relationships within an engagement to identify inconsistencies before they become compliance issues.

Unlike traditional document comparison, Veritax compares **validated facts** that have already been normalized and connected through the transaction graph.

The objective is not to determine which fact is correct.

The objective is to identify conflicts, explain them, and guide the user toward resolution.

---

# Problem

Large multinational tax engagements often contain hundreds of documents produced by different teams over several years.

Common inconsistencies include:

* agreements disagreeing with TP policies
* invoices disagreeing with agreements
* ledgers disagreeing with invoices
* benchmark reports using different tested parties
* amendments superseding agreements
* prior Local Files containing outdated assumptions

These inconsistencies are extremely difficult to identify manually.

Today they are often discovered only during:

* internal review
* Big Four review
* tax authority audit

Veritax should identify them immediately after evidence is ingested.

---

# Goals

The system should

* detect conflicting facts
* detect missing relationships
* detect outdated evidence
* explain every contradiction
* identify impacted requirements
* identify impacted draft sections
* recommend possible resolutions

---

# Non-Goals

This feature does NOT

* determine legal correctness
* automatically overwrite evidence
* change facts
* determine evidence sufficiency
* rewrite documentation

Only practitioners resolve contradictions.

---

# User Stories

### Agreement Conflict

User uploads

Agreement

↓

5% markup

Later uploads

TP Policy

↓

7% markup

Veritax immediately reports

```text id="c1"
Markup conflict detected

Agreement

5%

TP Policy

7%

Status

Open
```

---

### Wrong Counterparty

Agreement

↓

ABC Netherlands BV

Ledger

↓

ABC Germany GmbH

Veritax reports

```text id="c2"
Counterparty mismatch detected.
```

---

### Expired Agreement

Agreement

Expires

2024

Invoices continue through

2025

Veritax reports

```text id="c3"
Transaction continues after agreement expiry.
```

---

# Functional Requirements

---

## 1. Claim-Based Comparison

The engine compares structured facts.

Never raw documents.

Example

```text id="c4"
Fact

Markup

5%

↓

Compare

Markup

6%
```

Facts are grouped before comparison.

---

## 2. Comparison Scope

Facts are compared only when

* same transaction
* same entity pair
* same jurisdiction
* same fiscal period
* same fact type

This prevents false positives.

---

## 3. Supported Contradictions

Version 1 detects

### Pricing

Markup mismatch

Royalty mismatch

Interest rate mismatch

Pricing method mismatch

---

### Entity

Provider mismatch

Recipient mismatch

Counterparty mismatch

Ownership mismatch

---

### Financial

Ledger vs Invoice

Ledger vs Trial Balance

Trial Balance vs Financial Statements

Transaction Amount mismatch

Currency mismatch

---

### Agreement

Agreement expired

Missing amendment

Wrong governing law

Missing agreement

---

### Transfer Pricing

Method Selection mismatch

Tested Party mismatch

Benchmark mismatch

FAR mismatch

Risk allocation mismatch

---

### Timing

Effective Date mismatch

Period mismatch

Document version mismatch

---

# 4. Missing Relationship Detection

Graph traversal identifies broken chains.

Example

```text id="c5"
Royalty Transaction

↓

License Agreement

✓

↓

Invoices

✓

↓

Ledger

Missing
```

Veritax reports

Missing supporting financial evidence.

---

# 5. Dependency Analysis

Every contradiction records

Impacted

Requirements

↓

Draft Sections

↓

Risks

↓

Transactions

Users immediately know what is affected.

---

# 6. Severity Engine

Every contradiction receives a deterministic severity.

Levels

Critical

High

Medium

Low

Severity is rule-based.

Never LLM generated.

Example

Agreement missing

↓

Critical

Different wording

↓

Low

---

# 7. Resolution Workflow

Users may

Accept

Resolve

Ignore

Mark False Positive

Upload New Evidence

Replace Fact

Every action is audited.

---

# 8. Resolution History

Every contradiction stores

Opened

Resolved

Resolved By

Resolution Reason

Supporting Evidence

Timestamp

Nothing is deleted.

---

# Contradiction Pipeline

```text id="c6"
Validated Facts

↓

Group Comparable Facts

↓

Apply Comparison Rules

↓

Graph Validation

↓

Generate Contradictions

↓

Assign Severity

↓

Impact Analysis

↓

Store Results
```

---

# Deterministic Rules

Example

Agreement

5%

Policy

7%

↓

Critical

---

Ledger

€5,000,001

Invoice

€5,000,000

↓

Ignore

Tolerance rule.

---

Agreement

Expired

↓

Invoices continue

↓

Critical

No LLM reasoning required.

---

# Graph Usage

GraphRAG provides

Related facts

↓

Related transactions

↓

Related evidence

↓

Relationship paths

Contradiction Detection only analyzes those relationships.

It does not perform retrieval itself.

---

# UI

## Contradictions Dashboard

Displays

```text id="c7"
Critical

3

High

5

Medium

8

Low

14
```

---

## Contradiction Detail

Displays

Issue

↓

Supporting Facts

↓

Supporting Documents

↓

Relationship Path

↓

Impacted Requirements

↓

Suggested Resolution

---

## Transaction View

Every transaction displays

Healthy

↓

Warning

↓

Critical

Status.

---

## Draft Impact

Draft sections display

```text id="c8"
Method Selection

Blocked

Reason

Open contradiction.
```

---

# Database

## contradictions

Stores

* contradiction_id
* type
* severity
* transaction_id
* status

---

## contradiction_facts

Stores

* contradiction
* fact_a
* fact_b

---

## contradiction_impacts

Stores

* contradiction
* requirement
* draft_section
* transaction

---

## contradiction_history

Stores

* action
* user
* timestamp
* notes

---

# APIs

```text id="c9"
POST /contradictions/run

GET /contradictions

GET /contradictions/{id}

PATCH /contradictions/{id}

POST /contradictions/{id}/resolve
```

---

# Success Metrics

* ≥95% precision for deterministic contradiction rules
* Zero contradictions generated from unsupported or uncited facts
* 100% of contradictions traceable to source evidence
* Every contradiction linked to impacted requirements and draft sections
* Contradiction analysis completes in under 30 seconds for a standard engagement
* No Draft section marked complete while blocked by unresolved critical contradictions

---

# Future Enhancements

* AI-assisted contradiction explanations
* Cross-year contradiction detection
* Cross-engagement benchmarking
* Temporal change analysis
* Automatic amendment recommendations
* ERP reconciliation checks
* Jurisdiction-specific contradiction rules

---

# Acceptance Criteria

1. Only validated, cited facts participate in contradiction analysis.
2. Comparisons occur only within the correct transaction, entity, jurisdiction, and fiscal period.
3. Every contradiction is generated using deterministic comparison rules.
4. Every contradiction links directly to the underlying facts, documents, pages, and relationship path.
5. Every contradiction records its downstream impact on transactions, requirements, draft sections, and risks.
6. Users can resolve, dismiss, or explain contradictions without altering the original evidence.
7. Critical contradictions automatically block affected requirements and Draft generation until resolved.

---

# Design Principles

* **Facts are compared—not documents.**
* **The engine identifies conflicts; practitioners resolve them.**
* **Every contradiction must be reproducible from the same evidence.**
* **No contradiction is generated from an uncited fact.**
* **Every contradiction must explain why it exists and what parts of the engagement it affects.**
