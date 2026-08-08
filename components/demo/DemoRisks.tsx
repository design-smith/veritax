"use client"

// Static demo of the Risks step — findings register, prefilled for the Fusion (Qatar) file.
// Display-only: findings/evidence are illustrative and coherent with the drafted Local File. No api/auth.

import { useState } from "react"
import { Copy, Download, X } from "lucide-react"
import type { CSSProperties } from "react"

type Severity = "critical" | "high" | "medium" | "low"
type Kind = "exposure" | "discrepancy"

const SEVERITY_STYLE: Record<Severity, CSSProperties> = {
  critical: { background: "#000", color: "#fff" },
  high: { background: "#3f3f3f", color: "#fff" },
  medium: { background: "#dcdcdc", color: "#000" },
  low: { background: "#f2f2f2", color: "#666", border: "1px solid #e5e5e5" },
}
const KIND_LABEL: Record<Kind, string> = { discrepancy: "Contradiction", exposure: "Exposure" }
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

interface Evidence { kind: string; reference: string; detail: string; verified: boolean; source_label: string }
interface Finding {
  id: string; severity: Severity; kind: Kind; title: string; description: string
  exposureLabel: string; estimated: boolean; confidence: "high" | "medium" | "low"
  evidence: Evidence[]; recommendations: string[]
}

const FINDINGS: Finding[] = [
  {
    id: "f1", severity: "high", kind: "exposure",
    title: "Intercompany fund transfers lack loan documentation",
    description: "QAR 5.2m of related-party fund transfers were made interest-free with no loan agreements, repayment schedules, or terms. A tax authority may recharacterise these as financing and impute interest.",
    exposureLabel: "Imputed-interest / recharacterisation", estimated: true, confidence: "medium",
    evidence: [
      { kind: "section", reference: "Draft §3.1.1", detail: "No formal loan agreements were executed; no repayment schedules or interest were imposed.", verified: true, source_label: "Local File draft" },
      { kind: "figure", reference: "Transaction One total", detail: "TOTAL in QAR 5,235,268.87", verified: true, source_label: "FOS Trial Balance FY2024.xlsx" },
    ],
    recommendations: ["Execute intercompany loan or cash-pooling agreements with defined terms.", "Document the liquidity-management rationale and reciprocal nature contemporaneously."],
  },
  {
    id: "f2", severity: "high", kind: "discrepancy",
    title: "No signed intercompany agreements on file",
    description: "The file states there are no signed transfer pricing agreements between FOS and related entities, yet material controlled transactions occurred. This is a documentation gap the arm's-length analysis relies on.",
    exposureLabel: "Documentation gap", estimated: true, confidence: "high",
    evidence: [
      { kind: "section", reference: "Draft §3.2", detail: "There are no intra-group transfer pricing agreements signed between FOS and other related entities.", verified: true, source_label: "Local File draft" },
    ],
    recommendations: ["Put executed agreements in place for the recurring controlled transactions.", "Where none exist, deduce and document the terms from the parties' conduct."],
  },
  {
    id: "f3", severity: "medium", kind: "exposure",
    title: "Thin benchmarking set with negative-margin comparables",
    description: "The comparable set has only 4–5 observations and includes negative operating margins (1st quartile -0.5%, minimum -0.9%). A small, loss-making set weakens the reliability of the arm's-length range.",
    exposureLabel: "Benchmark reliability", estimated: true, confidence: "medium",
    evidence: [
      { kind: "figure", reference: "Benchmarking — Net Cost-Plus", detail: "Number of observations: 5, 5, 4, 5; minimum 3-year average -0.9%.", verified: true, source_label: "Benchmarking appendix" },
    ],
    recommendations: ["Broaden the search strategy and refresh the comparable set.", "Document rejection criteria and consider excluding persistent loss-makers."],
  },
  {
    id: "f4", severity: "low", kind: "exposure",
    title: "Tested margin sits below the benchmark median",
    description: "The tested operating margin of 3.25% is within the interquartile range (-0.5% to 11.7%) but well below the 7.3% median, leaving limited headroom on any downward adjustment.",
    exposureLabel: "3.25% vs 7.3% median", estimated: true, confidence: "low",
    evidence: [
      { kind: "section", reference: "Draft §3.4.2", detail: "The operating margin of 3.25% falls within the interquartile range.", verified: true, source_label: "Local File draft" },
    ],
    recommendations: ["Monitor the margin against the range annually.", "Retain the year-on-year comparison to explain any drift."],
  },
]

