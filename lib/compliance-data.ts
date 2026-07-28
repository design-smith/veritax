// Compliance demo data. Self-contained (no backend): a mock Unilever entity set × their jurisdictions,
// with obligations curated from backend/app/data/jurisdiction_requirements.json. Legal citations are
// real (from each jurisdiction's governing_law); due dates are demo-seeded to relative offsets so the
// Register always shows every status in the top bands. ponytail: real due dates would derive from the
// entity's fiscal year-end + statutory timing — faked to offsets here purely to keep the demo stable.

export type Status = "pending" | "close" | "done" | "missed"

export const CLOSE_DAYS = 30  // due within 30 days = "close" (shared by Register + Calendar)

export const STATUS: Record<Status, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: "Pending", bg: "var(--color-background-info-soft)",    text: "var(--color-text-info-soft)",    border: "var(--color-border-info-surface)" },
  close:   { label: "Close",   bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", border: "var(--color-border-caution-surface)" },
  done:    { label: "Done",    bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", border: "var(--color-border-success-surface)" },
  missed:  { label: "Missed",  bg: "var(--color-background-danger-soft)",  text: "var(--color-text-danger-soft)",  border: "var(--color-border-danger-surface)" },
}

export interface Obligation {
  id: string
  name: string            // "Local File — Germany"
  entity: string
  jurisdiction: string
  authority: string
  legalSource: string     // real citation from governing_law
  timing: string          // statutory timing phrase
  dueDate: string         // ISO yyyy-mm-dd
  fye: string             // fiscal year-end (display)
  owner?: string          // initials; undefined = unassigned
  source: "Auto" | "Manual"
  fulfillment: { met: boolean; progress?: string; filedDate?: string; evidence?: string }
}

export function iso(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function daysUntil(isoDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(isoDate + "T00:00:00").getTime() - today.getTime()) / 86_400_000)
}

export function statusOf(o: Obligation): Status {
  if (o.fulfillment.met) return "done"
  const days = daysUntil(o.dueDate)
  if (days < 0) return "missed"
  if (days <= CLOSE_DAYS) return "close"
  return "pending"
}

// ── Mock Unilever entities (one per jurisdiction) ────────────────────────────
interface Entity { name: string; jurisdiction: string; fye: string }
const ENTITIES: Entity[] = [
  { name: "Unilever Nederland B.V.",     jurisdiction: "Netherlands",    fye: "31 Dec" },
  { name: "Unilever Deutschland GmbH",   jurisdiction: "Germany",        fye: "31 Dec" },
  { name: "Unilever France SAS",         jurisdiction: "France",         fye: "31 Dec" },
  { name: "Unilever Ireland Ltd",        jurisdiction: "Ireland",        fye: "31 Dec" },
  { name: "Unilever U.K. Ltd",           jurisdiction: "United Kingdom", fye: "31 Dec" },
  { name: "Unilever Australia Ltd",      jurisdiction: "Australia",      fye: "30 Jun" },
  { name: "Unilever Canada Inc.",        jurisdiction: "Canada",         fye: "31 Dec" },
  { name: "Unilever United States Inc.", jurisdiction: "United States",  fye: "31 Dec" },
]

