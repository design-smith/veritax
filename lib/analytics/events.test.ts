import { describe, it, expect } from "vitest"
import { documentType, documentCategory, scopeFilterValue } from "./events"

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
