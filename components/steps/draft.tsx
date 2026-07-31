"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { api, type DraftResponse, type DraftSection } from "@/lib/api"
import { Animate } from "@/components/ui/transition"
import DraftDocument, { DraftCover, DraftSectionSidebar } from "./DraftDocument"

const FIRST_REVEAL_SECTIONS = 5
const TYPE_CHARS_PER_TICK = 3
const TYPE_TICK_MS = 24

const stripLeadingHeading = (content: string) => content.replace(/^\s*#{1,4}\s+.*\n+/, "")
const stripObjectMarkers = (content: string) => content.replace(/\[\[(table|chart):([^\]]+)\]\]/g, "")

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

function DraftGenerationPreview({ draft, entity, jurisdiction, complete, failedSections, retrying, onRetry, onTypedComplete }: {
  draft: DraftResponse | null
  entity: string
  jurisdiction: string
  complete: boolean
  failedSections: DraftSection[]
  retrying: boolean
  onRetry: () => void
  onTypedComplete: () => void
}) {
  const [typedText, setTypedText] = useState("")
  const [activeSectionId, setActiveSectionId] = useState<string>("cover")
  const scrollRef = useRef<HTMLDivElement>(null)
  const allSections = useMemo(() => [...(draft?.sections ?? [])].sort((a, b) => a.element_order - b.element_order), [draft])
  const readySections = useMemo(() => draftedSections(draft), [draft])
  const total = draft?.summary.total ?? 0
  const revealAt = Math.min(FIRST_REVEAL_SECTIONS, total || FIRST_REVEAL_SECTIONS)
  const readyToType = readySections.length >= revealAt || (complete && readySections.length > 0)
  const sourceText = useMemo(() => readySections.map(sectionText).join(""), [readySections])
  const typedChunks = useMemo(() => {
    let offset = 0
    return readySections
      .map(section => {
        const full = sectionText(section)
        const text = typedText.slice(offset, Math.min(typedText.length, offset + full.length))
        offset += full.length
        return { section, text }
      })
      .filter(chunk => chunk.text.trim().length > 0)
  }, [readySections, typedText])
  const typedSectionIds = useMemo(() => new Set(typedChunks.map(chunk => chunk.section.id)), [typedChunks])
  const observedSectionKey = useMemo(() => ["cover", ...typedChunks.map(chunk => chunk.section.id)].join("|"), [typedChunks])

  useEffect(() => {
    setTypedText("")
    setActiveSectionId("cover")
  }, [jurisdiction])

  useEffect(() => {
    setTypedText(prev => (sourceText.startsWith(prev) ? prev : ""))
  }, [sourceText])

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

  function scrollToElement(id: string) {
    const target = scrollRef.current?.querySelector<HTMLElement>(`#${id}`)
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-draft-section-id]"))
    if (nodes.length === 0) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      const id = visible?.target.getAttribute("data-draft-section-id")
      if (id) setActiveSectionId(id)
    }, { root, threshold: 0.18, rootMargin: "-12% 0px -58% 0px" })
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [observedSectionKey, readyToType])

  return (
    <Animate enter="fade" duration={160} style={{ flex: 1, minHeight: 0, display: "flex", background: "var(--color-surface-secondary)" }}>
      {allSections.length > 0 && (
        <DraftSectionSidebar
          sections={allSections}
          activeSectionId={activeSectionId}
          onSelect={section => scrollToElement(`draft-gen-section-${section.id}`)}
          onSelectCover={() => scrollToElement("draft-gen-cover-page")}
          isSectionAvailable={section => typedSectionIds.has(section.id)}
        />
      )}
      <div ref={scrollRef} className="vt-a4-scroll">
        <article id="draft-gen-cover-page" className="vt-a4-page" data-draft-section-id="cover">
          <DraftCover entity={entity} jurisdiction={jurisdiction} />
        </article>
        {typedChunks.map(({ section, text }) => (
          <article key={section.id} id={`draft-gen-section-${section.id}`} className="vt-a4-page" data-draft-section-id={section.id}>
            <TypedDraftText text={text} />
          </article>
        ))}
        {failedSections.length > 0 && (
          <article className="vt-a4-page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.625rem", textAlign: "center" }}>
            <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-danger-soft)", margin: 0 }}>
              Draft failed for {failedSections.length} section{failedSections.length === 1 ? "" : "s"} in {jurisdiction}.
            </p>
            {failedSections[0] && (
              <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", margin: 0, maxWidth: 520 }}>
                {failedSections[0].element_name}: {failedSections[0].error || "No backend error returned."}
              </p>
            )}
            <button type="button" onClick={onRetry} disabled={retrying} style={{
              height: "var(--control-size-md)", padding: "0 var(--control-gutter-lg)",
              borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)",
              background: "transparent", color: "var(--color-text-secondary)",
              fontSize: "var(--control-font-size-md)", cursor: retrying ? "not-allowed" : "pointer",
            }}>{retrying ? "Retrying..." : "Retry draft"}</button>
          </article>
        )}
        {typedChunks.length === 0 && failedSections.length === 0 && (
          <article className="vt-a4-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
          </article>
        )}
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

  const typedDoneStorageKey = useCallback((j: string) => (
    engagementId && j ? `veritax:draft-typed:${engagementId}:${j}` : ""
  ), [engagementId])

  const markTypedDone = useCallback((j: string) => {
    setTypedDoneByJuris(prev => ({ ...prev, [j]: true }))
    const key = typedDoneStorageKey(j)
    if (key) localStorage.setItem(key, "1")
  }, [typedDoneStorageKey])

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
      const completeAlready = d.summary.total > 0 && d.summary.pending === 0 && d.summary.failed === 0
      if (completeAlready && localStorage.getItem(typedDoneStorageKey(j)) === "1") {
        setTypedDoneByJuris(prev => ({ ...prev, [j]: true }))
      }
      setDraft(j, d)
      if (d.summary.pending > 0 && !pollRef.current) pollRef.current = setTimeout(poll, 1200)
    } catch (e) {
      console.error("[veritax] failed to start draft:", e)
      setError(String(e))
    }
  }, [engagementId, poll, typedDoneStorageKey])

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
    const key = typedDoneStorageKey(activeJurisdiction)
    if (complete && key && localStorage.getItem(key) === "1") {
      setTypedDoneByJuris(prev => ({ ...prev, [activeJurisdiction]: true }))
    }
    if (!complete) {
      setTypedDoneByJuris(prev => ({ ...prev, [activeJurisdiction]: false }))
      if (key) localStorage.removeItem(key)
    }
  }, [activeJurisdiction, complete, typedDoneStorageKey])

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
        {!error && (!complete || !typedDone) && (
          <DraftGenerationPreview
            draft={draft}
            entity={entity}
            jurisdiction={activeJurisdiction}
            complete={complete}
            failedSections={failedSections}
            retrying={retrying}
            onRetry={retryDraft}
            onTypedComplete={() => markTypedDone(activeJurisdiction)}
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
