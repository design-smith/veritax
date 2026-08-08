# PRD: GraphRAG

## Status

**Priority:** P1

**Owner:** AI Platform

**Dependencies:**

* ✅ Document Classification & Source Validation, including the shared usable-source guard that excludes Out of Scope uploaded documents from graph ingestion
* ✅ Structured Extraction & Entity Resolution
* ✅ Controlled Transaction Mapping
* ✅ Requirement Matching & Evidence Sufficiency

**Blocks:**

* Contradiction Detection
* Advanced Draft Generation
* Advanced Review Agent
* Intelligent Search

---

# Overview

GraphRAG is Veritax's intelligent retrieval engine.

Unlike traditional RAG, which retrieves semantically similar chunks of text, GraphRAG retrieves **connected evidence** by traversing the relationships between entities, controlled transactions, agreements, financial records, requirements, and extracted facts.

GraphRAG never replaces semantic search.

It augments semantic retrieval with deterministic relationship traversal.

---

# Problem

Traditional RAG answers

> "Find me paragraphs about royalties."

Transfer Pricing requires answering

> "Show me every document supporting the royalty transaction between Netherlands BV and Switzerland AG during FY2025."

Those are fundamentally different problems.

Traditional vector retrieval cannot reliably reconstruct business relationships.

GraphRAG can.

---

# Goals

The system should:

* retrieve connected evidence instead of isolated documents
* understand relationships between tax artifacts
* provide deterministic evidence paths
* improve downstream agent reasoning
* reduce irrelevant retrieval
* enable explainable AI decisions

---

# Non-Goals

GraphRAG does NOT:

* extract facts
* classify documents
* evaluate evidence sufficiency
* detect contradictions
* generate Local Files

GraphRAG is a retrieval layer.

---

# User Stories

### Transaction Retrieval

User asks

> Show everything supporting the royalty transaction.

GraphRAG returns

```text id="trr1"
Royalty Transaction

↓

License Agreement

↓

Amendment

↓

Royalty Calculations

↓

Invoices

↓

Ledger

↓

Trial Balance

↓

Benchmark

↓

OECD Guidance
```

---

### Requirement Investigation

User asks

> Why is Method Selection incomplete?

GraphRAG returns

```text id="trr2"
Requirement

↓

Benchmark

✓

↓

TP Policy

Missing

↓

APA

Missing
```

---

### Draft Support

Draft Agent asks

> Generate FAR Analysis.

GraphRAG retrieves

* Functions
* Risks
* Assets
* Agreements
* Organization Structure
* Prior Local File
* Supporting Quotes

Not random document chunks.

---

# Functional Requirements

---

## 1. Hybrid Retrieval

Every query performs

Semantic Retrieval

*

Graph Traversal

Both result sets are merged.

Neither replaces the other.

---

## 2. Graph Nodes

The graph contains canonical nodes.

Examples

```text id="graph1"
Entity

Controlled Transaction

Requirement

Document

Extracted Fact

Agreement

Invoice

Ledger Entry

Benchmark

APA

Financial Statement

Draft Section

Risk
```

Only validated objects become nodes.

---

## 3. Graph Relationships

Examples

```text id="graph2"
Agreement

GOVERNS

Transaction
```

```text id="graph3"
Invoice

SUPPORTS

Transaction
```

```text id="graph4"
Fact

SUPPORTS

Requirement
```

```text id="graph5"
Requirement

USES

Evidence
```

```text id="graph6"
Entity

PARTICIPATES_IN

Transaction
```

Every edge contains provenance.

---

## 4. Traversal Engine

Queries begin from a starting node.

Example

```text id="graph7"
Transaction

↓

Agreement

↓

Invoices

↓

Ledger

↓

Trial Balance

↓

Facts

↓

Supporting Quotes
```

Traversal depth is configurable.

---

## 5. Hybrid Ranking

Returned evidence is ranked using

Relationship distance

*

Semantic similarity

*

Evidence strength

*

Scope match

Example

Agreement directly governing transaction

↓

Rank 1

Annual report mentioning royalties

↓

Much lower rank

---

## 6. Scope Filtering

Graph traversal automatically filters by

