"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { api, type DraftResponse, type DraftSection } from "@/lib/api"
import { Animate } from "@/components/ui/transition"
import DraftDocument, { DraftCover } from "./DraftDocument"

const FIRST_REVEAL_SECTIONS = 5
const TYPE_CHARS_PER_TICK = 3
const TYPE_TICK_MS = 24

const stripLeadingHeading = (content: string) => content.replace(/^\s*#{1,4}\s+.*\n+/, "")
const stripObjectMarkers = (content: string) => content.replace(/\[\[(table|chart):([^\]]+)\]\]/g, "")

function statusPhrases(entity: string, jurisdiction: string) {
  const company = entity.trim() || "the company"
  return [
    "Merging requirements into the file structure",
    `Reading the ${company} source record`,
    "Reconciling coverage notes with source evidence",
    `Writing cited ${jurisdiction} local-file language`,
    "Threading citations back to the record",
    "Smoothing the section narrative",
  ]
}

function draftedSections(draft: DraftResponse | null): DraftSection[] {
  return [...(draft?.sections ?? [])]
    .filter(s => s.status === "drafted" && !!s.content)
    .sort((a, b) => a.element_order - b.element_order)
}

function sectionText(section: DraftSection) {
  const body = stripObjectMarkers(stripLeadingHeading(section.content ?? "")).trim()
  return `## ${section.element_order}. ${section.element_name}\n\n${body}\n\n`
}

