# S06 — Local File generation + sections + citations

**Type:** AFK

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Instrument the Local File (Draft tab) generation lifecycle, per-section engagement, and citation inspection —
one of the most important parts of the demo. Section "viewed" must use real viewport visibility, not
generated-but-unseen.

## Acceptance criteria
- [ ] `local_file_generation_started` fires once when generation begins; `local_file_generation_completed` fires once when it finishes, with `{ section_count, generation_duration_ms }` (§12, §34).
- [ ] Each section emits `local_file_section_started` and `local_file_section_completed` with `{ section_key, section_index, generation_duration_ms }` (§12).
- [ ] `local_file_section_viewed` fires only when a section is meaningfully in the viewport (IntersectionObserver), once per section per `demo_run_id` (§12, §36).
- [ ] `local_file_section_expanded` fires where a section can be expanded (if applicable) (§12).
- [ ] `local_file_citation_opened` (high-intent) fires on citation inspection, with `{ section_key, citation_source_type }` (§12, §24).
- [ ] Tests: generation start/complete fire once each; `section_viewed` does not fire for never-seen sections.

## Blocked by
S03.

## Touch points
`components/steps/draft.tsx` (generation lifecycle), `components/steps/DraftDocument.tsx` (sections + citations), `lib/analytics.ts`.
