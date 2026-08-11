import { describe, it, expect } from "vitest"
import { documentType, documentCategory, scopeFilterValue, trackJurisdictionComparison, sectionLifecycle, riskProps, waitlistPersonProps, type ComparisonState } from "./events"

describe("documentType", () => {
  it("maps known source labels to categories", () => {
    expect(documentType("VOS Trial Balance FY2024.xlsx")).toBe("trial_balance")
    expect(documentType("VOS Audited Financial Statements FY2024.pdf")).toBe("financial_statements")
    expect(documentType("Local File draft")).toBe("local_file_draft")
    expect(documentType("TP Questionnaire - VOS.docx")).toBe("questionnaire")
  })
  it("falls back to a generic category and never echoes the raw label (PRD §30)", () => {
    const label = "Acme GmbH confidential 2024.pdf"
    const out = documentType(label)
    expect(out).toBe("document")
    expect(out).not.toContain(" ")
    expect(out).not.toBe(label)
  })
})

describe("documentCategory", () => {
  it("maps evidence kind", () => {
    expect(documentCategory("figure")).toBe("figure")
    expect(documentCategory("section")).toBe("section")
    expect(documentCategory(undefined)).toBe("section")
  })
})

describe("scopeFilterValue", () => {
  it("reports global or count, never jurisdiction names", () => {
    expect(scopeFilterValue([])).toBe("global")
    expect(scopeFilterValue(["Germany", "France"])).toBe("scoped_2")
    expect(scopeFilterValue(["Germany"])).not.toContain("Germany")
  })
})

describe("sectionLifecycle", () => {
  it("returns per-section payloads in element order with an even duration split (PRD §12)", () => {
    const out = sectionLifecycle(
      [{ requirement_key: "req-2", element_order: 2 }, { requirement_key: "req-1", element_order: 1 }],
      1000,
    )
    expect(out.map(s => s.section_index)).toEqual([1, 2])
    expect(out.map(s => s.section_key)).toEqual(["req-1", "req-2"])
    expect(out.every(s => s.generation_duration_ms === 500)).toBe(true)
  })
  it("is empty and safe for zero sections", () => {
    expect(sectionLifecycle([], 1000)).toEqual([])
  })
})

describe("waitlistPersonProps", () => {
  it("builds identify person props with no email/name (PRD §6, §30)", () => {
    const props = waitlistPersonProps({ entry_source: "linkedin", campaign: "founder_outreach", first_demo_date: "2026-08-10" })
    expect(props).toEqual({
      waitlist_status: "requested",
      first_demo_date: "2026-08-10",
      acquisition_source: "linkedin",
      campaign: "founder_outreach",
    })
    const keys = Object.keys(props)
    expect(keys).not.toContain("email")
    expect(keys).not.toContain("name")
  })
})

describe("riskProps", () => {
  it("maps kind/severity/id and never leaks risk narrative (PRD §13, §30)", () => {
    const finding = { id: "f1", kind: "exposure", severity: "high", title: "Acme paid too much", description: "secret" }
    expect(riskProps(finding)).toEqual({ risk_type: "exposure", severity: "high", risk_category: "f1" })
    expect(Object.keys(riskProps(finding)).sort()).toEqual(["risk_category", "risk_type", "severity"])
  })
})

describe("trackJurisdictionComparison", () => {
  it("fires once when a 2nd distinct jurisdiction is inspected, not for one (PRD §11)", () => {
    const state: ComparisonState = { seen: new Set(), fired: false }
    expect(trackJurisdictionComparison(state, "United Arab Emirates")).toBeNull()
    const out = trackJurisdictionComparison(state, "Singapore")
    expect(out).not.toBeNull()
    expect(out).toHaveLength(2)
    expect(trackJurisdictionComparison(state, "South Africa")).toBeNull()  // already fired
  })
})
