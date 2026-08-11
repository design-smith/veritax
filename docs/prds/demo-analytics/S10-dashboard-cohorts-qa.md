# S10 — PostHog dashboard + funnels + cohorts + KPIs + end-to-end QA

**Type:** HITL

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Assemble the analysis surface in PostHog and validate the whole system against real demo sessions. This is
mostly done in the PostHog UI plus human review, hence HITL. No custom dashboard/replay/heatmap engine is
built in Veritax (§42).

## Acceptance criteria
- [ ] A dashboard named **`Veritax Demo`** exists with Traffic, Engagement, Funnel, Conversion, Content Engagement, and Friction sections (§26).
- [ ] The primary funnel is charted: `demo_started → evidence → requirements → local_file_generation_started → local_file_generation_completed → risks_viewed → access_veritax_cta_viewed → access_veritax_clicked → waitlist_completed` (§3, §26).
- [ ] Primary KPI (Access-Veritax click conversion among CTA viewers) and the Post-Risk conversion KPI are defined, plus the supporting KPIs (§27, §28).
- [ ] Behavioral session cohorts exist — Bounced / Browsed / Investigated / Completed / Converted / Waitlisted — derived from events, not manual (§29).
- [ ] Session replay, heatmaps, scrollmaps, and clickmaps verified on real sessions; a high-value session can be opened to its replay from its recording context (§18, §19, DoD 23).
- [ ] Privacy verified (inputs masked, no sensitive props), disabled-analytics verified (demo works with PostHog off), and idempotent events verified against duplicates (§30, §34, §41).
- [ ] Abandonment is analyzable from the event sequence / pageleave — no fragile `demo_abandoned` event (§37).

## Blocked by
S04, S05, S06, S07, S09 (events must exist), and S08 (waitlist funnel).

## Touch points
PostHog project UI (dashboard, funnels, cohorts); manual QA against `/demo`.
