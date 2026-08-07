# Issues: Document Classification & Source Validation

Parent PRD: [document-classification-source-validation.md](document-classification-source-validation.md)

Ponytail constraint: keep this invisible unless a file is skipped. Do not build a Documents page, review queue, filters, badges, manual classification, or manual reclassification for this PRD.

---

## DCSV-01: Add Fiscal Year to Engagement Scope

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** Pre-Requirements Safety, Future Evidence Intelligence

### What to build

Add fiscal year as a first-class engagement field so source validation can compare uploaded files against entity, jurisdiction, and fiscal year.

### Acceptance criteria

- [ ] Engagements persist `fiscal_year`.
- [ ] Engagement read/update API supports `fiscal_year`.
- [ ] Planning UI lets the user enter fiscal year.
- [ ] Project rehydration restores fiscal year after refresh.
- [ ] Existing engagements without fiscal year continue to load.
- [ ] Backend and frontend validation covers fiscal-year persistence.

---

## DCSV-02: Make Ordinary Uploads Metadata-Only

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** Pre-Requirements Safety

### What to build

Change ordinary Planning uploads so they store bytes and metadata only. They should not extract text, embed chunks, or start downstream jobs until Requirements starts.

### Acceptance criteria

- [ ] Upload stores bytes, filename, MIME type, size, content hash, and status.
- [ ] Ordinary upload does not enqueue document indexing.
- [ ] Planning still shows uploaded document names after refresh.
- [ ] Supplements keep their targeted processing behavior.
- [ ] Tests prove ordinary uploads create no indexing jobs.

---

## DCSV-03: Start Stored Upload Processing from Requirements

**Type:** AFK

**Blocked by:** DCSV-02

**User stories covered:** Pre-Requirements Safety

### What to build

Move the automatic indexing trigger to Requirements startup so uploaded documents begin processing only when Requirements Matching is actually needed.

### Acceptance criteria

- [ ] Requirements startup queues processing for usable uploaded documents.
- [ ] Already-indexed documents are not reprocessed.
- [ ] Stale or failed upload states still use the existing recovery path.
- [ ] Requirements progress reflects document processing instead of blocking silently.
- [ ] Tests prove Requirements startup triggers indexing for stored uploads.

---

## DCSV-04: Add Versioned Evidence Taxonomy Registry

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** Future Evidence Intelligence

### What to build

Create the initial fixed Evidence Taxonomy used by classification. The classifier must select from this registry and cannot invent document types.

### Acceptance criteria

- [ ] A versioned taxonomy registry exists in the backend.
- [ ] Registry includes the initial PRD document types.
- [ ] Registry entries define allowed tags, deterministic signals, candidate extractors, candidate requirement categories, and optional scope rules.
- [ ] `Unknown` is an explicit supported document type.
- [ ] Tests prove invalid document types are rejected by classification code.

---

## DCSV-05: Persist Classification, Tags, and Scope Results

**Type:** AFK

**Blocked by:** DCSV-04

**User stories covered:** Future Evidence Intelligence

### What to build

Add persistence for document classification output, document tags, source scope checks, diagnostics, classifier version, and classified timestamp.

### Acceptance criteria

- [ ] Document classification records store type, score, state, relevance, candidates, signals, quotes, diagnostics, classifier version, and classified timestamp.
- [ ] Document tags are persisted and replaced safely on update.
- [ ] Document scope records store entity, jurisdiction, fiscal year, language, status, version, and validation checks.
- [ ] Deleting a document deletes its classification, tags, and scope records.
- [ ] Tests cover create, update, read, and cascade delete of stored classification results.

---

## DCSV-06: Add Scope Fingerprints for Reuse and Invalidation

**Type:** AFK

**Blocked by:** DCSV-01, DCSV-05

**User stories covered:** Pre-Requirements Safety, Future Evidence Intelligence

### What to build

Make classification results reusable only when the stored fingerprint still matches the document and engagement scope.

### Acceptance criteria

- [ ] Scope fingerprint includes document hash, entity, jurisdictions, fiscal year, and classifier version.
- [ ] Requirements startup reuses classification only when the fingerprint matches.
- [ ] Changing entity, jurisdiction, fiscal year, document hash, or classifier version invalidates prior classification.
- [ ] Missing fiscal year degrades fiscal-year validation to `Unknown` instead of blocking.
- [ ] Tests cover fingerprint reuse and invalidation.

---

## DCSV-07: Build PDF Preview Classification

**Type:** AFK

**Blocked by:** DCSV-04, DCSV-05

