"use client"

import { useMemo, useState } from "react"
import { Star, X } from "lucide-react"

// ── Types (ported from main app's lib/mock/types) ────────────────────────────
type Severity = "critical" | "high" | "medium" | "low"
type Status = "detected" | "triaged" | "in-remediation" | "reviewed" | "resolved" | "verify-next-cycle"
type ReviewerState = "unreviewed" | "confirmed" | "dismissed"

interface Finding {
  id: string
  severity: Severity
  title: string
  summary: string
  status: Status
  exposure: number
  currency: string
  assigneeId?: string
  reviewerState: ReviewerState
  flowId: string
  age: number
  ruleId: string
  confidence: number
}

// ── Data (ported from mockFindings / mockFlows / mockEntities / mockUsers) ────
const FINDINGS: Finding[] = [
  { id: "fn1", severity: "critical", title: "UK royalty rate exceeds benchmark upper quartile by 50%", summary: "The royalty charged to Veritax UK Ltd is 18%, materially above the CUT comparable range of 10–14%. Potential UK CIT adjustment of £3.2M.", status: "detected", exposure: 3_200_000, currency: "GBP", reviewerState: "unreviewed", flowId: "f1", age: 4, ruleId: "R-IC-001", confidence: 92 },
  { id: "fn2", severity: "critical", title: "France royalty rate exceeds arm's length range", summary: "Royalty to Veritax France SAS at 17% versus 9–13% benchmark. French TP adjustment risk: €850K.", status: "triaged", exposure: 850_000, currency: "EUR", assigneeId: "u3", reviewerState: "unreviewed", flowId: "f10", age: 7, ruleId: "R-IC-001", confidence: 89 },
  { id: "fn3", severity: "high", title: "Japan royalty — no executed ICA found in corpus", summary: "Flow F5 charges royalties to Veritax KK but no executed agreement was found. Gap represents a documentation risk under local TP rules.", status: "detected", exposure: 1_100_000, currency: "USD", reviewerState: "unreviewed", flowId: "f5", age: 2, ruleId: "R-DOC-003", confidence: 97 },
  { id: "fn4", severity: "high", title: "UK intercompany loan rate below EURIBOR floor", summary: "The loan from US to UK carries 3.8% versus policy 4.5%. Potential UK thin-cap and TP exposure.", status: "in-remediation", exposure: 600_000, currency: "USD", assigneeId: "u3", reviewerState: "confirmed", flowId: "f7", age: 21, ruleId: "R-IC-002", confidence: 84 },
  { id: "fn5", severity: "high", title: "DE royalty drift — rate increased without policy amendment", summary: "Germany royalty moved from 12% to 13.5% without a policy gate. Triggers staleness on master file section 4.2.", status: "triaged", exposure: 420_000, currency: "EUR", assigneeId: "u4", reviewerState: "unreviewed", flowId: "f2", age: 9, ruleId: "R-IC-001", confidence: 78 },
  { id: "fn6", severity: "medium", title: "APAC hub service margin below TNMM lower quartile", summary: "SG hub operating margin at 6.5% is at the lower quartile boundary. Monitor for Q4 true-up.", status: "detected", exposure: 180_000, currency: "USD", reviewerState: "unreviewed", flowId: "f3", age: 1, ruleId: "R-IC-004", confidence: 71 },
  { id: "fn7", severity: "medium", title: "Local file missing for SG→UK service flow", summary: "F9 (SG→UK services) lacks a Singapore local file for FY2024. Singaporean TP documentation deadline is 30 days post-filing.", status: "detected", exposure: 290_000, currency: "USD", reviewerState: "unreviewed", flowId: "f9", age: 3, ruleId: "R-DOC-001", confidence: 95 },
  { id: "fn8", severity: "medium", title: "France commissionnaire agreement expired 31 Dec 2023", summary: "Agreement A7 expired. Services continued in FY2024 under expired terms.", status: "in-remediation", exposure: 330_000, currency: "EUR", assigneeId: "u3", reviewerState: "unreviewed", flowId: "f11", age: 15, ruleId: "R-AGR-002", confidence: 99 },
  { id: "fn9", severity: "medium", title: "Benchmark set for CUT comparables last refreshed FY2022", summary: "The CUT dataset used for royalty benchmarking is 2 years stale. Refresh required before filing.", status: "triaged", exposure: 0, currency: "USD", reviewerState: "unreviewed", flowId: "f1", age: 11, ruleId: "R-BMK-001", confidence: 88 },
  { id: "fn10", severity: "low", title: "US→SG guarantee fee — minor basis point drift", summary: "Guarantee fee observed at 0.51% vs policy 0.50%. Within tolerance but logged for monitoring.", status: "resolved", exposure: 20_000, currency: "USD", reviewerState: "confirmed", flowId: "f12", age: 30, ruleId: "R-IC-003", confidence: 65 },
  { id: "fn11", severity: "low", title: "UK goods resale documentation below 80% coverage", summary: "Only 72% of invoices in F6 are matched to signed purchase orders in the corpus.", status: "detected", exposure: 0, currency: "USD", reviewerState: "unreviewed", flowId: "f6", age: 5, ruleId: "R-DOC-002", confidence: 82 },
  { id: "fn12", severity: "critical", title: "Pillar 2 — DE GloBE ETR below 15% threshold", summary: "Effective GloBE ETR for Germany entity is 12.4% after adjustments. QDMTT top-up liability estimated at €240K.", status: "detected", exposure: 240_000, currency: "EUR", reviewerState: "unreviewed", flowId: "f2", age: 6, ruleId: "R-P2-001", confidence: 90 },
  { id: "fn13", severity: "high", title: "Japan local file substance section incomplete", summary: "Headcount and payroll data for Veritax KK not extracted from payroll system. Blocking local file sign-off.", status: "in-remediation", exposure: 0, currency: "USD", assigneeId: "u4", reviewerState: "unreviewed", flowId: "f4", age: 18, ruleId: "R-DOC-004", confidence: 96 },
  { id: "fn14", severity: "medium", title: "DE services cost allocation key not documented", summary: "The basis for allocating IT costs to Germany (F8) is not described in any local file or master file section.", status: "triaged", exposure: 85_000, currency: "EUR", assigneeId: "u3", reviewerState: "unreviewed", flowId: "f8", age: 8, ruleId: "R-DOC-003", confidence: 80 },
  { id: "fn15", severity: "low", title: "APAC hub — payroll data lag 45 days", summary: "Headcount data for the Singapore hub is 45 days stale (threshold: 30 days). Affects substance analysis for safe harbour.", status: "detected", exposure: 0, currency: "USD", reviewerState: "unreviewed", flowId: "f3", age: 2, ruleId: "R-STALE-001", confidence: 99 },
]

