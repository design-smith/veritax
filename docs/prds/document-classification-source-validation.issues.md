# Issues: Document Classification & Source Validation

Parent PRD: [document-classification-source-validation.md](document-classification-source-validation.md)

Ponytail constraint: do not build a Documents page, review queue, filters, manual classify action, or manual reclassification action for this PRD. Classification is internal infrastructure. The only user-visible surface is a skipped-files notice in Requirements.

---

## DCSV-01: Add Fiscal Year to Engagement Scope

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** Pre-Requirements Safety, Future Evidence Intelligence

### What to build

Add fiscal year as a first-class engagement field so source validation can compare uploaded files against entity, jurisdiction, and fiscal year.

### Acceptance criteria

- [ ] Engagements persist `fiscal_year`.
- [ ] Engagement create/read/update API supports `fiscal_year`.
- [ ] Planning UI lets the user enter fiscal year.
- [ ] Project rehydration restores fiscal year after refresh.
- [ ] Existing engagements without fiscal year continue to load.
- [ ] Backend and frontend tests cover fiscal-year persistence.

---

## DCSV-02: Stop Uploads from Full Indexing Immediately

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** Pre-Requirements Safety

### What to build

Change upload behavior so uploaded files are stored with metadata but not fully extracted, embedded, or sent into downstream work until Requirements starts.

### Acceptance criteria

- [ ] Upload stores bytes, filename, MIME type, size, hash, and status.
- [ ] Upload does not enqueue full document embedding by default.
- [ ] Planning still shows uploaded document names after refresh.
- [ ] Requirements remains responsible for starting document processing.
- [ ] Supplements keep their existing targeted processing behavior.
- [ ] Tests prove upload does not create embedding jobs for ordinary source uploads.

---

## DCSV-03: Add Versioned Evidence Taxonomy Registry

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** Future Evidence Intelligence

### What to build

Create the initial fixed Evidence Taxonomy used by classification. The classifier must select from this registry and cannot invent document types.

### Acceptance criteria

- [ ] A versioned taxonomy registry exists in the backend.
- [ ] Registry includes the initial PRD document types.
- [ ] Registry entries can define allowed tags, deterministic signals, candidate extractors, candidate requirement categories, and scope rules.
- [ ] Unknown is an explicit supported document type.
- [ ] Tests prove invalid document types are rejected by classification code.

---

## DCSV-04: Persist Document Classification and Scope Results

**Type:** AFK

**Blocked by:** DCSV-03

**User stories covered:** Future Evidence Intelligence

### What to build

Add persistence for classification output, tags, scope validation, diagnostics, classifier version, and scope fingerprint.

### Acceptance criteria

- [ ] Document classification records store document type, score, state, relevance, candidate requirements, candidate extractors, signals, quotes, diagnostics, classifier version, and classified timestamp.
- [ ] Document tags are persisted.
- [ ] Document scope records store entity, jurisdiction, fiscal year, language, status, version, and validation checks.
- [ ] Scope fingerprint includes document hash, engagement entity, jurisdictions, fiscal year, and classifier version.
- [ ] Deleting a document deletes its classification, tags, and scope records.
- [ ] Tests cover create/update/read of stored classification results.

---

## DCSV-05: Classify PDF and Word-Like Document Previews Before Requirements

**Type:** AFK

**Blocked by:** DCSV-01, DCSV-03, DCSV-04

**User stories covered:** Pre-Requirements Safety

### What to build

Before Requirements Matching starts, classify uploaded PDF/Word-like files using a cheap preview: filename, MIME type, size, first page or first roughly 4,000 characters, and OCR fallback only for thin preview text.

### Acceptance criteria

- [ ] Requirements startup runs classification before assessment.
- [ ] PDF/Word-like files are classified from preview text rather than full embedding.
- [ ] OCR preview is attempted only when normal preview text is empty or too thin.
- [ ] Obvious documents are classified by deterministic rules without LLM calls.
- [ ] Insufficient preview results in `Unknown`, not a failed Requirements run.
- [ ] Tests cover Relevant, Partially Relevant, Unknown, and Out of Scope outcomes for PDF-like inputs.

---

## DCSV-06: Classify Excel and CSV Previews Before Requirements

