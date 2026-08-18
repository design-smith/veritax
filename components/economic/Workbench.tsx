"use client"

// Class 3 · S1 — Financial Workbench shell (design/shell slice).
// The in-Draft "Economic Analysis" surface (PRD §58): a five-step analysis nav (Financials / Segmentation /
// TNMM / Benchmark / Conclusion), a main area, and an evidence/calculations/warnings side panel. This slice is
// the SHELL only — zero backend, placeholder content per view. Later slices plug their real surfaces into
// `MAIN[view]` and the side panel; every override they add preserves original/new/reason/user/time (§56).

import { useState } from "react"
import { FileSpreadsheet, Layers, Calculator, BarChart3, Flag, Info } from "lucide-react"

export type WorkbenchView = "financials" | "segmentation" | "tnmm" | "benchmark" | "conclusion"

const NAV: { id: WorkbenchView; label: string; icon: typeof FileSpreadsheet }[] = [
  { id: "financials", label: "Financials", icon: FileSpreadsheet },
  { id: "segmentation", label: "Segmentation", icon: Layers },
  { id: "tnmm", label: "TNMM", icon: Calculator },
  { id: "benchmark", label: "Benchmark", icon: BarChart3 },
  { id: "conclusion", label: "Conclusion", icon: Flag },
]

// Placeholder copy per view — replaced as each slice lands (S2 Financials, S6 Segmentation, S10 TNMM, …).
const PLACEHOLDER: Record<WorkbenchView, { title: string; body: string }> = {
  financials: { title: "Financials", body: "Upload a trial balance, GL, or segmented P&L in Planning. The dataset, its source-linked rows, column mapping, and validation will appear here." },
  segmentation: { title: "Segmentation", body: "Isolate the financial result for a controlled transaction or business segment — direct account mapping, exclusions, and allocations, with a segmented P&L that drills to source." },
  tnmm: { title: "TNMM", body: "Select the tested party (from the FAR analysis) and a PLI, then Veritax computes the result deterministically from the reconciled segment." },
  benchmark: { title: "Benchmark", body: "Import a comparable set with its rejection log. The arm's-length range is computed with the jurisdiction's statistical method." },
  conclusion: { title: "Conclusion", body: "The tested result against the arm's-length range — within / below / above — and any illustrative transfer-pricing adjustment for your review." },
}

export default function EconomicWorkbench() {
  const [view, setView] = useState<WorkbenchView>("financials")
  const active = PLACEHOLDER[view]

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--color-background)" }}>
      {/* Analysis nav */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.875rem 3.5rem 0.75rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
        {NAV.map(({ id, label, icon: Icon }) => {
          const on = id === view
          return (
            <button key={id} type="button" onClick={() => setView(id)} style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem",
              padding: "0.3125rem 0.75rem", borderRadius: "9999px", border: "none", cursor: "pointer",
              background: on ? "var(--color-background-primary-solid)" : "var(--alpha-04)",
              color: on ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
              fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
              transition: "all var(--transition-duration-basic)",
            }}>
              <Icon size={13} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Body: main analysis area + evidence side panel */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "1.5rem 3.5rem" }}>
          <div style={{
            border: "1px dashed var(--color-border)", borderRadius: "var(--radius-lg, 0.75rem)",
            padding: "2.5rem 2rem", textAlign: "center", maxWidth: "38rem", margin: "0 auto",
          }}>
            <h2 style={{ margin: 0, fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>{active.title}</h2>
            <p style={{ margin: "0.625rem 0 0", fontSize: "var(--font-text-sm-size)", lineHeight: 1.5, color: "var(--color-text-secondary)" }}>{active.body}</p>
            <p style={{ margin: "1rem 0 0", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>Coming soon</p>
          </div>
        </div>

        <aside style={{ width: "18rem", flexShrink: 0, borderLeft: "1px solid var(--color-border-subtle)", padding: "1.25rem", overflow: "auto", background: "var(--color-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--color-text-secondary)" }}>
            <Info size={13} />
            <span style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Evidence &amp; calculations</span>
          </div>
          <p style={{ margin: "0.75rem 0 0", fontSize: "var(--font-text-xs-size)", lineHeight: 1.5, color: "var(--color-text-tertiary)" }}>
            Every figure will trace here to its source: dataset, segment, adjustment, PLI calculation, and comparable set. Warnings (unreconciled totals, stale benchmarks) surface in this panel.
          </p>
        </aside>
      </div>
    </div>
  )
}
