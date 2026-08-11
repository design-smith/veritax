import { describe, it, expect } from "vitest"
import { ActiveTimer, newlyCrossed } from "./activeTime"

describe("ActiveTimer", () => {
  it("accumulates active time and excludes hidden/inactive periods (PRD §16)", () => {
    let t = 0
    const timer = new ActiveTimer(() => t)
    timer.setStage("evidence")
    t = 1000
    expect(timer.stageMs("evidence")).toBe(1000)
    timer.setActive(false)  // flush at 1000, then paused
    t = 5000                // 4s hidden — must be excluded
    timer.setActive(true)   // resume
    t = 6000                // +1s active
    expect(timer.stageMs("evidence")).toBe(2000)
    expect(timer.totalMs()).toBe(2000)
  })

  it("keeps per-stage buckets separate (PRD §17)", () => {
    let t = 0
    const timer = new ActiveTimer(() => t)
    timer.setStage("evidence"); t = 1000
    timer.setStage("requirements"); t = 3000
    expect(timer.stageMs("evidence")).toBe(1000)
    expect(timer.stageMs("requirements")).toBe(2000)
  })

  it("counts interactions against the current stage only", () => {
    const timer = new ActiveTimer(() => 0)
    timer.setStage("risks"); timer.note(); timer.note()
    expect(timer.interactions("risks")).toBe(2)
    expect(timer.interactions("evidence")).toBe(0)
  })
})

describe("newlyCrossed (scroll thresholds, PRD §20)", () => {
  it("returns only thresholds newly reached, once each", () => {
    const fired = new Set<number>()
    expect(newlyCrossed(30, fired)).toEqual([25])
    fired.add(25)
    expect(newlyCrossed(80, fired)).toEqual([50, 75])
    ;[50, 75].forEach(x => fired.add(x))
    expect(newlyCrossed(80, fired)).toEqual([])
    expect(newlyCrossed(100, fired)).toEqual([90, 100])
  })
})
