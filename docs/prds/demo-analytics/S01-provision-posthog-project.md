# S01 — Provision dedicated demo PostHog project + env/secrets

**Type:** HITL

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Stand up a dedicated PostHog project for the public demo and make its configuration available to the app
through environment variables. Decide the project-level replay/masking and heatmap defaults. No app code
depends on this to compile, but real-data verification of every later slice does.

## Acceptance criteria
- [ ] A dedicated PostHog project exists for the demo, separate from any future production/enterprise project (PRD §31).
- [ ] `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_ENABLED`, `NEXT_PUBLIC_ANALYTICS_DEBUG` are documented in `.env.example`.
- [ ] Keys are set in Vercel (Production + Preview); analytics is disabled by default in local dev (§4, §40).
- [ ] Session replay input masking and heatmap/scroll/click collection are enabled at project level (§18, §19, §30).
- [ ] Data retention / project settings recorded in the README so the team knows the policy.

## Blocked by
None — can start immediately.
