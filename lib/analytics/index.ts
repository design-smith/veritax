// Browser singleton: binds the pure core (./core) to posthog-js, owns init + common properties.
// Nothing else in the app calls posthog.capture directly (PRD §32). Analytics is env-gated and never throws.

import posthog from "posthog-js"
import { createAnalytics } from "./core"

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
  capture: (event, props) => posthog.capture(event, props),
  isEnabled: () => ENABLED && initialized,
  debug: () => DEBUG,
  commonProps,
})

// demo_started must fire once per demo_run_id even across reloads within the run, so guard it in
// sessionStorage (survives reload) on top of the core's in-memory dedupe (survives rerenders) (PRD §34).
export function trackDemoStarted(entryStage = "evidence"): void {
  if (typeof window !== "undefined") {
    const guard = `veritax.demoStarted:${getDemoRunId()}`
    if (window.sessionStorage.getItem(guard)) return
    window.sessionStorage.setItem(guard, "1")
  }
  analytics.demoStarted({ entry_stage: entryStage })
}