// flowId → "FROM to TO kind" (derived from mockFlows + entity jurisdiction codes)
const FLOW_LABEL: Record<string, string> = {
  f1: "US to GB royalty", f2: "US to DE royalty", f3: "US to SG service", f4: "SG to JP service",
  f5: "US to JP royalty", f6: "GB to US goods", f7: "US to GB loan", f8: "US to DE service",
  f9: "SG to GB service", f10: "US to FR royalty", f11: "FR to US service", f12: "US to SG guarantee",
}
const USER_NAME: Record<string, string> = {
  u1: "Alexandra Chen", u2: "Marcus Webb", u3: "Ikaika Choi", u4: "Sarah Kimura", u5: "Tom Feld", u6: "Priya Nair",
}
const DEFAULT_ASSIGNEE = "u3" // first analyst (Ikaika Choi)

// flowId → { destination jurisdiction, transaction kind } — for exhibit doc names
const FLOW_META: Record<string, { to: string; kind: string }> = {
  f1: { to: "GB", kind: "royalty" }, f2: { to: "DE", kind: "royalty" }, f3: { to: "SG", kind: "service" },
  f4: { to: "JP", kind: "service" }, f5: { to: "JP", kind: "royalty" }, f6: { to: "US", kind: "goods" },
  f7: { to: "GB", kind: "loan" }, f8: { to: "DE", kind: "service" }, f9: { to: "GB", kind: "service" },
  f10: { to: "FR", kind: "royalty" }, f11: { to: "US", kind: "service" }, f12: { to: "SG", kind: "guarantee" },
}

interface Exhibit { id: string; docName: string; section: string; snippet: string; confidence: number }