* entity
* fiscal year
* jurisdiction
* engagement
* transaction

No unrelated evidence should appear.

---

## 7. Source Provenance

Every retrieved object exposes

Document

↓

Page

↓

Quote

↓

Relationship Path

Example

```text id="graph8"
Transaction

↓

Agreement

↓

Clause 4.2

↓

Page 16
```

No hidden reasoning.

---

## 8. Query Types

Supported

Evidence Lookup

Requirement Lookup

Transaction Lookup

Entity Lookup

Agreement Lookup

Financial Lookup

Relationship Lookup

Document Lookup

Risk Lookup

---

## 9. Multi-Hop Retrieval

GraphRAG supports multiple hops.

Example

```text id="graph9"
Requirement

↓

Transaction

↓

Agreement

↓

Provider

↓

Invoices

↓

Ledger

↓

Financials

↓

Supporting Facts
```

The number of hops is configurable.

---

# Retrieval Pipeline

```text id="graph10"
User Query

↓

Intent Detection

↓

Determine Starting Nodes

↓

Graph Traversal

↓

Semantic Retrieval

↓

Merge Results

↓

Rank Results

↓

Return Context
```

---

# Ranking Strategy

Ranking is deterministic.

Factors

Relationship Distance

Evidence Strength

Entity Match

Fiscal Year Match

Jurisdiction Match

Requirement Match

Semantic Similarity

Recency

Document Status

LLMs do not assign ranking.

The retrieval engine does.

---

# Supported Consumers

GraphRAG serves

Requirement Engine

Draft Agent

Risk Engine

Contradiction Detection

Evidence Explorer

Future Copilot

---

# UI

## Evidence Explorer

Interactive graph

```text id="graph11"
Entity

↓

Transactions

↓

Documents

↓

Facts

↓

Requirements
```

Every node is clickable.

---

## Graph Inspector

Selecting a node displays

Relationships

Supporting Evidence

Connected Facts

Connected Requirements

Related Transactions

---

## Relationship Viewer

Displays

```text id="graph12"
Agreement

↓

Supports

↓

Royalty Transaction

↓

Supports

↓

Requirement

↓

Supports

↓

Draft Section
```

---

# Database

## graph_nodes

Stores

* node_id
* node_type
* canonical_id

---

## graph_edges

Stores

* source
* target
* relationship
* provenance

---

## graph_queries

Stores

* query
* retrieved nodes
* performance

---

# APIs

```text id="graph13"
POST /graph/query

GET /graph/node/{id}

GET /graph/path

GET /graph/transaction/{id}

GET /graph/entity/{id}
```

---

# Performance

Requirements

Support

100,000+

nodes

Millions of edges

Sub-second traversal

Incremental graph updates

No graph rebuild after every upload

---

# Success Metrics

* ≥95% of retrieved evidence belongs to the correct entity and engagement
* ≥95% reduction in unrelated retrieval compared with semantic search alone
* Relationship traversal completes in under 500 ms for common queries
* Every returned result includes a complete provenance path
* No graph node exists without originating from validated structured facts
* Graph updates are incremental and do not require full re-indexing

---

# Future Enhancements

* Cross-engagement similarity search
* Temporal graph visualization
* Automatic graph summarization
* Agent-specific retrieval profiles
* Knowledge graph analytics
* Workflow path optimization
* Cross-jurisdiction relationship discovery

---

# Acceptance Criteria

1. Every validated entity, transaction, document, fact, requirement, and financial artifact is represented as a graph node.
2. Relationships are built only from validated structured facts and always retain provenance.
3. Every retrieval combines semantic search with graph traversal.
4. Retrieved evidence is ranked deterministically using relationship and evidence metadata, not LLM judgment.
5. All downstream AI agents retrieve context exclusively through GraphRAG rather than directly querying embeddings.
6. Users can inspect the traversal path from any retrieved result back to its originating evidence.

---

## Design Principles

* **GraphRAG is infrastructure, not a user feature.**
* **The graph is built from validated facts—not directly from documents.**
* **Semantic search finds relevant text; the graph finds relevant relationships.**
* **Every retrieval must be explainable.**
* **The graph is a representation of the evidence model, not the source of truth.**
