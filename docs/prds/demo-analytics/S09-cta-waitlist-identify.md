# S09 — CTA exposure/click + waitlist analytics + `identify()`

**Type:** AFK

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Instrument the primary conversion: the "Access Veritax Live" CTA exposure and click, the waitlist funnel, and
the one place we upgrade from anonymous to identified — successful waitlist submission. CTA exposure must be
real visibility, never a below-the-fold impression.

## Acceptance criteria
- [ ] `access_veritax_cta_viewed` fires only when the CTA is ≥50% visible for a brief duration (IntersectionObserver) — never on Risks mount / below the fold — once per `demo_run_id`, with `{ demo_run_id, active_demo_time_ms }` (§14, §35).
- [ ] `access_veritax_clicked` (primary success event) fires exactly once per click, with `{ demo_run_id, active_demo_time_ms, elapsed_demo_time_ms }` (§14, §34).
- [ ] `waitlist_started` (form opened / first interaction) and `waitlist_completed` (successful submit) are distinct events; `waitlist_submission_failed` fires on error (§15).
- [ ] On `waitlist_completed`, `identify()` is called with the `waitlist_user_id` from S08 (not the email) plus person properties (`waitlist_status`, `first_demo_date`, `acquisition_source`, `campaign`) (§6).
- [ ] No form field contents are ever sent to analytics (privacy test, §15, §30).
- [ ] Tests: CTA event does not fire while below viewport; fires when truly exposed; click fires once; started/completed distinct.

## Blocked by
S03 (CTA lives in the Risks stage), S08 (provides `waitlist_user_id`).

## Touch points
`components/steps/risks.tsx` (CTA), `app/signup/page.tsx`, `lib/analytics.ts`.
