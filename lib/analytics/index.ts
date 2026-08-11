// Browser singleton: binds the pure core (./core) to posthog-js, owns init + common properties.
// Nothing else in the app calls posthog.capture directly (PRD §32). Analytics is env-gated and never throws.

import posthog from "posthog-js"
import { createAnalytics } from "./core"
import { ActiveTimer, newlyCrossed } from "./activeTime"

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
const ENABLED = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true"
const DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true"

// Bump when the demo materially changes so historical analytics stay comparable (PRD §8).
export const DEMO_VERSION = "2026-08-v1"

// Only the public demo surfaces load analytics, so the dedicated demo project isn't polluted by the authed app.
const DEMO_SURFACES = ["/demo", "/signup"]
export const isDemoSurface = (path: string | null | undefined): boolean =>
  !!path && DEMO_SURFACES.some(s => path === s || path.startsWith(s + "/"))

// Current stage + active-engagement accounting (PRD §16, §17, §21).
const timer = new ActiveTimer()
let _stage: string | undefined
let _prevStage: string | undefined
let _stageEnteredAt = 0

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// demo_run_id: one traversal of the demo. Persisted for the tab session so it survives a reload and the
// /demo -> /signup navigation, keeping the funnel attributable to one run (PRD §7).
const RUN_KEY = "veritax.demoRunId"
export function getDemoRunId(): string {
  if (typeof window === "undefined") return "ssr"
  let id = window.sessionStorage.getItem(RUN_KEY)
  if (!id) { id = `demo_${uuid()}`; window.sessionStorage.setItem(RUN_KEY, id) }
  return id
}

// Evaluated once per load, before the "seen" flag is set, so it's stable for the whole run.
let _returning: boolean | null = null
function isReturningVisitor(): boolean {
  if (typeof window === "undefined") return false
  const seen = window.localStorage.getItem("veritax.demoSeen") === "1"
  if (!seen) window.localStorage.setItem("veritax.demoSeen", "1")
  return seen
}

function viewportCategory(): string {
  if (typeof window === "undefined") return "unknown"
  const w = window.innerWidth
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop"
}

// Acquisition attribution captured once from the entry URL / referrer (PRD §23).
let _attribution: Record<string, unknown> | null = null
function attribution(): Record<string, unknown> {
  if (_attribution) return _attribution
  if (typeof window === "undefined") return {}
  const q = new URLSearchParams(window.location.search)
  const utm: Record<string, string> = {}
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = q.get(k)
    if (v) utm[k] = v
  }
  _attribution = {
    ...utm,
    campaign: q.get("utm_campaign") ?? undefined,
    entry_source: q.get("utm_source") ?? (typeof document !== "undefined" && document.referrer ? "referral" : "direct"),
    lead_id: q.get("lead_id") ?? undefined,
    referrer: (typeof document !== "undefined" && document.referrer) || undefined,
  }
  return _attribution
}

function commonProps(): Record<string, unknown> {
  if (_returning === null) _returning = isReturningVisitor()
  return {
    demo_version: DEMO_VERSION,
    product_surface: "demo",
    demo_run_id: getDemoRunId(),
    stage: _stage,
    previous_stage: _prevStage,
    is_returning_visitor: _returning,
    viewport_category: viewportCategory(),
    ...attribution(),
  }
}

let initialized = false
export function initAnalytics(): void {
  if (initialized || typeof window === "undefined" || !ENABLED || !KEY) return
  initialized = true
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "identified_only",   // anonymous by default; identify only after waitlist (PRD §5, §6)
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    enable_heatmaps: true,                 // heatmaps / clickmaps / scrollmaps (PRD §19)
    session_recording: { maskAllInputs: true },  // mask anything the user types (PRD §30)
    loaded: ph => { if (DEBUG) ph.debug() },
  })
}

export const analytics = createAnalytics({
  // Ensure init before the first capture so event ordering vs the provider effect can't drop events.
  capture: (event, props) => { initAnalytics(); posthog.capture(event, props) },
  isEnabled: () => ENABLED,
  debug: () => DEBUG,
  commonProps,
})

// demo_started must fire once per demo_run_id even across reloads within the run, so guard it in
// sessionStorage (survives reload) on top of the core's in-memory dedupe (survives rerenders) (PRD §34).
// True the first time this (run, key) is seen; guards once-per-run events across reloads (PRD §34).
function firedOncePerRun(key: string): boolean {
  if (typeof window === "undefined") return false
  const k = `veritax.once:${getDemoRunId()}:${key}`
  if (window.sessionStorage.getItem(k)) return true
  window.sessionStorage.setItem(k, "1")
  return false
}

export function trackDemoStarted(entryStage = "evidence"): void {
  if (firedOncePerRun("demo_started")) return
  analytics.demoStarted({ entry_stage: entryStage })
}

// ── Stage lifecycle + active-time + scroll depth (PRD §9.2/§9.3, §16/§17, §20/§21) ──

const scrollFired: Record<string, Set<number>> = {}

