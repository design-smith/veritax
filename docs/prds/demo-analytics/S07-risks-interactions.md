# S07 — Risks interactions

**Type:** AFK

## Parent
Veritax Demo Analytics & PostHog Instrumentation PRD (see README.md).

## What to build
Instrument the Risks stage — a major intent signal, since a user investigating detected problems is treating
Veritax as an intelligence/review product, not just an AI writer. Wired into the Risks step (findings table,
detail panel, evidence, recommendations). No risk narrative text in payloads.

## Acceptance criteria
- [ ] `risks_viewed` fires once per `demo_run_id` when the Risks experience becomes meaningfully visible — not merely on component mount (§13, §34).
- [ ] `risk_opened` fires when a finding is opened, with `{ risk_type, severity, risk_category }` (§13).
- [ ] `risk_evidence_opened` (high-intent) fires on evidence "Open", with `{ risk_type, severity, evidence_type }` (§13, §24).
- [ ] `risk_recommendation_opened` fires on recommendation inspection, with `{ risk_type, severity }` (§13).
- [ ] No risk narrative / exposure text appears in any payload (privacy test, §30).

## Blocked by
S03.

## Touch points
`components/steps/risks.tsx`, `lib/analytics.ts`.
