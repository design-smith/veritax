"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Upload, Check, ShieldCheck, AlertTriangle, Loader2, FileText, ArrowRight } from "lucide-react"
import { api, type CoverageResponse, type CoverageStatusValue } from "@/lib/api"

type Seg = "present" | "partial" | "missing"

const STATUS_CFG: Record<CoverageStatusValue, { label: string; bg: string; text: string; dot: string }> = {
  present:     { label: "Present",     bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", dot: "var(--green-400)" },
  partial:     { label: "Partial",     bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", dot: "var(--yellow-400)" },
  missing:     { label: "Missing",     bg: "var(--color-background-danger-soft)",  text: "var(--color-text-danger-soft)",  dot: "var(--red-400)" },
  conditional: { label: "Conditional", bg: "var(--alpha-06)",                      text: "var(--color-text-tertiary)",     dot: "var(--gray-300)" },
  pending:     { label: "Assessing…",  bg: "var(--alpha-06)",                      text: "var(--color-text-tertiary)",     dot: "var(--gray-300)" },
  failed:      { label: "Failed",      bg: "var(--color-background-danger-soft)",  text: "var(--color-text-danger-soft)",  dot: "var(--red-400)" },
}

const KIND_CHIP: Record<string, { bg: string; text: string; label: string }> = {
  financials: { bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", label: "Financials" },
  agreements: { bg: "var(--color-background-info-soft)",    text: "var(--color-text-info-soft)",    label: "Agreements" },
  public:     { bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", label: "Website" },
  interview:  { bg: "var(--color-background-discovery-soft)", text: "var(--color-text-discovery-soft)", label: "Interview" },
  supplement: { bg: "var(--color-background-primary-soft)", text: "var(--color-text)",              label: "Supplement" },
}

function CoverageDonut({ present, partial, missing, active, onToggle, size = 52 }: {
  present: number; partial: number; missing: number
  active: Set<Seg>; onToggle: (c: Seg) => void; size?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = present + partial + missing
  const stroke = Math.max(6, Math.round(size * 0.16))
  const pad = Math.max(2, Math.round(size * 0.04))
  const r = (size - stroke - pad * 2) / 2
  const C = 2 * Math.PI * r
  const bump = Math.max(3, Math.round(stroke * 0.4))
  const allSegs: { key: Seg; label: string; count: number; color: string }[] = [
    { key: "present", label: "Present", count: present, color: "var(--green-400)" },
    { key: "partial", label: "Partial", count: partial, color: "var(--yellow-400)" },
    { key: "missing", label: "Missing", count: missing, color: "var(--red-400)" },
  ]
  const segs = allSegs.filter(s => s.count > 0)

  let acc = 0
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        {total === 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-200)" strokeWidth={stroke} />
        )}
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
      {hover !== null && segs[hover] && (
        <div style={{ position: "absolute", left: "50%", top: -6, transform: "translate(-50%, -100%)", background: "var(--color-text)", color: "var(--color-surface)", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", padding: "4px 10px", borderRadius: "var(--radius-md)", whiteSpace: "nowrap", boxShadow: "var(--shadow-300)", pointerEvents: "none" }}>
          {segs[hover].label} · {segs[hover].count}{active.has(segs[hover].key) ? " · filtering" : ""}
        </div>
      )}
    </div>
  )
}

export default function RequirementsStep({ engagementId, jurisdictions, onContinue, onBack, onOpenDraftSection }: {
  engagementId: string | null
  jurisdictions: string[]
  onContinue: () => void
  onBack: () => void
  onOpenDraftSection: (jurisdiction: string, sectionId: string) => void
}) {
  const [coverageByJuris, setCoverageByJuris] = useState<Record<string, CoverageResponse>>({})
  const [started, setStarted] = useState<Set<string>>(new Set())
  const [activeJurisdiction, setActive] = useState(jurisdictions[0] ?? "")
  const [error, setError] = useState<string | null>(null)
  const [openReqId, setOpenReqId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Set<Seg>>(new Set())
  const [supplementText, setSupplementText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // Documents index HERE (not on the Planning screen). Assessment waits until they're all embedded.
  const [docReady, setDocReady] = useState(false)
  const [indexStatus, setIndexStatus] = useState<{ done: number; total: number; failed: number }>({ done: 0, total: 0, failed: 0 })

  const coverageRef = useRef(coverageByJuris); coverageRef.current = coverageByJuris
  const startedRef = useRef(started); startedRef.current = started
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setCoverage = (j: string, data: CoverageResponse) => setCoverageByJuris(prev => ({ ...prev, [j]: data }))

  // Poll every started jurisdiction that still has pending rows; stop when none do.
  const poll = useCallback(async () => {
    pollRef.current = null
    if (!engagementId) return
    const js = [...startedRef.current]
    const results = await Promise.all(js.map(async j => {
      try { return [j, await api.getCoverage(engagementId, j)] as const }
      catch (e) { console.error("[veritax] poll failed:", e); return [j, coverageRef.current[j]] as const }
    }))
    const merged: Record<string, CoverageResponse> = {}
    for (const [j, d] of results) if (d) merged[j] = d
    setCoverageByJuris(prev => ({ ...prev, ...merged }))
    if (Object.values(merged).some(d => d.summary.pending > 0)) pollRef.current = setTimeout(poll, 1500)
  }, [engagementId])

  const startJurisdiction = useCallback(async (j: string) => {
    if (!engagementId || !j || startedRef.current.has(j)) return
    setStarted(prev => new Set(prev).add(j))
    startedRef.current = new Set(startedRef.current).add(j)
    try {
      const d = await api.startCoverage(engagementId, j)
      setCoverage(j, d)
      if (d.summary.pending > 0 && !pollRef.current) pollRef.current = setTimeout(poll, 1200)
    } catch (e) {
      console.error("[veritax] failed to start coverage:", e)
      setError(String(e))
    }
  }, [engagementId, poll])

  // Index-first: poll the engagement's document statuses until every uploaded file is embedded
  // (or failed) before any assessment starts, so no requirement is assessed on empty context.
  useEffect(() => {
    if (!engagementId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const check = async () => {
      try {
        const eng = await api.getEngagement(engagementId)
        const docs = eng.sources.flatMap(sc => sc.documents)
        const total = docs.length
        const done = docs.filter(d => d.status === "embedded" || d.status === "failed").length
        const failed = docs.filter(d => d.status === "failed").length
        if (cancelled) return
        setIndexStatus({ done, total, failed })
        if (total === 0 || done >= total) setDocReady(true)
        else timer = setTimeout(check, 1500)
      } catch (e) {
        console.error("[veritax] index status poll failed:", e)
        if (!cancelled) timer = setTimeout(check, 2000)
      }
    }
    check()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [engagementId])

  // Once documents are indexed, start assessing the FIRST jurisdiction. The rest stay grey until selected.
  useEffect(() => {
    if (!engagementId || jurisdictions.length === 0 || !docReady) return
    setActive(prev => (jurisdictions.includes(prev) ? prev : jurisdictions[0]))
    startJurisdiction(jurisdictions[0])
    return () => { if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null } }
  }, [engagementId, jurisdictions, startJurisdiction, docReady])

  function selectJurisdiction(j: string) {
    setActive(j)
    setOpenReqId(null)
    setFilters(new Set())
    if (docReady) startJurisdiction(j)  // begins processing if it hasn't been yet
  }

  const coverage = coverageByJuris[activeJurisdiction] ?? null
  const rows = coverage?.requirements ?? []
  const s = coverage?.summary
  const openReq = rows.find(r => r.id === openReqId) ?? null

  const toggleFilter = (c: Seg) => setFilters(prev => {
    const n = new Set(prev)
    if (n.has(c)) n.delete(c)
    else if (n.size < 2) n.add(c)
    return n
  })

  // Reveal requirements one-by-one: assessment runs sequentially in element order, so completed rows
  // are a prefix. Show all completed rows plus the single one currently being assessed (the first
  // still-pending), and hold back the rest until their turn.
  const revealed = (() => {
    const ordered = [...rows].sort((a, b) => a.element_order - b.element_order)
    const out: typeof ordered = []
    for (const r of ordered) {
      out.push(r)
      if (r.status === "pending") break
    }
    return out
  })()
  const shownRows = filters.size === 0 ? revealed : revealed.filter(r => (filters as Set<string>).has(r.status))

  async function supplement(body: { kind: "upload"; file: File } | { kind: "text"; text: string }) {
    if (!openReq || !engagementId) return
    setSubmitting(true)
    try {
      await api.supplementCoverage(openReq.id, body)
      setCoverage(activeJurisdiction, await api.getCoverage(engagementId, activeJurisdiction))
      setSupplementText("")
    } catch (e) {
      console.error("[veritax] supplement failed:", e)
    } finally {
      setSubmitting(false)
    }
  }

  if (!engagementId) {
    return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Preparing session…</main>
  }
  if (jurisdictions.length === 0) {
    return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Select a jurisdiction in Planning first.</main>
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>

        {/* Jurisdiction tabs — all picked jurisdictions (like Draft) */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--color-surface)", padding: "1rem 3.5rem 0.75rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {jurisdictions.map(j => {
            const isActive = j === activeJurisdiction
            const cov = coverageByJuris[j]
            const isStarted = started.has(j)
            const processing = isStarted && (!cov || cov.summary.pending > 0)
            return (
              <button key={j} type="button" onClick={() => selectJurisdiction(j)} title={isStarted ? undefined : "Not processed yet — click to assess"} style={{
                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "none", cursor: "pointer",
                background: isActive ? "var(--color-background-primary-solid)" : isStarted ? "var(--alpha-06)" : "transparent",
                color: isActive ? "var(--color-text-inverse)" : isStarted ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
                fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
                opacity: isStarted ? 1 : 0.55,  // grey when not yet processed
                transition: "all var(--transition-duration-basic)",
              }}>
                {processing && <Loader2 size={11} className="animate-spin" />}
                {j}
              </button>
            )
          })}
        </div>

        <div style={{ padding: "1.5rem 3.5rem 3rem", maxWidth: 760 }}>

          {/* Header — question + summary + inline donut */}
          <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
            <div>
              <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.375rem" }}>
                What does this file legally need to contain?
              </h1>
              {s && (
                <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>
                  {s.present} of {s.required_total} covered
                  {s.need_attention > 0 && <span style={{ color: "var(--color-text-danger-soft)" }}> · {s.need_attention} need attention</span>}
                  {s.pending > 0 && <span style={{ color: "var(--color-text-tertiary)" }}> · assessing {s.pending}…</span>}
                  <span style={{ color: "var(--color-text-tertiary)" }}> · {activeJurisdiction}</span>
                </p>
              )}
            </div>
            <CoverageDonut present={s?.present ?? 0} partial={s?.partial ?? 0} missing={s?.missing ?? 0} active={filters} onToggle={toggleFilter} size={52} />
          </div>

          {error && (
            <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-danger-soft)", marginBottom: "1rem" }}>
              Couldn’t load requirements. Is the backend running? ({error})
            </p>
          )}
          {!docReady && !error ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>
                <Loader2 size={14} className="animate-spin" />
                Indexing documents{indexStatus.total > 0 ? ` — ${indexStatus.done} of ${indexStatus.total}` : "…"}
              </p>
              <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0 }}>
                Requirements are assessed once the documents finish indexing.
              </p>
              {indexStatus.failed > 0 && (
                <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-danger-soft)", margin: 0 }}>
                  {indexStatus.failed} document{indexStatus.failed === 1 ? "" : "s"} failed to index — re-upload from Planning.
                </p>
              )}
            </div>
          ) : !coverage && !error ? (
            <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>
              <Loader2 size={14} className="animate-spin" /> Assessing {activeJurisdiction}…
            </p>
          ) : null}

          {/* Requirements list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {shownRows.map((row, idx) => {
              const cfg = STATUS_CFG[row.status]
              const isLast = idx === shownRows.length - 1
              const selected = openReqId === row.id
              return (
                <div key={row.id}
                  onClick={() => { setOpenReqId(row.id); setSupplementText("") }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--color-background-primary-ghost-hover)" }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent" }}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: "1rem", cursor: "pointer",
                    padding: "0.875rem 0.75rem",
                    borderBottom: isLast ? "none" : "1px solid var(--color-border)",
                    background: selected ? "var(--color-background-primary-soft)" : "transparent",
                    borderRadius: "var(--radius-md)",
                  }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      {row.status === "pending"
                        ? <Loader2 size={11} className="animate-spin" style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
                        : <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 1 }} />}
                      <span style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>
                        {row.element_name}
                      </span>
                      {!row.verified && (
                        <span title="Not yet confirmed against statute" style={{ display: "inline-flex", color: "var(--color-text-caution-soft)" }}>
                          <AlertTriangle size={11} />
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0, paddingLeft: "1.1875rem", lineHeight: 1.5 }}>
                      {row.element_description}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem", paddingTop: "0.125rem" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "9999px", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>
                      {cfg.label}
                    </span>
                    {row.sources_used.length > 0 && (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {row.sources_used.map(k => {
                          const c = KIND_CHIP[k] ?? { bg: "var(--alpha-06)", text: "var(--color-text-tertiary)", label: k }
                          return <span key={k} style={{ padding: "1px 6px", borderRadius: "var(--radius-xs)", fontSize: "10px", fontWeight: "var(--font-weight-medium)", background: c.bg, color: c.text }}>{c.label}</span>
                        })}
                      </div>
                    )}
                  </div>
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
              fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer",
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
      {openReq && (() => {
        const cfg = STATUS_CFG[openReq.status]
        const canSupplement = openReq.status === "partial" || openReq.status === "missing" || openReq.status === "failed"
        return (
          <aside style={{ width: 360, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", borderBottom: "1px solid var(--color-border)", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                <span style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", color: cfg.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>{cfg.label}</span>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpenReqId(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: "16px", lineHeight: 1, padding: 2 }}>×</button>
            </div>

            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.5rem" }}>{openReq.element_name}</h3>
                <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.6, color: "var(--color-text-secondary)", margin: 0 }}>{openReq.element_description}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.625rem", fontSize: "var(--font-text-xs-size)", color: openReq.verified ? "var(--color-text-success-soft)" : "var(--color-text-caution-soft)" }}>
                  {openReq.verified ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                  {openReq.verified ? "Confirmed against statute" : "Needs review — not yet confirmed against statute"}
                </div>
              </div>

              {openReq.whats_present && (
                <div>
                  <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.375rem" }}>What’s present</p>
                  <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6 }}>{openReq.whats_present}</p>
                </div>
              )}

              {openReq.whats_missing && (
                <div>
                  <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.375rem" }}>What’s missing</p>
                  <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text)", margin: 0, lineHeight: 1.6 }}>{openReq.whats_missing}</p>
                </div>
              )}

              {openReq.sources_used.length > 0 && (
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  {openReq.sources_used.map(k => {
                    const c = KIND_CHIP[k] ?? { bg: "var(--alpha-06)", text: "var(--color-text-tertiary)", label: k }
                    return <span key={k} style={{ padding: "1px 8px", borderRadius: "9999px", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", background: c.bg, color: c.text }}>{c.label}</span>
                  })}
                </div>
              )}

              {/* Provenance: which document + where satisfies this requirement */}
              {openReq.evidence.length > 0 && (
                <div>
                  <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.5rem" }}>Where it’s satisfied</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {openReq.evidence.map((ev, i) => (
                      <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.5rem 0.625rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                          <FileText size={12} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
                          <span style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)", wordBreak: "break-word" }}>{ev.source_label}</span>
                        </div>
                        <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>“{ev.locator}”</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements → draft: jump to the section that fulfils this requirement */}
              {openReq.draft_section_id && (
                <button type="button" onClick={() => onOpenDraftSection(activeJurisdiction, openReq.draft_section_id!)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", alignSelf: "flex-start", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-sm)", borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer" }}>
                  Covered in the draft <ArrowRight size={13} />
                </button>
              )}

              {canSupplement && (
                <>
                  <div style={{ height: 1, background: "var(--color-border)" }} />
                  <div>
                    <p style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.375rem" }}>Supplement</p>
                    <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: "0 0 0.625rem", lineHeight: 1.5 }}>
                      Add material to fill this gap — it re-assesses this requirement and flows into the draft.
                    </p>
                    <textarea
                      value={supplementText}
                      onChange={e => setSupplementText(e.target.value)}
                      placeholder="Type the missing information here…"
                      rows={4}
                      style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "0.5rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--input-outline-border-color)", background: "transparent", fontSize: "var(--font-text-sm-size)", color: "var(--color-text)", outline: "none", fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button type="button" disabled={submitting || !supplementText.trim()} onClick={() => supplement({ kind: "text", text: supplementText })}
                        style={{ height: "var(--control-size-sm)", padding: "0 var(--control-gutter-md)", borderRadius: "var(--control-radius-md)", border: "none", background: (submitting || !supplementText.trim()) ? "var(--alpha-08)" : "var(--color-background-primary-solid)", color: (submitting || !supplementText.trim()) ? "var(--color-text-tertiary)" : "var(--color-text-inverse)", fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: (submitting || !supplementText.trim()) ? "not-allowed" : "pointer" }}>
                        {submitting ? "Re-assessing…" : "Add & re-assess"}
                      </button>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-sm)", borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent", fontSize: "var(--control-font-size-md)", color: "var(--color-text-secondary)", cursor: submitting ? "not-allowed" : "pointer" }}>
                        <Upload size={14} /> Upload
                        <input type="file" style={{ display: "none" }} disabled={submitting} onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) void supplement({ kind: "upload", file: f })
                          e.currentTarget.value = ""
                        }} />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {openReq.status === "present" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-success-soft)" }}>
                  <Check size={13} /> Enough information to write this section.
                </div>
              )}
            </div>
          </aside>
        )
      })()}
    </div>
  )
}