function onScroll(e: Event): void {
  const el = e.target as HTMLElement | null
  if (!el || !el.scrollHeight || !_stage) return
  const max = el.scrollHeight - el.clientHeight
  if (max <= 40) return  // ignore non-scrollers / trivial overflow
  const pct = Math.min(100, (el.scrollTop / max) * 100)
  const fired = (scrollFired[_stage] ??= new Set())
  for (const t of newlyCrossed(pct, fired)) {
    fired.add(t)
    analytics.capture("stage_scroll_depth_reached", { stage: _stage, depth_percent: t })
  }
}

let engagementStarted = false
export function startEngagementTracking(): void {
  if (engagementStarted || typeof document === "undefined") return
  engagementStarted = true
  const sync = () => timer.setActive(document.visibilityState === "visible" && document.hasFocus())
  document.addEventListener("visibilitychange", sync)
  window.addEventListener("focus", sync)
  window.addEventListener("blur", sync)
  document.addEventListener("scroll", onScroll, true)  // capture phase: scroll does not bubble
  sync()
}

// Fire once per real stage transition (call site guards against rerenders; re-entry re-fires — backtracking).
export function stageEntered(stage: string): void {
  _prevStage = _stage
  _stage = stage
  _stageEnteredAt = Date.now()
  timer.setStage(stage)
  analytics.capture("demo_stage_entered", {})  // stage/previous_stage/demo_run_id come from common props
}

export function stageCompleted(stage: string): void {
  analytics.capture("demo_stage_completed", {
    stage,
    active_time_ms: timer.stageMs(stage),
    elapsed_time_ms: _stageEnteredAt ? Date.now() - _stageEnteredAt : 0,
    interaction_count: timer.interactions(stage),
  })
}

// ── Evidence interactions (PRD §10). Category props only — never document content (PRD §30). ──
export { documentType, documentCategory, scopeFilterValue } from "./events"

export function evidenceDocumentOpened(p: { document_id: string | null; document_type: string; document_category: string }): void {
  timer.note()
  analytics.capture("evidence_document_opened", p)
}
export function evidenceSourceViewed(p: { document_type: string; fact_type?: string; locator_type: string }): void {
  timer.note()
  analytics.capture("evidence_source_viewed", p)
}
export function evidenceFactInspected(p: { fact_type: string; scope_level: string; document_type: string }): void {
  timer.note()
  analytics.capture("evidence_fact_inspected", p)
}
export function evidenceFilterUsed(p: { filter_type: string; filter_value: string }): void {
  timer.note()
  analytics.capture("evidence_filter_used", p)
}

// ── Requirements + jurisdiction comparison (PRD §11) ──
export { trackJurisdictionComparison, type ComparisonState } from "./events"

export function requirementsCountrySelected(p: { country_code: string; previous_country_code: string }): void {
  timer.note()
  analytics.capture("requirements_country_selected", p)
}
export function requirementOpened(p: { country_code: string; requirement_category: string; requirement_status: string; criticality: string }): void {
  timer.note()
  analytics.capture("requirement_opened", p)
}
export function requirementEvidenceOpened(p: { country_code: string; requirement_category: string; requirement_status: string; document_type: string }): void {
  timer.note()
  analytics.capture("requirement_evidence_opened", p)
}
export function jurisdictionComparisonUsed(p: { country_codes: string[]; country_count: number }): void {
  timer.note()
  analytics.capture("jurisdiction_comparison_used", p)
}

// ── Local File generation + sections + citations (PRD §12) ──
export { sectionLifecycle, type DraftSectionLike } from "./events"

export function localFileGenerationStarted(): void {
  analytics.capture("local_file_generation_started", {})
}
export function localFileGenerationCompleted(p: { section_count: number; generation_duration_ms: number }): void {
  analytics.capture("local_file_generation_completed", p)
}
export function localFileSectionStarted(p: { section_key: string; section_index: number }): void {
  analytics.capture("local_file_section_started", p)
}
export function localFileSectionCompleted(p: { section_key: string; section_index: number; generation_duration_ms: number }): void {
  analytics.capture("local_file_section_completed", p)
}
export function localFileSectionViewed(p: { section_key: string; section_index: number }): void {
  timer.note()
  analytics.capture("local_file_section_viewed", p)
}
export function localFileCitationOpened(p: { section_key: string; citation_source_type: string }): void {
  timer.note()
  analytics.capture("local_file_citation_opened", p)
}

// ── Risks interactions (PRD §13) ──
export { riskProps, type RiskLike } from "./events"

export function risksViewed(): void {
  if (firedOncePerRun("risks_viewed")) return
  timer.note()
  analytics.capture("risks_viewed", {})
}
export function riskOpened(p: { risk_type: string; severity: string; risk_category: string }): void {
  timer.note()
  analytics.capture("risk_opened", p)
}
export function riskEvidenceOpened(p: { risk_type: string; severity: string; risk_category: string; evidence_type: string }): void {
  timer.note()
  analytics.capture("risk_evidence_opened", p)
}
export function riskRecommendationOpened(p: { risk_type: string; severity: string; risk_category: string }): void {
  timer.note()
  analytics.capture("risk_recommendation_opened", p)
}
