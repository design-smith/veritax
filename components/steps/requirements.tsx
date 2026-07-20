"use client"

import { useState } from "react"
import { Upload, Plug, Check } from "lucide-react"
import type { SourceId } from "./planning"

type Coverage = "satisfied" | "partial" | "missing"

interface Requirement {
  id: string
  name: string
  description: string
  getCoverage: (s: Set<SourceId>) => Coverage
  getSources: (s: Set<SourceId>) => SourceId[]
}

const ALL: Requirement[] = [
  {
    id: "entity-overview", name: "Local Entity Overview",
    description: "Description of the entity, its history, organizational structure, and ownership chain",
    getCoverage: s => s.has("interview") ? "satisfied" : s.has("public") ? "partial" : "missing",
    getSources: s => (["interview","public"] as SourceId[]).filter(x => s.has(x)),
  },
  {
    id: "management-structure", name: "Management Structure",
    description: "Reporting lines, key management personnel, and decision-making authority within the entity",
    getCoverage: s => s.has("interview") ? "satisfied" : "missing",
    getSources: s => s.has("interview") ? ["interview"] : [],
  },
  {
    id: "business-description", name: "Business Description",
    description: "Business activities, products and services, competitive strategy, and market position",
    getCoverage: s => (s.has("interview") && s.has("public")) ? "satisfied" : (s.has("interview") || s.has("public")) ? "partial" : "missing",
    getSources: s => (["interview","public"] as SourceId[]).filter(x => s.has(x)),
  },
  {
    id: "industry-analysis", name: "Industry Analysis",
    description: "Industry context, market trends, key competitive factors, and macroeconomic conditions",
    getCoverage: s => s.has("public") ? "satisfied" : "missing",
    getSources: s => s.has("public") ? ["public"] : [],
  },
  {
    id: "key-competitors", name: "Key Competitors",
    description: "Identification of principal competitors, their products, and competitive dynamics",
    getCoverage: s => s.has("public") ? "satisfied" : "missing",
    getSources: s => s.has("public") ? ["public"] : [],
  },
  {
    id: "controlled-transactions", name: "Controlled Transactions",
    description: "Comprehensive schedule of all intercompany transactions with related group entities",
    getCoverage: s => s.has("agreements") ? "satisfied" : "missing",
    getSources: s => s.has("agreements") ? ["agreements"] : [],
  },
  {
    id: "far-analysis", name: "Functional Analysis (FAR)",
    description: "Detailed analysis of functions performed, risks assumed, and assets employed",
    getCoverage: s => (s.has("interview") && s.has("agreements")) ? "satisfied" : (s.has("interview") || s.has("agreements")) ? "partial" : "missing",
    getSources: s => (["interview","agreements"] as SourceId[]).filter(x => s.has(x)),
  },
  {
    id: "tp-method", name: "Transfer Pricing Method",
    description: "Selected method for each transaction type and documented rationale for rejection of alternatives",
    getCoverage: s => (s.has("agreements") && s.has("interview")) ? "satisfied" : s.has("agreements") ? "partial" : "missing",
    getSources: s => (["agreements","interview"] as SourceId[]).filter(x => s.has(x)),
  },
  {
    id: "comparable-analysis", name: "Comparable Analysis",
    description: "Identification of comparable uncontrolled transactions or independent companies as benchmarks",
    getCoverage: s => s.has("public") ? "partial" : "missing",
    getSources: s => s.has("public") ? ["public"] : [],
  },
  {
    id: "economic-analysis", name: "Economic Analysis",
    description: "Application of the selected TP method and calculation of the arm's length range",
    getCoverage: s => (s.has("financials") && s.has("agreements")) ? "satisfied" : (s.has("financials") || s.has("agreements")) ? "partial" : "missing",
    getSources: s => (["financials","agreements"] as SourceId[]).filter(x => s.has(x)),
  },
  {
    id: "alp-result", name: "Arm's Length Result",
    description: "Demonstration that the tested party's results fall within the arm's length range",
    getCoverage: s => (s.has("financials") && s.has("agreements")) ? "satisfied" : s.has("financials") ? "partial" : "missing",
    getSources: s => (["financials","agreements"] as SourceId[]).filter(x => s.has(x)),
  },
  {
    id: "financial-info", name: "Financial Information",
    description: "Audited or reviewed financial statements, P&L, and segment data for the tested period",
    getCoverage: s => s.has("financials") ? "satisfied" : "missing",
    getSources: s => s.has("financials") ? ["financials"] : [],
  },
  {
    id: "related-party", name: "Related Party Relationships",
    description: "Overview of the group structure and all significant relationships with related parties",
    getCoverage: s => s.has("agreements") ? "satisfied" : "missing",
    getSources: s => s.has("agreements") ? ["agreements"] : [],
  },
  {
    id: "ic-agreements", name: "Intercompany Agreements",
    description: "Copies of or references to agreements governing the tested intercompany transactions",
    getCoverage: s => s.has("agreements") ? "satisfied" : "missing",
    getSources: s => s.has("agreements") ? ["agreements"] : [],
  },
  {
    id: "restructuring", name: "Business Restructurings",
    description: "Description of restructuring events that materially affected the entity during the tested period",
    getCoverage: s => (s.has("agreements") && s.has("interview")) ? "satisfied" : s.has("agreements") ? "partial" : "missing",
    getSources: s => (["agreements","interview"] as SourceId[]).filter(x => s.has(x)),
  },
  {
    id: "apa", name: "Advance Pricing Agreements",
    description: "Existing APAs, tax rulings, or competent authority agreements applicable to the entity",
    getCoverage: s => s.has("agreements") ? "partial" : "missing",
    getSources: s => s.has("agreements") ? ["agreements"] : [],
  },
  {
    id: "financial-transactions", name: "Financial Transactions",
    description: "Analysis of intercompany financing arrangements, guarantees, and cash pooling if applicable",
    getCoverage: s => (s.has("financials") && s.has("agreements")) ? "satisfied" : (s.has("financials") || s.has("agreements")) ? "partial" : "missing",
    getSources: s => (["financials","agreements"] as SourceId[]).filter(x => s.has(x)),
  },
  {
    id: "appendices", name: "Supporting Appendices",
    description: "Organization charts, financial schedules, transaction summaries, and supporting data tables",
    getCoverage: s => (s.has("financials") && s.has("agreements")) ? "satisfied" : s.has("financials") ? "partial" : "missing",
    getSources: s => (["financials","agreements"] as SourceId[]).filter(x => s.has(x)),
  },
]

