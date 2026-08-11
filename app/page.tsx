"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Activity, CalendarDays, ChevronDown, FileText, GraduationCap, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react"
import PlanningStep, { type PlanningDocumentMap, type PlanningSourceRow, type SourceId } from "@/components/steps/planning"
import DemoTour, { type TourStep } from "@/components/DemoTour"
import Confetti from "@/components/Confetti"
import { stageEntered, stageCompleted } from "@/lib/analytics"
import RequirementsStep from "@/components/steps/requirements"
import DraftStep from "@/components/steps/draft"
import RisksStep from "@/components/steps/risks"
import { api, type DocumentRead, type Engagement, type EngagementSummary } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { LoadingIndicator } from "@/components/ui/indicator"
import { ActionModal } from "@/components/ui/action-modal"
import { diagnoseApiFailure, withActions, type ActionableIssue, type ActionableIssueBase, type ActionableErrorAction } from "@/lib/actionable-errors"

// FullCalendar is browser-only — load it client-side so it never runs during the build prerender.
const CompliancePage = dynamic(() => import("@/components/compliance"), { ssr: false })
const MonitoringPage = dynamic(() => import("@/components/monitoring"), { ssr: false })
const DefensePage = dynamic(() => import("@/components/defense"), { ssr: false })

type Step = 1 | 2 | 3 | 4
type BootStatus = "loading" | "ready" | "offline"

const NAV: { step: Step; label: string }[] = [
  { step: 1, label: "Planning" },
  { step: 2, label: "Requirements" },
  { step: 3, label: "Draft" },
  { step: 4, label: "Risks" },
]

// Guided walkthrough for the public /demo (enableTour). Each step switches to its tab, then spotlights
// the element carrying the matching data-tour attribute.
const TOUR_STEPS: TourStep[] = [
  { appStep: 1, target: "planning-scope", title: "Set the scope", text: "Choose the jurisdictions, the entity, and the fiscal year. This frames the whole Local File.", placement: "bottom-end" },
  { appStep: 1, target: "planning-sources", title: "Bring your sources", text: "Upload or connect financials, agreements, the website, and interviews — Veritax reads them for you." },
  { appStep: 2, target: "req-jurisdictions", title: "Every jurisdiction at once", text: "Veritax checks the file against each jurisdiction's real requirements in parallel. Click a tab to see its results." },
  { appStep: 3, target: "draft-sections", title: "The draft writes itself", text: "Every section that jurisdiction requires is generated for you, in order." },
  { appStep: 3, target: "draft-actions", title: "Edit or export", text: "Edit any section inline, or download the finished Local File as a Word document." },
  { appStep: 4, target: "risks-rollup", title: "Exposures & contradictions", text: "Veritax flags financial exposures and contradictions in the file, each with evidence you can open." },
]

const LS_ID = "veritax.engagementId"     // resume the file being worked on across refreshes
const LS_STEP = "veritax.step"
// Workflow tab → canonical analytics stage (Planning is the "evidence" stage; Draft is "local_file").
const STEP_TO_STAGE: Record<Step, string> = { 1: "evidence", 2: "requirements", 3: "local_file", 4: "risks" }
const PLANNING_SOURCES = new Set<SourceId>(["financials", "agreements", "public", "interview"])
const EMPTY_PLANNING_DOCUMENTS: PlanningDocumentMap = {}
const STEP_URL: Record<Step, string> = {
  1: "planning",
  2: "requirements",
  3: "draft",
  4: "risks",
}

function parseStepParam(value: string | null): Step | null {
  if (!value) return null
  const normalized = value.toLowerCase()
  if (normalized === "planning" || normalized === "1") return 1
  if (normalized === "requirements" || normalized === "2") return 2
  if (normalized === "draft" || normalized === "3") return 3
  if (normalized === "risks" || normalized === "4") return 4
  return null
}

function readWorkspaceUrl() {
  if (typeof window === "undefined") return { projectId: null as string | null, step: null as Step | null }
  const params = new URLSearchParams(window.location.search)
  return {
    projectId: params.get("project") || params.get("engagement") || params.get("file"),
    step: parseStepParam(params.get("step")),
  }
}

function planningDocumentsFromEngagement(engagement: Engagement): PlanningDocumentMap {
  const documents: PlanningDocumentMap = {}
  for (const source of engagement.sources) {
    if (!PLANNING_SOURCES.has(source.kind as SourceId)) continue
    const kind = source.kind as SourceId
    documents[kind] = [...(documents[kind] ?? []), ...source.documents]
  }
  return documents
}

function planningSourceRowsFromEngagement(engagement: Engagement): PlanningSourceRow[] {
  return engagement.sources
    .filter(source => PLANNING_SOURCES.has(source.kind as SourceId))
    .map(source => ({
      id: source.id,
      kind: source.kind as SourceId,
      origin: source.origin,
      connector_provider: source.connector_provider,
      url: source.url,
    }))
}