// Ported from finding-detail-page-content buildExhibits — observed + policy (+ benchmark for royalty rules)
function buildExhibits(f: Finding): Exhibit[] {
  const juris = FLOW_META[f.flowId]?.to ?? "US"
  const exhibits: Exhibit[] = [
    { id: `${f.id}-observed`, docName: `${juris} Local File FY2024`, section: "Observed rate", snippet: f.summary, confidence: f.confidence },
    { id: `${f.id}-policy`, docName: "Veritax Group TP Policy FY2024 v4", section: "Policy comparison", snippet: "Policy terms were compared against observed values and the benchmark range.", confidence: 92 },
  ]
  if (f.ruleId.startsWith("R-IC-00")) {
    exhibits.push({ id: `${f.id}-benchmark`, docName: "CUT Benchmark Study — Software Royalties FY2022", section: "Comparable range", snippet: "Benchmark interquartile range applied against the observed rate.", confidence: 88 })
  }
  return exhibits
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

// Grayscale severity — black-and-white palette
const SEVERITY_STYLE: Record<Severity, { bg: string; color: string; border?: string }> = {
  critical: { bg: "#000", color: "#fff" },
  high:     { bg: "#3f3f3f", color: "#fff" },
  medium:   { bg: "#dcdcdc", color: "#000" },
  low:      { bg: "#f2f2f2", color: "#666", border: "1px solid #e5e5e5" },
}
const STATUS_LABEL: Record<Status, string> = {
  detected: "Detected", triaged: "Triaged", "in-remediation": "In remediation",
  reviewed: "Reviewed", resolved: "Resolved", "verify-next-cycle": "Verify next cycle",
}

const fmt = (n: number) => n.toLocaleString("en-US")
const isOpen = (f: Finding) => f.status !== "resolved" && f.status !== "verify-next-cycle"

// ── Small presentational bits ────────────────────────────────────────────────
function Chip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 500, whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  )
}
function OutlineChip({ children }: { children: React.ReactNode }) {
  return <Chip style={{ background: "#fff", color: "#555", border: "1px solid #e5e5e5" }}>{children}</Chip>
}
function Sparkline() {
  return (
    <svg role="img" aria-label="Finding trend" viewBox="0 0 96 28" style={{ height: 28, width: 96, color: "#000" }}>
      <polyline points="2,22 18,19 34,17 50,11 66,14 82,8 94,6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TH: React.CSSProperties = { textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e5e5", whiteSpace: "nowrap" }
const TD: React.CSSProperties = { padding: "0.625rem 0.75rem", borderBottom: "1px solid #f0f0f0", verticalAlign: "middle" }

function BulkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      height: 30, padding: "0 0.75rem", borderRadius: 6, border: "1px solid #e5e5e5",
      background: "#fff", color: "#000", fontSize: "12px", fontWeight: 500, cursor: "pointer",
    }}>{children}</button>
  )
}

