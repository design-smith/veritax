# S03 — Stage lifecycle + active-time engine + scroll depth

**Type:** AFK

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Emit the demo/stage lifecycle using the canonical stage names (Planning→`evidence`, Requirements→
`requirements`, Draft→`local_file`, Risks→`risks`), track **active** engagement time (visibility/focus gated)
overall and per stage, and record scroll depth. Stage transitions must be clean enough that backtracking is
derivable without a dedicated event.

## Acceptance criteria
- [ ] Entering a tab fires `demo_stage_entered` once with `{ stage, previous_stage, demo_run_id }` using canonical names; component rerenders do not re-fire it (§9.2, §34).
- [ ] `demo_stage_completed` fires on each stage's explicit completion condition with `active_time_ms`, `elapsed_time_ms`, `interaction_count` (§9.3). Completion conditions are documented per stage.
- [ ] An active-time engine accumulates `active_demo_time_ms` and per-stage `{stage}_active_time_ms`, pausing when `document.visibilityState !== "visible"` or the tab is blurred; values ride on lifecycle events (no per-second events; optional lightweight heartbeat only if needed) (§16, §17).
- [ ] `stage_scroll_depth_reached` fires at 25/50/75/90/100%, once per threshold per stage per `demo_run_id` (§20).
- [ ] Backtracking (e.g. risks → requirements) is derivable from the `demo_stage_entered`/`previous_stage` sequence (§21).
- [ ] Tests: stage-entered dedupe on rerender; hidden/blurred time is excluded from active time.

## Blocked by
S02.

## Touch points
`app/page.tsx` (owns `step`/`page` state), a `useActiveTime` hook, `lib/analytics.ts`.
