"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Download, ChevronDown, ChevronUp, GitCompareArrows, ShieldAlert, FileText } from "lucide-react"
import { api, DraftNotCompleteError, type RiskResponse, type RiskFinding, type RiskSeverityValue } from "@/lib/api"

const SEV_CFG: Record<RiskSeverityValue, { label: string; bg: string; text: string; dot: string }> = {
  critical: { label: "Critical", bg: "#000",                                   text: "#fff",                          dot: "#000" },
  high:     { label: "High",     bg: "var(--color-background-danger-soft)",    text: "var(--color-text-danger-soft)", dot: "var(--red-400)" },
  medium:   { label: "Medium",   bg: "var(--color-background-caution-soft)",   text: "var(--color-text-caution-soft)", dot: "var(--yellow-400)" },
  low:      { label: "Low",      bg: "var(--color-background-info-soft)",      text: "var(--color-text-info-soft)",   dot: "var(--blue-400)" },
}

const KIND_CFG = {
  discrepancy: { label: "Contradiction", hint: "Your documents disagree — reconcile them", Icon: GitCompareArrows },
  exposure:    { label: "Exposure",      hint: "This position may be challenged",          Icon: ShieldAlert },
} as const

export default function RisksStep({ engagementId, jurisdictions, entity }: {
  engagementId: string | null
  jurisdictions: string[]
  entity: string
}) {
  const [riskByJuris, setRiskByJuris] = useState<Record<string, RiskResponse>>({})
  const [started, setStarted] = useState<Set<string>>(new Set())
  const [notReady, setNotReady] = useState<Set<string>>(new Set())
  const [activeJurisdiction, setActive] = useState(jurisdictions[0] ?? "")
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
  const s = risk?.summary

  function exportRegister() {
    const title = `${entity || "Entity"} — ${activeJurisdiction} · Risk Register`
    const body = findings.map(f => {
      const ev = f.evidence.map(e => `<li><em>${e.kind}</em> — ${e.reference}: ${e.detail}</li>`).join("")
      const rec = f.recommendations.map(r => `<li>${r}</li>`).join("")
      return `<div class="f"><h3>[${f.severity.toUpperCase()} · ${KIND_CFG[f.kind].label}] ${f.title}</h3>` +
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

  if (!engagementId) return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Preparing session…</main>
  if (jurisdictions.length === 0) return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Select a jurisdiction in Planning first.</main>

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Jurisdiction tabs */}
      <div style={{ background: "var(--color-surface)", padding: "1rem 3.5rem 0.75rem", display: "flex", gap: "0.375rem", flexWrap: "wrap", borderBottom: "1px solid var(--color-border)" }}>
        {jurisdictions.map(j => {
          const isActive = j === activeJurisdiction
          const isStarted = started.has(j)
          const processing = isStarted && analyzing(riskByJuris[j])
          return (
            <button key={j} type="button" onClick={() => selectJurisdiction(j)} style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem",
              padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "none", cursor: "pointer",
              background: isActive ? "var(--color-background-primary-solid)" : isStarted ? "var(--alpha-06)" : "transparent",
              color: isActive ? "var(--color-text-inverse)" : isStarted ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
              fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
              opacity: isStarted ? 1 : 0.55, transition: "all var(--transition-duration-basic)",
            }}>
              {processing && <Loader2 size={11} className="animate-spin" />}
              {j}
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <main style={{ padding: "2rem 3.5rem 3rem", maxWidth: 820 }}>

          <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.375rem" }}>
                Where are you exposed?
              </h1>
              {s && risk?.status === "done" && (
                <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>
                  {s.total} finding{s.total === 1 ? "" : "s"} · {s.by_kind.exposure ?? 0} exposure · {s.by_kind.discrepancy ?? 0} contradiction · {activeJurisdiction}
                </p>
              )}
            </div>
            {risk?.status === "done" && findings.length > 0 && (
              <button type="button" onClick={exportRegister} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-md)", borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer", flexShrink: 0 }}>
                <Download size={14} /> Export register
              </button>
            )}
          </div>

          {error && <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-danger-soft)" }}>Couldn’t load risks. Is the backend running? ({error})</p>}

          {notReady.has(activeJurisdiction) ? (
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: "0 0 0.75rem" }}>
                Risks run on the finished file. Complete the <strong>Draft</strong> for {activeJurisdiction} first, then check here.
              </p>
              <button type="button" onClick={() => retry(activeJurisdiction)} style={{ height: "var(--control-size-sm)", padding: "0 var(--control-gutter-md)", borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", fontSize: "var(--control-font-size-md)", cursor: "pointer" }}>Check again</button>
            </div>
          ) : analyzing(risk) || (!risk && !error) ? (
            <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>
              <Loader2 size={14} className="animate-spin" /> Analysing the {activeJurisdiction} file for risk…
            </p>
          ) : risk?.status === "failed" ? (
            <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-danger-soft)" }}>Analysis failed: {risk.error}</p>
          ) : findings.length === 0 ? (
            <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>No risks surfaced for this file.</p>
          ) : (
            <>
              <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: "0 0 1rem" }}>
                Exposure figures are flagged estimates, not computed — verify against the record before acting.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {findings.map(f => <FindingCard key={f.id} f={f} open={expanded.has(f.id)} onToggle={() => setExpanded(prev => { const n = new Set(prev); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n })} />)}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function FindingCard({ f, open, onToggle }: { f: RiskFinding; open: boolean; onToggle: () => void }) {
  const sev = SEV_CFG[f.severity]
  const kind = KIND_CFG[f.kind]
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <button type="button" onClick={onToggle} style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", width: "100%", padding: "1rem 1.25rem", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>
        <kind.Icon size={16} style={{ color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: "0.125rem" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
            <span style={{ padding: "2px 8px", borderRadius: "9999px", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", background: sev.bg, color: sev.text }}>{sev.label}</span>
            <span style={{ padding: "2px 8px", borderRadius: "9999px", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", background: "var(--alpha-06)", color: "var(--color-text-secondary)" }}>{kind.label}</span>
            <span style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{f.title}</span>
          </div>
          <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>{f.description}</p>
          {!open && f.exposure_label && (
            <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: "0.375rem 0 0" }}>
              {kind.hint} · Exposure: {f.exposure_label}{f.exposure_estimated ? " (est.)" : ""}
            </p>
          )}
        </div>
        <span style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--color-border)", padding: "1rem 1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.375rem" }}>Exposure</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text)", fontWeight: "var(--font-weight-medium)" }}>{f.exposure_label ?? "—"}</span>
              {f.exposure_estimated && <span style={{ padding: "1px 7px", borderRadius: "9999px", fontSize: "10px", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", background: "var(--color-background-caution-soft)", color: "var(--color-text-caution-soft)", textTransform: "uppercase" }}>Estimated</span>}
              <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>· {f.confidence} confidence</span>
            </div>
          </div>

          <div>
            <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.375rem" }}>Evidence</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {f.evidence.map((e, i) => (
                <div key={i} style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", marginRight: "0.375rem" }}>{e.kind}</span>
                  <span style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{e.reference}</span> — {e.detail}
                  {e.document_id && (
                    <span title="Traceable to a source document on file" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginLeft: "0.5rem", padding: "0 6px", borderRadius: "9999px", fontSize: "10px", fontWeight: "var(--font-weight-medium)", background: "var(--color-background-info-soft)", color: "var(--color-text-info-soft)", verticalAlign: "middle" }}>
                      <FileText size={10} /> Source document
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.375rem" }}>Your options</p>
            <ul style={{ margin: 0, padding: "0 0 0 1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {f.recommendations.map((r, i) => (
                <li key={i} style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", lineHeight: 1.55 }}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
