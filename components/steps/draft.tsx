"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Download, Edit3, Loader2 } from "lucide-react"
import { api, type DraftResponse, type DraftSection } from "@/lib/api"
import { Animate } from "@/components/ui/transition"
import { ActionModal } from "@/components/ui/action-modal"
import {
  diagnoseApiFailure,
  parseApiError,
  runWithRetry,
  withActions,
  type ActionableIssue,
  type ActionableIssueBase,
} from "@/lib/actionable-errors"
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

function isDraftComplete(draft: DraftResponse | null): draft is DraftResponse {
  return !!draft && draft.summary.total > 0 && draft.summary.pending === 0 && draft.summary.failed === 0
}

function hasDraftFailure(draft: DraftResponse | null | undefined): boolean {
  return !!draft && (draft.summary.failed > 0 || draft.sections.some(section => section.status === "failed"))
}

function explainDraftError(error: string | null | undefined): string {
  const message = error?.trim()
  if (!message) return "No backend error returned."

  const unusedCitation = message.match(/draft returned citation\(s\) not used in content:\s*(.+)$/i)
  if (unusedCitation) {
    return `Veritax rejected this section because source record(s) ${unusedCitation[1]} were not attached to any sentence in the draft. The citation trail is inconsistent, so the section was not accepted.`
  }

  const missingRecord = message.match(/draft has uncaptured citation marker\(s\):\s*(.+)$/i)
  if (missingRecord) {
    return `Veritax rejected this section because citation marker(s) ${missingRecord[1]} appear in the text but no matching source record was returned.`
  }

  const uncitedSentence = message.match(/draft factual sentence lacks inline citation:\s*(.+)$/i)
  if (uncitedSentence) {
    return `Veritax rejected this section because this factual sentence has no source citation: ${uncitedSentence[1]}`
  }

  const numberMismatch = message.match(/draft number '([^']+)' is not present in the cited quote/i)
  if (numberMismatch) {
    return `Veritax rejected this section because the number '${numberMismatch[1]}' is not present in the cited source quote.`
  }

  if (/draft returned empty content/i.test(message)) {
    return "Veritax rejected this section because the model returned no draft text."
  }

  if (/draft returned no citations/i.test(message)) {
    return "Veritax rejected this section because it did not include source citations. Every factual claim needs a cited source before it can be shown."
  }

  if (/draft content has no inline citation markers/i.test(message)) {
    return "Veritax rejected this section because the draft text did not link its claims to citations."
  }

  const missingSourceText = message.match(/document citation \[(\d+)\] quote was not found in retrieved source context/i)
  if (missingSourceText) {
    return `Veritax rejected this section because citation [${missingSourceText[1]}] was not found in the retrieved source text. The evidence link could not be verified.`
  }

  return message
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
                {failedSections[0].element_name}: {explainDraftError(failedSections[0].error)}
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

