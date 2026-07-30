"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, Loader2, Download, X, FileText } from "lucide-react"
import {
  api,
  DraftNotCompleteError,
  type DocumentTextRead,
  type RiskEvidence,
  type RiskResponse,
  type RiskFinding,
  type RiskSeverityValue,
} from "@/lib/api"

// ── Original "Findings" appearance (grayscale), now driven by the real pipeline ──────────────
type Severity = RiskSeverityValue
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const SEVERITY_STYLE: Record<Severity, { bg: string; color: string; border?: string }> = {
  critical: { bg: "#000", color: "#fff" },
  high:     { bg: "#3f3f3f", color: "#fff" },
  medium:   { bg: "#dcdcdc", color: "#000" },
  low:      { bg: "#f2f2f2", color: "#666", border: "1px solid #e5e5e5" },
}
const KIND_LABEL = { discrepancy: "Contradiction", exposure: "Exposure" } as const
type KindFilter = "all" | "exposure" | "discrepancy"

const fmt = (n: number) => n.toLocaleString("en-US")
const snippet = (text: string, needle: string) => {
  const hay = text.toLowerCase()
  const ndl = needle.toLowerCase().trim()
  const at = ndl ? hay.indexOf(ndl.slice(0, Math.min(ndl.length, 120))) : -1
  const start = at >= 0 ? Math.max(0, at - 800) : 0
  const end = at >= 0 ? Math.min(text.length, at + needle.length + 1400) : Math.min(text.length, 2200)
  return text.slice(start, end).trim()
}

// ── Small presentational bits (ported from the original) ─────────────────────────────────────
function Chip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  )
}
function OutlineChip({ children }: { children: React.ReactNode }) {
  return <Chip style={{ background: "#fff", color: "#555", border: "1px solid #e5e5e5" }}>{children}</Chip>
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 0.125rem" }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 600, color: "#000", margin: 0, fontVariant: "tabular-nums" }}>{value}</p>
    </div>
  )
}
const Divider = () => <div style={{ width: 1, height: 32, background: "#e5e5e5" }} />

const TH: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e5e5", whiteSpace: "nowrap" }
const TD: React.CSSProperties = { padding: "0.625rem 0.75rem", borderBottom: "1px solid #f0f0f0", verticalAlign: "middle" }
const PILL = (active: boolean): React.CSSProperties => ({
  height: 28, padding: "0 0.75rem", borderRadius: 9999, cursor: "pointer",
  border: active ? "1px solid #000" : "1px solid #e5e5e5",
  background: active ? "#000" : "#fff", color: active ? "#fff" : "#555",
  fontSize: 12, fontWeight: 500,
})

