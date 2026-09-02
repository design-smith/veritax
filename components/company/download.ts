"use client"

// Client-side downloads for a company record. JSON = the raw combined artifacts. ZIP = one file per "step":
// Financials (numeric) as CSV, every other tab rendered to PDF, plus the raw JSON. jsPDF + jszip are
// dynamically imported so they stay out of the main bundle.
import { money, type CompanyProfile, type Financials, type Footprint, type Group, type IP } from "@/lib/companies"

export type Bundle = { profile: CompanyProfile; financials: Financials; footprint: Footprint; ip: IP; group: Group }

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; document.body.appendChild(a); a.click()
  a.remove(); URL.revokeObjectURL(url)
}

export function downloadCompanyJSON(slug: string, b: Bundle) {
  triggerDownload(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }), `${slug}.json`)
}

// ---- financials CSV (the numeric step) ----
function financialsCSV(f: Financials): string {
  const years = [...new Set(f.rows.flatMap(r => Object.keys(r.values)))].map(Number).sort((a, b) => b - a)
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const head = ["Concept", "Label", "Statement", "Unit", "Currency", ...years.map(y => `FY${y}`)]
  const lines = [head.map(esc).join(",")]
  for (const r of f.rows) lines.push([r.concept, r.label, r.statement, r.unit, r.currency, ...years.map(y => r.values[y] ?? "")].map(esc).join(","))
  return lines.join("\n")
}

// ---- PDF helpers (jsPDF) ----
type Block = { heading: string } & ({ text: string } | { head?: string[]; body: (string | number)[][] })

async function makePDF(title: string, subtitle: string, blocks: Block[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const M = 40, W = 515
  let y = 48
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(title, M, y); y += 18
  if (subtitle) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120); doc.text(doc.splitTextToSize(subtitle, W), M, y); y += 16; doc.setTextColor(0) }
  for (const b of blocks) {
    if (y > 760) { doc.addPage(); y = 48 }
    y += 12
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(b.heading, M, y); y += 4
    if ("text" in b) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10)
      const lines = doc.splitTextToSize(b.text || "—", W)
      doc.text(lines, M, y + 12); y += 12 + lines.length * 12
    } else {
      autoTable(doc, {
        startY: y + 6, head: b.head ? [b.head] : undefined, body: b.body.length ? b.body : [["—"]],
        styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [240, 240, 240], textColor: 40 }, margin: { left: M, right: M }, theme: "grid",
      })
      // @ts-expect-error lastAutoTable is added by the plugin
      y = doc.lastAutoTable.finalY
    }
  }
  return doc.output("blob")
}

