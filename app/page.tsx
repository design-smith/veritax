"use client"

import { useState } from "react"
import PlanningStep, { type SourceId } from "@/components/steps/planning"
import RequirementsStep from "@/components/steps/requirements"
import DraftStep from "@/components/steps/draft"
import RisksStep from "@/components/steps/risks"

type Step = 1 | 2 | 3 | 4

const NAV: { step: Step; label: string }[] = [
  { step: 1, label: "Planning" },
  { step: 2, label: "Requirements" },
  { step: 3, label: "Draft" },
  { step: 4, label: "Risks" },
]

export default function Page() {
  const [step, setStep]       = useState<Step>(1)
  const [visited, setVisited] = useState<Set<Step>>(new Set([1]))
  const [jurisdictions, setJ] = useState<string[]>([])
  const [entity, setEntity]   = useState("")
  const [sources, setSources] = useState<Set<SourceId>>(new Set())

  function navigate(s: Step) {
    setStep(s)
    setVisited(prev => new Set(prev).add(s))
  }

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
          <span style={{ fontFamily: "var(--font-wordmark)", fontSize: "19px", fontWeight: 300, letterSpacing: "0.12em", color: "#000" }}>VERITAX</span>
        </div>

        <button
          type="button"
          style={{
            display: "flex", alignItems: "center",
            padding: "0.5rem 0.75rem", border: "none",
            borderRadius: "6px", background: "#000",
            color: "#fff", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", textAlign: "left", width: "100%",
          }}
        >
          Planning and research
        </button>
      </aside>

      {/* Page body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

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

        {/* Section content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {step === 1 && (
            <PlanningStep
              jurisdictions={jurisdictions} onJurisdictionsChange={setJ}
              entity={entity}              onEntityChange={setEntity}
              sources={sources}            onSourcesChange={setSources}
              onContinue={() => navigate(2)}
            />
          )}
          {step === 2 && (
            <RequirementsStep
              jurisdictions={jurisdictions} sources={sources}
              onContinue={() => navigate(3)} onBack={() => navigate(1)}
            />
          )}
          {step === 3 && (
            <DraftStep
              jurisdictions={jurisdictions} entity={entity} sources={sources}
              onContinue={() => navigate(4)}
            />
          )}
          {step === 4 && (
            <RisksStep jurisdictions={jurisdictions} entity={entity} />
          )}
        </div>

      </div>

    </div>
  )
}
