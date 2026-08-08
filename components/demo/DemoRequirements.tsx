"use client"

// Static demo of the Requirements step — deterministic coverage view, prefilled for the Fusion (Qatar) file.
// Display-only: no api/auth. Statuses/evidence are illustrative and coherent with the drafted Local File.

import { RefreshCw } from "lucide-react"
import type { CSSProperties } from "react"

type Status = "present" | "partial" | "missing"

const STATUS_CFG: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  present: { label: "Present", bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", dot: "var(--green-400)" },
  partial: { label: "Partial", bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", dot: "var(--yellow-400)" },
  missing: { label: "Missing", bg: "var(--color-background-danger-soft)", text: "var(--color-text-danger-soft)", dot: "var(--red-400)" },
}

const KIND_CHIP: Record<string, { bg: string; text: string; label: string }> = {
  financials: { bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", label: "Financials" },
  agreements: { bg: "var(--color-background-info-soft)", text: "var(--color-text-info-soft)", label: "Agreements" },
  public: { bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", label: "Website" },
  interview: { bg: "var(--color-background-discovery-soft)", text: "var(--color-text-discovery-soft)", label: "Interview" },
}

interface Req { name: string; description: string; status: Status; sources: string[] }

const REQUIREMENTS: Req[] = [
  { name: "Management structure", description: "Local organisation chart and reporting lines of the entity.", status: "present", sources: ["interview", "financials"] },
  { name: "Business and strategy", description: "Description of the local business, strategy, and any restructurings.", status: "present", sources: ["interview", "public"] },
  { name: "Controlled transactions inventory", description: "Each material category of intercompany transaction and its context.", status: "present", sources: ["financials"] },
  { name: "Amounts by category and counterparty", description: "Intra-group payments and receipts per category and related party.", status: "present", sources: ["financials"] },
  { name: "Material intercompany agreements", description: "Executed agreements governing the controlled transactions.", status: "missing", sources: [] },
  { name: "Functional, asset and risk analysis", description: "Functions performed, assets used, and risks assumed by the entity.", status: "present", sources: ["interview", "financials"] },
  { name: "Method selection", description: "Most appropriate transfer pricing method and reasons for selecting it.", status: "present", sources: ["financials"] },
  { name: "Comparability and benchmarking", description: "Benchmarking study and the arm's-length range applied.", status: "present", sources: ["financials"] },
  { name: "Financial information and tie-out", description: "Annual accounts and reconciliation to the pricing analysis.", status: "present", sources: ["financials"] },
  { name: "Pricing terms of fund transfers", description: "Documented terms for the intercompany fund transfers.", status: "partial", sources: ["financials"] },
  { name: "Arm's-length conclusion", description: "Explanation of why the results support an arm's-length outcome.", status: "present", sources: ["financials"] },
]

function Donut({ present, partial, missing }: { present: number; partial: number; missing: number }) {
  const size = 52, stroke = 8, r = (size - stroke) / 2, C = 2 * Math.PI * r
  const total = present + partial + missing || 1
  const segs = [
    { n: present, color: "var(--green-400)" },
    { n: partial, color: "var(--yellow-400)" },
    { n: missing, color: "var(--red-400)" },
  ]
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      {segs.filter(s => s.n > 0).map((s, i) => {
        const dash = (s.n / total) * C
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} />
        acc += s.n / total
        return el
      })}
    </svg>
  )
}

export default function DemoRequirements() {
  const present = REQUIREMENTS.filter(r => r.status === "present").length
  const partial = REQUIREMENTS.filter(r => r.status === "partial").length
  const missing = REQUIREMENTS.filter(r => r.status === "missing").length
  const total = REQUIREMENTS.length
  const chip: CSSProperties = { padding: "2px 8px", borderRadius: "9999px", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", whiteSpace: "nowrap" }

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ padding: "1.5rem 3.5rem 3rem", maxWidth: 760 }}>
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.375rem" }}>
              <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: 0 }}>
                What does this file legally need to contain?
              </h1>
              <RefreshCw size={13} strokeWidth={1.5} style={{ color: "var(--color-text-tertiary)" }} />
            </div>
            <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>
              {present} of {total} covered
              <span style={{ color: "var(--color-text-danger-soft)" }}> · {partial + missing} need attention</span>
              <span style={{ color: "var(--color-text-tertiary)" }}> · Qatar</span>
            </p>
          </div>
          <Donut present={present} partial={partial} missing={missing} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {REQUIREMENTS.map((r, idx) => {
            const cfg = STATUS_CFG[r.status]
            return (
              <div key={r.name} style={{
                display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: "1rem",
                padding: "0.875rem 0.75rem", borderBottom: idx === total - 1 ? "none" : "1px solid var(--color-border)",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{r.name}</span>
                  </div>
                  <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0, paddingLeft: "1.1875rem", lineHeight: 1.5 }}>
                    {r.description}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem", paddingTop: "0.125rem" }}>
                  <span style={{ ...chip, background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                  {r.sources.length > 0 && (
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {r.sources.map(k => {
                        const c = KIND_CHIP[k]
                        return <span key={k} style={{ padding: "1px 6px", borderRadius: "var(--radius-xs)", fontSize: "10px", fontWeight: "var(--font-weight-medium)", background: c.bg, color: c.text }}>{c.label}</span>
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
