"use client"

// Static demo of the Planning step — the intake view, prefilled for the Fusion (Qatar) engagement.
// Display-only: inputs are read-only, sources are pre-selected, files show as processed. No api/auth.

import { Check, ChevronDown, Globe, Upload, X } from "lucide-react"
import type { CSSProperties } from "react"

const FIELD_LABEL: CSSProperties = {
  display: "block", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
  color: "var(--color-text-tertiary)", marginBottom: "0.375rem", letterSpacing: "0.04em", textTransform: "uppercase",
}
const OUTLINE_INPUT: CSSProperties = {
  height: "var(--control-size-sm)", padding: "0 var(--control-gutter-sm)", borderRadius: "var(--control-radius-md)",
  border: "1px solid var(--input-outline-border-color)", background: "transparent", fontSize: "var(--control-font-size-md)",
  color: "var(--color-text)", width: "100%", outline: "none", boxSizing: "border-box",
}

const CONNECTORS: Record<string, { name: string; color: string }[]> = {
  erp: [
    { name: "SAP", color: "#0AA1DD" }, { name: "Oracle", color: "#C74634" }, { name: "NetSuite", color: "#1F5FA9" },
    { name: "QuickBooks", color: "#2CA01C" }, { name: "Xero", color: "#13B5EA" },
  ],
  notetaker: [{ name: "Fireflies", color: "#7C4DFF" }, { name: "Otter", color: "#00A0DC" }, { name: "Granola", color: "#E8613C" }],
}

function FileChip({ name }: { name: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.125rem 0.375rem 0.125rem 0.5rem",
      borderRadius: "var(--radius-xs)", background: "var(--color-background-primary-soft)",
      fontSize: "var(--font-text-xs-size)", color: "var(--color-text)", maxWidth: 260,
    }}>
      <Check size={11} style={{ color: "var(--color-text-success-soft)", flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ color: "var(--color-text-tertiary)", flexShrink: 0, fontSize: 10 }}>Extracted</span>
      <X size={10} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
    </span>
  )
}

function DropZone({ hint, files }: { hint: string; files: string[] }) {
  return (
    <div>
      <div style={{
        border: "1.5px dashed var(--color-border)", borderRadius: "var(--radius-md)", padding: "1rem 1.25rem",
        textAlign: "center", cursor: "default",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
          <Upload size={16} style={{ color: "var(--color-text-tertiary)" }} />
          <span style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)" }}>
            Drop files here · or <span style={{ color: "var(--color-text)", textDecoration: "underline", textUnderlineOffset: "2px" }}>browse</span>
          </span>
          <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>{hint}</span>
        </div>
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.5rem" }}>
          {files.map(f => <FileChip key={f} name={f} />)}
        </div>
      )}
    </div>
  )
}

function ConnectorGrid({ which }: { which: keyof typeof CONNECTORS }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
        <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>or connect</span>
        <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: "0.5rem" }}>
        {CONNECTORS[which].map(c => (
          <div key={c.name} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "0.75rem 0.5rem",
            borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
          }}>
            <span aria-hidden style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30,
              borderRadius: 7, background: c.color, color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0,
            }}>{c.name.charAt(0)}</span>
            <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" }}>{c.name}</span>
          </div>
        ))}
      </div>
    </>
  )
}

const SOURCES: { label: string; primary?: boolean; content: () => React.ReactNode }[] = [
  {
    label: "Financial statements",
    content: () => (
      <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <DropZone hint="PDF, Excel, CSV · up to 50 MB each" files={["FOS Audited Financial Statements FY2024.pdf", "Trial Balance FY2024.xlsx"]} />
        <ConnectorGrid which="erp" />
      </div>
    ),
  },
  {
    label: "Agreements, prior files, questionnaires",
    content: () => (
      <div style={{ paddingLeft: "2rem" }}>
        <DropZone hint="PDF, Word, Excel · up to 50 MB each" files={["Prior Local File FY2023.pdf", "TP Questionnaire — FOS.docx"]} />
      </div>
    ),
  },
  {
    label: "Website / public info",
    content: () => (
      <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <input readOnly value="https://fusionoutsourcing.qa" style={OUTLINE_INPUT} />
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>
          <Globe size={11} /> The tool will pull publicly available information from this URL.
        </span>
      </div>
    ),
  },
  {
    label: "Interview",
    primary: true,
    content: () => (
      <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <DropZone hint="TXT, PDF, Word, VTT, SRT · up to 50 MB each" files={["Management interview — Liam Trump.vtt"]} />
        <ConnectorGrid which="notetaker" />
      </div>
    ),
  },
]

export default function DemoPlanning() {
  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "3rem 3.5rem", maxWidth: 760, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", marginBottom: "2.5rem" }}>
        <div style={{ flex: "0 0 240px" }}>
          <label style={FIELD_LABEL}>Jurisdiction</label>
          <div style={{ ...OUTLINE_INPUT, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Qatar</span>
            <ChevronDown size={14} style={{ color: "var(--color-text-tertiary)" }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Entity</label>
          <input readOnly value="Fusion Outsourcing & Services W.L.L." style={OUTLINE_INPUT} />
        </div>
        <div style={{ flex: "0 0 120px" }}>
          <label style={FIELD_LABEL}>Fiscal year</label>
          <input readOnly value="FY2024" style={OUTLINE_INPUT} />
        </div>
        <button type="button" style={{
          height: "var(--control-size-md)", padding: "0 var(--control-gutter-lg)", borderRadius: "var(--control-radius-md)",
          border: "none", flexShrink: 0, background: "var(--color-background-primary-solid)", color: "var(--color-text-inverse)",
          fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer",
        }}>Continue</button>
      </div>

      <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)", marginBottom: "0.75rem", letterSpacing: "0.02em", textTransform: "uppercase", fontWeight: "var(--font-weight-medium)" }}>
        What do you have to work with?
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {SOURCES.map(({ label, primary, content }) => (
          <li key={label}>
            <div style={{ borderRadius: "var(--radius-md)", padding: "0.75rem 1rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, flexShrink: 0,
                  borderRadius: "var(--radius-xs)", border: "1.5px solid var(--color-background-primary-solid)", background: "var(--color-background-primary-solid)",
                }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{ display: "block", color: "var(--color-text-inverse)" }}>
                    <path d="M1 4L3.8 7L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text)", fontWeight: "var(--font-weight-medium)" }}>{label}</span>
                {primary && (
                  <span style={{
                    marginLeft: "auto", fontSize: "10px", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em",
                    textTransform: "uppercase", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-xs)", padding: "1px 5px", lineHeight: 1.5,
                  }}>Key source</span>
                )}
              </div>
              <div style={{ marginTop: "0.75rem" }}>{content()}</div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