const PILL = (active: boolean): CSSProperties => ({
  height: 28, padding: "0 0.75rem", borderRadius: 9999, cursor: "pointer",
  border: active ? "1px solid #000" : "1px solid #e5e5e5", background: active ? "#000" : "#fff",
  color: active ? "#fff" : "#555", fontSize: 12, fontWeight: 500,
})
const TH: CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e5e5", whiteSpace: "nowrap" }
const TD: CSSProperties = { padding: "0.625rem 0.75rem", borderBottom: "1px solid #f0f0f0", verticalAlign: "middle" }
const chip = (extra: CSSProperties): CSSProperties => ({ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", ...extra })

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 0.125rem" }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 600, color: "#000", margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  )
}

export default function DemoRisks() {
  const [view, setView] = useState<"all" | Kind>("all")
  const [open, setOpen] = useState<Finding | null>(null)

  const visible = FINDINGS.filter(f => view === "all" || f.kind === view).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const exposure = FINDINGS.filter(f => f.kind === "exposure").length
  const contradictions = FINDINGS.filter(f => f.kind === "discrepancy").length
  const needAttention = FINDINGS.filter(f => f.severity === "critical" || f.severity === "high").length

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: "#fff", padding: "1rem 3rem 0.75rem", display: "flex", gap: "0.375rem" }}>
        <button type="button" style={PILL(true)}>Qatar</button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2rem 3rem", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: "#000", margin: 0 }}>Risks</h1>
            <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: 30, padding: "0 0.75rem", borderRadius: 6, border: "1px solid #e5e5e5", background: "#fff", color: "#000", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              <Download size={14} /> Export register
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
            <input readOnly placeholder="Search findings…" style={{ height: 28, width: 240, padding: "0 0.75rem", borderRadius: 9999, border: "1px solid #e5e5e5", background: "#fff", color: "#000", fontSize: 12, outline: "none" }} />
            {([["all", "All"], ["exposure", "Exposure"], ["discrepancy", "Contradictions"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setView(id)} style={PILL(view === id)}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", border: "1px solid #e5e5e5", borderRadius: 8, padding: "0.875rem 1.25rem", marginBottom: "1rem" }}>
            <Stat label="Findings" value={FINDINGS.length} />
            <div style={{ width: 1, height: 32, background: "#e5e5e5" }} />
            <Stat label="Exposure" value={exposure} />
            <div style={{ width: 1, height: 32, background: "#e5e5e5" }} />
            <Stat label="Contradictions" value={contradictions} />
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#888", margin: "0 0 0.125rem" }}>Need attention</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: "#000", margin: 0 }}>{needAttention}</p>
            </div>
          </div>

          <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 0.75rem" }}>
            Exposure figures are flagged estimates, not computed — verify against the record before acting.
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={TH}>Severity</th><th style={TH}>Kind</th><th style={TH}>Title</th><th style={TH}>Exposure</th><th style={TH}>Confidence</th></tr>
            </thead>
            <tbody>
              {visible.map(f => (
                <tr key={f.id} style={{ cursor: "pointer", background: open?.id === f.id ? "#f2f2f2" : "transparent" }} onClick={() => setOpen(f)}>
                  <td style={TD}><span style={chip({ ...SEVERITY_STYLE[f.severity], textTransform: "capitalize", fontWeight: 600 })}>{f.severity}</span></td>
                  <td style={TD}><span style={chip({ background: "#fff", color: "#555", border: "1px solid #e5e5e5" })}>{KIND_LABEL[f.kind]}</span></td>
                  <td style={{ ...TD, fontSize: 13, fontWeight: 500, color: "#000", maxWidth: 360 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</span>
                  </td>
                  <td style={{ ...TD, fontSize: 12, color: "#555", maxWidth: 220 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.exposureLabel}{f.estimated ? " (est.)" : ""}</span>
                  </td>
                  <td style={{ ...TD, fontSize: 12, color: "#888", textTransform: "capitalize" }}>{f.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>

        {open && (
          <aside style={{ width: 380, flexShrink: 0, borderLeft: "1px solid #e5e5e5", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", borderBottom: "1px solid #e5e5e5", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                <span style={chip({ ...SEVERITY_STYLE[open.severity], textTransform: "capitalize", fontWeight: 600 })}>{open.severity}</span>
                <span style={chip({ background: "#fff", color: "#555", border: "1px solid #e5e5e5" })}>{KIND_LABEL[open.kind]}</span>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(null)} style={{ display: "inline-flex", padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "#888" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#000", margin: "0 0 0.5rem" }}>{open.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#666", margin: 0 }}>{open.description}</p>
              </div>
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: 0 }}>Exposure</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#000" }}>{open.exposureLabel}</span>
                  {open.estimated && <span style={chip({ background: "#dcdcdc", color: "#000", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" })}>Estimated</span>}
                </div>
                <p style={{ fontSize: 11, color: "#aaa", margin: 0, textTransform: "capitalize" }}>{open.confidence} confidence</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: "0 0 0.25rem" }}>Evidence ({open.evidence.length})</p>
                {open.evidence.map((e, i) => (
                  <div key={i} style={{ border: "1px solid #e5e5e5", background: "#fafafa", borderRadius: 6, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#aaa", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.04em", marginRight: 6 }}>{e.kind}</span>{e.reference}
                      </span>
                      <span style={chip({ background: "#ecfdf3", color: "#027a48", border: "1px solid #e5e5e5" })}>Verified</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{e.source_label}</p>
                    <p style={{ fontSize: 12, fontStyle: "italic", color: "#888", margin: 0, lineHeight: 1.5 }}>&ldquo;{e.detail}&rdquo;</p>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: "0 0 0.25rem" }}>Your options</p>
                <ul style={{ margin: 0, padding: "0 0 0 1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {open.recommendations.map((r, i) => <li key={i} style={{ fontSize: 13, color: "#555", lineHeight: 1.55 }}>{r}</li>)}
                </ul>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