function planningSourcesFromEngagement(engagement: Engagement): Set<SourceId> {
  const selected = new Set<SourceId>()
  for (const kind of engagement.selected_source_kinds ?? []) {
    if (PLANNING_SOURCES.has(kind as SourceId)) selected.add(kind as SourceId)
  }
  for (const source of engagement.sources) {
    if (PLANNING_SOURCES.has(source.kind as SourceId)) selected.add(source.kind as SourceId)
  }
  if (engagement.website_url) selected.add("public")
  return selected
}

function canonicalizePlanningUrl() {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (parseStepParam(url.searchParams.get("step")) !== 1) return
  url.searchParams.delete("step")
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
}

function replaceWorkspaceUrl(projectId: string | null, step: Step) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (projectId) url.searchParams.set("project", projectId)
  else url.searchParams.delete("project")
  if (step === 1) url.searchParams.delete("step")
  else url.searchParams.set("step", STEP_URL[step])
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
}

function describeAppError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
  }
}

function logAppError(stage: string, error: unknown) {
  console.warn("[veritax] app startup/API failure", { stage, error: describeAppError(error) })
}

function SkeletonBlock({ style }: { style?: CSSProperties }) {
  return <div className="vt-skeleton" style={style} />
}

function SidebarLibrarySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 0.75rem" }} aria-hidden="true">
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5, padding: "0.35rem 0" }}>
          <SkeletonBlock style={{ width: i === 1 ? "78%" : "88%", height: 13 }} />
          <SkeletonBlock style={{ width: i === 2 ? "50%" : "62%", height: 10 }} />
        </div>
      ))}
    </div>
  )
}

