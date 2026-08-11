# S02 — Analytics foundation: init + central module + common props + `demo_started`

**Type:** AFK  ·  **Tracer bullet** (env → module → one real event → verified)

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Install `posthog-js` and initialize it in a client provider scoped to the demo, env-gated and failure-safe,
with a debug mode. Turn on autocapture, session replay, and heatmaps/scrollmaps/clickmaps with input masking.
Build the **single** `analytics` module that owns event names, common properties, environment checks, and
error handling — nothing else in the app calls `posthog.capture` directly. Prove the whole path end-to-end by
firing `demo_started` once per `demo_run_id`.

## Acceptance criteria
- [ ] `posthog-js` initializes only when `NEXT_PUBLIC_POSTHOG_ENABLED` is set; otherwise it no-ops. All analytics calls are wrapped so failures are swallowed/logged and never block or break the demo (§4, §38).
- [ ] Autocapture, session replay, and heatmaps are enabled; **all inputs are masked** in replay (§18, §19, §30).
- [ ] A central `analytics` module is the only place that calls PostHog; it exposes typed helpers (`analytics.demoStarted(...)`, etc.) per §32/§33 naming (`snake_case`, past-tense).
- [ ] Every event carries the common properties: `demo_version` (mandatory), `product_surface="demo"`, `demo_run_id`, `stage`, `previous_stage`, acquisition (`entry_source`/`utm_*`/`referrer`/`lead_id`), `is_returning_visitor`, `viewport_category` (§8, §23, §31).
- [ ] `demo_run_id` is generated on entering/restarting the demo from the beginning — **not** when navigating between stages (§7).
- [ ] `demo_started` fires **exactly once** per `demo_run_id` and survives React rerenders (§9.1, §34).
- [ ] Debug mode (`NEXT_PUBLIC_ANALYTICS_DEBUG`) logs `[event]` + `[properties]` to the console in non-prod and sends nothing unless PostHog is explicitly enabled (§40).
- [ ] Anonymous visitor identity is the default; no new identity is created on stage changes (§5).
- [ ] Tests: `demo_started` fires once; the app operates normally with analytics disabled/unavailable; no PII in the payload (§39).

## Blocked by
S01 (for real-data verification; local dev works via debug mode).

## Touch points
`package.json`, a client `PostHogProvider` mounted for the demo (`app/demo/page.tsx` / `app/layout.tsx`), new `lib/analytics.ts`.