const COVERAGE_CFG = {
  satisfied: { label: "Satisfied", bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", dot: "var(--green-400)" },
  partial:   { label: "Partial",   bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", dot: "var(--yellow-400)" },
  missing:   { label: "Missing",   bg: "var(--color-background-danger-soft)",  text: "var(--color-text-danger-soft)",  dot: "var(--red-400)" },
}

const SOURCE_CHIP_CFG: Record<SourceId, { bg: string; text: string; label: string }> = {
  financials: { bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", label: "Financials" },
  agreements: { bg: "var(--color-background-info-soft)",    text: "var(--color-text-info-soft)",    label: "Agreements" },
  public:     { bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", label: "Website" },
  interview:  { bg: "var(--color-background-discovery-soft)", text: "var(--color-text-discovery-soft)", label: "Interview" },
}

// What each source contributes toward a requirement — shown in the detail panel
const SOURCE_PROVIDES: Record<SourceId, string> = {
  financials: "Financial statements, P&L, and segment data uploaded in planning.",
  agreements: "Intercompany agreements, prior files, and questionnaires uploaded in planning.",
  public:     "Website and public information gathered by the tool.",
  interview:  "The functional interview transcript attached in planning.",
}

function CoverageDonut({ satisfied, partial, missing, total, active, onToggle, size = 52 }: {
  satisfied: number; partial: number; missing: number; total: number
  active: Set<Coverage>; onToggle: (c: Coverage) => void; size?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const stroke = Math.max(6, Math.round(size * 0.16))
  const pad = Math.max(2, Math.round(size * 0.04))
  const r = (size - stroke - pad * 2) / 2
  const C = 2 * Math.PI * r
  const bump = Math.max(3, Math.round(stroke * 0.4))
  const allSegs: { key: Coverage; label: string; count: number; color: string }[] = [
    { key: "satisfied", label: "Satisfied", count: satisfied, color: "var(--green-400)" },
    { key: "partial",   label: "Partial",   count: partial,   color: "var(--yellow-400)" },
    { key: "missing",   label: "Missing",   count: missing,   color: "var(--red-400)" },
  ]
  const segs = allSegs.filter(s => s.count > 0)

  let acc = 0
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        {segs.map((s, i) => {
          const f = s.count / total
          const dash = f * C
          const offset = -acc * C
          acc += f
          const on = active.has(s.key)
          const dim = active.size > 0 && !on
          const enlarged = on || hover === i
          return (
            <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={dim ? "var(--gray-200)" : s.color}
              strokeWidth={enlarged ? stroke + bump : stroke}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              onClick={() => onToggle(s.key)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer", transition: "stroke-width 150ms ease, stroke 150ms ease" }}
            />
          )
        })}
      </svg>
      {/* Hover toast */}
      {hover !== null && segs[hover] && (
        <div style={{ position: "absolute", left: "50%", top: -6, transform: "translate(-50%, -100%)", background: "var(--color-text)", color: "var(--color-surface)", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", padding: "4px 10px", borderRadius: "var(--radius-md)", whiteSpace: "nowrap", boxShadow: "var(--shadow-300)", pointerEvents: "none" }}>
          {segs[hover].label} · {segs[hover].count}{active.has(segs[hover].key) ? " · filtering" : ""}
        </div>
      )}
    </div>
  )
}

export default function RequirementsStep({ sources, jurisdictions, onContinue, onBack }: {
  sources: Set<SourceId>
  jurisdictions: string[]
  onContinue: () => void
  onBack: () => void
}) {
  const items = ALL.map(r => ({ ...r, coverage: r.getCoverage(sources), feedSources: r.getSources(sources) }))
  const total = items.length
  const satisfied = items.filter(i => i.coverage === "satisfied").length
  const partial   = items.filter(i => i.coverage === "partial").length
  const missing   = items.filter(i => i.coverage === "missing").length

  const [activeJurisdiction, setActiveJurisdiction] = useState(jurisdictions[0] ?? "")
  const [openReqId, setOpenReqId] = useState<string | null>(null)
  const [supplementFiles, setSupplementFiles] = useState<Record<string, string[]>>({})
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [filters, setFilters] = useState<Set<Coverage>>(new Set())
  const openReq = items.find(i => i.id === openReqId) ?? null

  const toggleFilter = (c: Coverage) => setFilters(prev => {
    const n = new Set(prev)
    if (n.has(c)) n.delete(c)
    else if (n.size < 2) n.add(c) // multi-select up to 2
    return n
  })
  const shownItems = filters.size === 0 ? items : items.filter(i => filters.has(i.coverage))

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

      {/* Center — scroll container */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>

        {/* Jurisdiction filter — same as Draft */}
        {jurisdictions.length > 1 && (
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", padding: "0.625rem 2.5rem", display: "flex", gap: "0.25rem" }}>
            {jurisdictions.map(j => (
              <button key={j} type="button" onClick={() => setActiveJurisdiction(j)} style={{
                padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "none",
                background: activeJurisdiction === j ? "var(--color-background-primary-solid)" : "var(--alpha-06)",
                color: activeJurisdiction === j ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
                cursor: "pointer", transition: "all var(--transition-duration-basic)",
              }}>{j}</button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", alignSelf: "center" }}>
              Generated from the same record
            </span>
          </div>
        )}

        <div style={{ padding: "3rem 3.5rem", maxWidth: 760 }}>

          {/* Header — question + small inline donut */}
          <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
            <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: 0 }}>
              What does this file legally need to contain?
            </h1>
            <CoverageDonut satisfied={satisfied} partial={partial} missing={missing} total={total} active={filters} onToggle={toggleFilter} size={52} />
          </div>

          {/* Requirements list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {shownItems.map((item, idx) => {
              const cfg = COVERAGE_CFG[item.coverage]
              const isLast = idx === shownItems.length - 1
              const selected = openReqId === item.id
              return (
                <div key={item.id}
                  onClick={() => setOpenReqId(item.id)}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--color-background-primary-ghost-hover)" }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent" }}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr auto",
                    alignItems: "start", gap: "1rem", cursor: "pointer",
                    padding: "0.875rem 0.75rem",
                    borderBottom: isLast ? "none" : "1px solid var(--color-border)",
                    background: selected ? "var(--color-background-primary-soft)" : "transparent",
                    borderRadius: "var(--radius-md)",
                  }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      {/* Status dot */}
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>
                        {item.name}
                      </span>
                    </div>
                    <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0, paddingLeft: "1.1875rem", lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                  </div>

                  {/* Source chips */}
                  {item.feedSources.length > 0 && (
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", justifyContent: "flex-end", paddingTop: "0.125rem" }}>
                      {item.feedSources.map(src => {
                        const c = SOURCE_CHIP_CFG[src]
                        return (
                          <span key={src} style={{ padding: "1px 6px", borderRadius: "var(--radius-xs)", fontSize: "10px", fontWeight: "var(--font-weight-medium)", background: c.bg, color: c.text }}>
                            {c.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "2rem" }}>
            <button type="button" onClick={onContinue} style={{
              height: "var(--control-size-md)", padding: "0 var(--control-gutter-lg)",
              borderRadius: "var(--control-radius-md)", border: "none",
              background: "var(--color-background-primary-solid)", color: "var(--color-text-inverse)",
              fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)",
              cursor: "pointer",
            }}>Continue to Draft</button>
            <button type="button" onClick={onBack} style={{
              height: "var(--control-size-md)", padding: "0 var(--control-gutter-md)",
              borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)",
              background: "transparent", color: "var(--color-text-secondary)",
              fontSize: "var(--control-font-size-md)", cursor: "pointer",
            }}>← Back to sources</button>
          </div>
        </div>
      </div>

      {/* Right panel — requirement detail */}
      {openReq && (
        <aside style={{ width: 340, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", borderBottom: "1px solid var(--color-border)", padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: COVERAGE_CFG[openReq.coverage].dot, flexShrink: 0 }} />
              <span style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", color: COVERAGE_CFG[openReq.coverage].text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {COVERAGE_CFG[openReq.coverage].label}
              </span>
            </div>
            <button type="button" aria-label="Close" onClick={() => setOpenReqId(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: "16px", lineHeight: 1, padding: 2 }}>×</button>
          </div>

          {/* Body */}
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h3 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.5rem" }}>{openReq.name}</h3>
              <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.6, color: "var(--color-text-secondary)", margin: 0 }}>{openReq.description}</p>
            </div>

            <div style={{ height: 1, background: "var(--color-border)" }} />

            <div>
              <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.625rem" }}>
                What satisfies this
              </p>
              {openReq.feedSources.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {openReq.feedSources.map(src => {
                    const c = SOURCE_CHIP_CFG[src]
                    return (
                      <div key={src} style={{ display: "flex", flexDirection: "column", gap: "0.375rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.75rem" }}>
                        <span style={{ alignSelf: "flex-start", padding: "1px 8px", borderRadius: "9999px", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", background: c.bg, color: c.text }}>
                          {c.label}
                        </span>
                        <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                          {SOURCE_PROVIDES[src]}
                        </p>
                      </div>
                    )
                  })}
                  {openReq.coverage === "partial" && (
                    <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-caution-soft)", margin: 0, lineHeight: 1.5 }}>
                      Partially covered — additional material would strengthen this element.
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6 }}>
                  No source currently covers this requirement. It will be researched from public information or flagged as a gap in the draft.
                </p>
              )}
            </div>

            <div style={{ height: 1, background: "var(--color-border)" }} />

            {/* Supplement */}
            <div>
              <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.375rem" }}>
                Supplement
              </p>
              <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: "0 0 0.625rem", lineHeight: 1.5 }}>
                Add material to satisfy or strengthen this requirement.
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-sm)", borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent", fontSize: "var(--control-font-size-md)", color: "var(--color-text-secondary)", cursor: "pointer" }}>
                  <Upload size={14} /> Upload
                  <input type="file" multiple style={{ display: "none" }} onChange={e => {
                    const names = Array.from(e.target.files ?? []).map(f => f.name)
                    if (names.length) setSupplementFiles(prev => ({ ...prev, [openReq.id]: [...(prev[openReq.id] ?? []), ...names] }))
                    e.currentTarget.value = ""
                  }} />
                </label>
                <button type="button" onClick={() => setConnected(prev => ({ ...prev, [openReq.id]: true }))} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-sm)", borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent", fontSize: "var(--control-font-size-md)", color: "var(--color-text-secondary)", cursor: "pointer" }}>
                  <Plug size={14} /> Connect
                </button>
              </div>

              {/* Accumulated material */}
              {(connected[openReq.id] || (supplementFiles[openReq.id]?.length ?? 0) > 0) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "0.75rem" }}>
                  {connected[openReq.id] && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-success-soft)" }}>
                      <Check size={13} /> Connected — Accounting / ERP
                    </div>
                  )}
                  {supplementFiles[openReq.id]?.map((name, i) => (
                    <span key={i} style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", background: "var(--color-background-primary-ghost-hover)", borderRadius: "var(--radius-xs)", padding: "2px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