function TypedDraftText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div style={{ color: "var(--color-text)" }}>
      {blocks.map((block, idx) => {
        const value = block.trimEnd()
        if (!value && idx < blocks.length - 1) return null
        const heading = value.match(/^(#{1,6})\s*(.*)$/)
        if (heading) {
          const level = heading[1].length
          const HeadingTag = (level <= 2 ? "h2" : "h3") as "h2" | "h3"
          const style = level <= 2
            ? { fontSize: "18px", fontWeight: "var(--font-weight-semibold)", margin: "1.5rem 0 0.5rem", color: "var(--color-text)" }
            : { fontSize: "15px", fontWeight: "var(--font-weight-medium)", margin: "1rem 0 0.375rem", color: "var(--color-text)" }
          return (
            <HeadingTag key={idx} style={style}>
              {heading[2]}
              {idx === blocks.length - 1 && <span className="vt-type-cursor" />}
            </HeadingTag>
          )
        }
        return (
          <p key={idx} style={{ whiteSpace: "pre-wrap", fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text-secondary)", margin: "0 0 0.875rem" }}>
            {value}
            {idx === blocks.length - 1 && <span className="vt-type-cursor" />}
          </p>
        )
      })}
    </div>
  )
}

function DraftGenerationPreview({ draft, entity, jurisdiction, complete, onTypedComplete }: {
  draft: DraftResponse | null
  entity: string
  jurisdiction: string
  complete: boolean
  onTypedComplete: () => void
}) {
  const [typedText, setTypedText] = useState("")
  const [phraseIndex, setPhraseIndex] = useState(0)
  const phrases = useMemo(() => statusPhrases(entity, jurisdiction), [entity, jurisdiction])
  const readySections = useMemo(() => draftedSections(draft), [draft])
  const total = draft?.summary.total ?? 0
  const revealAt = Math.min(FIRST_REVEAL_SECTIONS, total || FIRST_REVEAL_SECTIONS)
  const readyToType = readySections.length >= revealAt || (complete && readySections.length > 0)
  const sourceText = useMemo(() => readySections.map(sectionText).join("\n"), [readySections])

  useEffect(() => {
    setTypedText("")
    setPhraseIndex(0)
  }, [jurisdiction])

  useEffect(() => {
    setTypedText(prev => (sourceText.startsWith(prev) ? prev : ""))
  }, [sourceText])

  useEffect(() => {
    const timer = setInterval(() => setPhraseIndex(i => (i + 1) % phrases.length), 2600)
    return () => clearInterval(timer)
  }, [phrases.length])

  useEffect(() => {
    if (!readyToType || typedText.length >= sourceText.length) return
    const timer = setTimeout(() => {
      setTypedText(sourceText.slice(0, Math.min(sourceText.length, typedText.length + TYPE_CHARS_PER_TICK)))
    }, TYPE_TICK_MS)
    return () => clearTimeout(timer)
  }, [readyToType, sourceText, typedText])

  useEffect(() => {
    if (complete && sourceText && typedText.length >= sourceText.length) onTypedComplete()
  }, [complete, onTypedComplete, sourceText, typedText.length])

  if (!readyToType) {
    return (
      <Animate enter="fade" duration={150} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.625rem", color: "var(--color-text-tertiary)", padding: "2rem", textAlign: "center" }}>
        <Loader2 size={16} className="animate-spin" />
        <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>
          {phrases[phraseIndex]}
        </p>
      </Animate>
    )
  }

  return (
    <Animate enter="fade" duration={160} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--color-surface-secondary)" }}>
      <div style={{ flexShrink: 0, padding: "0.65rem 3.5rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)" }}>
        {!complete && <Loader2 size={12} className="animate-spin" />}
        <span>{complete ? "Finishing the file" : phrases[phraseIndex]}</span>
      </div>
      <div className="vt-a4-scroll">
        <article className="vt-a4-page">
          <span className="vt-a4-page-label">Page 1</span>
          <DraftCover entity={entity} jurisdiction={jurisdiction} />
        </article>
        <article className="vt-a4-page">
          <span className="vt-a4-page-label">Drafting</span>
          <TypedDraftText text={typedText} />
        </article>
      </div>
    </Animate>
  )
}

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
  const [retrying, setRetrying] = useState(false)
  const [typedDoneByJuris, setTypedDoneByJuris] = useState<Record<string, boolean>>({})

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

  async function retryDraft() {
    if (!engagementId) return
    setRetrying(true)
    setError(null)
    try {
      await api.recoverPipeline(engagementId, true)
      try { setDraft(activeJurisdiction, await api.getDraft(engagementId, activeJurisdiction)) }
      catch (e) { console.error("[veritax] retry draft refresh failed:", e) }
      if (!pollRef.current) pollRef.current = setTimeout(poll, 600)
    } catch (e) {
      console.error("[veritax] draft retry failed:", e)
      setError(String(e))
    } finally {
      setRetrying(false)
    }
  }

  // Deep-link from Requirements: focus that jurisdiction (section-level scroll no longer applies).
  useEffect(() => {
    if (!jumpTo) return
    selectJurisdiction(jumpTo.jurisdiction)
    onJumped?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo])

  const draft = draftByJuris[activeJurisdiction] ?? null
  const failedSections = draft?.sections.filter(s => s.status === "failed") ?? []
  const failed = failedSections.length > 0
  const complete = !!draft && draft.summary.total > 0 && draft.summary.pending === 0 && !failed
  const typedDone = typedDoneByJuris[activeJurisdiction] === true

  useEffect(() => {
    if (!complete) setTypedDoneByJuris(prev => ({ ...prev, [activeJurisdiction]: false }))
  }, [activeJurisdiction, complete])

  if (!engagementId) return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Preparing session…</main>
  if (jurisdictions.length === 0) return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Select a jurisdiction in Planning first.</main>

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Jurisdiction tabs */}
      <div style={{ background: "var(--color-surface)", padding: "1rem 3.5rem 0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
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
        <button type="button" disabled={!complete} onClick={onContinue} style={{
          height: "var(--control-size-md)", padding: "0 var(--control-gutter-lg)",
          borderRadius: "var(--control-radius-md)", border: "none", flexShrink: 0,
          background: complete ? "var(--color-background-primary-solid)" : "var(--alpha-08)",
          color: complete ? "var(--color-text-inverse)" : "var(--color-text-tertiary)",
          fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: complete ? "pointer" : "not-allowed",
        }}>Continue to Risks</button>
      </div>

      {/* Body — the document editor once drafting is complete, otherwise progress */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {error && (
          <p style={{ padding: "1rem 3.5rem", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-danger-soft)" }}>
            Couldn’t load draft. Is the backend running? ({error})
          </p>
        )}
        {draft?.draft_mode === "fake" && (
          <p style={{ padding: "0.625rem 3.5rem", margin: 0, fontSize: "var(--font-text-xs-size)", color: "#8a5a00", background: "#fff8e5", borderTop: "1px solid #f0d58c", borderBottom: "1px solid #f0d58c" }}>
            Development mode: this draft is generated by the fake drafter, not a real model.
          </p>
        )}
        {!error && failed && (
          <Animate enter="slide-up" duration={150} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.625rem", color: "var(--color-text-tertiary)", padding: "2rem", textAlign: "center" }}>
            <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-danger-soft)", margin: 0 }}>
              Drafting failed for {failedSections.length} section{failedSections.length === 1 ? "" : "s"} in {activeJurisdiction}.
            </p>
            {failedSections[0] && (
              <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", margin: 0, maxWidth: 520 }}>
                {failedSections[0].element_name}: {failedSections[0].error || "No backend error returned."}
              </p>
            )}
            <button type="button" onClick={retryDraft} disabled={retrying} style={{
              height: "var(--control-size-md)", padding: "0 var(--control-gutter-lg)",
              borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)",
              background: "transparent", color: "var(--color-text-secondary)",
              fontSize: "var(--control-font-size-md)", cursor: retrying ? "not-allowed" : "pointer",
            }}>{retrying ? "Retrying..." : "Retry draft"}</button>
          </Animate>
        )}
        {!error && !failed && (!complete || !typedDone) && (
          <DraftGenerationPreview
            draft={draft}
            entity={entity}
            jurisdiction={activeJurisdiction}
            complete={complete}
            onTypedComplete={() => setTypedDoneByJuris(prev => ({ ...prev, [activeJurisdiction]: true }))}
          />
        )}
        {!error && complete && typedDone && draft && (
          <Animate enter="fade" duration={160} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <DraftDocument
              engagementId={engagementId}
              jurisdiction={activeJurisdiction}
              entity={entity}
              sections={draft.sections}
              onSectionsChange={sections => setDraft(activeJurisdiction, { ...draft, sections })}
            />
          </Animate>
        )}
      </div>
    </div>
  )
}