export default function RisksStep({ engagementId, jurisdictions, entity }: {
  engagementId: string | null
  jurisdictions: string[]
  entity: string
}) {
  // ── real pipeline wiring (unchanged) ──
  const [riskByJuris, setRiskByJuris] = useState<Record<string, RiskResponse>>({})
  const [started, setStarted] = useState<Set<string>>(new Set())
  const [notReady, setNotReady] = useState<Set<string>>(new Set())
  const [activeJurisdiction, setActive] = useState(jurisdictions[0] ?? "")
  const [error, setError] = useState<string | null>(null)
  // ── view state (search + kind toggle + slide-in detail, from the original) ──
  const [search, setSearch] = useState("")
  const [view, setView] = useState<KindFilter>("all")
  const [openFinding, setOpenFinding] = useState<RiskFinding | null>(null)
  const [sourcePreview, setSourcePreview] = useState<{ doc: DocumentTextRead; evidence: RiskEvidence } | null>(null)
  const [sourceLoading, setSourceLoading] = useState<string | null>(null)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [copiedEvidence, setCopiedEvidence] = useState(false)

  const riskRef = useRef(riskByJuris); riskRef.current = riskByJuris
  const startedRef = useRef(started); startedRef.current = started
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setRisk = (j: string, d: RiskResponse) => setRiskByJuris(prev => ({ ...prev, [j]: d }))
  const analyzing = (d?: RiskResponse) => d?.status === "pending" || d?.status === "analyzing"

  const poll = useCallback(async () => {
    pollRef.current = null
    if (!engagementId) return
    const js = [...startedRef.current].filter(j => !notReady.has(j))
    const results = await Promise.all(js.map(async j => {
      try { return [j, await api.getRisks(engagementId, j)] as const }
      catch (e) { console.error("[veritax] risks poll failed:", e); return [j, riskRef.current[j]] as const }
    }))
    const merged: Record<string, RiskResponse> = {}
    for (const [j, d] of results) if (d) merged[j] = d
    setRiskByJuris(prev => ({ ...prev, ...merged }))
    if (Object.values(merged).some(analyzing)) pollRef.current = setTimeout(poll, 1800)
  }, [engagementId, notReady])

  const startJurisdiction = useCallback(async (j: string) => {
    if (!engagementId || !j || startedRef.current.has(j)) return
    setStarted(prev => new Set(prev).add(j))
    startedRef.current = new Set(startedRef.current).add(j)
    try {
      const d = await api.startRisks(engagementId, j)
      setRisk(j, d)
      if (analyzing(d) && !pollRef.current) pollRef.current = setTimeout(poll, 1200)
    } catch (e) {
      if (e instanceof DraftNotCompleteError) {
        setNotReady(prev => new Set(prev).add(j))
      } else {
        console.error("[veritax] failed to start risks:", e)
        setError(String(e))
      }
    }
  }, [engagementId, poll])

  useEffect(() => {
    if (!engagementId || jurisdictions.length === 0) return
    setActive(prev => (jurisdictions.includes(prev) ? prev : jurisdictions[0]))
    startJurisdiction(jurisdictions[0])
    return () => { if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null } }
  }, [engagementId, jurisdictions, startJurisdiction])

  function selectJurisdiction(j: string) {
    setActive(j)
    setOpenFinding(null)
    setSourcePreview(null)
    setSourceError(null)
    startJurisdiction(j)
  }

  function retry(j: string) {
    setNotReady(prev => { const n = new Set(prev); n.delete(j); return n })
    setStarted(prev => { const n = new Set(prev); n.delete(j); return n })
    startedRef.current = new Set([...startedRef.current].filter(x => x !== j))
    startJurisdiction(j)
  }

  const risk = riskByJuris[activeJurisdiction] ?? null
  const findings = risk?.findings ?? []

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return findings
      .filter(f => view === "all" || f.kind === view)
      .filter(f => !q || `${f.title} ${f.description} ${KIND_LABEL[f.kind]}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  }, [findings, view, search])

  const exposureCount = findings.filter(f => f.kind === "exposure").length
  const contradictionCount = findings.filter(f => f.kind === "discrepancy").length
  const needAttention = findings.filter(f => f.severity === "critical" || f.severity === "high").length

  function exportRegister() {
    const title = `${entity || "Entity"} — ${activeJurisdiction} · Risk Register`
    const body = findings.map(f => {
      const ev = f.evidence.map(e => `<li><em>${e.kind}</em> — ${e.reference}: ${e.detail}</li>`).join("")
      const rec = f.recommendations.map(r => `<li>${r}</li>`).join("")
      return `<div class="f"><h3>[${f.severity.toUpperCase()} · ${KIND_LABEL[f.kind]}] ${f.title}</h3>` +
        `<p>${f.description}</p>` +
        `<p><strong>Exposure:</strong> ${f.exposure_label ?? "—"}${f.exposure_estimated ? " <em>(estimated)</em>" : ""} · <strong>Confidence:</strong> ${f.confidence}</p>` +
        `<p><strong>Evidence</strong></p><ul>${ev}</ul>` +
        `<p><strong>Options</strong></p><ul>${rec}</ul></div>`
    }).join("\n")
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
      `<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:2.5rem auto;padding:0 1.25rem;line-height:1.6;color:#111}h1{font-size:1.6rem}.f{border-top:1px solid #ddd;padding-top:1rem;margin-top:1rem}h3{font-size:1.05rem}em{color:#666}</style></head>` +
      `<body><h1>${title}</h1><p><em>Exposure figures are flagged estimates, not computed.</em></p>${body}</body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function openSource(evidence: RiskEvidence) {
    setSourceError(null)
    setCopiedEvidence(false)
    if (!evidence.document_id) {
      await navigator.clipboard?.writeText(evidence.detail).catch(() => undefined)
      setCopiedEvidence(true)
      setTimeout(() => setCopiedEvidence(false), 1200)
      return
    }
    setSourceLoading(evidence.document_id)
    try {
      const doc = await api.getDocumentText(evidence.document_id)
      setSourcePreview({ doc, evidence })
    } catch (e) {
      console.error("[veritax] failed to open risk source:", e)
      setSourceError("Source text is not available yet. The document may still be indexing.")
    } finally {
      setSourceLoading(null)
    }
  }

  if (!engagementId) return <main style={{ flex: 1, padding: "3rem 3rem", color: "#888" }}>Preparing session…</main>
  if (jurisdictions.length === 0) return <main style={{ flex: 1, padding: "3rem 3rem", color: "#888" }}>Select a jurisdiction in Planning first.</main>

  const hasFindings = risk?.status !== "failed" && !analyzing(risk) && findings.length > 0

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Jurisdiction tabs (grayscale pills) */}
      <div style={{ background: "#fff", padding: "1rem 3rem 0.75rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {jurisdictions.map(j => {
          const isActive = j === activeJurisdiction
          const isStarted = started.has(j)
          const processing = isStarted && analyzing(riskByJuris[j])
          return (
            <button key={j} type="button" onClick={() => selectJurisdiction(j)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", ...PILL(isActive), opacity: isStarted ? 1 : 0.6 }}>
              {processing && <Loader2 size={11} className="animate-spin" />}
              {j}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2rem 3rem", overflowY: "auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: "#000", margin: 0 }}>Risks</h1>
            {hasFindings && (
              <button type="button" onClick={exportRegister} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: 30, padding: "0 0.75rem", borderRadius: 6, border: "1px solid #e5e5e5", background: "#fff", color: "#000", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
                <Download size={14} /> Export register
              </button>
            )}
          </div>

          {error && <p style={{ fontSize: 13, color: "#b00020" }}>Couldn’t load risks. Is the backend running? ({error})</p>}
          {risk?.analysis_mode === "fake" && (
            <p style={{ fontSize: 12, color: "#8a5a00", background: "#fff8e5", border: "1px solid #f0d58c", borderRadius: 6, padding: "0.625rem 0.75rem", margin: "0 0 0.875rem" }}>
              Development mode: these findings are generated by the fake analyzer, not a real model.
            </p>
          )}
          {risk?.stale && (
            <p style={{ fontSize: 12, color: "#555", background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: 6, padding: "0.625rem 0.75rem", margin: "0 0 0.875rem" }}>
              The draft changed after this run.{" "}
              <button type="button" onClick={() => retry(activeJurisdiction)} style={{ border: "none", background: "transparent", padding: 0, color: "#000", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer", fontSize: 12 }}>
                Refresh the risk review
              </button>
              {" "}to replace stale findings.
            </p>
          )}

          {notReady.has(activeJurisdiction) ? (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 0.75rem" }}>
                Risks run on the finished file. Complete the <strong>Draft</strong> for {activeJurisdiction} first, then check here.
              </p>
              <button type="button" onClick={() => retry(activeJurisdiction)} style={{ height: 28, padding: "0 0.75rem", borderRadius: 6, border: "1px solid #e5e5e5", background: "#fff", color: "#555", fontSize: 12, cursor: "pointer" }}>Check again</button>
            </div>
          ) : analyzing(risk) || (!risk && !error) ? (
            <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13, color: "#888" }}>
              <Loader2 size={14} className="animate-spin" /> Analysing the {activeJurisdiction} file for risk…
            </p>
          ) : risk?.status === "failed" ? (
            <p style={{ fontSize: 13, color: "#b00020" }}>Analysis failed: {risk.error}</p>
          ) : findings.length === 0 ? (
            <p style={{ fontSize: 13, color: "#888" }}>No risks surfaced for this file.</p>
          ) : (
            <>
              {/* Search + kind toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search findings…"
                  style={{ height: 28, width: 240, padding: "0 0.75rem", borderRadius: 9999, border: "1px solid #e5e5e5", background: "#fff", color: "#000", fontSize: 12, outline: "none" }} />
                {([["all", "All"], ["exposure", "Exposure"], ["discrepancy", "Contradictions"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setView(id)} style={PILL(view === id)}>{label}</button>
                ))}
              </div>

              {/* Rollup header */}
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", border: "1px solid #e5e5e5", borderRadius: 8, padding: "0.875rem 1.25rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <Stat label="Findings" value={findings.length} />
                <Divider />
                <Stat label="Exposure" value={exposureCount} />
                <Divider />
                <Stat label="Contradictions" value={contradictionCount} />
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <p style={{ fontSize: 11, color: "#888", margin: "0 0 0.125rem" }}>Need attention</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: "#000", margin: 0 }}>{needAttention}</p>
                </div>
              </div>

              <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 0.75rem" }}>
                Exposure figures are flagged estimates, not computed — verify against the record before acting.
              </p>

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={TH}>Severity</th>
                    <th style={TH}>Kind</th>
                    <th style={TH}>Title</th>
                    <th style={TH}>Exposure</th>
                    <th style={TH}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(f => (
                    <tr key={f.id} style={{ cursor: "pointer", background: openFinding?.id === f.id ? "#f2f2f2" : "transparent" }}
                      onClick={() => { setOpenFinding(f); setSourcePreview(null); setSourceError(null) }}
                      onMouseEnter={e => { if (openFinding?.id !== f.id) e.currentTarget.style.background = "#fafafa" }}
                      onMouseLeave={e => { if (openFinding?.id !== f.id) e.currentTarget.style.background = "transparent" }}>
                      <td style={TD}><Chip style={{ ...SEVERITY_STYLE[f.severity], textTransform: "capitalize", fontWeight: 600 }}>{f.severity}</Chip></td>
                      <td style={TD}><OutlineChip>{KIND_LABEL[f.kind]}</OutlineChip></td>
                      <td style={{ ...TD, fontSize: 13, fontWeight: 500, color: "#000", maxWidth: 360 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</span>
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: "#555", maxWidth: 220 }}>
                        {f.exposure_amount != null ? (
                          <span style={{ fontVariant: "tabular-nums", color: "#000" }}>{fmt(f.exposure_amount)} <span style={{ color: "#aaa", fontSize: 11 }}>{f.exposure_currency}</span></span>
                        ) : (
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.exposure_label || "—"}{f.exposure_estimated && f.exposure_label ? " (est.)" : ""}
                          </span>
                        )}
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: "#888", textTransform: "capitalize" }}>{f.confidence}</td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: "3rem", textAlign: "center", fontSize: 13, color: "#888" }}>No findings match the current view.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </main>

        {/* Detail panel — slides in on row click */}
        {openFinding && (
          <aside style={{ width: 380, flexShrink: 0, borderLeft: "1px solid #e5e5e5", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", borderBottom: "1px solid #e5e5e5", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                <Chip style={{ ...SEVERITY_STYLE[openFinding.severity], textTransform: "capitalize", fontWeight: 600 }}>{openFinding.severity}</Chip>
                <OutlineChip>{KIND_LABEL[openFinding.kind]}</OutlineChip>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpenFinding(null)} style={{ display: "inline-flex", padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "#888" }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#000", margin: "0 0 0.5rem" }}>{openFinding.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#666", margin: 0 }}>{openFinding.description}</p>
              </div>

              <div style={{ height: 1, background: "#e5e5e5" }} />

              {/* Exposure card */}
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: 0 }}>Exposure</p>
                {openFinding.exposure_amount != null ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                    <span style={{ fontSize: 24, fontWeight: 600, color: "#000", fontVariant: "tabular-nums" }}>{fmt(openFinding.exposure_amount)}</span>
                    <span style={{ fontSize: 13, color: "#888" }}>{openFinding.exposure_currency}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#000" }}>{openFinding.exposure_label || "—"}</span>
                    {openFinding.exposure_estimated && (
                      <Chip style={{ background: "#dcdcdc", color: "#000", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Estimated</Chip>
                    )}
                  </div>
                )}
                <p style={{ fontSize: 11, color: "#aaa", margin: 0, textTransform: "capitalize" }}>{openFinding.confidence} confidence</p>
                <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Flagged estimate — verify against the record, not computed.</p>
              </div>

              <div style={{ height: 1, background: "#e5e5e5" }} />

              {/* Evidence (real provenance) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: "0 0 0.25rem" }}>Evidence ({openFinding.evidence.length})</p>
                {openFinding.evidence.map((e, i) => (
                  <div key={i} style={{ border: "1px solid #e5e5e5", background: "#fafafa", borderRadius: 6, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#aaa", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.04em", marginRight: 6 }}>{e.kind}</span>{e.reference}
                      </span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                        <Chip style={{ background: e.verified ? "#ecfdf3" : "#fff8e5", color: e.verified ? "#027a48" : "#8a5a00", border: "1px solid #e5e5e5", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {e.verified ? <Check size={10} /> : null}{e.verified ? "Verified" : "Needs check"}
                        </Chip>
                        <button type="button" onClick={() => openSource(e)} disabled={!!e.document_id && sourceLoading === e.document_id} style={{
                          display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid #e5e5e5", borderRadius: 9999,
                          background: "#fff", color: "#555", padding: "2px 8px", fontSize: 11, cursor: "pointer",
                        }}>
                          {e.document_id && sourceLoading === e.document_id ? <Loader2 size={10} className="animate-spin" /> : e.document_id ? <FileText size={10} /> : <Copy size={10} />}
                          {e.document_id ? "Open" : copiedEvidence ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                    {e.source_label && <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{e.source_label}</p>}
                    <p style={{ fontSize: 12, fontStyle: "italic", color: "#888", margin: 0, lineHeight: 1.5 }}>&ldquo;{e.detail}&rdquo;</p>
                  </div>
                ))}
                {openFinding.evidence.length === 0 && <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>No evidence pointers recorded.</p>}
                {sourceError && <p style={{ fontSize: 12, color: "#b00020", margin: 0 }}>{sourceError}</p>}
                {sourcePreview && (
                  <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, background: "#fff", padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: 0 }}>Source preview</p>
                    <p style={{ fontSize: 12, color: "#000", margin: 0 }}>{sourcePreview.doc.original_filename}</p>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", fontSize: 11, lineHeight: 1.55, color: "#555", background: "#fafafa", borderRadius: 6, padding: "0.75rem" }}>
                      {snippet(sourcePreview.doc.text, sourcePreview.evidence.detail)}
                    </pre>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: "#e5e5e5" }} />

              {/* Options (recommendations) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: "0 0 0.25rem" }}>Your options</p>
                <ul style={{ margin: 0, padding: "0 0 0 1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {openFinding.recommendations.map((r, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#555", lineHeight: 1.55 }}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
