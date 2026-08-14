import { describe, it, expect } from "vitest"
import { demoApi } from "./demo-api"

describe("demo Industry Analysis section", () => {
  it("appears right after Business Strategy in UAE / South Africa, carrying a research card with sources", async () => {
    for (const jur of ["United Arab Emirates", "South Africa"]) {
      const draft = await demoApi.getDraft("demo", jur)
      const names = draft.sections.map(s => s.element_name)
      const idx = names.indexOf("Industry Analysis")
      expect(idx).toBeGreaterThan(0)
      expect(names[idx - 1]).toContain("Business Strategy")   // positioned after strategy
      const ind = draft.sections[idx]
      expect(ind.element_order).toBe(idx + 1)                 // orders stay contiguous (1-based)
      expect(ind.research?.sources.length).toBe(7)
      expect(ind.research?.market).toBe("Qatar / GCC")
      expect(ind.content).toContain("wage inflation")        // contemporaneous, not generic filler
    }
  })

  it("falls after the entity profile when the list has no Business Strategy element (Singapore)", async () => {
    const draft = await demoApi.getDraft("demo", "Singapore")
    const names = draft.sections.map(s => s.element_name)
    const idx = names.indexOf("Industry Analysis")
    expect(idx).toBe(1)                                       // right after the profile (index 0)
    expect(draft.sections[idx].research).not.toBeNull()
  })

  it("attaches the research card only to Industry Analysis, not other sections", async () => {
    const draft = await demoApi.getDraft("demo", "United Arab Emirates")
    const withResearch = draft.sections.filter(s => s.research)
    expect(withResearch).toHaveLength(1)
    expect(withResearch[0].element_name).toBe("Industry Analysis")
  })
})
