# Veritax Demo Analytics & PostHog — Issue Breakdown (parent)

Source: **PRD "Veritax Demo Analytics & PostHog Instrumentation"**.

## Goal

Not website analytics. The one question: **does experiencing the demo make a prospect want the real product?**
So we instrument the conversion funnel and the high-intent inspection behavior that predicts intent, measure
**active** (not elapsed) engagement, and turn on replay/heatmaps for qualitative review. North-star KPIs are
CTA-click conversion **among CTA viewers** and **among Risks reachers** — not traffic.

## Decisions (resolved with product)

- **Evidence stage = the Planning tab.** Canonical stage 1 is `evidence`; the `evidence_*` inspection events
  fire on the Planning source rows/cards and the source-preview surfaces in Risks/Requirements.
- **Dedicated PostHog project** for the public demo (separate from any future production project).
- **Real backend waitlist endpoint.** `/signup` POSTs to a backend endpoint that persists the request and
  returns an opaque `waitlist_user_id`, used for `identify()`.

## Canonical stage names

```
evidence · requirements · local_file · risks · access_veritax · waitlist
```

Demo tab → stage: Planning→`evidence`, Requirements→`requirements`, Draft→`local_file`, Risks→`risks`.

## Primary funnel

```
demo_started → demo_stage_entered(evidence) → demo_stage_entered(requirements)
→ local_file_generation_started → local_file_generation_completed → risks_viewed
→ access_veritax_cta_viewed → access_veritax_clicked → waitlist_started → waitlist_completed
```

## Slice index

| # | Title | Type | Blocked by |
|---|-------|------|-----------|
| S01 | Provision dedicated demo PostHog project + env/secrets | HITL | — |
| S02 | Analytics foundation: init + central module + common props + `demo_started` | AFK | S01 |
| S03 | Stage lifecycle + active-time engine + scroll depth | AFK | S02 |
| S04 | Evidence interactions (Planning sources + source previews) | AFK | S03 |
| S05 | Requirements + jurisdiction comparison | AFK | S03 |
| S06 | Local File generation + sections + citations | AFK | S03 |
| S07 | Risks interactions | AFK | S03 |
| S08 | Waitlist request-access backend + /signup wiring | AFK | — |
| S09 | CTA exposure/click + waitlist analytics + `identify()` | AFK | S03, S08 |
| S10 | PostHog dashboard + funnels + cohorts + KPIs + end-to-end QA | HITL | S04–S09 |

Per-slice tests (PRD §39) and privacy checks (§30) live inside each slice's acceptance criteria, so every
slice stays a true vertical. `demo_version`, `product_surface="demo"`, and acquisition/returning/viewport
common props are established in S02 and inherited by every later event. S04–S07 depend only on S03 and can be
built in parallel.
