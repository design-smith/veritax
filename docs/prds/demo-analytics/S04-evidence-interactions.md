# S04 — Evidence interactions (Planning sources + source previews)

**Type:** AFK

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Instrument evidence inspection. Per the resolved mapping, the `evidence` stage is the Planning tab, and the
inspection events fire on the Planning source rows/cards **and** the source-preview surfaces where extracted
evidence is actually examined (the Risks finding "Open" → document text + extracted facts; the Requirements
"where it's satisfied" panel). IDs/categories only — never content.

## Acceptance criteria
- [ ] `evidence_document_opened` fires when a document/source preview is opened, with `{ document_id, document_type, document_category }` (§10).
- [ ] `evidence_fact_inspected` (high-intent) fires when an extracted fact is inspected, with `{ fact_type, scope_level, document_type }` — no fact value (§10, §24).
- [ ] `evidence_source_viewed` (high-intent) fires when a source quote is viewed, with `{ document_type, fact_type, locator_type }` — no quote text (§10, §24).
- [ ] `evidence_filter_used` fires on a filter control with `{ filter_type, filter_value }` using controlled, non-sensitive values only (§10).
- [ ] No document content, quote text, or fact values appear in any payload (privacy test, §30).

## Blocked by
S03.

## Touch points
`components/steps/planning.tsx` (source rows/cards), `components/steps/risks.tsx` (source preview + facts), `components/steps/requirements.tsx` (evidence panel), `lib/analytics.ts`.
