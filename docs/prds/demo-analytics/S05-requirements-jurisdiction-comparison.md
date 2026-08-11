# S05 — Requirements + jurisdiction comparison

**Type:** AFK

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Measure whether users investigate jurisdiction-specific intelligence, including the high-intent act of
comparing jurisdictions. Wired into the Requirements step (jurisdiction tabs, requirement rows, evidence
panel).

## Acceptance criteria
- [ ] `requirements_country_selected` fires when a jurisdiction tab is selected, with `{ country_code, previous_country_code }` (§11).
- [ ] `requirement_opened` fires when a requirement row is opened, with `{ country_code, requirement_category, requirement_status, criticality }` (§11).
- [ ] `requirement_evidence_opened` (high-intent) fires when a requirement's evidence is opened, with `{ country_code, requirement_category, requirement_status, document_type }` (§11, §24).
- [ ] `jurisdiction_comparison_used` (high-intent) fires when the user meaningfully inspects ≥2 jurisdictions within a `demo_run_id`, with `{ country_codes, country_count }` — fired on the comparison threshold, not on every tab click (§11, §24).
- [ ] Tests: country-selected event; comparison threshold logic (does not fire for a single jurisdiction).

## Blocked by
S03.

## Touch points
`components/steps/requirements.tsx`, `lib/analytics.ts`.
