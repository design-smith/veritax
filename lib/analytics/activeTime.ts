// Active-engagement time + scroll thresholds. Pure and injectable so the accounting logic is unit-tested
// without a DOM; the browser singleton (./index) wires real visibility/focus/scroll listeners to it.

export class ActiveTimer {
  private active = true
  private last: number
  private total = 0
  private stage: string | undefined
  private perStageMs: Record<string, number> = {}
  private perStageInteractions: Record<string, number> = {}

  constructor(private nowFn: () => number = () => Date.now()) {
    this.last = this.nowFn()
  }

  private flush() {
    const t = this.nowFn()
    if (this.active) {
      const d = t - this.last
      this.total += d
      if (this.stage) this.perStageMs[this.stage] = (this.perStageMs[this.stage] ?? 0) + d
    }
    this.last = t
  }

  /** Pause (tab hidden / blurred) or resume (visible + focused) accumulation. */
  setActive(a: boolean) { this.flush(); this.active = a }
  /** Switch which stage bucket subsequent active time accrues to. */
  setStage(s: string) { this.flush(); this.stage = s }
  /** Record one interaction against the current stage. */
  note() { if (this.stage) this.perStageInteractions[this.stage] = (this.perStageInteractions[this.stage] ?? 0) + 1 }

  totalMs() { this.flush(); return this.total }
  stageMs(s: string) { this.flush(); return this.perStageMs[s] ?? 0 }
  interactions(s: string) { return this.perStageInteractions[s] ?? 0 }
}

export const SCROLL_THRESHOLDS = [25, 50, 75, 90, 100]

/** Thresholds newly reached at `pct` given those already fired (so each fires once per stage per run). */
export function newlyCrossed(pct: number, fired: Set<number>): number[] {
  return SCROLL_THRESHOLDS.filter(t => pct >= t && !fired.has(t))
}
