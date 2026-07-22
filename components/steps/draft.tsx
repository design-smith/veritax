"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { api, type DraftResponse } from "@/lib/api"
import { markdownToSfdt, type DocSection } from "@/lib/sfdt"

// Syncfusion touches the DOM at load — keep it out of SSR.
const DraftDocEditor = dynamic(() => import("./DraftDocEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-sm-size)" }}>
      <Loader2 size={16} className="animate-spin" style={{ marginRight: "0.5rem" }} /> Loading editor…
    </div>
  ),
})

const stripLeadingHeading = (content: string) => content.replace(/^\s*#{1,4}\s+.*\n+/, "")

export default function DraftStep({ engagementId, jurisdictions, entity, onContinue, jumpTo, onJumped }: {
  engagementId: string | null
  jurisdictions: string[]
  entity: string
  onContinue: () => void
  jumpTo?: { jurisdiction: string; sectionId: string } | null
  onJumped?: () => void
}) {
  const [draftByJuris, setDraftByJuris] = useState<Record<string, DraftResponse>>({})
  const [started, setStarted] = useState<Set<string>>(new Set())
  const [activeJurisdiction, setActive] = useState(jurisdictions[0] ?? "")
  const [error, setError] = useState<string | null>(null)

  const draftRef = useRef(draftByJuris); draftRef.current = draftByJuris
  const startedRef = useRef(started); startedRef.current = started
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setDraft = (j: string, data: DraftResponse) => setDraftByJuris(prev => ({ ...prev, [j]: data }))

  const poll = useCallback(async () => {
    pollRef.current = null
    if (!engagementId) return
    const js = [...startedRef.current]
    const results = await Promise.all(js.map(async j => {
      try { return [j, await api.getDraft(engagementId, j)] as const }
      catch (e) { console.error("[veritax] draft poll failed:", e); return [j, draftRef.current[j]] as const }
    }))
    const merged: Record<string, DraftResponse> = {}
    for (const [j, d] of results) if (d) merged[j] = d
    setDraftByJuris(prev => ({ ...prev, ...merged }))
    if (Object.values(merged).some(d => d.summary.pending > 0)) pollRef.current = setTimeout(poll, 1800)
  }, [engagementId])

  const startJurisdiction = useCallback(async (j: string) => {
    if (!engagementId || !j || startedRef.current.has(j)) return
    setStarted(prev => new Set(prev).add(j))
    startedRef.current = new Set(startedRef.current).add(j)
    try {
      const d = await api.startDraft(engagementId, j)
      setDraft(j, d)
      if (d.summary.pending > 0 && !pollRef.current) pollRef.current = setTimeout(poll, 1200)
    } catch (e) {
      console.error("[veritax] failed to start draft:", e)
      setError(String(e))
    }
  }, [engagementId, poll])

  // Process only the FIRST jurisdiction on entry; the rest start when selected.
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

  // Deep-link from Requirements: focus that jurisdiction (section-level scroll no longer applies).
  useEffect(() => {
    if (!jumpTo) return
    selectJurisdiction(jumpTo.jurisdiction)
    onJumped?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo])

  const draft = draftByJuris[activeJurisdiction] ?? null
  const complete = !!draft && draft.summary.total > 0 && draft.summary.pending === 0

  // Assemble the whole jurisdiction into one A4 document once its sections are all drafted.
  const sfdt = useMemo(() => {
    if (!complete || !draft) return ""
    const sections: DocSection[] = draft.sections.map(s => ({
      heading: `${s.element_order}. ${s.element_name}`,
      markdown: stripLeadingHeading(s.content ?? ""),
      bookmark: `sec_${s.element_order}`,
    }))
    return markdownToSfdt(`${entity || "Entity"} — ${activeJurisdiction}`, sections)
  }, [complete, draft, entity, activeJurisdiction])

  const navItems = useMemo(
    () => (draft?.sections ?? []).map(s => ({ order: s.element_order, name: s.element_name, bookmark: `sec_${s.element_order}` })),
    [draft],
  )

  if (!engagementId) return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Preparing session…</main>
  if (jurisdictions.length === 0) return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Select a jurisdiction in Planning first.</main>

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Jurisdiction tabs */}
      <div style={{ background: "var(--color-surface)", padding: "1rem 3.5rem 0.75rem", display: "flex", gap: "0.375rem", flexWrap: "wrap", borderBottom: "1px solid var(--color-border)" }}>
        {jurisdictions.map(j => {
          const isActive = j === activeJurisdiction
          const d = draftByJuris[j]
          const isStarted = started.has(j)
          const processing = isStarted && (!d || d.summary.pending > 0)
          return (
            <button key={j} type="button" onClick={() => selectJurisdiction(j)} title={isStarted ? undefined : "Not drafted yet — click to draft"} style={{
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

      {/* Body — the document editor once drafting is complete, otherwise progress */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {error && (
          <p style={{ padding: "1rem 3.5rem", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-danger-soft)" }}>
            Couldn’t load draft. Is the backend running? ({error})
          </p>
        )}
        {!error && !complete && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--color-text-tertiary)" }}>
            <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-text-sm-size)" }}>
              <Loader2 size={14} className="animate-spin" /> Drafting {activeJurisdiction}…
            </p>
            {draft && draft.summary.total > 0 && (
              <p style={{ fontSize: "var(--font-text-xs-size)" }}>{draft.summary.drafted} of {draft.summary.total} sections</p>
            )}
          </div>
        )}
        {!error && complete && <DraftDocEditor sfdt={sfdt} fileName={`${entity || "Entity"} ${activeJurisdiction}`} sections={navItems} />}
      </div>

      {/* Continue */}
      <div style={{ borderTop: "1px solid var(--color-border)", padding: "0.875rem 3.5rem", background: "var(--color-surface)", flexShrink: 0 }}>
        <button type="button" onClick={onContinue} style={{
          height: "var(--control-size-md)", padding: "0 var(--control-gutter-lg)",
          borderRadius: "var(--control-radius-md)", border: "none",
          background: "var(--color-background-primary-solid)", color: "var(--color-text-inverse)",
          fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer",
        }}>Continue to Risks</button>
      </div>
    </div>
  )
}
