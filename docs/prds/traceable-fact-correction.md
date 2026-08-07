# PRD: Traceable Fact Correction

## Status

**Priority:** P1

**Owner:** AI Platform

**Dependencies**

* ✅ Document Classification & Source Validation
* ✅ Structured Extraction & Entity Resolution
* ✅ Controlled Transaction Mapping
* ✅ Requirement Matching & Evidence Sufficiency
* ✅ GraphRAG
* ✅ Contradiction Detection

---

# Overview

Traceable Fact Correction enables practitioners to correct extracted facts without editing documents or generated text.

Instead of modifying paragraphs, users correct the underlying structured fact. Every downstream object that depends on that fact is automatically updated while preserving a complete audit trail.

This feature establishes a **single source of truth** for every extracted business fact.

---

# Problem

Today, corrections happen in documents.

For example

Agreement

↓

Markup extracted as **7%**

User edits Local File

↓

Changes text to **5%**

The Local File is now correct.

Everything else remains wrong.

* Transaction Graph
* Requirement Engine
* GraphRAG
* Contradiction Detection
* Future Drafts

Eventually different parts of the system disagree.

The correction must happen once, at the source.

---

# Goals

The system should

* allow users to correct extracted facts
* propagate corrections automatically
* preserve original extracted values
* maintain complete audit history
* trigger downstream recalculations
* never modify original documents

---

# Non-Goals

This feature does NOT

* edit PDFs
* overwrite source evidence
* resolve contradictions automatically
* modify uploaded files

Original evidence always remains immutable.

---

# User Stories

### Incorrect Extraction

Veritax extracts

```text id="tf1"
Markup

7%
```

User notices

Agreement clearly says

5%.

User edits

```text id="tf2"
7%

↓

5%
```

Every dependent feature updates.

---

### Wrong Entity

Invoice extracted

```text id="tf3"
ABC Germany GmbH
```

Should be

```text id="tf4"
ABC Netherlands BV
```

User corrects

↓

Transaction graph updates

↓

Requirement evaluation updates

↓

GraphRAG updates

↓

Draft updates

---

### Audit

Reviewer asks

Who changed this fact?

Veritax displays

Original

↓

Corrected

↓

User

↓

Reason

↓

Timestamp

↓

Supporting Evidence

---

# Functional Requirements

---

## 1. Fact Editing

Users may edit

* extracted value
* entity mapping
* transaction assignment
* dates
* document relationships
* metadata

Original extraction remains preserved.

---

## 2. Immutable Original

Every fact contains

Original Value

↓

Current Value

Original extraction is never deleted.

---

## 3. Correction Record

Every correction stores

* corrected field
* previous value
* new value
* reason
* user
* timestamp

Example

```text id="tf5"
Markup

Original

7%

Current

5%

Reason

OCR misread

Corrected By

John Smith

Date

2026-08-06
```

---

## 4. Dependency Tracking

Every fact knows

what depends on it.

Example

```text id="tf6"
Markup

↓

Transaction

↓

Requirement

↓

Draft

↓

Risk

↓

Graph
```

---

## 5. Automatic Propagation

After correction

Automatically update

Transaction Graph

↓

Requirement Evaluation

↓

GraphRAG

↓

Contradiction Detection

↓

Draft

↓

Risks

No manual refresh.

---

## 6. Revalidation

Every correction triggers

Validation

↓

Relationship Check

↓

Dependency Update

↓

Graph Update

↓

Requirement Re-evaluation

↓

Contradiction Re-run

---

## 7. Version History

Facts maintain versions.

Example

```text id="tf7"
Version 1

Extracted

7%

↓

Version 2

Reviewed

5%

↓

Version 3

Updated

6%

Reason

Contract Amendment
```

Nothing is deleted.

---

## 8. Correction Status

Facts receive

```text id="tf8"
Extracted

Reviewed

Corrected

Verified

Superseded
```

---

## 9. Source Integrity

Corrections never alter

Original PDF

Original OCR

Original Source Quote

Those remain immutable.

---

## 10. Correction Suggestions

When a contradiction exists

Veritax may suggest

Possible correction targets

but never edits automatically.

---

# Update Pipeline

```text id="tf9"
User Correction

↓

Validate

↓

Save New Version

↓

Update Fact

↓

Update Relationships

↓

Update Graph

↓

Re-evaluate Requirements

↓

Re-run Contradictions

↓

Update Draft

↓

Notify User
```

---

# Graph Updates

Graph nodes remain stable.

Only properties change.

Example

```text id="tf10"
Royalty Rate

5%

↓

6%
```

Relationships remain intact.

No graph rebuild.

---

# UI

## Fact Inspector

Displays

```text id="tf11"
Markup

Current

5%

Original

7%

Status

Corrected

Version

2
```

---

## Correction Dialog

Fields

Current Value

↓

New Value

↓

Reason

↓

Supporting Notes

↓

Save

---

## History Panel

Displays

```text id="tf12"
Version 1

Extracted

↓

Version 2

Corrected

↓

Version 3

Verified
```

---

## Dependency Viewer

Displays

```text id="tf13"
Changing this fact will affect

Transaction

Requirement

Draft

Contradictions

Risks
```

---

# Database

## facts

Stores

* fact_id
* original_value
* current_value
* version
* status

---

## fact_versions

Stores

* version
* previous
* current
* user
* timestamp
* reason

---

## fact_dependencies

Stores

* fact
* dependent_object
* dependency_type

---

## correction_log

Stores

* correction
* user
* notes

---

# APIs

```text id="tf14"
PATCH /facts/{id}

GET /facts/{id}/history

GET /facts/{id}/dependencies

POST /facts/{id}/revalidate
```

---

# Success Metrics

* 100% of corrections preserve the original extracted value
* 100% of downstream dependencies update automatically
* Every correction is fully auditable
* No manual graph rebuild required after a correction
* Requirement re-evaluation completes automatically after a correction
* Zero loss of provenance during fact updates

---

# Future Enhancements

* Multi-user review workflows
* Approval before publishing corrections
* Bulk fact correction
* AI-assisted correction suggestions
* Reviewer assignment
* Jurisdiction-specific approval chains
* Collaborative review sessions

---

# Acceptance Criteria

1. Users can edit any validated fact without modifying the original document.
2. Every correction creates a new immutable version rather than overwriting history.
3. All downstream dependencies are recalculated automatically after a correction.
4. Original extraction, source document, page, and quote remain permanently preserved.
5. Every correction is attributable to a user, timestamp, and reason.
6. The transaction graph, requirements, GraphRAG, contradiction engine, draft, and risks all reflect the corrected fact after propagation.
7. The complete history of every fact can be viewed and restored for audit purposes.

---

# Design Principles

* **Facts are editable; documents are immutable.**
* **Corrections create new versions, not replacements.**
* **One corrected fact updates the entire platform.**
* **Every correction must be explainable and auditable.**
* **The original extraction is never lost.**
