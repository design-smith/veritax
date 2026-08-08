"use client"

// Public, no-login demo shell — a static visual duplicate of the app workflow chrome (app/page.tsx).
// Intentionally has NO functionality and imports NO api/auth/step components: it renders for logged-out
// visitors with zero network calls. The step panes are placeholders to be prefilled with canned content later.

import { useState } from "react"
import { Activity, CalendarDays, ChevronDown, FileText, ShieldCheck } from "lucide-react"
import DemoDraft from "@/components/demo/DemoDraft"

type Step = 1 | 2 | 3 | 4

const NAV: { step: Step; label: string }[] = [
  { step: 1, label: "Planning" },
  { step: 2, label: "Requirements" },
  { step: 3, label: "Draft" },
  { step: 4, label: "Risks" },
]

// Steps 1/2/4 are empty in the demo — a visitor passes through them before reaching the prefilled Draft.
const EMPTY_STATE: Record<Exclude<Step, 3>, { title: string; detail: string }> = {
  1: { title: "Add your sources", detail: "Upload financials, agreements, and interview notes to begin." },
  2: { title: "No requirements assessed yet", detail: "Requirement coverage appears once your sources are analysed." },
  4: { title: "No risk analysis yet", detail: "Risk analysis runs after the Local File draft is complete." },
}

const DISABLED_PAGE = {
  display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem",
  padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
  background: "transparent", cursor: "not-allowed", width: "100%",
  fontSize: "14px", fontWeight: 400, color: "#aaa", opacity: 0.55,
} as const

export default function DemoPage() {
  const [step, setStep] = useState<Step>(1)

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#fff", color: "#000" }}>

      {/* App-level left panel */}
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

        {/* Local file group */}
        <button type="button" style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.6rem 0.75rem", border: "none", borderRadius: "6px",
          background: "transparent", cursor: "default", width: "100%",
          fontSize: "14px", fontWeight: 400, color: "#000",
        }}>
          <FileText size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left" }}>Local file</span>
          <ChevronDown size={16} strokeWidth={1.5} style={{ color: "#888", flexShrink: 0 }} />
        </button>

        <div style={{ padding: "0.5rem 0.75rem" }}>
          <span style={{ fontSize: "13px", fontWeight: 400, color: "#000" }}>+ New file</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ padding: "0.4rem 0.75rem" }}>
            <div style={{ fontSize: "13px", color: "#000" }}>Netherlands BV — FY2025</div>
            <div style={{ fontSize: "11px", color: "#888" }}>Netherlands</div>
          </div>
        </div>

        {/* Demo-only pages (disabled, mirrors the app) */}
        <button type="button" disabled title="Coming soon" style={DISABLED_PAGE}>
          <CalendarDays size={16} strokeWidth={1.5} style={{ flexShrink: 0, color: "#aaa" }} />
          <span style={{ flex: 1, textAlign: "left" }}>Compliance</span>
        </button>
        <button type="button" disabled title="Coming soon" style={DISABLED_PAGE}>
          <Activity size={16} strokeWidth={1.5} style={{ flexShrink: 0, color: "#aaa" }} />
          <span style={{ flex: 1, textAlign: "left" }}>Monitoring</span>
        </button>
        <button type="button" disabled title="Coming soon" style={DISABLED_PAGE}>
          <ShieldCheck size={16} strokeWidth={1.5} style={{ flexShrink: 0, color: "#aaa" }} />
          <span style={{ flex: 1, textAlign: "left" }}>Defense</span>
        </button>

        <a href="/login" style={{
          marginTop: "auto", display: "flex", alignItems: "center",
          padding: "0.5rem 0.75rem", border: "1px solid #e5e5e5",
          borderRadius: "6px", background: "#fff",
          color: "#555", fontSize: "13px", fontWeight: 400,
          textDecoration: "none", width: "100%", boxSizing: "border-box",
        }}>
          Log in
        </a>
      </aside>

      {/* Page body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Horizontal section tabs */}
        <nav style={{
          borderBottom: "1px solid #e5e5e5", background: "#fff", padding: "0 2rem",
          display: "flex", alignItems: "stretch", height: 48, flexShrink: 0,
        }}>
          {NAV.map(({ step: s, label }) => {
            const active = step === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  padding: "0 1rem", border: "none",
                  borderBottom: active ? "2px solid #000" : "2px solid transparent",
                  background: "transparent", cursor: "pointer",
                  color: active ? "#000" : "#888",
                  fontSize: "13px", fontWeight: active ? 600 : 400,
                  transition: "color 150ms ease, border-color 150ms ease",
                }}
              >
                <span style={{ fontSize: "10px", letterSpacing: "0.06em", color: active ? "#000" : "#aaa" }}>0{s}</span>
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Section content — Draft is prefilled; the other steps show empty states. */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {step === 3 ? (
            <DemoDraft />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem" }}>
              <div style={{ textAlign: "center", maxWidth: 360 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 500, color: "#555" }}>
                  {EMPTY_STATE[step as Exclude<Step, 3>].title}
                </p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "13px", color: "#999", lineHeight: 1.5 }}>
                  {EMPTY_STATE[step as Exclude<Step, 3>].detail}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