**User stories covered:** Pre-Requirements Safety

### What to build

Classify PDF uploads from a cheap preview before Requirements Matching starts.

### Acceptance criteria

- [ ] Preview uses filename, MIME type, size, and first page or first roughly 4,000 extracted characters.
- [ ] OCR preview is attempted only when normal preview text is empty or too thin.
- [ ] Obvious documents are classified by deterministic rules without LLM calls.
- [ ] Thin or unclear preview stores `Unknown` instead of failing Requirements.
- [ ] Tests cover Relevant, Partially Relevant, Unknown, and Out of Scope outcomes for PDF files.

---

## DCSV-08: Build Word Preview Classification

**Type:** AFK

**Blocked by:** DCSV-04, DCSV-05

**User stories covered:** Pre-Requirements Safety

### What to build

Classify DOCX and Word-like uploads from document metadata and a bounded text preview.

### Acceptance criteria

- [ ] Preview uses filename, MIME type, size, and the first roughly 4,000 extracted characters.
- [ ] Obvious agreements, policies, questionnaires, and narrative reports are classified by deterministic rules without LLM calls.
- [ ] Thin or unclear preview stores `Unknown` instead of failing Requirements.
- [ ] Large Word-like files are previewed without full-document classification work.
- [ ] Tests cover Relevant, Partially Relevant, Unknown, and Out of Scope outcomes for Word-like files.

---

## DCSV-09: Build CSV Preview Classification

**Type:** AFK

**Blocked by:** DCSV-04, DCSV-05

**User stories covered:** Pre-Requirements Safety

### What to build

Classify CSV uploads from shape and header previews instead of prose extraction.

### Acceptance criteria

- [ ] CSV preview includes delimiter, approximate shape, headers, and first rows.
- [ ] CSV previews can classify trial balances, general ledgers, invoice populations, segmented P&Ls, and `Unknown`.
- [ ] Large CSVs are previewed without loading the full file into parser output.
- [ ] Tests cover relevant, partial, unknown, and out-of-scope CSV paths.

---

## DCSV-10: Build Excel Preview Classification

**Type:** AFK

**Blocked by:** DCSV-04, DCSV-05

**User stories covered:** Pre-Requirements Safety

### What to build

Classify spreadsheet workbooks from workbook metadata and first-row previews.

### Acceptance criteria

- [ ] Excel preview includes sheet names, first rows, headers, and approximate dimensions.
- [ ] Excel previews can classify trial balances, general ledgers, invoice populations, segmented P&Ls, and `Unknown`.
- [ ] Large workbooks are previewed without full extraction.
- [ ] Tests cover relevant, partial, unknown, and out-of-scope Excel paths.

---

## DCSV-11: Wire Classification into Requirements Startup

**Type:** AFK

**Blocked by:** DCSV-03, DCSV-06, DCSV-07, DCSV-08, DCSV-09, DCSV-10

**User stories covered:** Pre-Requirements Safety

### What to build

Run classification automatically at the start of Requirements, immediately before Requirements Matching.

### Acceptance criteria

- [ ] Requirements startup classifies unclassified uploaded documents first.
- [ ] Requirements startup reruns classification when fingerprints are stale.
- [ ] Classification degradation to `Unknown` does not fail Requirements startup.
- [ ] No manual classify or reclassify endpoint is exposed to users.
- [ ] Tests prove classification happens before coverage assessment.

---

## DCSV-12: Add LLM Fallback for Ambiguous Classification

**Type:** AFK

**Blocked by:** DCSV-07, DCSV-08, DCSV-09, DCSV-10

**User stories covered:** Pre-Requirements Safety, Future Evidence Intelligence

### What to build

Use the LLM only when deterministic rules are inconclusive. Store observed signals and supporting quotes, then let deterministic scoring decide the final state.

### Acceptance criteria

- [ ] Deterministic classification runs before any LLM call.
- [ ] LLM prompt receives preview text, metadata, deterministic signals, engagement scope, and allowed taxonomy values.
- [ ] LLM output cannot introduce document types outside the taxonomy.
- [ ] Transient provider and malformed-output failures retry automatically.
- [ ] Persistent LLM failure stores diagnostics and degrades to `Unknown`.
- [ ] No user-facing error modal appears solely because LLM classification degraded.
- [ ] Tests cover LLM success, invalid taxonomy output, retry, and degradation.

---

## DCSV-13: Process Only Usable Documents Automatically

**Type:** AFK

**Blocked by:** DCSV-11

