"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Activity, CalendarDays, ChevronDown, FileText, ShieldCheck } from "lucide-react"
import PlanningStep, { type SourceId } from "@/components/steps/planning"
import RequirementsStep from "@/components/steps/requirements"
import DraftStep from "@/components/steps/draft"
import RisksStep from "@/components/steps/risks"
import { api, type EngagementSummary } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { LoadingIndicator } from "@/components/ui/indicator"

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

const LS_ID = "veritax.engagementId"     // resume the file being worked on across refreshes
const LS_STEP = "veritax.step"
const PLANNING_SOURCES = new Set<SourceId>(["financials", "agreements", "public", "interview"])
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

function replaceWorkspaceUrl(projectId: string | null, step: Step) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (projectId) url.searchParams.set("project", projectId)
  else url.searchParams.delete("project")
  url.searchParams.set("step", STEP_URL[step])
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0 0.75rem", marginBottom: "1.5rem" }}>
          <img src="/VeritaxLogo.png" alt="Veritax" style={{ width: 24, height: 24, objectFit: "contain" }} />
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

export default function Page() {
  const router = useRouter()
  const [step, setStep]       = useState<Step>(1)
  const [visited, setVisited] = useState<Set<Step>>(new Set([1]))
  const [jurisdictions, setJ] = useState<string[]>([])
  const [entity, setEntity]   = useState("")
  const [sources, setSources] = useState<Set<SourceId>>(new Set())
  const [engagementId, setEngagementId] = useState<string | null>(null)
  // Deep-link from a Requirements row to the draft section that fulfils it.
  const [draftJump, setDraftJump] = useState<{ jurisdiction: string; sectionId: string } | null>(null)
  const [files, setFiles] = useState<EngagementSummary[]>([])
  const [localOpen, setLocalOpen] = useState(true)
  const [mounted, setMounted] = useState<Set<Step>>(new Set([1]))  // steps stay mounted once visited
  const [page, setPage] = useState<"workflow" | "compliance" | "monitoring" | "defense">("workflow")
  const [apiOffline, setApiOffline] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [bootStatus, setBootStatus] = useState<BootStatus>("loading")
  const [libraryLoading, setLibraryLoading] = useState(true)
  const engagementLoadSeq = useRef(0)

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
      return false
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  // Rehydrate a file's scope from the backend (entity, jurisdictions, which source rows are on).
  const loadEngagement = useCallback(async (id: string, seq?: number): Promise<boolean> => {
    try {
      const eng = await api.getEngagement(id)
      if (seq !== undefined && seq !== engagementLoadSeq.current) return false
      setEntity(eng.entity_name ?? "")
      setJ(eng.jurisdictions)
      setSources(new Set(eng.sources.map(s => s.kind).filter((k): k is SourceId => PLANNING_SOURCES.has(k as SourceId))))
      setEngagementId(id)
      localStorage.setItem(LS_ID, id)
      return true
    } catch (error) {
      logAppError("load engagement", error)
      return false
    }
  }, [])

  // Resume the file being worked on (or start a fresh one), then load the library.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
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
        }
        return
      }
      const fromUrl = readWorkspaceUrl()
      const stored = localStorage.getItem(LS_ID)
      const requestedId = fromUrl.projectId || stored
      let resumed = requestedId ? await loadEngagement(requestedId) : false
      if (!resumed && fromUrl.projectId && stored && stored !== fromUrl.projectId) {
        resumed = await loadEngagement(stored)
      }
      if (cancelled) return
      if (resumed) {
        const resumedStep = fromUrl.step ?? parseStepParam(localStorage.getItem(LS_STEP))
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
          setEngagementId(id)
          localStorage.setItem(LS_ID, id)
        } catch (error) {
          logAppError("create engagement", error)
          if (!cancelled) {
            setApiOffline(true)
            setBootStatus("offline")
            setLibraryLoading(false)
          }
          return
        }
      }
      const loadedFiles = await refreshFiles()
      if (!cancelled) setBootStatus(loadedFiles ? "ready" : "offline")
    })()
    return () => { cancelled = true }
  }, [loadEngagement, refreshFiles])

  useEffect(() => { localStorage.setItem(LS_STEP, String(step)) }, [step])
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
    })
  }, [engagementId])

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

  function newFile() {
    // Start a fresh Local File pipeline: jump into Planning immediately, then create the engagement
    // in the background so the pipeline shows instantly even if the create call is slow.
    setEntity(""); setJ([]); setSources(new Set()); setDraftJump(null); setDraftReady(false)
    setVisited(new Set([1])); setStep(1); setMounted(new Set([1]))
    setPage("workflow")
    setEngagementId(null)
    engagementLoadSeq.current += 1
    api.createEngagement()
      .then(({ id }) => { setApiOffline(false); setEngagementId(id); localStorage.setItem(LS_ID, id); refreshFiles() })
      .catch(() => setApiOffline(true))
  }

  function openFile(file: EngagementSummary) {
    const id = file.id
    const seq = engagementLoadSeq.current + 1
    engagementLoadSeq.current = seq
    setEntity(file.entity_name ?? "")
    setJ(file.jurisdictions)
    setSources(new Set())
    setEngagementId(id)
    localStorage.setItem(LS_ID, id)
    setDraftReady(false)
    setVisited(new Set([1, 2]))
    setMounted(new Set([2]))           // fresh mount for the opened file
    setStep(2)                          // land on Requirements so progress is visible
    setDraftJump(null)
    setPage("workflow")
    if (id !== engagementId) {
      void loadEngagement(id, seq)
    }
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
    router.replace("/login")
    router.refresh()
  }

  function continueFromPlanning() {
    if (engagementId) {
      api.patchEngagement(engagementId, { entity_name: entity, jurisdictions })
        .then(refreshFiles)  // the newly-named file now shows in the library
        .catch(error => { logAppError("save planning scope", error); setApiOffline(true) })
    }
    setDraftReady(false)
    navigate(2)
  }

  const newFileActive = page === "workflow" && engagementId !== null && files.every(f => f.id !== engagementId)

  if (bootStatus === "loading") return <BootSkeleton />
  if (bootStatus === "offline") return <BootSkeleton offline onRetry={() => window.location.reload()} />

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#fff", color: "#000" }}>

      {/* App-level left panel — pages */}
      <aside style={{
        width: 220, flexShrink: 0,
        borderRight: "1px solid #e5e5e5",
        background: "#fafafa",
        padding: "1.5rem 0.75rem",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0 0.75rem", marginBottom: "1.5rem" }}>
          <img src="/VeritaxLogo.png" alt="Veritax" style={{ width: 24, height: 24, objectFit: "contain" }} />
          <span style={{ fontFamily: "var(--font-wordmark)", fontSize: "20px", fontWeight: 300, letterSpacing: 0, lineHeight: 1, color: "#000" }}>Veritax</span>
        </div>

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

        {/* Demo-only pages stay visible, but disabled on the live app until backend support exists. */}
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

        {apiOffline && (
          <div style={{
            flexShrink: 0,
            padding: "0.625rem 2rem",
            borderBottom: "1px solid #e5e5e5",
            background: "#fafafa",
            color: "#555",
            fontSize: "12px",
          }}>
            Backend or database is unavailable. Refresh, check your connection or browser blocker, and confirm the Render backend is reachable.
          </div>
        )}

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
              />
            </div>
          )}
          {mounted.has(3) && (
            <div className={step === 3 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 3 ? "flex" : "none" }}>
              <DraftStep
                key={`draft-${engagementId ?? "pending"}`}
                engagementId={engagementId} jurisdictions={jurisdictions} entity={entity}
                onContinue={() => navigate(4)}
                jumpTo={draftJump} onJumped={() => setDraftJump(null)}
              />
            </div>
          )}
          {mounted.has(4) && (
            <div className={step === 4 ? "vt-step-panel vt-step-panel-active" : "vt-step-panel"} style={{ flex: 1, minWidth: 0, display: step === 4 ? "flex" : "none" }}>
              <RisksStep key={`risks-${engagementId ?? "pending"}`} engagementId={engagementId} jurisdictions={jurisdictions} entity={entity} />
            </div>
          )}
        </div>
          </>
        )}
      </div>

    </div>
  )
}