function BootSkeleton({ offline = false, onRetry }: { offline?: boolean; onRetry?: () => void }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#fff", color: "#000" }}>
      <aside style={{
        width: 220, flexShrink: 0,
        borderRight: "1px solid #e5e5e5",
        background: "#fafafa",
        padding: "1.5rem 0.75rem",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 0.75rem", marginBottom: "1.5rem", minHeight: 24 }}>
          <span style={{ fontFamily: "var(--font-wordmark)", fontSize: "20px", fontWeight: 300, letterSpacing: 0, lineHeight: 1, color: "#000" }}>Veritax</span>
        </div>
        <div style={{ padding: "0.6rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <SkeletonBlock style={{ width: 16, height: 16, borderRadius: 4 }} />
          <SkeletonBlock style={{ width: 82, height: 14 }} />
        </div>
        <div style={{ padding: "0.5rem 0.75rem" }}><SkeletonBlock style={{ width: 70, height: 13 }} /></div>
        <div style={{ marginTop: "0.5rem" }}><SidebarLibrarySkeleton /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "1rem", padding: "0 0.75rem" }} aria-hidden="true">
          <SkeletonBlock style={{ width: 106, height: 14 }} />
          <SkeletonBlock style={{ width: 96, height: 14 }} />
          <SkeletonBlock style={{ width: 84, height: 14 }} />
        </div>
        <SkeletonBlock style={{ width: "calc(100% - 1.5rem)", height: 31, margin: "auto 0.75rem 0" }} />
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <nav style={{
          borderBottom: "1px solid #e5e5e5",
          background: "#fff",
          padding: "0 2rem",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          height: 48,
          flexShrink: 0,
        }} aria-hidden="true">
          {[92, 118, 74, 68].map(w => <SkeletonBlock key={w} style={{ width: w, height: 13 }} />)}
        </nav>

        <div style={{ flex: 1, padding: "2rem", overflow: "hidden" }}>
          {offline ? (
            <section style={{ maxWidth: 520, marginTop: "10vh" }}>
              <p style={{ margin: 0, fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Connection check failed
              </p>
              <h1 style={{ margin: "0.5rem 0", fontSize: "var(--font-heading-lg-size)", lineHeight: "var(--font-heading-lg-line-height)", fontWeight: 500 }}>
                Veritax could not load your workspace.
              </h1>
              <p style={{ margin: "0 0 1rem", color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)", lineHeight: 1.6 }}>
                Refresh, check your connection or browser blocker, and confirm the Render backend is reachable.
              </p>
              <button type="button" onClick={onRetry} style={{
                height: 32,
                padding: "0 0.875rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "#fff",
                color: "var(--color-text)",
                cursor: "pointer",
                fontSize: "var(--font-text-sm-size)",
              }}>
                Retry
              </button>
            </section>
          ) : (
            <section style={{ maxWidth: 980 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)" }}>
                <LoadingIndicator size={14} />
                <span>Opening workspace</span>
              </div>
              <SkeletonBlock style={{ width: 132, height: 11, marginBottom: 12 }} />
              <SkeletonBlock style={{ width: 360, maxWidth: "70%", height: 28, marginBottom: 30 }} />
              <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 0.8fr) minmax(260px, 1.2fr)", gap: "1.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <SkeletonBlock style={{ width: "100%", height: 30 }} />
                  <SkeletonBlock style={{ width: "82%", height: 30 }} />
                  <SkeletonBlock style={{ width: "74%", height: 30 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "1rem" }}>
                      <SkeletonBlock style={{ width: i === 1 ? "46%" : "58%", height: 14, marginBottom: 12 }} />
                      <SkeletonBlock style={{ width: "100%", height: 46 }} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default function Page({ enableTour = false }: { enableTour?: boolean } = {}) {
  const router = useRouter()
  const [step, setStep]       = useState<Step>(1)
  const [visited, setVisited] = useState<Set<Step>>(new Set([1]))
  const [jurisdictions, setJ] = useState<string[]>([])
  const [entity, setEntity]   = useState("")
  const [fiscalYear, setFiscalYear] = useState("")
  const [sources, setSources] = useState<Set<SourceId>>(new Set())
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [planningSourceRows, setPlanningSourceRows] = useState<PlanningSourceRow[]>([])
  const [planningDocuments, setPlanningDocuments] = useState<PlanningDocumentMap>(EMPTY_PLANNING_DOCUMENTS)
  const [engagementId, setEngagementId] = useState<string | null>(null)
  // Deep-link from a Requirements row to the draft section that fulfils it.
  const [draftJump, setDraftJump] = useState<{ jurisdiction: string; sectionId: string } | null>(null)
  const [files, setFiles] = useState<EngagementSummary[]>([])
  const [localOpen, setLocalOpen] = useState(true)
  const [collapsed, setCollapsed] = useState(false)   // left panel: collapsed shows the logo only
  const [logoHover, setLogoHover] = useState(false)
  const [mounted, setMounted] = useState<Set<Step>>(new Set([1]))  // steps stay mounted once visited
  const [page, setPage] = useState<"workflow" | "compliance" | "monitoring" | "defense">("workflow")
  const [apiOffline, setApiOffline] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [bootStatus, setBootStatus] = useState<BootStatus>("loading")
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [actionIssue, setActionIssue] = useState<ActionableIssue | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)   // remembered walkthrough position (resume from the cap icon)
  const [confetti, setConfetti] = useState(false)
  const engagementLoadSeq = useRef(0)
  const trackedStageRef = useRef<string | null>(null)   // last analytics stage fired (guards rerender/StrictMode)
  const revealEngRef = useRef<Engagement | null>(null)  // demo Planning data, revealed as the tutorial spotlights it
  const scopeShownRef = useRef(false)
  const sourcesShownRef = useRef(false)
  const tourWasOpenedRef = useRef(false)

  const openIssue = useCallback((
    base: ActionableIssueBase,
    primaryAction: ActionableErrorAction = { label: "Retry", onClick: () => window.location.reload() },
    secondaryAction?: ActionableErrorAction,
  ) => {
    setActionIssue(withActions(base, primaryAction, secondaryAction))
  }, [])

  const diagnoseAndOpen = useCallback(async (
    error: unknown,
    operation: string,
    primaryAction: ActionableErrorAction = { label: "Retry", onClick: () => window.location.reload() },
    secondaryAction?: ActionableErrorAction,
  ) => {
    const base = await diagnoseApiFailure(error, { operation, engagementId })
    openIssue(base, primaryAction, secondaryAction)
  }, [engagementId, openIssue])

  const refreshFiles = useCallback(async (): Promise<boolean> => {
    setLibraryLoading(true)
    try {
      const list = await api.listEngagements()
      setFiles(list)
      setApiOffline(false)
      return true
    } catch (error) {
      logAppError("list engagements", error)
      setFiles([])
      setApiOffline(true)
      void diagnoseAndOpen(error, "load file library", { label: "Refresh", onClick: () => window.location.reload() })
      return false
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  // Rehydrate a file's scope from the backend (entity, jurisdictions, which source rows are on).
  const loadEngagement = useCallback(async (id: string, seq?: number, reveal = false): Promise<boolean> => {
    try {
      const eng = await api.getEngagement(id)
      if (seq !== undefined && seq !== engagementLoadSeq.current) return false
      setEngagementId(id)
      localStorage.setItem(LS_ID, id)
      if (!reveal) {
        setEntity(eng.entity_name ?? "")
        setJ(eng.jurisdictions)
        setFiscalYear(eng.fiscal_year ?? "")
        setSources(planningSourcesFromEngagement(eng))
        setWebsiteUrl(eng.website_url ?? "")
        setPlanningSourceRows(planningSourceRowsFromEngagement(eng))
        setPlanningDocuments(planningDocumentsFromEngagement(eng))
        return true
      }
      // Demo: don't populate on load. Blank Planning and hold the data; the reveal effect below fills each
      // part when the tutorial spotlight lands on it (or immediately if the tutorial is closed/skipped).
      setEntity(""); setJ([]); setFiscalYear(""); setSources(new Set())
      setWebsiteUrl(""); setPlanningSourceRows([]); setPlanningDocuments(EMPTY_PLANNING_DOCUMENTS)
      scopeShownRef.current = false
      sourcesShownRef.current = false
      revealEngRef.current = eng
      return true
    } catch (error) {
      logAppError("load engagement", error)
      return false
    }
  }, [])

  // Demo reveal: fill the scope fields at once.
  const revealScope = useCallback((eng: Engagement) => {
    setJ(eng.jurisdictions); setEntity(eng.entity_name ?? ""); setFiscalYear(eng.fiscal_year ?? "")
  }, [])

  // Demo reveal: check each source class and pop its files/connectors in one at a time (each fades in
  // via .vt-reveal-in in Planning), so the file reads like it's being assembled live.
  const revealSources = useCallback((eng: Engagement) => {
    const mySeq = engagementLoadSeq.current
    const at = (ms: number, fn: () => void) => window.setTimeout(() => { if (engagementLoadSeq.current === mySeq) fn() }, ms)
    let t = 0
    for (const kind of PLANNING_SOURCES) {   // insertion order: financials, agreements, public, interview
      const kindSources = eng.sources.filter(s => (s.kind as SourceId) === kind)
      if (kindSources.length === 0) continue
      t += 350
      at(t, () => setSources(prev => new Set(prev).add(kind)))   // tick the class checkbox
      for (const src of kindSources) {
        if (src.url) { const url = src.url; t += 300; at(t, () => setWebsiteUrl(url)) }
        if (src.origin === "connected") {
          const row: PlanningSourceRow = { id: src.id, kind, origin: src.origin, connector_provider: src.connector_provider, url: src.url }
          t += 300; at(t, () => setPlanningSourceRows(prev => (prev.some(r => r.id === row.id) ? prev : [...prev, row])))
        }
        for (const doc of src.documents) {
          t += 300
          at(t, () => setPlanningDocuments(prev => ({ ...prev, [kind]: [...(prev[kind] ?? []), doc] })))
        }
      }
    }
  }, [])

  const updatePlanningDocuments = useCallback((
    kind: SourceId,
    updater: (docs: DocumentRead[]) => DocumentRead[],
  ) => {
    setPlanningDocuments(prev => ({
      ...prev,
      [kind]: updater(prev[kind] ?? []),
    }))
  }, [])

  const rememberPlanningSourceRow = useCallback((source: PlanningSourceRow) => {
    setPlanningSourceRows(prev => (
      prev.some(existing => existing.id === source.id)
        ? prev
        : [...prev, source]
    ))
  }, [])

  // Resume the file being worked on (or start a fresh one), then load the library.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      canonicalizePlanningUrl()
      setBootStatus("loading")
      setLibraryLoading(true)
      try {
        await api.health()
        if (!cancelled) setApiOffline(false)
      } catch (error) {
        logAppError("health", error)
        if (!cancelled) {
          setApiOffline(true)
          setBootStatus("offline")
          setLibraryLoading(false)
          void diagnoseAndOpen(
            error,
            "check backend health",
            { label: "Retry", onClick: () => window.location.reload() },
            { label: "Sign in again", onClick: () => router.replace("/auth"), variant: "ghost" },
          )
        }
        return
      }
      const fromUrl = readWorkspaceUrl()
      const stored = localStorage.getItem(LS_ID)
      const requestedId = fromUrl.projectId || stored
      let resumed = requestedId ? await loadEngagement(requestedId, undefined, enableTour) : false
      if (!resumed && fromUrl.projectId && stored && stored !== fromUrl.projectId) {
        resumed = await loadEngagement(stored)
      }
      if (cancelled) return
      if (resumed) {
        // The demo always opens on Planning (step 1) so the staged fill + tutorial start from the top.
        const resumedStep = enableTour ? 1 : (fromUrl.step ?? parseStepParam(localStorage.getItem(LS_STEP)))
        if (resumedStep) {
          setStep(resumedStep)
          setVisited(new Set([1, resumedStep]))
          setMounted(new Set([1, resumedStep]))
          if (resumedStep >= 3) setDraftReady(true)
        }
      } else {
        try {
          const { id } = await api.createEngagement()  // uploads need an id to attach to
          if (cancelled) return
          setPlanningDocuments(EMPTY_PLANNING_DOCUMENTS)
          setPlanningSourceRows([])
          setWebsiteUrl("")
          setSources(new Set())
          setEngagementId(id)
          localStorage.setItem(LS_ID, id)
        } catch (error) {
          logAppError("create engagement", error)
          if (!cancelled) {
            setApiOffline(true)
            setBootStatus("offline")
            setLibraryLoading(false)
            void diagnoseAndOpen(
              error,
              "create project",
              { label: "Retry", onClick: () => window.location.reload() },
              { label: "Sign in again", onClick: () => router.replace("/auth"), variant: "ghost" },
            )
          }
          return
        }
      }
      const loadedFiles = await refreshFiles()
      if (!cancelled) setBootStatus(loadedFiles ? "ready" : "offline")
    })()
    return () => { cancelled = true }
  }, [loadEngagement, refreshFiles, enableTour])

  useEffect(() => { localStorage.setItem(LS_STEP, String(step)) }, [step])
  // Demo-only stage lifecycle: fire completed(prev) + entered(next) on each real transition (backtracking re-fires).
  useEffect(() => {
    if (!enableTour || bootStatus !== "ready" || page !== "workflow") return
    const stage = STEP_TO_STAGE[step]
    if (trackedStageRef.current === stage) return
    const prev = trackedStageRef.current
    if (prev) stageCompleted(prev)
    trackedStageRef.current = stage
    stageEntered(stage)
  }, [enableTour, bootStatus, page, step])
  useEffect(() => {
    if (bootStatus !== "ready" || page !== "workflow") return
    replaceWorkspaceUrl(engagementId, step)
  }, [bootStatus, engagementId, page, step])
  useEffect(() => { setMounted(m => (m.has(step) ? m : new Set([...m, step]))) }, [step])  // mount a step on first visit, keep it
  useEffect(() => {
    if (!engagementId) return
    api.recoverPipeline(engagementId).catch(error => {
      logAppError("pipeline recovery", error)
      setApiOffline(true)
      void diagnoseAndOpen(error, "recover pipeline", { label: "Retry recovery", onClick: () => void api.recoverPipeline(engagementId, true) })
    })
  }, [diagnoseAndOpen, engagementId])

  function navigate(s: Step) {
    if (s >= 3 && !draftReady) return
    setStep(s)
    setVisited(prev => new Set(prev).add(s))
  }

  function continueToDraft() {
    setDraftReady(true)
    setStep(3)
    setVisited(prev => new Set(prev).add(3))
  }

  // Tour navigation: jump straight to a tab (bypassing the draft lock) so the walkthrough can show every step.
  const tourGoToStep = useCallback((s: Step) => {
    setPage("workflow")
    setDraftReady(true)
    setStep(s)
    setVisited(prev => new Set(prev).add(s))
    setMounted(prev => (prev.has(s) ? prev : new Set([...prev, s])))
  }, [])

  // Tutorial is on by default: open the walkthrough from the first step on every demo load.
  useEffect(() => {
    if (!enableTour || bootStatus !== "ready") return
    setTourStep(0)
    setTourOpen(true)
  }, [enableTour, bootStatus])

  // Demo reveal: fill each Planning part when the tutorial spotlight lands on it; if the tutorial is
  // closed/skipped, fill whatever's left immediately. (With the tutorial off entirely, loadEngagement
  // already fills Planning on load, so this path only runs for the guided demo.)
  useEffect(() => {
    if (tourOpen) tourWasOpenedRef.current = true
    const eng = revealEngRef.current
    if (!enableTour || !eng) return
    const target = tourOpen ? TOUR_STEPS[tourStep]?.target : undefined
    const tutorialClosed = tourWasOpenedRef.current && !tourOpen   // opened, then skipped/closed
    if (!scopeShownRef.current && (tutorialClosed || target === "planning-scope" || target === "planning-sources")) {
      scopeShownRef.current = true
      revealScope(eng)
    }
    if (!sourcesShownRef.current && (tutorialClosed || target === "planning-sources")) {
      sourcesShownRef.current = true
      revealSources(eng)
    }
  }, [enableTour, tourOpen, tourStep, revealScope, revealSources])

  function newFile() {
    // Start a fresh Local File pipeline: jump into Planning immediately, then create the engagement
    // in the background so the pipeline shows instantly even if the create call is slow.
    setEntity(""); setJ([]); setFiscalYear(""); setSources(new Set()); setDraftJump(null); setDraftReady(false)
    setWebsiteUrl("")
    setPlanningSourceRows([])
    setPlanningDocuments(EMPTY_PLANNING_DOCUMENTS)
    setVisited(new Set([1])); setStep(1); setMounted(new Set([1]))
    setPage("workflow")
    setEngagementId(null)
    engagementLoadSeq.current += 1
    api.createEngagement()
      .then(({ id }) => { setApiOffline(false); setEngagementId(id); localStorage.setItem(LS_ID, id); refreshFiles() })
      .catch(error => {
        setApiOffline(true)
        void diagnoseAndOpen(error, "create new project", { label: "Try again", onClick: newFile })
      })
  }

  function openFile(file: EngagementSummary) {
    const id = file.id
    const seq = engagementLoadSeq.current + 1
    engagementLoadSeq.current = seq
    setEntity(file.entity_name ?? "")
    setJ(file.jurisdictions)
    setFiscalYear(file.fiscal_year ?? "")
    setSources(new Set())
    setWebsiteUrl("")
    setPlanningSourceRows([])
    setPlanningDocuments(EMPTY_PLANNING_DOCUMENTS)
    setEngagementId(id)
    localStorage.setItem(LS_ID, id)
    setDraftReady(false)
    setVisited(new Set([1, 2]))
    setMounted(new Set([2]))           // fresh mount for the opened file
    setStep(2)                          // land on Requirements so progress is visible
    setDraftJump(null)
    setPage("workflow")
    void loadEngagement(id, seq)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: "local" }).catch(error => {
      console.warn("[veritax] local sign-out failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      })
    })
    supabase.auth.signOut().catch(error => {
      console.warn("[veritax] remote sign-out failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      })
    })
    router.replace("/auth")
    router.refresh()
  }

  function continueFromPlanning() {
    if (engagementId) {
      api.patchEngagement(engagementId, {
        entity_name: entity,
        jurisdictions,
        fiscal_year: fiscalYear,
        website_url: websiteUrl.trim(),
        selected_source_kinds: Array.from(sources),
      })
        .then(refreshFiles)  // the newly-named file now shows in the library
        .catch(error => {
          logAppError("save planning scope", error)
          setApiOffline(true)
          void diagnoseAndOpen(error, "save planning scope", { label: "Retry save", onClick: continueFromPlanning })
        })
    }
    setDraftReady(false)
    navigate(2)
  }

  const newFileActive = page === "workflow" && engagementId !== null && files.every(f => f.id !== engagementId)

  if (bootStatus === "loading") return (
    <>
      <BootSkeleton />
      <ActionModal issue={actionIssue} onClose={() => setActionIssue(null)} />
    </>
  )
  if (bootStatus === "offline") return (
    <>
      <BootSkeleton offline onRetry={() => window.location.reload()} />
      <ActionModal issue={actionIssue} onClose={() => setActionIssue(null)} />
    </>
  )

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#fff", color: "#000" }}>

      {/* App-level left panel — pages. Collapses to a logo-only rail. */}
      <aside style={{
        width: collapsed ? 60 : 220, flexShrink: 0,
        borderRight: "1px solid #e5e5e5",
        background: "#fafafa",
        padding: collapsed ? "1.5rem 0" : "1.5rem 0.75rem",
        display: "flex", flexDirection: "column", gap: 2,
        alignItems: collapsed ? "center" : "stretch",
        transition: "width 160ms ease",
      }}>
        {/* Header — expanded: wordmark only; collapsed: logo only (hover to reveal the expand icon) */}
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            aria-label="Expand sidebar"
            title="Expand"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, marginBottom: "1.5rem", padding: 0,
              border: "none", background: "transparent", cursor: "pointer", borderRadius: "6px",
            }}
          >
            {logoHover
              ? <PanelLeftOpen size={20} strokeWidth={1.5} style={{ color: "#000" }} />
              : <img src="/VeritaxLogo.png" alt="Veritax" style={{ width: 24, height: 24, objectFit: "contain" }} />}
          </button>
        ) : (
          <div
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0 0.75rem", marginBottom: "1.5rem", minHeight: 24 }}
          >
            <span style={{ fontFamily: "var(--font-wordmark)", fontSize: "20px", fontWeight: 300, letterSpacing: 0, lineHeight: 1, color: "#000" }}>Veritax</span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 24, height: 24, padding: 0, border: "none", background: "transparent",
                cursor: "pointer", borderRadius: "4px", flexShrink: 0,
                opacity: logoHover ? 1 : 0, transition: "opacity 120ms ease",
              }}
            >
              <PanelLeftClose size={18} strokeWidth={1.5} style={{ color: "#888" }} />
            </button>
          </div>
        )}

        {!collapsed && (
        <>
        {/* Local file — a prominent page entry that collapses New file + the library */}
        <button
          type="button"
          onClick={() => setLocalOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
            background: "transparent", cursor: "pointer", width: "100%",
            fontSize: "14px", fontWeight: 400, color: "#000",
          }}
        >
          <FileText size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left" }}>Local file</span>
          <ChevronDown size={16} strokeWidth={1.5} style={{ color: "#888", flexShrink: 0, transform: localOpen ? "none" : "rotate(-90deg)", transition: "transform 120ms ease" }} />
        </button>

        {localOpen && (
          <>
            <button
              type="button"
              onClick={newFile}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.5rem 0.75rem", border: "none",
                borderRadius: "6px", background: newFileActive ? "#ececec" : "transparent",
                color: "#000", fontSize: "13px", fontWeight: 400,
                cursor: "pointer", textAlign: "left", width: "100%",
              }}
            >
              + New file
            </button>

            {/* File library — the user's engagements */}
            <div style={{ maxHeight: "42vh", overflowY: "auto", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: 2 }}>
              {libraryLoading && files.length === 0 ? (
                <SidebarLibrarySkeleton />
              ) : files.map(f => {
                const active = f.id === engagementId
                return (
                  <button key={f.id} type="button" onClick={() => openFile(f)} style={{
                    display: "flex", flexDirection: "column", gap: 1,
                    padding: "0.4rem 0.75rem", border: "none", borderRadius: "6px",
                    background: active ? "#ececec" : "transparent",
                    cursor: "pointer", textAlign: "left", width: "100%",
                  }}>
                    <span style={{ fontSize: "13px", fontWeight: 400, color: "#000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.entity_name || "Untitled"}
                    </span>
                    <span style={{ fontSize: "11px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.jurisdictions.join(", ") || "No jurisdictions"}
                    </span>
                  </button>
                )
              })}
              {!libraryLoading && files.length === 0 && (
                <p style={{ fontSize: "12px", color: "#aaa", padding: "0 0.75rem" }}>No files yet</p>
              )}
            </div>
          </>
        )}

        {/* Compliance / Monitoring / Defense hidden for now — flip `false` to restore the three pages. */}
        {false && (
        <>
        <button
          type="button"
          disabled
          title="Coming soon"
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem",
            padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
            background: "transparent",
            cursor: "not-allowed", width: "100%",
            fontSize: "14px", fontWeight: 400, color: "#aaa",
            opacity: 0.55,
          }}
        >
          <CalendarDays size={16} strokeWidth={1.5} style={{ flexShrink: 0, color: "#aaa" }} />
          <span style={{ flex: 1, textAlign: "left" }}>Compliance</span>
        </button>

        <button
          type="button"
          disabled
          title="Coming soon"
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem",
            padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
            background: "transparent",
            cursor: "not-allowed", width: "100%",
            fontSize: "14px", fontWeight: 400, color: "#aaa",
            opacity: 0.55,
          }}
        >
          <Activity size={16} strokeWidth={1.5} style={{ flexShrink: 0, color: "#aaa" }} />
          <span style={{ flex: 1, textAlign: "left" }}>Monitoring</span>
        </button>

        <button
          type="button"
          disabled
          title="Coming soon"
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem",
            padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
            background: "transparent",
            cursor: "not-allowed", width: "100%",
            fontSize: "14px", fontWeight: 400, color: "#aaa",
            opacity: 0.55,
          }}
        >
          <ShieldCheck size={16} strokeWidth={1.5} style={{ flexShrink: 0, color: "#aaa" }} />
          <span style={{ flex: 1, textAlign: "left" }}>Defense</span>
        </button>
        </>
        )}

        <button
          type="button"
          onClick={signOut}
          style={{
            marginTop: "auto",
            display: "flex", alignItems: "center",
            padding: "0.5rem 0.75rem", border: "1px solid #e5e5e5",
            borderRadius: "6px", background: "#fff",
            color: "#555", fontSize: "13px", fontWeight: 400,
            cursor: "pointer", textAlign: "left", width: "100%",
          }}
        >
          Sign out
        </button>
        </>
        )}
      </aside>

      {/* Page body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {page === "compliance" ? (
          <CompliancePage onOpenRequirements={() => { setPage("workflow"); setVisited(prev => new Set(prev).add(2)); setStep(2) }} />
        ) : page === "monitoring" ? (
          <MonitoringPage onOpenRisks={() => { setPage("workflow"); setVisited(prev => new Set(prev).add(4)); setStep(4) }} />
        ) : page === "defense" ? (
          <DefensePage
            onOpenMonitoring={() => setPage("monitoring")}
            onOpenRisks={() => { setPage("workflow"); setVisited(prev => new Set(prev).add(4)); setStep(4) }}
          />
        ) : (
          <>

        {/* Horizontal section tabs */}
        <nav style={{
          borderBottom: "1px solid #e5e5e5",
          background: "#fff",
          padding: "0 2rem",
          display: "flex",
          alignItems: "stretch",
          height: 48,
          flexShrink: 0,
        }}>
          {NAV.map(({ step: s, label }) => {
            const active = step === s
            const seen   = visited.has(s)
            const locked = s >= 3 && !draftReady
            return (
              <button
                key={s}
                type="button"
                disabled={locked}
                title={locked ? "Complete Requirements before drafting" : undefined}
                onClick={() => navigate(s)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  padding: "0 1rem", border: "none",
                  borderBottom: active ? "2px solid #000" : "2px solid transparent",
                  background: "transparent", cursor: locked ? "not-allowed" : "pointer",
                  color: locked ? "#c7c7c7" : active ? "#000" : seen ? "#000" : "#bbb",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 400,
                  opacity: locked ? 0.55 : 1,
                  transition: "color 150ms ease, border-color 150ms ease",
                }}
              >
                <span style={{ fontSize: "10px", letterSpacing: "0.06em", color: locked ? "#d0d0d0" : active ? "#000" : seen ? "#888" : "#ccc" }}>0{s}</span>
                <span>{label}</span>
              </button>
            )
          })}
          {enableTour && (
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              title="Tutorial"
              aria-label="Open tutorial"
              style={{
                marginLeft: "auto", alignSelf: "center",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30, borderRadius: 8, border: "none",
                background: tourOpen ? "#000" : "transparent", color: tourOpen ? "#fff" : "#666",
                cursor: "pointer",
              }}
            >
              <GraduationCap size={18} strokeWidth={1.5} />
            </button>
          )}
        </nav>

        {/* Section content — each step stays mounted once visited (hidden when inactive), so its
            results + in-flight polling persist and revisiting shows the stored output, never a re-run. */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {mounted.has(1) && (
            <div className={step === 1 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 1 ? "flex" : "none" }}>
              <PlanningStep
                key={`planning-${engagementId ?? "pending"}`}
                engagementId={engagementId}
                jurisdictions={jurisdictions} onJurisdictionsChange={setJ}
                entity={entity}              onEntityChange={setEntity}
                fiscalYear={fiscalYear}      onFiscalYearChange={setFiscalYear}
                documentsByKind={planningDocuments}
                updateDocuments={updatePlanningDocuments}
                sourceRows={planningSourceRows}
                rememberSourceRow={rememberPlanningSourceRow}
                websiteUrl={websiteUrl}
                onWebsiteUrlChange={setWebsiteUrl}
                sources={sources}            onSourcesChange={setSources}
                onContinue={continueFromPlanning}
              />
            </div>
          )}
          {mounted.has(2) && (
            <div className={step === 2 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 2 ? "flex" : "none" }}>
              <RequirementsStep
                key={`requirements-${engagementId ?? "pending"}`}
                engagementId={engagementId} jurisdictions={jurisdictions}
                onContinue={continueToDraft}
                onOpenDraftSection={(jurisdiction, sectionId) => { setDraftJump({ jurisdiction, sectionId }); continueToDraft() }}
                onDraftReadinessChange={setDraftReady}
                onOpenPlanning={() => navigate(1)}
              />
            </div>
          )}
          {mounted.has(3) && (
            <div className={step === 3 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 3 ? "flex" : "none" }}>
              <DraftStep
                key={`draft-${engagementId ?? "pending"}`}
                engagementId={engagementId} jurisdictions={jurisdictions} entity={entity}
                onContinue={() => navigate(4)}
                onOpenRequirements={() => navigate(2)}
                jumpTo={draftJump} onJumped={() => setDraftJump(null)}
              />
            </div>
          )}
          {mounted.has(4) && (
            <div className={step === 4 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 4 ? "flex" : "none" }}>
              <RisksStep
                key={`risks-${engagementId ?? "pending"}`}
                engagementId={engagementId}
                jurisdictions={jurisdictions}
                entity={entity}
                onOpenDraft={() => navigate(3)}
                onOpenPlanning={() => navigate(1)}
                accessLive={enableTour}
              />
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <ActionModal issue={actionIssue} onClose={() => setActionIssue(null)} />

      {enableTour && tourOpen && (
        <DemoTour
          steps={TOUR_STEPS}
          initialStep={tourStep}
          goToStep={tourGoToStep}
          onStepChange={(i) => { setTourStep(i); if (typeof window !== "undefined") window.localStorage.setItem("veritax.demoTourStep", String(i)) }}
          onExit={() => setTourOpen(false)}
          onFinish={() => { setTourStep(0); if (typeof window !== "undefined") window.localStorage.setItem("veritax.demoTourStep", "0"); setTourOpen(false); setConfetti(true) }}
        />
      )}
      {confetti && <Confetti onDone={() => setConfetti(false)} />}
    </div>
  )
}
