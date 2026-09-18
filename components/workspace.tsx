"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { usePathname, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ChevronDown, GraduationCap, PanelLeftClose } from "lucide-react"
import PlanningStep, { type PlanningDocumentMap, type PlanningSourceRow, type SourceId } from "@/components/steps/planning"
import DemoTour, { type TourStep } from "@/components/DemoTour"
import Confetti from "@/components/Confetti"
import { stageEntered, stageCompleted } from "@/lib/analytics"
import ControlledTransactionsStep from "@/components/steps/controlled-transactions"
import RequirementsStep from "@/components/steps/requirements"
import DraftStep from "@/components/steps/draft"
import RisksStep from "@/components/steps/risks"
import { api, type DocumentRead, type Engagement, type EngagementSummary } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { LoadingIndicator } from "@/components/ui/indicator"
import { ActionModal } from "@/components/ui/action-modal"
import { diagnoseApiFailure, withActions, type ActionableIssue, type ActionableIssueBase, type ActionableErrorAction } from "@/lib/actionable-errors"
import SearchPage from "@/components/company/SearchPage"
import CompanyRecord from "@/components/company/CompanyRecord"
import { loadIndex, type IndexRow } from "@/lib/companies"
import { useSavedCompanies } from "@/lib/saved-companies"
import { useSearchMode } from "@/lib/search-mode"

// FullCalendar is browser-only — load it client-side so it never runs during the build prerender.
const CompliancePage = dynamic(() => import("@/components/compliance"), { ssr: false })
const MonitoringPage = dynamic(() => import("@/components/monitoring"), { ssr: false })
const DefensePage = dynamic(() => import("@/components/defense"), { ssr: false })

type Step = 1 | 2 | 3 | 4 | 5
type BootStatus = "loading" | "ready" | "offline"

const NAV: { step: Step; label: string }[] = [
  { step: 1, label: "Planning" },
  { step: 2, label: "Controlled transactions" },
  { step: 3, label: "Requirements" },
  { step: 4, label: "Draft" },
  { step: 5, label: "Risks" },
]

// Guided walkthrough for the public /demo (enableTour). Each step switches to its tab, then spotlights
// the element carrying the matching data-tour attribute.
const TOUR_STEPS: TourStep[] = [
  { appStep: 1, target: "planning-scope", title: "Set the scope", text: "Choose the jurisdictions, the entity, and the fiscal year. This frames the whole Local File.", placement: "bottom-end" },
  { appStep: 1, target: "planning-sources", title: "Bring your sources", text: "Upload or connect financials, agreements, the website, and interviews — Veritax reads them for you." },
  { appStep: 3, target: "req-jurisdictions", title: "Every jurisdiction at once", text: "Veritax checks the file against each jurisdiction's real requirements in parallel. Click a tab to see its results." },
  { appStep: 4, target: "draft-sections", title: "The draft writes itself", text: "Every section that jurisdiction requires is generated for you, in order." },
  { appStep: 4, target: "draft-actions", title: "Edit or export", text: "Edit any section inline, or download the finished Local File as a Word document." },
  { appStep: 5, target: "risks-rollup", title: "Exposures & contradictions", text: "Veritax flags financial exposures and contradictions in the file, each with evidence you can open." },
]

const LS_ID = "veritax.engagementId"     // resume the file being worked on across refreshes
const LS_STEP = "veritax.step"
// Workflow tab → canonical analytics stage (Planning is the "evidence" stage; Draft is "local_file").
const STEP_TO_STAGE: Record<Step, string> = { 1: "evidence", 2: "transactions", 3: "requirements", 4: "local_file", 5: "risks" }
const PLANNING_SOURCES = new Set<SourceId>(["financials", "agreements", "public", "interview"])
const EMPTY_PLANNING_DOCUMENTS: PlanningDocumentMap = {}
const STEP_SLUG: Record<Step, string> = { 1: "planning", 2: "transactions", 3: "requirements", 4: "draft", 5: "risks" }
// Which steps are per-jurisdiction — the country belongs in their URL. Planning is not.
const STEP_HAS_JURISDICTION: Record<Step, boolean> = { 1: false, 2: true, 3: true, 4: true, 5: true }

