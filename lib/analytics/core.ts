// Pure, injectable analytics core — no PostHog, no DOM — so it is fully unit-testable.
// The browser singleton in ./index binds this to posthog-js. Everything routes through here so event
// names, common properties, gating, dedupe, debug logging, and error handling live in one place (PRD §32).

export type CaptureFn = (event: string, props: Record<string, unknown>) => void

export interface AnalyticsConfig {
  capture: CaptureFn
  isEnabled: () => boolean
  debug: () => boolean
  commonProps: () => Record<string, unknown>
}

export interface Analytics {
  /** Emit an event. Pass `onceKey` to guarantee it fires at most once for that key (idempotency, PRD §34). */
  capture: (event: string, props?: Record<string, unknown>, opts?: { onceKey?: string }) => void
  demoStarted: (p: { entry_stage: string }) => void
  /** Test/lifecycle helper: clear the in-memory once-guard. */
  resetOnce: () => void
}

export function createAnalytics(cfg: AnalyticsConfig): Analytics {
  const fired = new Set<string>()

  function capture(event: string, props: Record<string, unknown> = {}, opts?: { onceKey?: string }) {
    if (opts?.onceKey) {
      if (fired.has(opts.onceKey)) return
      fired.add(opts.onceKey)
    }
    const payload = { ...cfg.commonProps(), ...props }
    if (cfg.debug()) {
      console.info("[analytics]", event, payload)
    }
    if (!cfg.isEnabled()) return
    try {
      cfg.capture(event, payload)
    } catch {
      // Analytics must never break or block the demo (PRD §38).
    }
  }

  return {
    capture,
    demoStarted: ({ entry_stage }) => {
      const runId = String(cfg.commonProps().demo_run_id ?? "")
      capture("demo_started", { entry_stage }, { onceKey: `demo_started:${runId}` })
    },
    resetOnce: () => fired.clear(),
  }
}
