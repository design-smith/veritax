"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Activity, CalendarDays, ChevronDown, FileText, ShieldCheck } from "lucide-react"
import PlanningStep, { type SourceId } from "@/components/steps/planning"
import RequirementsStep from "@/components/steps/requirements"
import DraftStep from "@/components/steps/draft"
import RisksStep from "@/components/steps/risks"
import { api, type EngagementSummary } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"

// FullCalendar is browser-only — load it client-side so it never runs during the build prerender.
const CompliancePage = dynamic(() => import("@/components/compliance"), { ssr: false })
const MonitoringPage = dynamic(() => import("@/components/monitoring"), { ssr: false })
const DefensePage = dynamic(() => import("@/components/defense"), { ssr: false })

type Step = 1 | 2 | 3 | 4

const NAV: { step: Step; label: string }[] = [
  { step: 1, label: "Planning" },
  { step: 2, label: "Requirements" },
  { step: 3, label: "Draft" },
  { step: 4, label: "Risks" },
]

const LS_ID = "veritax.engagementId"     // resume the file being worked on across refreshes
const LS_STEP = "veritax.step"
const PLANNING_SOURCES = new Set<SourceId>(["financials", "agreements", "public", "interview"])

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

  const refreshFiles = useCallback(() => {
    api.listEngagements().then(setFiles).catch(err => console.error("[veritax] failed to list files:", err))
  }, [])

  // Rehydrate a file's scope from the backend (entity, jurisdictions, which source rows are on).
  const loadEngagement = useCallback(async (id: string): Promise<boolean> => {
    try {
      const eng = await api.getEngagement(id)
      setEntity(eng.entity_name ?? "")
      setJ(eng.jurisdictions)
      setSources(new Set(eng.sources.map(s => s.kind).filter((k): k is SourceId => PLANNING_SOURCES.has(k as SourceId))))
      setEngagementId(id)
      localStorage.setItem(LS_ID, id)
      return true
    } catch {
      return false
    }
  }, [])

  // Resume the file being worked on (or start a fresh one), then load the library.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stored = localStorage.getItem(LS_ID)
      const resumed = stored ? await loadEngagement(stored) : false
      if (cancelled) return
      if (resumed) {
        const s = Number(localStorage.getItem(LS_STEP))
        if (s >= 2 && s <= 4) { setStep(s as Step); setVisited(new Set([1, s as Step])) }
      } else {
        try {
          const { id } = await api.createEngagement()  // uploads need an id to attach to
          if (cancelled) return
          setEngagementId(id)
          localStorage.setItem(LS_ID, id)
        } catch (err) { console.error("[veritax] failed to create engagement:", err) }
      }
      refreshFiles()
    })()
    return () => { cancelled = true }
  }, [loadEngagement, refreshFiles])

  useEffect(() => { localStorage.setItem(LS_STEP, String(step)) }, [step])
  useEffect(() => { setMounted(m => (m.has(step) ? m : new Set([...m, step]))) }, [step])  // mount a step on first visit, keep it

  function navigate(s: Step) {
    setStep(s)
    setVisited(prev => new Set(prev).add(s))
  }

  function newFile() {
    // Start a fresh Local File pipeline: jump into Planning immediately, then create the engagement
    // in the background so the pipeline shows instantly even if the create call is slow.
    setEntity(""); setJ([]); setSources(new Set()); setDraftJump(null)
    setVisited(new Set([1])); setStep(1); setMounted(new Set([1]))
    setPage("workflow")
    setEngagementId(null)
    api.createEngagement()
      .then(({ id }) => { setEngagementId(id); localStorage.setItem(LS_ID, id); refreshFiles() })
      .catch(err => console.error("[veritax] failed to create file:", err))
  }

  async function openFile(id: string) {
    if (id !== engagementId) await loadEngagement(id)
    setVisited(new Set([1, 2, 3, 4]))  // an existing file — unlock all steps
    setMounted(new Set([2]))           // fresh mount for the opened file
    setStep(2)                          // land on Requirements so progress is visible
    setDraftJump(null)
    setPage("workflow")
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.replace("/login")
  }

  function continueFromPlanning() {
    if (engagementId) {
      api.patchEngagement(engagementId, { entity_name: entity, jurisdictions })
        .then(refreshFiles)  // the newly-named file now shows in the library
        .catch(err => console.error("[veritax] failed to save engagement scope:", err))
    }
    navigate(2)
  }

  const newFileActive = page === "workflow" && engagementId !== null && files.every(f => f.id !== engagementId)

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
              {files.map(f => {
                const active = f.id === engagementId
                return (
                  <button key={f.id} type="button" onClick={() => openFile(f.id)} style={{
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
              {files.length === 0 && (
                <p style={{ fontSize: "12px", color: "#aaa", padding: "0 0.75rem" }}>No files yet</p>
              )}
            </div>
          </>
        )}

        {/* Compliance — a second top-level page */}
        <button
          type="button"
          onClick={() => setPage("compliance")}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem",
            padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
            background: page === "compliance" ? "#ececec" : "transparent",
            cursor: "pointer", width: "100%",
            fontSize: "14px", fontWeight: 400, color: "#000",
          }}
        >
          <CalendarDays size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left" }}>Compliance</span>
        </button>

        <button
          type="button"
          onClick={() => setPage("monitoring")}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem",
            padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
            background: page === "monitoring" ? "#ececec" : "transparent",
            cursor: "pointer", width: "100%",
            fontSize: "14px", fontWeight: 400, color: "#000",
          }}
        >
          <Activity size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left" }}>Monitoring</span>
        </button>

        <button
          type="button"
          onClick={() => setPage("defense")}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem",
            padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
            background: page === "defense" ? "#ececec" : "transparent",
            cursor: "pointer", width: "100%",
            fontSize: "14px", fontWeight: 400, color: "#000",
          }}
        >
          <ShieldCheck size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
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
            return (
              <button
                key={s}
                type="button"
                onClick={() => navigate(s)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  padding: "0 1rem", border: "none",
                  borderBottom: active ? "2px solid #000" : "2px solid transparent",
                  background: "transparent", cursor: "pointer",
                  color: active ? "#000" : seen ? "#000" : "#bbb",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 400,
                  transition: "color 150ms ease, border-color 150ms ease",
                }}
              >
                <span style={{ fontSize: "10px", letterSpacing: "0.06em", color: active ? "#000" : seen ? "#888" : "#ccc" }}>0{s}</span>
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Section content — each step stays mounted once visited (hidden when inactive), so its
            results + in-flight polling persist and revisiting shows the stored output, never a re-run. */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {mounted.has(1) && (
            <div style={{ flex: 1, minWidth: 0, display: step === 1 ? "flex" : "none" }}>
              <PlanningStep
                engagementId={engagementId}
                jurisdictions={jurisdictions} onJurisdictionsChange={setJ}
                entity={entity}              onEntityChange={setEntity}
                sources={sources}            onSourcesChange={setSources}
                onContinue={continueFromPlanning}
              />
            </div>
          )}
          {mounted.has(2) && (
            <div style={{ flex: 1, minWidth: 0, display: step === 2 ? "flex" : "none" }}>
              <RequirementsStep
                engagementId={engagementId} jurisdictions={jurisdictions}
                onContinue={() => navigate(3)} onBack={() => navigate(1)}
                onOpenDraftSection={(jurisdiction, sectionId) => { setDraftJump({ jurisdiction, sectionId }); navigate(3) }}
              />
            </div>
          )}
          {mounted.has(3) && (
            <div style={{ flex: 1, minWidth: 0, display: step === 3 ? "flex" : "none" }}>
              <DraftStep
                engagementId={engagementId} jurisdictions={jurisdictions} entity={entity}
                onContinue={() => navigate(4)}
                jumpTo={draftJump} onJumped={() => setDraftJump(null)}
              />
            </div>
          )}
          {mounted.has(4) && (
            <div style={{ flex: 1, minWidth: 0, display: step === 4 ? "flex" : "none" }}>
              <RisksStep engagementId={engagementId} jurisdictions={jurisdictions} entity={entity} />
            </div>
          )}
        </div>
          </>
        )}
      </div>

    </div>
  )
}