// ── Per-jurisdiction obligation templates (curated from jurisdiction_requirements.json) ──
interface Template { name: string; legal: string; timing: string }
const JURIS: Record<string, { authority: string; obligations: Template[] }> = {
  Netherlands: { authority: "Belastingdienst", obligations: [
    { name: "Local File",  legal: "CIT Act art. 8b",       timing: "Available by the tax-return due date" },
    { name: "Master File", legal: "CIT Act art. 29b–29h",  timing: "Available by the tax-return due date" },
  ]},
  Germany: { authority: "German tax authorities", obligations: [
    { name: "Local File",  legal: "AO s.90(3) / GAufzV", timing: "Within 30 days on audit request" },
    { name: "Master File", legal: "AO s.138a",           timing: "Within 6 months of fiscal year-end" },
    { name: "CbC report",  legal: "AO s.138a",           timing: "Within 12 months of fiscal year-end" },
  ]},
  France: { authority: "DGFiP", obligations: [
    { name: "Master & Local File", legal: "LPF art. L13 AA",          timing: "Produced within 30 days on request" },
    { name: "TP statement (2257-SD)", legal: "CGI art. 223 quinquies B", timing: "Within 6 months of the return deadline" },
  ]},
  Ireland: { authority: "Revenue", obligations: [
    { name: "Local File",  legal: "TCA 1997 s.835D", timing: "By the tax-return due date" },
    { name: "Master File", legal: "TCA 1997 s.835F", timing: "Within 30 days of written request" },
  ]},
  "United Kingdom": { authority: "HM Revenue & Customs", obligations: [
    { name: "Local File",          legal: "TIOPA 2010 s.147",            timing: "Retained; produced within 30 days on notice" },
    { name: "Master File",         legal: "TP Records Regulations 2023", timing: "Retained; produced within 30 days on notice" },
    { name: "Summary Audit Trail", legal: "TP Records Regulations 2023", timing: "On request under information notice" },
  ]},
  Australia: { authority: "Australian Taxation Office", obligations: [
    { name: "Local File",  legal: "ITAA 1997 Subdiv 815-E", timing: "Lodged within 12 months of period end" },
    { name: "Master File", legal: "ITAA 1997 Subdiv 815-E", timing: "Lodged within 12 months of period end" },
    { name: "CbC report",  legal: "TAA 1953 Sch 1 Div 286", timing: "Lodged within 12 months of period end" },
  ]},
  Canada: { authority: "Canada Revenue Agency", obligations: [
    { name: "Contemporaneous documentation", legal: "Income Tax Act s.247(4)", timing: "Within 6 months of taxation year-end" },
  ]},
  "United States": { authority: "Internal Revenue Service", obligations: [
    { name: "Section 6662(e) documentation", legal: "Treas. Reg. 1.6662-6",       timing: "In place when the return is filed" },
    { name: "Principal documents",           legal: "IRC 482 / Treas. Reg. 1.482", timing: "Produced within 30 days of IRS request" },
  ]},
}

const OWNERS = ["AC", "MW", "IC", "SK"]

// Seeded schedule by running index → due-date offset (+ done/evidence) to guarantee the demo mix:
// 1 missed, 2 close, 2 done (1 with evidence, 1 without), the rest pending across the year.
const SCHEDULE: Record<number, { offset: number; done?: boolean; evidence?: string; filed?: number }> = {
  0: { offset: -18 },                                                              // missed
  1: { offset: 9 },                                                                // close
  2: { offset: 24 },                                                               // close
  3: { offset: -25, done: true, evidence: "NL-CIT-return-confirmation.pdf", filed: -10 }, // done + evidence
  4: { offset: -30, done: true, filed: -28 },                                      // done, no evidence
}

export function generateObligations(): Obligation[] {
  const out: Obligation[] = []
  let i = 0
  for (const e of ENTITIES) {
    const j = JURIS[e.jurisdiction]
    if (!j) continue
    for (const t of j.obligations) {
      const plan = SCHEDULE[i] ?? { offset: 40 + (i - 5) * 22 }  // pending, spread across the year
      out.push({
        id: `ob-${i}`,
        name: `${t.name} — ${e.jurisdiction}`,
        entity: e.name,
        jurisdiction: e.jurisdiction,
        authority: j.authority,
        legalSource: t.legal,
        timing: t.timing,
        dueDate: iso(plan.offset),
        fye: e.fye,
        owner: i % 3 === 0 ? undefined : OWNERS[i % OWNERS.length],
        source: "Auto",
        fulfillment: plan.done
          ? { met: true, filedDate: iso(plan.filed ?? -14), evidence: plan.evidence }
          : { met: false, progress: t.name.includes("Local File") ? "Local File draft in progress — 3 of 20 elements uncovered" : "Not started" },
      })
      i++
    }
  }
  return out
}

export const ALL_JURISDICTIONS = ENTITIES.map(e => e.jurisdiction)
export const ALL_ENTITIES = ENTITIES.map(e => e.name)
