# S08 — Waitlist request-access backend + /signup wiring

**Type:** AFK

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Turn the currently UI-only `/signup` request-access page into a real submission: a public backend endpoint
that persists the request and returns an opaque `waitlist_user_id`, plus the frontend wiring. This exists so
S09 can `identify()` a waitlisted visitor by an internal id rather than by email. (Added because the waitlist
identity decision was "real backend endpoint.")

## Acceptance criteria
- [ ] `POST /waitlist` accepts `{ name, country, email, company }`, validates required fields, persists the request, and returns an **opaque** `waitlist_user_id` (e.g. `waitlist_<uuid>`). The email is never used as the id (§6).
- [ ] The endpoint is public (no auth) and reachable from the demo origin; the persisted record may include acquisition attribution (`lead_id`/`utm_*`) when supplied, but attribution is never placed in a URL with PII (§23).
- [ ] `/signup` submits to the endpoint on **Access**; on success it shows the existing waitlist success screen; on failure it shows a friendly error without losing the entered values.
- [ ] Backend test covers create + validation (missing fields rejected).

## Blocked by
None — independent backend/UI slice (can run in parallel with S02–S07).

## Touch points
`backend/app/routers/…` (new waitlist route + lightweight store/model), `app/signup/page.tsx`, `lib/api.ts` (client call).
