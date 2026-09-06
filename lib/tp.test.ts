import { describe, expect, it } from "vitest"
import { computePLI, lines, PLIS, periodTotals, sumOver, yearsAvailable } from "./tp"
import type { Financials } from "./companies"

const fin: Financials = {
  standard: "US-GAAP", currency: "USD",
  rows: [
    { concept: "us-gaap:Revenues", label: "Revenue", statement: "income", unit: "USD", currency: "USD", values: { 2022: 100, 2023: 200, 2024: 300 } },
    { concept: "us-gaap:OperatingIncomeLoss", label: "EBIT", statement: "income", unit: "USD", currency: "USD", values: { 2022: 10, 2023: 40, 2024: 60 } },
    { concept: "us-gaap:GrossProfit", label: "Gross profit", statement: "income", unit: "USD", currency: "USD", values: { 2023: 80, 2024: 120 } },
  ],
}
const L = lines(fin)
const def = (k: string) => PLIS.find(p => p.key === k)!

describe("tp", () => {
  it("derives per-year line items", () => {
    expect(L.totalCost[2024]).toBe(240)  // revenue 300 - ebit 60
    expect(L.opex[2024]).toBe(60)        // gross 120 - ebit 60
  })
  it("sumOver ignores missing years", () => {
    expect(sumOver(L.grossProfit, [2022, 2023, 2024])).toBe(200)  // 2022 gross missing
  })
  it("pooled operating margin = ΣEBIT / ΣRevenue", () => {
    const r = computePLI(L, def("op_margin"), [2023, 2024])
    expect(r.value).toBeCloseTo(100 / 500)   // (40+60)/(200+300)
    expect(r.perYear.find(p => p.year === 2023)!.ratio).toBeCloseTo(0.2)
  })
  it("pooled Berry ratio = ΣGross / ΣOpex", () => {
    expect(computePLI(L, def("berry"), [2023, 2024]).value).toBeCloseTo(200 / 100)  // 2.0
  })
  it("net cost plus = ΣEBIT / ΣTotalCost", () => {
    expect(computePLI(L, def("ncp"), [2023, 2024]).value).toBeCloseTo(100 / 400)  // 0.25
  })
  it("returns null when a denominator input is absent", () => {
    expect(computePLI(L, def("roa"), [2023, 2024]).value).toBeNull()  // no Assets in fixture
  })
  it("period totals + available years", () => {
    expect(yearsAvailable(fin)).toEqual([2022, 2023, 2024])
    expect(periodTotals(L, [2023, 2024]).revenue).toBe(500)
  })
})
