import { describe, it, expect, vi } from "vitest"
import { createAnalytics, type AnalyticsConfig } from "./core"

function setup(over: Partial<AnalyticsConfig> = {}) {
  const captured: Array<[string, Record<string, unknown>]> = []
  const cfg: AnalyticsConfig = {
    capture: (e, p) => captured.push([e, p]),
    isEnabled: () => true,
    debug: () => false,
    commonProps: () => ({ demo_run_id: "run-1", demo_version: "v-test", product_surface: "demo" }),
    ...over,
  }
  return { captured, a: createAnalytics(cfg), cfg }
}

describe("analytics core", () => {
  it("merges common props into every event", () => {
    const { captured, a } = setup()
    a.capture("x", { foo: 1 })
    expect(captured).toHaveLength(1)
    expect(captured[0][0]).toBe("x")
    expect(captured[0][1]).toMatchObject({ foo: 1, demo_run_id: "run-1", demo_version: "v-test", product_surface: "demo" })
  })

  it("onceKey dedupes repeated captures", () => {
    const { captured, a } = setup()
    a.capture("y", {}, { onceKey: "k" })
    a.capture("y", {}, { onceKey: "k" })
    expect(captured).toHaveLength(1)
  })

  it("does not send when analytics is disabled", () => {
    const capture = vi.fn()
    const { a } = setup({ capture, isEnabled: () => false })
    a.capture("z")
    expect(capture).not.toHaveBeenCalled()
  })

  it("logs in debug mode even when disabled, without sending (PRD §40)", () => {
    const capture = vi.fn()
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const { a } = setup({ capture, isEnabled: () => false, debug: () => true })
    a.capture("z")
    expect(info).toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
    info.mockRestore()
  })

  it("swallows sink errors so analytics never breaks the app (PRD §38)", () => {
    const { a } = setup({ capture: () => { throw new Error("boom") } })
    expect(() => a.capture("x")).not.toThrow()
  })

  it("demo_started fires exactly once per demo_run_id with expected props (PRD §9.1, §34)", () => {
    const { captured, a } = setup()
    a.demoStarted({ entry_stage: "evidence" })
    a.demoStarted({ entry_stage: "evidence" })
    expect(captured).toHaveLength(1)
    expect(captured[0][0]).toBe("demo_started")
    expect(captured[0][1]).toMatchObject({ entry_stage: "evidence", demo_run_id: "run-1", demo_version: "v-test" })
  })

  it("payload carries only common + passed props — no PII is injected by the module (PRD §30, §39)", () => {
    const { captured, a } = setup()
    a.capture("evt", { document_type: "financials" })
    const keys = Object.keys(captured[0][1]).sort()
    expect(keys).toEqual(["demo_run_id", "demo_version", "document_type", "product_surface"].sort())
  })
})