function stepFromSlug(slug: string | undefined): Step | null {
  switch ((slug ?? "").toLowerCase()) {
    case "planning": return 1
    case "transactions": return 2
    case "requirements": return 3
    case "draft": return 4
    case "risks": return 5
    default: return null
  }
}

// The URL is the source of truth:  /  ·  /company/<slug>  ·  /project/<id>/<step>[/<country>]
type Route =
  | { view: "search" }
  | { view: "company"; slug: string }
  | { view: "workflow"; projectId: string; step: Step; jurisdiction: string | null }

function parseRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean).map(p => { try { return decodeURIComponent(p) } catch { return p } })
  if (parts[0] === "company" && parts[1]) return { view: "company", slug: parts[1] }
  if (parts[0] === "project" && parts[1]) {
    return { view: "workflow", projectId: parts[1], step: stepFromSlug(parts[2]) ?? 1, jurisdiction: parts[3] ?? null }
  }
  return { view: "search" }
}

function buildProjectPath(projectId: string, step: Step, jurisdiction: string | null): string {
  const base = `/project/${projectId}/${STEP_SLUG[step]}`
  return STEP_HAS_JURISDICTION[step] && jurisdiction ? `${base}/${encodeURIComponent(jurisdiction)}` : base
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0 0.75rem", marginBottom: "1.5rem", minHeight: 24 }}>
          <img src="/VeritaxLogo-notext.svg" alt="Veritax" style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }} />
        </div>
        <div style={{ padding: "0.6rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <SkeletonBlock style={{ width: 16, height: 16, borderRadius: 4 }} />
          <SkeletonBlock style={{ width: 58, height: 14 }} />
        </div>
        <div style={{ padding: "0.6rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <SkeletonBlock style={{ width: 16, height: 16, borderRadius: 4 }} />
          <SkeletonBlock style={{ width: 118, height: 14 }} />
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
        <div style={{ flex: 1, padding: "3rem 1.5rem", overflow: "hidden" }}>
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
            <section style={{ maxWidth: 820, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)" }}>
                <LoadingIndicator size={14} />
                <span>Opening workspace</span>
              </div>
              <SkeletonBlock style={{ width: "100%", height: 56, borderRadius: 14, marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
                <SkeletonBlock style={{ width: 88, height: 32, borderRadius: 999 }} />
                <SkeletonBlock style={{ width: 108, height: 32, borderRadius: 999 }} />
                <SkeletonBlock style={{ width: 96, height: 32, borderRadius: 999 }} />
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default function Workspace({ enableTour = false }: { enableTour?: boolean } = {}) {
  const router = useRouter()
  const pathname = usePathname()
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
  const [collapsed, setCollapsed] = useState(false)   // left panel: collapsed shows the mark only
  const [mounted, setMounted] = useState<Set<Step>>(new Set([1]))  // steps stay mounted once visited
  const [page, setPage] = useState<"workflow" | "compliance" | "monitoring" | "defense" | "company-search">(enableTour ? "workflow" : "company-search")
  const [companyOpen, setCompanyOpen] = useState(true)
  const [companies, setCompanies] = useState<IndexRow[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [fromSearch, setFromSearch] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      const route = parseRoute(window.location.pathname)
      return route.view === "company" && sessionStorage.getItem("veritax.fromSearch") === route.slug
    } catch {
      return false
    }
  })
  const [activeJurisdiction, setActiveJurisdiction] = useState("")   // shared across per-jurisdiction steps; lives in the URL
  const [savedSlugs] = useSavedCompanies()
  const [searchMode] = useSearchMode()
  const [apiOffline, setApiOffline] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [bootStatus, setBootStatus] = useState<BootStatus>("loading")
  const [signedIn, setSignedIn] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [actionIssue, setActionIssue] = useState<ActionableIssue | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)   // remembered walkthrough position (resume from the cap icon)
  const [confetti, setConfetti] = useState(false)
  const engagementLoadSeq = useRef(0)
  const engagementIdRef = useRef<string | null>(engagementId)   // read current id in effects without re-subscribing
  engagementIdRef.current = engagementId
  const routeProjectRef = useRef<string | null>(null)          // last project id applied from the URL (detects project switch)
  const trackedStageRef = useRef<string | null>(null)   // last analytics stage fired (guards rerender/StrictMode)
  const revealEngRef = useRef<Engagement | null>(null)  // demo Planning data, revealed as the tutorial spotlights it
  const scopeShownRef = useRef(false)
  const sourcesShownRef = useRef(false)
  const tourWasOpenedRef = useRef(false)

  // Company index (all researched companies) — powers the sidebar saved-list name lookup + the search page.
  useEffect(() => { loadIndex().then(setCompanies).catch(() => setCompanies([])) }, [])

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
      // Anonymous search is the product. No token is not an outage — just no Local File library yet.
      if (error instanceof Error && error.message.startsWith("API 401 ")) {
        setSignedIn(false)
        return false
      }
      setApiOffline(true)
      void diagnoseAndOpen(error, "load file library", { label: "Refresh", onClick: () => window.location.reload() })
      return false
    } finally {
      setLibraryLoading(false)
    }
  }, [diagnoseAndOpen])

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
      t += 450
      at(t, () => setSources(prev => new Set(prev).add(kind)))   // tick the class checkbox
      for (const src of kindSources) {
        if (src.url) { const url = src.url; t += 400; at(t, () => setWebsiteUrl(url)) }
        if (src.origin === "connected") {
          const row: PlanningSourceRow = { id: src.id, kind, origin: src.origin, connector_provider: src.connector_provider, url: src.url }
          t += 400; at(t, () => setPlanningSourceRows(prev => (prev.some(r => r.id === row.id) ? prev : [...prev, row])))
        }
        for (const doc of src.documents) {
          t += 400
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
  // Search does not wait on the Local File API — it is the product.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const landing = parseRoute(window.location.pathname)
      const searchFirst = !enableTour && landing.view !== "workflow"
      if (searchFirst) {
        setPage("company-search")
        if (landing.view === "company") setSelectedCompany(landing.slug)
        setBootStatus("ready")
      } else {
        setBootStatus("loading")
      }
      setLibraryLoading(true)
      const { data: sessionData } = await createClient().auth.getSession()
      const hasSession = Boolean(sessionData.session?.access_token)
      if (!cancelled) setSignedIn(hasSession)
      try {
        await api.health()
        if (!cancelled) setApiOffline(false)
      } catch (error) {
        logAppError("health", error)
        if (!cancelled) {
          setApiOffline(true)
          setLibraryLoading(false)
          if (!searchFirst) {
            setBootStatus("offline")
            void diagnoseAndOpen(
              error,
              "check backend health",
              { label: "Retry", onClick: () => window.location.reload() },
              { label: "Sign in again", onClick: () => router.replace("/auth"), variant: "ghost" },
            )
          }
        }
        return
      }
      // Search is public. Skip Local File API calls until there is a login token.
      if (!hasSession && !enableTour) {
        if (!cancelled) {
          setFiles([])
          setLibraryLoading(false)
          setBootStatus("ready")
        }
        if (!searchFirst) router.replace("/auth")
        return
      }
      // ensure a background working file exists (New file + uploads need an id) — or create one.
      const ensureBackgroundFile = async (): Promise<boolean> => {
        const stored = localStorage.getItem(LS_ID)
        const resumed = stored ? await loadEngagement(stored) : false
        if (resumed || cancelled) return resumed
        try {
          const { id } = await api.createEngagement()
          if (cancelled) return false
          setPlanningDocuments(EMPTY_PLANNING_DOCUMENTS); setPlanningSourceRows([]); setWebsiteUrl(""); setSources(new Set())
          setEngagementId(id); localStorage.setItem(LS_ID, id)
          return true
        } catch (error) {
          logAppError("create engagement", error)
          if (!cancelled) {
            setApiOffline(true)
            setLibraryLoading(false)
            if (!searchFirst) {
              setBootStatus("offline")
              void diagnoseAndOpen(
                error, "create project",
                { label: "Retry", onClick: () => window.location.reload() },
                { label: "Sign in again", onClick: () => router.replace("/auth"), variant: "ghost" },
              )
            }
          }
          return false
        }
      }

      if (enableTour) {
        // Demo: resume the seeded file with the staged reveal; always open on Planning for the tour.
        const stored = localStorage.getItem(LS_ID)
        const resumed = stored ? await loadEngagement(stored, undefined, true) : false
        if (!resumed) { try { const { id } = await api.createEngagement(); if (!cancelled) { setEngagementId(id); localStorage.setItem(LS_ID, id) } } catch (e) { logAppError("create engagement (demo)", e) } }
        if (cancelled) return
        setPage("workflow"); setStep(1); setVisited(new Set([1])); setMounted(new Set([1]))
      } else {
        const route = parseRoute(window.location.pathname)
        if (route.view === "workflow") {
          setPage("workflow")
          const ok = await loadEngagement(route.projectId)
          if (cancelled) return
          routeProjectRef.current = route.projectId
          if (ok) {
            setStep(route.step); setActiveJurisdiction(route.jurisdiction ?? "")
            setVisited(new Set([route.step])); setMounted(new Set([route.step]))
            if (route.step >= 4) setDraftReady(true)
          } else {
            router.replace("/")          // not found / not owned → fall back to search
            await ensureBackgroundFile()
          }
        } else {
          setPage("company-search")
          if (route.view === "company") setSelectedCompany(route.slug)
          const ok = await ensureBackgroundFile()
          if (!ok && !searchFirst) return
        }
      }
      if (cancelled) return
      const loadedFiles = await refreshFiles()
      if (!cancelled) {
        if (searchFirst) setBootStatus("ready")
        else setBootStatus(loadedFiles ? "ready" : "offline")
      }
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
  // URL → state: drive the visible view from the path (in-app navigation, refresh, and back/forward all flow here).
  useEffect(() => {
    if (enableTour || bootStatus !== "ready") return
    const route = parseRoute(pathname)
    if (route.view !== "workflow") {
      setPage("company-search")
      if (route.view === "company") {
        setSelectedCompany(route.slug)
        try { setFromSearch(sessionStorage.getItem("veritax.fromSearch") === route.slug) }
        catch { setFromSearch(false) }
      } else {
        setSelectedCompany(null)
        setFromSearch(false)
      }
      return
    }
    setPage("workflow"); setSelectedCompany(null)
    const projectChanged = route.projectId !== routeProjectRef.current
    routeProjectRef.current = route.projectId
    setStep(route.step)
    if (route.step >= 4) setDraftReady(true)   // deep-link into Draft/Risks unlocks the tab for viewing
    if (route.jurisdiction) setActiveJurisdiction(route.jurisdiction)
    if (projectChanged) { setVisited(new Set([route.step])); setMounted(new Set([route.step])) }
    else { setVisited(prev => new Set(prev).add(route.step)); setMounted(prev => new Set(prev).add(route.step)) }
    if (route.projectId !== engagementIdRef.current) {
      engagementLoadSeq.current += 1
      void loadEngagement(route.projectId, engagementLoadSeq.current)
    }
  }, [pathname, bootStatus, enableTour, loadEngagement])
  useEffect(() => { setMounted(m => (m.has(step) ? m : new Set([...m, step]))) }, [step])  // mount a step on first visit, keep it
  // Keep the active jurisdiction valid once the engagement's jurisdictions load (default not shown in the URL).
  useEffect(() => {
    if (jurisdictions.length && !jurisdictions.includes(activeJurisdiction)) setActiveJurisdiction(jurisdictions[0])
  }, [jurisdictions, activeJurisdiction])
  useEffect(() => {
    if (!engagementId) return
    api.recoverPipeline(engagementId).catch(error => {
      logAppError("pipeline recovery", error)
      setApiOffline(true)
      void diagnoseAndOpen(error, "recover pipeline", { label: "Retry recovery", onClick: () => void api.recoverPipeline(engagementId, true) })
    })
  }, [diagnoseAndOpen, engagementId])

  // Go to a workflow step (optionally for a specific country). Non-demo navigates the URL (the source of
  // truth); demo has no URL, so it flips state directly.
  const goWorkflow = useCallback((s: Step, jurisdiction?: string | null) => {
    if (enableTour) {
      setPage("workflow"); setStep(s)
      setVisited(prev => new Set(prev).add(s)); setMounted(prev => new Set(prev).add(s))
      if (jurisdiction) setActiveJurisdiction(jurisdiction)
      return
    }
    const id = engagementIdRef.current
    if (!id) return
    const jur = jurisdiction !== undefined ? jurisdiction : (STEP_HAS_JURISDICTION[s] ? (activeJurisdiction || null) : null)
    router.push(buildProjectPath(id, s, jur))
  }, [enableTour, activeJurisdiction, router])

  const openCompany = useCallback((slug: string, via: "search" | "saved" = "saved") => {
    const from = via === "search"
    setFromSearch(from)
    try {
      if (from) sessionStorage.setItem("veritax.fromSearch", slug)
      else sessionStorage.removeItem("veritax.fromSearch")
    } catch { /* ignore */ }
    if (enableTour) { setSelectedCompany(slug); setPage("company-search"); return }
    router.push(`/company/${encodeURIComponent(slug)}`)
  }, [enableTour, router])

  function navigate(s: Step) {
    if (s >= 4 && !draftReady) return
    goWorkflow(s)
  }

  function continueToDraft() {
    setDraftReady(true)
    goWorkflow(4)
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

  function openSearch() {
    setFromSearch(false)
    try { sessionStorage.removeItem("veritax.fromSearch") } catch { /* ignore */ }
    if (enableTour) { setSelectedCompany(null); setPage("company-search"); return }
    router.push("/")
  }

  function newFile() {
    if (!signedIn) { router.replace("/auth"); return }
    // Start a fresh Local File pipeline: jump into Planning immediately, then create the engagement
    // in the background so the pipeline shows instantly even if the create call is slow.
    setEntity(""); setJ([]); setFiscalYear(""); setSources(new Set()); setDraftJump(null); setDraftReady(false)
    setWebsiteUrl("")
    setPlanningSourceRows([])
    setPlanningDocuments(EMPTY_PLANNING_DOCUMENTS)
    setActiveJurisdiction("")
    setVisited(new Set([1])); setStep(1); setMounted(new Set([1]))
    setPage("workflow"); setSelectedCompany(null)
    setEngagementId(null)
    engagementLoadSeq.current += 1
    api.createEngagement()
      .then(({ id }) => {
        setApiOffline(false); setEngagementId(id); localStorage.setItem(LS_ID, id)
        routeProjectRef.current = id
        if (!enableTour) router.replace(buildProjectPath(id, 1, null))
        refreshFiles()
      })
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
    setActiveJurisdiction(file.jurisdictions[0] ?? "")
    setVisited(new Set([1, 3]))
    setMounted(new Set([3]))           // fresh mount for the opened file
    setStep(3)                          // land on Requirements so progress is visible
    setDraftJump(null)
    setPage("workflow"); setSelectedCompany(null)
    routeProjectRef.current = id       // the URL effect won't re-load; we already loaded here
    if (!enableTour) router.push(buildProjectPath(id, 3, file.jurisdictions[0] ?? null))
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
  const night = page === "company-search" && !selectedCompany && searchMode === "night"
  const routeNow = parseRoute(pathname)
  const searchFirst = !enableTour && routeNow.view !== "workflow"

  if (!searchFirst && bootStatus === "loading") return (
    <>
      <BootSkeleton />
      <ActionModal issue={actionIssue} onClose={() => setActionIssue(null)} />
    </>
  )
  if (!searchFirst && bootStatus === "offline") return (
    <>
      <BootSkeleton offline onRetry={() => window.location.reload()} />
      <ActionModal issue={actionIssue} onClose={() => setActionIssue(null)} />
    </>
  )

  return (
    <div className={night ? "vt-app vt-app--night" : "vt-app"}>

      <aside className={collapsed ? "vt-app-rail is-collapsed" : "vt-app-rail"}>
        {collapsed ? (
          <button type="button" className="vt-app-rail-mark" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand">V</button>
        ) : (
          <div className="vt-app-rail-head">
            <p className="vt-app-rail-mark">Veritax</p>
            <button type="button" className="vt-app-rail-collapse" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse">
              <PanelLeftClose size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        <button
          type="button"
          className={page === "company-search" && !selectedCompany ? "vt-app-rail-btn is-on" : "vt-app-rail-btn"}
          onClick={openSearch}
        >
          {collapsed ? "S" : "Search"}
        </button>

        <button
          type="button"
          className="vt-app-rail-btn"
          onClick={() => collapsed ? (setCollapsed(false), setCompanyOpen(true)) : setCompanyOpen(o => !o)}
        >
          {collapsed ? "C" : "Saved companies"}
          {!collapsed && <ChevronDown size={14} strokeWidth={1.5} style={{ marginLeft: "auto", transform: companyOpen ? "none" : "rotate(-90deg)", transition: "transform 120ms ease" }} />}
        </button>

        {!collapsed && companyOpen && (
          <div className="vt-app-rail-sub">
            {[...savedSlugs].map(slug => {
              const c = companies.find(x => x.slug === slug)
              if (!c) return null
              const active = page === "company-search" && selectedCompany === c.slug
              return (
                <button key={c.slug} type="button" className={active ? "vt-app-rail-item is-on" : "vt-app-rail-item"} onClick={() => openCompany(c.slug, "saved")}>
                  <span className="vt-app-rail-item-name">{c.name}</span>
                  <span className="vt-app-rail-item-meta">{[c.ticker, c.hq_country].filter(Boolean).join(" · ") || "—"}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Local file generator — Stage 1 search is the product; keep this out of the rail.
        <button
          type="button"
          className="vt-app-rail-btn"
          onClick={() => collapsed ? (setCollapsed(false), setLocalOpen(true)) : setLocalOpen(o => !o)}
        >
          {collapsed ? "L" : "Local file"}
          {!collapsed && <ChevronDown size={14} strokeWidth={1.5} style={{ marginLeft: "auto", transform: localOpen ? "none" : "rotate(-90deg)", transition: "transform 120ms ease" }} />}
        </button>

        {!collapsed && localOpen && (
          <>
            <button type="button" className={newFileActive ? "vt-app-rail-btn is-on" : "vt-app-rail-btn"} onClick={newFile}>
              + New file
            </button>
            <div className="vt-app-rail-sub">
              {libraryLoading && files.length === 0 ? (
                <SidebarLibrarySkeleton />
              ) : files.map(f => {
                const active = page === "workflow" && f.id === engagementId
                return (
                  <button key={f.id} type="button" className={active ? "vt-app-rail-item is-on" : "vt-app-rail-item"} onClick={() => openFile(f)}>
                    <span className="vt-app-rail-item-name">{f.entity_name || "Untitled"}</span>
                    <span className="vt-app-rail-item-meta">{f.jurisdictions.join(", ") || "No jurisdictions"}</span>
                  </button>
                )
              })}
              {!libraryLoading && files.length === 0 && (
                <p className="vt-app-rail-empty">{signedIn ? "No files yet" : "Sign in to keep files"}</p>
              )}
            </div>
          </>
        )}
        */}

        <button
          type="button"
          className="vt-app-rail-btn vt-app-rail-out"
          onClick={signedIn ? signOut : () => router.replace("/auth")}
          title={signedIn ? "Sign out" : "Sign in"}
          aria-label={signedIn ? "Sign out" : "Sign in"}
        >
          {collapsed ? (signedIn ? "Out" : "In") : (signedIn ? "Sign out" : "Sign in")}
        </button>
      </aside>

      <div className="vt-app-main">
        {page === "company-search" ? (
          <>
            <div style={{ display: selectedCompany ? "none" : "flex", flex: 1, minHeight: 0, flexDirection: "column", overflow: "hidden" }}>
              <SearchPage onOpen={slug => openCompany(slug, "search")} />
            </div>
            {selectedCompany ? (
              <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <CompanyRecord slug={selectedCompany} onBack={openSearch} fromSearch={fromSearch} />
              </div>
            ) : null}
          </>
        ) : page === "compliance" ? (
          <CompliancePage onOpenRequirements={() => goWorkflow(3)} />
        ) : page === "monitoring" ? (
          <MonitoringPage onOpenRisks={() => goWorkflow(5)} />
        ) : page === "defense" ? (
          <DefensePage
            onOpenMonitoring={() => setPage("monitoring")}
            onOpenRisks={() => goWorkflow(5)}
          />
        ) : (
          <>

        {/* Horizontal section tabs */}
        <nav className="vt-app-tabs">
          {NAV.map(({ step: s, label }) => {
            const active = step === s
            const locked = s >= 4 && !draftReady
            return (
              <button
                key={s}
                type="button"
                className={active ? "vt-app-tab is-on" : "vt-app-tab"}
                disabled={locked}
                title={locked ? "Complete Requirements before drafting" : undefined}
                onClick={() => navigate(s)}
              >
                <span className="vt-app-tab-n">0{s}</span>
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
              <ControlledTransactionsStep
                key={`transactions-${engagementId ?? "pending"}`}
                engagementId={engagementId} jurisdictions={jurisdictions}
                activeJurisdiction={activeJurisdiction} onJurisdictionChange={j => goWorkflow(2, j)}
                onContinue={() => navigate(3)}
              />
            </div>
          )}
          {mounted.has(3) && (
            <div className={step === 3 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 3 ? "flex" : "none" }}>
              <RequirementsStep
                key={`requirements-${engagementId ?? "pending"}`}
                engagementId={engagementId} jurisdictions={jurisdictions}
                activeJurisdiction={activeJurisdiction} onJurisdictionChange={j => goWorkflow(3, j)}
                onContinue={continueToDraft}
                onOpenDraftSection={(jurisdiction, sectionId) => { setDraftJump({ jurisdiction, sectionId }); setDraftReady(true); goWorkflow(4, jurisdiction) }}
                onDraftReadinessChange={setDraftReady}
                onOpenPlanning={() => navigate(1)}
              />
            </div>
          )}
          {mounted.has(4) && (
            <div className={step === 4 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 4 ? "flex" : "none" }}>
              <DraftStep
                key={`draft-${engagementId ?? "pending"}`}
                engagementId={engagementId} jurisdictions={jurisdictions} entity={entity}
                activeJurisdiction={activeJurisdiction} onJurisdictionChange={j => goWorkflow(4, j)}
                onContinue={() => navigate(5)}
                onOpenRequirements={() => navigate(3)}
                jumpTo={draftJump} onJumped={() => setDraftJump(null)}
              />
            </div>
          )}
          {mounted.has(5) && (
            <div className={step === 5 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 5 ? "flex" : "none" }}>
              <RisksStep
                key={`risks-${engagementId ?? "pending"}`}
                engagementId={engagementId}
                jurisdictions={jurisdictions}
                entity={entity}
                activeJurisdiction={activeJurisdiction} onJurisdictionChange={j => goWorkflow(5, j)}
                onOpenDraft={() => navigate(4)}
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