export default function DraftStep({ engagementId, jurisdictions, entity, onContinue, onOpenRequirements, jumpTo, onJumped }: {
  engagementId: string | null
  jurisdictions: string[]
  entity: string
  onContinue: () => void
  onOpenRequirements?: () => void
  jumpTo?: { jurisdiction: string; sectionId: string } | null
  onJumped?: () => void
}) {
  const [draftByJuris, setDraftByJuris] = useState<Record<string, DraftResponse>>({})
  const [started, setStarted] = useState<Set<string>>(new Set())
  const [activeJurisdiction, setActive] = useState(jurisdictions[0] ?? "")
  const [issue, setIssue] = useState<ActionableIssue | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadHover, setDownloadHover] = useState(false)
  const [typedDoneByJuris, setTypedDoneByJuris] = useState<Record<string, boolean>>({})

  const draftRef = useRef(draftByJuris); draftRef.current = draftByJuris
  const startedRef = useRef(started); startedRef.current = started
  const observedGeneratingRef = useRef<Set<string>>(new Set())
  const failedIssueKeyRef = useRef<string>("")
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setDraft = (j: string, data: DraftResponse) => setDraftByJuris(prev => ({ ...prev, [j]: data }))

  function openIssue(
    base: ActionableIssueBase,
    primaryAction: ActionableIssue["primaryAction"],
    secondaryAction?: ActionableIssue["secondaryAction"],
  ) {
    setIssue(withActions(base, primaryAction, secondaryAction))
  }

  async function openIssueFromError(
    error: unknown,
    operation: string,
    primaryAction: ActionableIssue["primaryAction"],
    secondaryAction?: ActionableIssue["secondaryAction"],
  ) {
    const base = await diagnoseApiFailure(error, { operation, engagementId, jurisdiction: activeJurisdiction })
    openIssue(base, primaryAction, secondaryAction)
  }

  const typedDoneStorageKey = useCallback((j: string) => (
    engagementId && j ? `veritax:draft-typed:${engagementId}:${j}` : ""
  ), [engagementId])

  const markTypedDone = useCallback((j: string) => {
    setTypedDoneByJuris(prev => ({ ...prev, [j]: true }))
    const key = typedDoneStorageKey(j)
    if (key) localStorage.setItem(key, "1")
  }, [typedDoneStorageKey])

  const stopJurisdictions = useCallback((jurisdictionsToStop: string[]) => {
    if (jurisdictionsToStop.length === 0) return
    const stopping = new Set(jurisdictionsToStop)
    startedRef.current = new Set([...startedRef.current].filter(j => !stopping.has(j)))
    setStarted(new Set(startedRef.current))
    if (startedRef.current.size === 0 && pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const poll = useCallback(async () => {
    pollRef.current = null
    if (!engagementId) return
    const js = [...startedRef.current]
    const results = await Promise.all(js.map(async j => {
      try { return [j, await runWithRetry(() => api.getDraft(engagementId, j), { retries: 1 })] as const }
      catch (e) {
        console.error("[veritax] draft poll failed:", e)
        if (!draftRef.current[j]) {
          void openIssueFromError(e, "poll draft", { label: "Retry draft", onClick: () => void retryDraft() })
        }
        return [j, draftRef.current[j]] as const
      }
    }))
    const merged: Record<string, DraftResponse> = {}
    const stopped: string[] = []
    for (const [j, d] of results) {
      if (!d) continue
      if (hasDraftFailure(d)) {
        stopped.push(j)
      } else if (d.summary.pending > 0) {
        observedGeneratingRef.current.add(j)
      } else if (isDraftComplete(d) && !observedGeneratingRef.current.has(j)) {
        markTypedDone(j)
      }
      merged[j] = d
    }
    stopJurisdictions(stopped)
    setDraftByJuris(prev => ({ ...prev, ...merged }))
    const stoppedSet = new Set(stopped)
    if (Object.entries(merged).some(([j, d]) => !stoppedSet.has(j) && d.summary.pending > 0 && !hasDraftFailure(d))) {
      pollRef.current = setTimeout(poll, 1800)
    }
  }, [engagementId, markTypedDone, stopJurisdictions])

  const startJurisdiction = useCallback(async (j: string) => {
    if (!engagementId || !j || startedRef.current.has(j)) return
    setStarted(prev => new Set(prev).add(j))
    startedRef.current = new Set(startedRef.current).add(j)
    try {
      const d = await runWithRetry(
        () => api.startDraft(engagementId, j),
        { retries: 2, recover: () => api.recoverPipeline(engagementId, true) },
      )
      if (hasDraftFailure(d)) {
        stopJurisdictions([j])
      } else if (d.summary.pending > 0) {
        observedGeneratingRef.current.add(j)
      } else if (isDraftComplete(d) && !observedGeneratingRef.current.has(j)) {
        markTypedDone(j)
      }
      setDraft(j, d)
      if (!hasDraftFailure(d) && d.summary.pending > 0 && !pollRef.current) pollRef.current = setTimeout(poll, 1200)
    } catch (e) {
      console.error("[veritax] failed to start draft:", e)
      stopJurisdictions([j])
      const status = parseApiError(e).status
      if (status === 409) {
        openIssue(
          {
            title: "Requirements need attention",
            message: parseApiError(e).detail || "Draft cannot start until the evidence gates are satisfied.",
            detail: "Go back to Requirements, resolve the missing or failed rows, then retry Draft.",
            tone: "caution",
            diagnostics: { operation: "start draft", engagementId, jurisdiction: j, status },
          },
          { label: "Go to Requirements", onClick: () => onOpenRequirements?.() },
          { label: "Retry Draft", onClick: () => { startedRef.current.delete(j); setStarted(prev => { const n = new Set(prev); n.delete(j); return n }); void startJurisdiction(j) }, variant: "ghost" },
        )
      } else {
        void openIssueFromError(
          e,
          "start draft",
          { label: "Retry draft", onClick: () => { startedRef.current.delete(j); setStarted(prev => { const n = new Set(prev); n.delete(j); return n }); void startJurisdiction(j) } },
          { label: "Go to Requirements", onClick: () => onOpenRequirements?.(), variant: "ghost" },
        )
      }
    }
  }, [engagementId, markTypedDone, poll, stopJurisdictions])

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

  async function downloadDraft() {
    if (!engagementId || !complete) return
    setDownloading(true)
    try {
      const blob = await runWithRetry(() => api.downloadDraftDocx(engagementId, activeJurisdiction), { retries: 2 })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${(entity || "Entity")} ${activeJurisdiction} Local File`.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") + ".docx"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("[veritax] docx download failed:", e)
      void openIssueFromError(
        e,
        "download draft",
        { label: "Retry download", onClick: downloadDraft },
        { label: "Show incomplete sections", onClick: () => {
          const first = draftRef.current[activeJurisdiction]?.sections.find(s => s.status !== "drafted")
          if (first) openIssue({
            title: "Incomplete section",
            message: `${first.element_order}. ${first.element_name} is ${first.status}.`,
            detail: first.error ? explainDraftError(first.error) : "Finish the draft before exporting a complete Word file.",
            tone: "caution",
            diagnostics: { operation: "show incomplete section", engagementId, jurisdiction: activeJurisdiction, sectionId: first.id },
          }, { label: "Retry draft", onClick: retryDraft })
        }, variant: "ghost" },
      )
    } finally {
      setDownloading(false)
    }
  }

  async function retryDraft() {
    if (!engagementId) return
    setRetrying(true)
    try {
      failedIssueKeyRef.current = ""
      startedRef.current = new Set(startedRef.current).add(activeJurisdiction)
      setStarted(new Set(startedRef.current))
      setTypedDoneByJuris(prev => ({ ...prev, [activeJurisdiction]: false }))
      const key = typedDoneStorageKey(activeJurisdiction)
      if (key) localStorage.removeItem(key)
      await runWithRetry(() => api.recoverPipeline(engagementId, true), { retries: 2 })
      let stopped = false
      try {
        const refreshed = await api.getDraft(engagementId, activeJurisdiction)
        setDraft(activeJurisdiction, refreshed)
        if (hasDraftFailure(refreshed)) {
          stopped = true
          stopJurisdictions([activeJurisdiction])
        }
      }
      catch (e) { console.error("[veritax] retry draft refresh failed:", e) }
      if (!stopped && !pollRef.current) pollRef.current = setTimeout(poll, 600)
    } catch (e) {
      console.error("[veritax] draft retry failed:", e)
      void openIssueFromError(e, "recover draft pipeline", { label: "Try recovery again", onClick: retryDraft })
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
  const showDraftActions = complete && typedDone && !!draft

  useEffect(() => {
    if (!failed || failedSections.length === 0) return
    const key = `${engagementId}:${activeJurisdiction}:${failedSections.map(s => `${s.id}:${s.error ?? ""}`).join("|")}`
    if (failedIssueKeyRef.current === key) return
    failedIssueKeyRef.current = key
    const first = failedSections[0]
    const noContext = /no retrieved source context|source context|missing source|requirements/i.test(first.error ?? "")
    openIssue(
      {
        title: "Draft section failed",
        message: `${failedSections.length} section${failedSections.length === 1 ? "" : "s"} could not be drafted.`,
        detail: first ? `${first.element_name}: ${explainDraftError(first.error)}` : "Retry the draft pipeline.",
        tone: "caution",
        diagnostics: {
          operation: "draft failed sections",
          engagementId,
          jurisdiction: activeJurisdiction,
          failedSections: failedSections.map(s => ({ id: s.id, name: s.element_name, error: s.error })),
        },
      },
      noContext
        ? { label: "Go to Requirements", onClick: () => onOpenRequirements?.() }
        : { label: "Retry failed sections", onClick: retryDraft },
      noContext
        ? { label: "Retry after reindex", onClick: retryDraft, variant: "ghost" }
        : { label: "Go to Requirements", onClick: () => onOpenRequirements?.(), variant: "ghost" },
    )
  }, [activeJurisdiction, engagementId, failed, failedSections, onOpenRequirements])

  useEffect(() => {
    if (!draft) return
    const key = typedDoneStorageKey(activeJurisdiction)
    if (draft.summary.pending > 0) {
      observedGeneratingRef.current.add(activeJurisdiction)
    }
    if (complete) {
      if (key && localStorage.getItem(key) === "1") {
        setTypedDoneByJuris(prev => ({ ...prev, [activeJurisdiction]: true }))
      } else if (!observedGeneratingRef.current.has(activeJurisdiction)) {
        markTypedDone(activeJurisdiction)
      }
      return
    }
    setTypedDoneByJuris(prev => ({ ...prev, [activeJurisdiction]: false }))
    if (key) localStorage.removeItem(key)
  }, [activeJurisdiction, complete, draft, markTypedDone, typedDoneStorageKey])

  useEffect(() => {
    setEditing(false)
    setDownloadHover(false)
  }, [activeJurisdiction, engagementId])

  useEffect(() => {
    if (!showDraftActions) setEditing(false)
  }, [showDraftActions])

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
            const hasFailed = hasDraftFailure(d)
            const isRunning = started.has(j)
            const isStarted = isRunning || !!d
            const processing = isRunning && !hasFailed && (!d || d.summary.pending > 0)
            return (
              <button key={j} type="button" onClick={() => selectJurisdiction(j)} title={isStarted ? undefined : "Not drafted yet — click to draft"} style={{
                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "none", cursor: "pointer",
                background: isActive ? "var(--color-background-primary-solid)" : isStarted ? "var(--alpha-06)" : "transparent",
                color: isActive ? "var(--color-text-inverse)" : hasFailed ? "var(--color-text-danger-soft)" : isStarted ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
                fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
                opacity: isStarted ? 1 : 0.55, transition: "all var(--transition-duration-basic)",
              }}>
                {processing && <Loader2 size={11} className="animate-spin" />}
                {j}
              </button>
            )
          })}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
          {showDraftActions && (
            <div data-tour="draft-actions" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
              <button type="button" onClick={() => setEditing(v => !v)} aria-label={editing ? "Preview draft" : "Edit draft"} title={editing ? "Preview" : "Edit draft"} style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", height: "var(--control-size-md)", width: "var(--control-size-md)",
                padding: 0, borderRadius: "var(--control-radius-md)", border: "none",
                background: editing ? "var(--color-background-primary-soft)" : "transparent",
                color: editing ? "var(--color-text)" : "var(--color-text-secondary)",
                cursor: "pointer", transition: "background var(--transition-duration-basic), color var(--transition-duration-basic)",
              }}>
                <Edit3 size={15} />
              </button>
              <div style={{ position: "relative", display: "inline-flex" }}>
                <button type="button" onClick={downloadDraft} disabled={downloading} aria-label="Download Word" title="Download Word" onMouseEnter={() => setDownloadHover(true)} onMouseLeave={() => setDownloadHover(false)} onFocus={() => setDownloadHover(true)} onBlur={() => setDownloadHover(false)} style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", height: "var(--control-size-md)", width: "var(--control-size-md)",
                  padding: 0, borderRadius: "var(--control-radius-md)", border: "none",
                  background: "transparent", color: "var(--color-text-secondary)",
                  cursor: downloading ? "not-allowed" : "pointer", transition: "background var(--transition-duration-basic), color var(--transition-duration-basic)",
                }}>
                  {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                </button>
                {downloadHover && !downloading && (
                  <span style={{
                    position: "absolute", top: "calc(100% + 0.375rem)", right: 0, zIndex: 20,
                    padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)", background: "var(--color-background-primary-solid)",
                    color: "var(--color-text-inverse)", fontSize: "var(--font-text-xs-size)", lineHeight: 1.2, whiteSpace: "nowrap",
                    boxShadow: "var(--shadow-100)", pointerEvents: "none",
                  }}>
                    Download Word
                  </span>
                )}
              </div>
            </div>
          )}
          <button type="button" disabled={!complete} onClick={onContinue} style={{
            display: "inline-flex", alignItems: "center", gap: "0.25rem", height: "var(--control-size-md)", padding: "0 0.25rem",
            borderRadius: "var(--control-radius-md)", border: "none", flexShrink: 0,
            background: "transparent",
            color: complete ? "var(--color-text)" : "var(--color-text-tertiary)",
            fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: complete ? "pointer" : "not-allowed",
          }}>
            Risks <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Body — the document editor once drafting is complete, otherwise progress */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {draft?.draft_mode === "fake" && (
          <p style={{ padding: "0.625rem 3.5rem", margin: 0, fontSize: "var(--font-text-xs-size)", color: "#8a5a00", background: "#fff8e5", borderTop: "1px solid #f0d58c", borderBottom: "1px solid #f0d58c" }}>
            Development mode: this draft is generated by the fake drafter, not a real model.
          </p>
        )}
        {(!complete || !typedDone) && (
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
        {complete && typedDone && draft && (
          <Animate enter="fade" duration={160} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <DraftDocument
              jurisdiction={activeJurisdiction}
              entity={entity}
              sections={draft.sections}
              editing={editing}
              onSectionsChange={sections => setDraft(activeJurisdiction, { ...draft, sections })}
              onSaveError={(error, retry) => void openIssueFromError(
                error,
                "save draft edit",
                { label: "Retry save", onClick: retry },
                { label: "Keep editing", onClick: () => setEditing(true), variant: "ghost" },
              )}
            />
          </Animate>
        )}
      </div>
      <ActionModal issue={issue} onClose={() => setIssue(null)} />
    </div>
  )
}