function stepPDFs(b: Bundle): Promise<[string, Blob]>[] {
  const p = b.profile, id = p.identity, c = p.classification
  const cur = p.financials_currency
  const subtitle = [c.sic_description, id.headquarters?.country, id.listings[0]?.ticker].filter(Boolean).join(" · ")
  const tasks: [string, Promise<Blob>][] = []

  tasks.push(["overview.pdf", makePDF(id.legal_name, subtitle, [
    { heading: "Business", text: p.business.description || "—" },
    { heading: "Activities", head: ["Activity", "Evidence"], body: p.business.activity_tags.map(t => [t.tag, t.evidence]) },
    { heading: "Snapshot", body: [
      ["Revenue", money(p.key_metrics.find(m => m.label === "Revenue")?.value ?? null, cur)],
      ["Net income", money(p.key_metrics.find(m => m.label === "Net income")?.value ?? null, cur)],
      ["Employees", p.business.employees?.toLocaleString() ?? "—"],
      ["Subsidiaries", String(p.group_summary.n_subsidiaries)], ["Countries", String(p.footprint_summary.n_countries)],
      ["Patents", String(p.ip_summary.count)], ["Confidence", p.sources.confidence],
    ] },
  ])])

  tasks.push(["identity.pdf", makePDF("Identity & Classification", id.legal_name, [
    { heading: "Identity", body: [["Legal name", id.legal_name], ["Former names", id.former_names.join(", ")], ["Entity type", id.entity_type], ["Status", id.entity_status], ["Jurisdiction", id.jurisdiction], ["Website", id.website]].map(([k, v]) => [k as string, (v as string) || "—"]) },
    { heading: "Identifiers", body: [["Ticker", id.listings[0]?.ticker], ["Exchange", id.listings[0]?.exchange], ["CIK", id.cik], ["LEI", id.lei], ["SEC file no.", id.sec_file_number]].map(([k, v]) => [k as string, (v as string) || "—"]) },
    { heading: "Classification", body: [["SIC", c.sic ? `${c.sic} ${c.sic_description}` : null], ["NAICS", c.naics ? `${c.naics} ${c.naics_label}` : null], ["NACE", c.nace ? `${c.nace} ${c.nace_label}` : null], ["Sector", c.sector]].map(([k, v]) => [k as string, (v as string) || "—"]) },
  ])])

  tasks.push(["business.pdf", makePDF("Business & Operations", id.legal_name, [
    { heading: "Business description", text: p.business.description || "—" },
    { heading: "Activities", head: ["Activity", "Evidence"], body: p.business.activity_tags.map(t => [t.tag, t.evidence]) },
    { heading: "Segments", text: p.business.segments.join("\n\n") || "—" },
    { heading: "R&D", body: [["Conducts R&D", p.business.rnd.conducts ? "Yes" : "No"], ["R&D spend", money(p.business.rnd.spend, cur)], ["Employees", p.business.employees?.toLocaleString() ?? "—"]] },
  ])])

  tasks.push(["group-structure-and-footprint.pdf", makePDF("Group Structure & Footprint", id.legal_name, [
    { heading: "Position", body: [["Ultimate parent", id.is_subsidiary ? id.parent_legal_name : id.legal_name], ["Is a subsidiary", id.is_subsidiary ? "Yes" : "No"], ["Subsidiaries", String(p.group_summary.n_subsidiaries)], ["Countries", String(p.footprint_summary.n_countries)]].map(([k, v]) => [k as string, (v as string) || "—"]) },
    { heading: `Legal footprint (${p.footprint_summary.n_entities} entities across ${p.footprint_summary.n_countries} countries)`,
      head: ["Country", "Entity", "Registered office", "Status", "LEI"],
      body: b.footprint.countries.flatMap(cc => cc.entities.map(e => [cc.name, e.name, e.office || "—", e.status || "—", e.lei || "—"])) },
    { heading: `All subsidiaries (${b.group.subsidiaries.length})`, head: ["Name", "Jurisdiction", "LEI"], body: b.group.subsidiaries.map(s => [s.name, s.jurisdiction || "—", s.lei || "—"]) },
  ])])

  tasks.push(["intellectual-property.pdf", makePDF("Intellectual Property", id.legal_name, [
    { heading: "Portfolio", body: [["Total patents", String(p.ip_summary.count)], ...Object.entries(p.ip_summary.by_jurisdiction).map(([j, n]) => [`Patents · ${j}`, String(n)] as [string, string])] },
    { heading: "Patents (first 500)", head: ["Number", "Jurisdiction", "Assignee"], body: b.ip.items.slice(0, 500).map(i => [i.number || "—", i.jurisdiction || "—", i.assignee || "—"]) },
  ])])

  tasks.push(["sources-confidence.pdf", makePDF("Sources & Confidence", id.legal_name, [
    { heading: "Coverage", head: ["Area", "Status"], body: p.sources.coverage.map(cv => [cv.area.replace(/_/g, " "), cv.status.replace(/_/g, " ")]) },
    { heading: "Sources used", text: p.sources.families.join(", ") || "—" },
    { heading: `Gaps (${p.sources.gaps.length})`, head: ["Field", "Description"], body: p.sources.gaps.map(g => [g.field, g.description]) },
    { heading: "Confidence", body: [["Completeness", Math.round(p.sources.completeness * 100) + "%"], ["Overall", p.sources.confidence]] },
  ])])

  return tasks.map(([name, promise]) => promise.then(blob => [name, blob] as [string, Blob]))
}

export async function downloadCompanyZip(slug: string, b: Bundle) {
  const JSZip = (await import("jszip")).default
  const zip = new JSZip()
  // numeric step
  zip.file("financials.csv", financialsCSV(b.financials))
  // non-numeric steps as PDF
  for (const [name, blob] of await Promise.all(stepPDFs(b))) zip.file(name, blob)
  // raw data
  const raw = zip.folder("raw")!
  raw.file("profile.json", JSON.stringify(b.profile, null, 2))
  raw.file("financials.json", JSON.stringify(b.financials, null, 2))
  raw.file("footprint.json", JSON.stringify(b.footprint, null, 2))
  raw.file("ip.json", JSON.stringify(b.ip, null, 2))
  raw.file("group.json", JSON.stringify(b.group, null, 2))
  triggerDownload(await zip.generateAsync({ type: "blob" }), `${slug}.zip`)
}