**Type:** AFK

**Blocked by:** DCSV-01, DCSV-03, DCSV-04

**User stories covered:** Pre-Requirements Safety

### What to build

Classify spreadsheet-style files using workbook/sheet/header previews instead of prose extraction.

### Acceptance criteria

- [ ] Excel preview includes sheet names, first rows, headers, and approximate dimensions.
- [ ] CSV preview includes delimiter/shape, headers, and first rows.
- [ ] Spreadsheet previews can classify trial balances, general ledgers, invoice populations, segmented P&Ls, and Unknown.
- [ ] Large spreadsheets are previewed without loading more data than needed.
- [ ] Tests cover Excel and CSV classification paths.

---

## DCSV-07: Rerun Classification When Scope Fingerprint Changes

**Type:** AFK

**Blocked by:** DCSV-01, DCSV-04, DCSV-05

**User stories covered:** Pre-Requirements Safety, Future Evidence Intelligence

### What to build

Make classification automatically rerun when engagement scope or classifier version changes.

### Acceptance criteria

- [ ] Requirements startup reuses classification results only when scope fingerprint matches.
- [ ] Changing entity, jurisdiction, fiscal year, document hash, or classifier version invalidates prior classification.
- [ ] Reruns happen automatically; there is no manual reclassify button.
- [ ] Missing fiscal year degrades fiscal-year validation to Unknown instead of blocking.
- [ ] Tests cover fingerprint reuse and invalidation.

---

## DCSV-08: Add LLM Fallback for Ambiguous Classifications

**Type:** AFK

**Blocked by:** DCSV-03, DCSV-04, DCSV-05, DCSV-06

**User stories covered:** Pre-Requirements Safety, Future Evidence Intelligence

### What to build

Use the LLM only when deterministic rules are inconclusive. Store observed signals and supporting quotes, then let the deterministic rule engine compute the final score/state.

### Acceptance criteria

- [ ] Deterministic classification runs before any LLM call.
- [ ] LLM prompt receives preview text, metadata, deterministic signals, engagement scope, and allowed taxonomy values.
- [ ] LLM output cannot introduce document types outside the taxonomy.
- [ ] Transient provider and malformed-output failures retry automatically.
- [ ] Persistent LLM failure stores diagnostics and degrades to `Unknown`.
- [ ] No user-facing error modal appears solely because LLM classification degraded.
- [ ] Tests cover LLM success, invalid taxonomy output, retry, and degradation.

---

## DCSV-09: Process Only Usable Documents for Requirements

**Type:** AFK

**Blocked by:** DCSV-05, DCSV-06

**User stories covered:** Pre-Requirements Safety

### What to build

After classification, process only Relevant, Partially Relevant, and Unknown uploaded documents for Requirements Matching. Skip Out of Scope files from automatic extraction, embedding, retrieval, Draft context, Risks, and GraphRAG.

### Acceptance criteria

- [ ] Relevant documents are processed normally.
- [ ] Partially Relevant documents are processed and carry scope warnings internally.
- [ ] Unknown documents are processed as low-trust context.
- [ ] Out of Scope documents are stored but not extracted, embedded, or used for Requirements Matching.
- [ ] Out of Scope documents remain available for later targeted supplement use.
- [ ] Tests prove Out of Scope files do not create chunks or enter coverage context.

---

## DCSV-10: Show Skipped Out-of-Scope Notice and Preserve Supplement Override

**Type:** AFK

**Blocked by:** DCSV-09

**User stories covered:** Out-of-Scope Visibility, Pre-Requirements Safety

### What to build

Expose skipped Out of Scope documents only when Requirements skipped them, and show a compact informational notice. Keep supplements as explicit targeted overrides.

### Acceptance criteria

- [ ] Coverage response includes skipped Out of Scope documents and reasons.
- [ ] Requirements UI shows no classification output in the normal state.
- [ ] Requirements UI shows a compact skipped-files notice only when files were skipped.
- [ ] The notice is informational and does not block continuation.
- [ ] Uploading a skipped file as a supplement processes it for the targeted requirement.
- [ ] Tests cover skipped-file API response, notice rendering, and supplement override behavior.