**User stories covered:** Pre-Requirements Safety

### What to build

After classification, process only Relevant, Partially Relevant, and Unknown uploaded documents for automatic Requirements Matching.

### Acceptance criteria

- [ ] Relevant documents are processed normally.
- [ ] Partially Relevant documents are processed and carry scope warnings internally.
- [ ] Unknown documents are processed as low-trust context.
- [ ] Out of Scope documents are stored but not extracted, embedded, or used for Requirements Matching.
- [ ] Tests prove Out of Scope files do not create chunks or enter coverage context.

---

## DCSV-14: Exclude Out-of-Scope Sources from Draft and Risks

**Type:** AFK

**Blocked by:** DCSV-13

**User stories covered:** Pre-Requirements Safety

### What to build

Prevent skipped Out of Scope documents from leaking into Draft retrieval and Risks.

### Acceptance criteria

- [ ] Draft retrieval excludes Out of Scope uploaded documents.
- [ ] Risks source retrieval excludes Out of Scope uploaded documents.
- [ ] Source filters do not exclude targeted supplements.
- [ ] Tests cover at least Draft and Risks exclusion.

---

## DCSV-15: Add GraphRAG Out-of-Scope Guard Contract

**Type:** AFK

**Blocked by:** DCSV-13

**User stories covered:** Pre-Requirements Safety, Future Evidence Intelligence

### What to build

Define the graph-ingestion guard so future GraphRAG work cannot ingest documents classified as Out of Scope.

### Acceptance criteria

- [ ] Shared source filter or service method exposes whether a source is usable for graph ingestion.
- [ ] Out of Scope uploaded documents are excluded by that filter.
- [ ] Targeted supplements remain eligible for their targeted requirement context.
- [ ] If no GraphRAG runtime exists yet, add the guard contract and tests around the shared filter instead of inventing a graph pipeline.
- [ ] Future GraphRAG PRD references this guard as a dependency.

---

## DCSV-16: Return Skipped File Reasons from Coverage API

**Type:** AFK

**Blocked by:** DCSV-13

**User stories covered:** Out-of-Scope Visibility

### What to build

Return compact skipped-file metadata from coverage reads so the frontend can explain why files were not used.

### Acceptance criteria

- [ ] Coverage response includes skipped Out of Scope documents.
- [ ] Each skipped document includes filename and a plain-language reason.
- [ ] Normal coverage responses include an empty skipped list.
- [ ] API does not expose full classification details in normal user payloads.
- [ ] Tests cover skipped and non-skipped coverage responses.

---

## DCSV-17: Show Requirements Skipped-Files Notice

**Type:** AFK

**Blocked by:** DCSV-16

**User stories covered:** Out-of-Scope Visibility

### What to build

Show a compact informational notice in Requirements only when files were skipped as Out of Scope.

### Acceptance criteria

- [ ] Requirements UI shows no classification output in the normal state.
- [ ] Requirements UI shows a compact skipped-files notice only when files were skipped.
- [ ] Notice lists filenames and reasons without exposing classifier internals.
- [ ] Notice is informational and does not block continuation.
- [ ] Frontend validation covers the skipped notice path.

---

## DCSV-18: Preserve Supplement Override for Skipped Files

**Type:** AFK

**Blocked by:** DCSV-13

**User stories covered:** Pre-Requirements Safety, Out-of-Scope Visibility

### What to build

Allow a user-supplied supplement to process for its targeted requirement even if the same file would otherwise be Out of Scope.

### Acceptance criteria

- [ ] Supplement upload bypasses automatic Out of Scope skipping for that targeted requirement.
- [ ] Supplement source remains tied to the requirement it was uploaded for.
- [ ] Supplement processing does not re-enable the skipped file globally.
- [ ] Tests prove skipped-file supplement override works.

---

## DCSV-19: Store Classification Diagnostics Without User Noise

**Type:** AFK

**Blocked by:** DCSV-05, DCSV-11

**User stories covered:** Future Evidence Intelligence

### What to build

Capture enough diagnostics to debug classification quality while keeping the feature invisible to users unless files are skipped.

### Acceptance criteria

- [ ] Classification stores deterministic signals, preview diagnostics, provider diagnostics when used, and final decision inputs.
- [ ] Classification logs include document id, classifier version, taxonomy version, state, relevance, and elapsed time.
- [ ] Classification failures degrade to stored `Unknown` with diagnostics.
- [ ] User-facing errors are not shown solely because classification degraded.
- [ ] Tests cover graceful degradation with stored diagnostics.