export default function RisksStep({ entity: _entity }: { entity: string; jurisdictions: string[] }) {
  const [view, setView] = useState<"open" | "all">("open")
  const [search, setSearch] = useState("")
  const [findings, setFindings] = useState<Finding[]>(FINDINGS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)
  const [openFinding, setOpenFinding] = useState<Finding | null>(null)
  const [watching, setWatching] = useState(false)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (view === "all" ? findings : findings.filter(isOpen))
      .filter(f => !q || `${f.id} ${f.title} ${f.summary} ${FLOW_LABEL[f.flowId] ?? ""}`.toLowerCase().includes(q))
    return [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  }, [findings, view, search])

  const openCount = findings.filter(isOpen).length
  const totalExposure = findings.reduce((s, f) => s + f.exposure, 0)
  const currencies = [...new Set(findings.map(f => f.currency))].join(", ")
  const selectedFindings = visible.filter(f => selected.has(f.id))

  const allVisibleSelected = visible.length > 0 && visible.every(f => selected.has(f.id))
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map(f => f.id)))
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  function assign() {
    const ids = new Set(selectedFindings.map(f => f.id))
    setFindings(cur => cur.map(f => ids.has(f.id) ? { ...f, assigneeId: DEFAULT_ASSIGNEE, status: "triaged" } : f))
    setNotice(`${ids.size} finding${ids.size === 1 ? "" : "s"} assigned to ${USER_NAME[DEFAULT_ASSIGNEE]}.`)
    setSelected(new Set())
  }
  function watch() {
    setNotice(`${selectedFindings.length} finding${selectedFindings.length === 1 ? "" : "s"} added to watch list.`)
    setSelected(new Set())
  }
  function exportList() {
    setNotice(`${selectedFindings.length} finding${selectedFindings.length === 1 ? "" : "s"} exported as a communication list.`)
    setSelected(new Set())
  }

  const exhibits = openFinding ? buildExhibits(openFinding) : []

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
    <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2.5rem 3rem", overflowY: "auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#000", margin: 0 }}>Findings</h1>
      </div>

      {/* Notice */}
      {notice && (
        <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", border: "1px solid #e5e5e5", background: "#fafafa", borderRadius: 8, padding: "0.625rem 0.875rem", marginBottom: "1rem", fontSize: "13px", color: "#000" }}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#888", fontSize: "13px" }}>Dismiss</button>
        </div>
      )}

      {/* Search + saved views */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search findings…"
          style={{
            height: 28, width: 240, padding: "0 0.75rem", borderRadius: 9999,
            border: "1px solid #e5e5e5", background: "#fff", color: "#000",
            fontSize: "12px", outline: "none",
          }}
        />
        {([["open", "Open"], ["all", "All"]] as const).map(([id, label]) => {
          const active = view === id
          return (
            <button key={id} type="button" onClick={() => setView(id)} style={{
              height: 28, padding: "0 0.75rem", borderRadius: 9999, cursor: "pointer",
              border: active ? "1px solid #000" : "1px solid #e5e5e5",
              background: active ? "#000" : "#fff", color: active ? "#fff" : "#555",
              fontSize: "12px", fontWeight: 500,
            }}>{label}</button>
          )
        })}
      </div>

          {/* Rollup header */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", border: "1px solid #e5e5e5", borderRadius: 8, padding: "0.875rem 1.25rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "11px", color: "#888", margin: "0 0 0.125rem" }}>Open findings</p>
              <p style={{ fontSize: "20px", fontWeight: 600, color: "#000", margin: 0 }}>{openCount}</p>
            </div>
            <div style={{ width: 1, height: 32, background: "#e5e5e5" }} />
            <div>
              <p style={{ fontSize: "11px", color: "#888", margin: "0 0 0.125rem" }}>Total exposure</p>
              <p style={{ fontSize: "20px", fontWeight: 600, color: "#000", margin: 0, fontVariant: "tabular-nums" }}>{fmt(totalExposure)}</p>
            </div>
            <div style={{ width: 1, height: 32, background: "#e5e5e5" }} />
            <div>
              <p style={{ fontSize: "11px", color: "#888", margin: "0 0 0.125rem" }}>Currencies</p>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#000", margin: 0 }}>{currencies}</p>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <p style={{ fontSize: "11px", color: "#888", margin: "0 0 0.125rem" }}>Trend</p>
              <Sparkline />
            </div>
          </div>

          {/* Bulk actions */}
          {selectedFindings.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 0.875rem", border: "1px solid #000", borderRadius: 8, marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#000", marginRight: "0.25rem" }}>{selectedFindings.length} selected</span>
              <BulkButton onClick={assign}>Assign</BulkButton>
              <BulkButton onClick={watch}>Watch</BulkButton>
              <BulkButton onClick={exportList}>Export list</BulkButton>
            </div>
          )}

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 36 }}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th style={TH}>Severity</th>
                <th style={TH}>ID</th>
                <th style={TH}>Title</th>
                <th style={TH}>Flow</th>
                <th style={TH}>Status</th>
                <th style={{ ...TH, textAlign: "right" }}>Exposure</th>
                <th style={TH}>Assignee</th>
                <th style={TH}>Reviewer</th>
                <th style={{ ...TH, textAlign: "right" }}>Age</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(f => (
                <tr key={f.id} style={{ cursor: "pointer", background: openFinding?.id === f.id ? "#f2f2f2" : "transparent" }}
                  onClick={() => { setOpenFinding(f); setWatching(false) }}
                  onMouseEnter={e => { if (openFinding?.id !== f.id) e.currentTarget.style.background = "#fafafa" }}
                  onMouseLeave={e => { if (openFinding?.id !== f.id) e.currentTarget.style.background = "transparent" }}>
                  <td style={TD} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleOne(f.id)} aria-label={`Select ${f.id}`} />
                  </td>
                  <td style={TD}>
                    <Chip style={{ ...SEVERITY_STYLE[f.severity], textTransform: "capitalize", fontWeight: 600 }}>{f.severity}</Chip>
                  </td>
                  <td style={{ ...TD, fontFamily: "monospace", fontSize: "12px", color: "#888" }}>{f.id}</td>
                  <td style={{ ...TD, fontSize: "13px", fontWeight: 500, color: "#000", maxWidth: 320 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</span>
                  </td>
                  <td style={{ ...TD, fontSize: "12px", color: "#888", whiteSpace: "nowrap" }}>{FLOW_LABEL[f.flowId] ?? f.flowId}</td>
                  <td style={TD}><OutlineChip>{STATUS_LABEL[f.status]}</OutlineChip></td>
                  <td style={{ ...TD, textAlign: "right", fontSize: "13px", fontVariant: "tabular-nums", color: "#000" }}>
                    {fmt(f.exposure)} <span style={{ color: "#aaa", fontSize: "11px" }}>{f.currency}</span>
                  </td>
                  <td style={{ ...TD, fontSize: "12px", color: "#888", whiteSpace: "nowrap" }}>{f.assigneeId ? USER_NAME[f.assigneeId] ?? f.assigneeId : "Unassigned"}</td>
                  <td style={TD}><Chip style={{ background: "#f2f2f2", color: "#555", textTransform: "capitalize" }}>{f.reviewerState}</Chip></td>
                  <td style={{ ...TD, textAlign: "right", fontSize: "12px", color: "#888" }}>{f.age}d</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={10} style={{ padding: "3rem", textAlign: "center", fontSize: "13px", color: "#888" }}>No findings match the current view.</td></tr>
              )}
            </tbody>
          </table>

    </main>

    {/* Detail panel — slides in on row click */}
    {openFinding && (
      <aside style={{ width: 380, flexShrink: 0, borderLeft: "1px solid #e5e5e5", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", borderBottom: "1px solid #e5e5e5", padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>{openFinding.id}</span>
            <Chip style={{ ...SEVERITY_STYLE[openFinding.severity], textTransform: "capitalize", fontWeight: 600 }}>{openFinding.severity}</Chip>
            <OutlineChip>{STATUS_LABEL[openFinding.status]}</OutlineChip>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
            <button type="button" aria-label="Watch" onClick={() => setWatching(w => !w)} style={{ display: "inline-flex", padding: 6, border: "none", background: "transparent", cursor: "pointer", color: watching ? "#000" : "#aaa" }}>
              <Star size={16} fill={watching ? "#000" : "none"} />
            </button>
            <button type="button" aria-label="Close" onClick={() => setOpenFinding(null)} style={{ display: "inline-flex", padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "#888" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#000", margin: "0 0 0.5rem" }}>{openFinding.title}</h3>
            <p style={{ fontSize: "13px", lineHeight: 1.6, color: "#666", margin: 0 }}>{openFinding.summary}</p>
          </div>

          <div style={{ height: 1, background: "#e5e5e5" }} />

          {/* Exposure card */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: 0 }}>Exposure</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "24px", fontWeight: 600, color: "#000", fontVariant: "tabular-nums" }}>{fmt(openFinding.exposure)}</span>
              <span style={{ fontSize: "13px", color: "#888" }}>{openFinding.currency}</span>
            </div>
            <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>As of 2024-12-31 · {openFinding.ruleId} exposure calculation · {openFinding.confidence}% confidence</p>
            <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>Methodology note — see provenance for lineage</p>
          </div>

          <div style={{ height: 1, background: "#e5e5e5" }} />

          {/* Exhibits */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: "0 0 0.25rem" }}>Exhibits ({exhibits.length})</p>
            {exhibits.map(ex => (
              <div key={ex.id} style={{ border: "1px solid #e5e5e5", background: "#fafafa", borderRadius: 6, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ex.docName} <span style={{ color: "#aaa", fontWeight: 400 }}>· {ex.section}</span>
                  </span>
                  <Chip style={{ background: "#fff", color: "#555", border: "1px solid #e5e5e5", flexShrink: 0 }}>{ex.confidence}%</Chip>
                </div>
                <p style={{ fontSize: "12px", fontStyle: "italic", color: "#888", margin: 0, lineHeight: 1.5 }}>&ldquo;{ex.snippet}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    )}
    </div>
  )
}
