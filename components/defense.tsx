"use client"

import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileArchive, FileCheck2, Flag, Plus, ShieldCheck, Upload, XCircle } from "lucide-react"
import {
  CASE_STAGES,
  OUTCOME_LABELS,
  QUESTION_STATUS_LABELS,
  SEEDED_CASES,
  SEALED_EXHIBITS,
  STAGE_LABELS,
  activeCases,
  closedCases,
  daysUntil,
  deadlineText,
  exposureDelta,
  formatDate,
  formatMoney,
  type CaseStage,
  type ConsistencyStatus,
  type DefenseCase,
  type DefenseItem,
  type QuestionStatus,
  type TimelineEvent,
} from "@/lib/defense-data"

type Tab = "questions" | "timeline" | "pack"

const STAGE_TONE: Record<CaseStage, { bg: string; text: string; border: string }> = {
  notice: { bg: "var(--color-background-primary-soft)", text: "var(--color-text-secondary)", border: "var(--color-border)" },
  responding: { bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", border: "var(--color-border-caution-surface)" },
  awaiting: { bg: "var(--color-background-info-soft)", text: "var(--color-text-info-soft)", border: "var(--color-border-info-surface)" },
  resolved: { bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", border: "var(--color-border-success-surface)" },
}

const QUESTION_TONE: Record<QuestionStatus, { bg: string; text: string; border: string }> = {
  open: { bg: "var(--color-background-primary-soft)", text: "var(--color-text-secondary)", border: "var(--color-border)" },
  drafted: { bg: "var(--color-background-info-soft)", text: "var(--color-text-info-soft)", border: "var(--color-border-info-surface)" },
  sent: { bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", border: "var(--color-border-success-surface)" },
}

function StagePill({ stage }: { stage: CaseStage }) {
  const s = STAGE_TONE[stage]
  return <Pill bg={s.bg} text={s.text} border={s.border}>{STAGE_LABELS[stage]}</Pill>
}

function QuestionPill({ status }: { status: QuestionStatus }) {
  const s = QUESTION_TONE[status]
  return <Pill bg={s.bg} text={s.text} border={s.border}>{QUESTION_STATUS_LABELS[status]}</Pill>
}

function ConsistencyPill({ status }: { status: ConsistencyStatus }) {
  const ok = status === "consistent"
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
      {ok ? <CheckCircle2 size={13} strokeWidth={1.7} /> : <Flag size={13} strokeWidth={1.7} />}
      <Pill
        bg={ok ? "var(--color-background-success-soft)" : "var(--color-background-danger-soft)"}
        text={ok ? "var(--color-text-success-soft)" : "var(--color-text-danger-soft)"}
        border={ok ? "var(--color-border-success-surface)" : "var(--color-border-danger-surface)"}
      >
        {ok ? "Consistent with filing" : "Deviates from filed position"}
      </Pill>
    </span>
  )
}

function Pill({ children, bg, text, border }: { children: ReactNode; bg: string; text: string; border: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "2px 8px", borderRadius: 9999,
      background: bg, color: text, border: `1px solid ${border}`, fontSize: "var(--font-text-xs-size)",
      fontWeight: "var(--font-weight-medium)", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  )
}

export default function DefensePage({ onOpenMonitoring, onOpenRisks }: { onOpenMonitoring?: () => void; onOpenRisks?: () => void }) {
  const [cases, setCases] = useState<DefenseCase[]>(SEEDED_CASES)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("questions")
  const [closedOpen, setClosedOpen] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const selectedCase = cases.find(c => c.id === selectedCaseId) ?? null
  const selectedItem = selectedCase?.items.find(i => i.id === selectedItemId) ?? null
  const active = useMemo(() => activeCases(cases), [cases])
  const closed = useMemo(() => closedCases(cases), [cases])

  function openCase(c: DefenseCase) {
    setSelectedCaseId(c.id)
    setSelectedItemId(c.items.find(i => i.consistency.status === "deviations")?.id ?? c.items[0]?.id ?? null)
    setTab("questions")
    setExportNotice(null)
  }

  function openManualCase() {
    const c: DefenseCase = {
      id: `manual-defense-${Date.now()}`,
      name: "New defense case",
      authority: "Tax authority",
      entity: "Unassigned entity",
      jurisdiction: "Unassigned",
      years: ["FY2026"],
      stage: "notice",
      nextDeadline: "2026-08-24",
      exposure: { proposed: 0, position: 0 },
      created: "2026-07-27",
      items: [],
      timeline: [{ id: `event-${Date.now()}`, date: "2026-07-27", type: "manual", note: "Manual case opened." }],
    }
    setCases(prev => [c, ...prev])
    openCase(c)
  }

  function updateCase(id: string, updater: (c: DefenseCase) => DefenseCase) {
    setCases(prev => prev.map(c => c.id === id ? updater(c) : c))
  }

  function addTimeline(caseId: string, event: Omit<TimelineEvent, "id">) {
    updateCase(caseId, c => ({ ...c, timeline: [{ ...event, id: `event-${Date.now()}` }, ...c.timeline] }))
  }

  function updateStage(stage: CaseStage) {
    if (!selectedCase) return
    updateCase(selectedCase.id, c => ({ ...c, stage }))
    addTimeline(selectedCase.id, { date: "2026-07-27", type: "stage", note: `Stage advanced to ${STAGE_LABELS[stage]}.` })
  }

  function updateDeadline(value: string) {
    if (!selectedCase) return
    updateCase(selectedCase.id, c => ({ ...c, nextDeadline: value }))
  }

  function updateItem(itemId: string, updater: (item: DefenseItem) => DefenseItem) {
    if (!selectedCase) return
    updateCase(selectedCase.id, c => ({ ...c, items: c.items.map(item => item.id === itemId ? updater(item) : item) }))
  }

  function markItem(status: QuestionStatus) {
    if (!selectedCase || !selectedItem) return
    updateItem(selectedItem.id, item => ({ ...item, status }))
    addTimeline(selectedCase.id, { date: "2026-07-27", type: "response", note: `Question ${selectedItem.number} marked ${QUESTION_STATUS_LABELS[status].toLowerCase()}.` })
  }

  function addManualEvent() {
    if (!selectedCase) return
    addTimeline(selectedCase.id, { date: "2026-07-27", type: "manual", note: "Manual event added for demo review." })
  }

  function exportPack(kind: "PDF" | "ZIP") {
    if (!selectedCase) return
    setExportNotice(`${kind} response pack prepared from sealed exhibits.`)
    addTimeline(selectedCase.id, { date: "2026-07-27", type: "export", note: `${kind} response pack exported.`, attachment: `${selectedCase.name} Response Pack.${kind.toLowerCase()}` })
  }

  if (!selectedCase) {
    return (
      <main style={pageMain}>
        <Header title="Defense" action={<button type="button" onClick={openManualCase} style={primaryButton}><Plus size={14} strokeWidth={1.5} /> Open case</button>} />

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", overflowY: "auto", paddingBottom: "2rem" }}>
          <section>
            <SectionHeading title="Active cases" count={active.length} />
            {active.length === 0 ? (
              <div style={emptyState}>
                <p style={{ margin: 0, color: "var(--color-text)", fontSize: "var(--font-text-sm-size)" }}>No active examinations.</p>
                <button type="button" onClick={onOpenMonitoring} style={linkButton}>Positions being watched preventively live in Monitoring.</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "0.875rem" }}>
                {active.map(c => <CaseCard key={c.id} c={c} onClick={() => openCase(c)} />)}
              </div>
            )}
          </section>

          <section style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <button type="button" onClick={() => setClosedOpen(v => !v)} style={sectionToggle}>
              <span style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>Closed cases</span>
              <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)" }}>{closed.length}</span>
              <span style={{ marginLeft: "auto", color: "var(--color-text-tertiary)", transform: closedOpen ? "none" : "rotate(-90deg)", transition: "transform 120ms" }}>v</span>
            </button>
            {closedOpen && closed.map(c => (
              <button key={c.id} type="button" onClick={() => openCase(c)} style={closedRow}>
                <span style={{ flex: 1, color: "var(--color-text)", fontSize: "var(--font-text-sm-size)" }}>{c.name}</span>
                <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)" }}>{c.closed ? formatDate(c.closed.resolvedDate) : ""}</span>
                {c.closed && <Pill bg="var(--color-background-success-soft)" text="var(--color-text-success-soft)" border="var(--color-border-success-surface)">{OUTCOME_LABELS[c.closed.outcome]}</Pill>}
                <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-text-xs-size)" }}>{c.closed ? formatMoney(c.closed.finalAmount) : ""}</span>
              </button>
            ))}
          </section>
        </div>
      </main>
    )
  }

  return (
    <div style={{ flex: 1, display: "flex", minWidth: 0, overflow: "hidden" }}>
      <main style={pageMain}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <button type="button" onClick={() => setSelectedCaseId(null)} style={iconButton} aria-label="Back to cases">
            <ArrowLeft size={16} strokeWidth={1.5} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.25rem" }}>
              {selectedCase.name}
            </h1>
            <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)" }}>
              {selectedCase.authority} {"\u00b7"} {selectedCase.entity} {"\u00b7"} {selectedCase.jurisdiction} {"\u00b7"} {selectedCase.years.join(", ")}
            </p>
          </div>
          <select value={selectedCase.stage} onChange={e => updateStage(e.target.value as CaseStage)} style={selectStyle}>
            {CASE_STAGES.map(stage => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
          <MetricCard label="Authority proposed" value={formatMoney(selectedCase.exposure.proposed)} />
          <MetricCard label="Our position" value={formatMoney(selectedCase.exposure.position)} />
          <MetricCard label="Delta" value={formatMoney(exposureDelta(selectedCase))} />
          <div style={metricCard}>
            <span style={metricLabel}>Next deadline</span>
            <input type="date" value={selectedCase.nextDeadline} onChange={e => updateDeadline(e.target.value)} style={dateInput} />
            <span style={{ fontSize: "var(--font-text-xs-size)", color: daysUntil(selectedCase.nextDeadline) < 14 ? "var(--color-text-danger-soft)" : "var(--color-text-tertiary)" }}>
              {deadlineText(selectedCase.nextDeadline)} {"\u00b7"} linked Compliance obligation
            </span>
          </div>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "0.25rem", borderBottom: "1px solid var(--color-border)", marginBottom: "1rem" }}>
          <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>Questions</TabButton>
          <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>Timeline</TabButton>
          <TabButton active={tab === "pack"} onClick={() => setTab("pack")}>Response pack</TabButton>
        </nav>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: "2rem" }}>
          {tab === "questions" && (
            <QuestionsTab c={selectedCase} selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} />
          )}
          {tab === "timeline" && (
            <TimelineTab c={selectedCase} onAddEvent={addManualEvent} />
          )}
          {tab === "pack" && (
            <ResponsePackTab c={selectedCase} exportNotice={exportNotice} onExport={exportPack} />
          )}
        </div>
      </main>

      {tab === "questions" && selectedItem && (
        <QuestionDetail
          item={selectedItem}
          onOpenRisks={onOpenRisks}
          onChangeResponse={value => updateItem(selectedItem.id, item => ({ ...item, response: value }))}
          onMarkDrafted={() => markItem("drafted")}
          onMarkSent={() => markItem("sent")}
        />
      )}
    </div>
  )
}

function Header({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
      <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: 0 }}>{title}</h1>
      {action}
    </div>
  )
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
      <h2 style={{ margin: 0, color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)" }}>{title}</h2>
      <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)" }}>{count}</span>
    </div>
  )
}

function CaseCard({ c, onClick }: { c: DefenseCase; onClick: () => void }) {
  const days = daysUntil(c.nextDeadline)
  return (
    <button type="button" onClick={onClick} style={{
      ...caseCard,
      textAlign: "left",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--color-text)", fontSize: "var(--font-text-md-size)", lineHeight: 1.35, fontWeight: "var(--font-weight-semibold)" }}>{c.name}</h3>
          <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)" }}>{c.authority}</p>
        </div>
        <StagePill stage={c.stage} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.625rem", marginTop: "1rem" }}>
        <SmallFact label="Years" value={c.years.join(", ")} />
        <SmallFact label="Deadline" value={`${formatDate(c.nextDeadline)} (${deadlineText(c.nextDeadline)})`} danger={days < 14} />
        <SmallFact label="Exposure" value={`${formatMoney(c.exposure.proposed)} proposed adjustment`} />
        <SmallFact label="Our position" value={formatMoney(c.exposure.position)} />
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--color-text-info-soft)", fontSize: "var(--font-text-xs-size)", marginTop: "1rem" }}>
        Open case <ArrowRight size={13} strokeWidth={1.5} />
      </span>
    </button>
  )
}

function SmallFact({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <span style={{ minWidth: 0 }}>
      <span style={{ display: "block", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)", marginBottom: 2 }}>{label}</span>
      <span style={{ display: "block", color: danger ? "var(--color-text-danger-soft)" : "var(--color-text)", fontSize: "var(--font-text-xs-size)", lineHeight: 1.35 }}>{value}</span>
    </span>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCard}>
      <span style={metricLabel}>{label}</span>
      <span style={{ color: "var(--color-text)", fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)" }}>{value}</span>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      border: "none", borderBottom: active ? "2px solid var(--color-text)" : "2px solid transparent", background: "transparent",
      cursor: "pointer", padding: "0.625rem 0.875rem", color: active ? "var(--color-text)" : "var(--color-text-secondary)",
      fontSize: "var(--font-text-sm-size)", fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
    }}>
      {children}
    </button>
  )
}

function QuestionsTab({ c, selectedItemId, onSelectItem }: { c: DefenseCase; selectedItemId: string | null; onSelectItem: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div style={ingestZone}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <Upload size={16} strokeWidth={1.5} style={{ color: "var(--color-text-secondary)" }} />
          <div>
            <p style={{ margin: 0, color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)" }}>
              {c.items.length ? `Notice parsed into ${c.items.length} questions` : "Upload an authority notice to parse questions"}
            </p>
            <p style={{ margin: "0.125rem 0 0", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)" }}>
              Users can split, merge, add, or edit parsed items before confirming.
            </p>
          </div>
        </div>
        <button type="button" style={ghostButton}>Upload notice</button>
      </div>

      {c.items.length === 0 ? (
        <div style={emptyState}>No parsed questions yet.</div>
      ) : c.items.map(item => (
        <QuestionRow key={item.id} item={item} active={item.id === selectedItemId} onClick={() => onSelectItem(item.id)} />
      ))}
    </div>
  )
}

function QuestionRow({ item, active, onClick }: { item: DefenseItem; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", flexDirection: "column", gap: "0.625rem", width: "100%", textAlign: "left", cursor: "pointer",
      border: `1px solid ${active ? "var(--color-border-strong)" : "var(--color-border)"}`, borderRadius: "var(--radius-lg)",
      background: active ? "var(--color-surface-secondary)" : "var(--color-surface)", boxShadow: active ? "var(--shadow-100)" : "none",
      padding: "0.875rem 1rem", transition: "background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)", minWidth: 34 }}>Item {item.number}</span>
        <p style={{ flex: 1, margin: 0, color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", lineHeight: 1.45 }}>{item.question}</p>
        <QuestionPill status={item.status} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", paddingLeft: 46 }}>
        {item.topics.map(topic => <Chip key={topic}>{topic}</Chip>)}
        <ConsistencyPill status={item.consistency.status} />
      </div>
    </button>
  )
}

function QuestionDetail({ item, onOpenRisks, onChangeResponse, onMarkDrafted, onMarkSent }: {
  item: DefenseItem
  onOpenRisks?: () => void
  onChangeResponse: (value: string) => void
  onMarkDrafted: () => void
  onMarkSent: () => void
}) {
  const hasDeviations = item.consistency.status === "deviations"
  return (
    <aside style={{ width: 410, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <QuestionPill status={item.status} />
        <ConsistencyPill status={item.consistency.status} />
      </div>

      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <p style={sectionLabel}>Authority question</p>
          <h2 style={{ margin: "0 0 0.5rem", color: "var(--color-text)", fontSize: "var(--font-text-md-size)", lineHeight: 1.4, fontWeight: "var(--font-weight-semibold)" }}>
            Item {item.number}
          </h2>
          <p style={{ margin: 0, color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", lineHeight: 1.5 }}>{item.question}</p>
          <button type="button" style={{ ...linkButton, marginTop: "0.5rem" }}>{item.noticeRef}</button>
        </div>

        {hasDeviations && (
          <div style={{ border: "1px solid var(--color-border-danger-surface)", borderRadius: "var(--radius-lg)", background: "var(--color-background-danger-soft)", padding: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-text-danger-soft)", fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", marginBottom: "0.5rem" }}>
              <XCircle size={15} strokeWidth={1.6} /> This answer deviates from your filed position.
            </div>
            {item.consistency.deviations.map(d => (
              <div key={d.source} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.375rem 0.625rem", fontSize: "var(--font-text-xs-size)", lineHeight: 1.45 }}>
                <span style={{ color: "var(--color-text-tertiary)" }}>Draft</span><span style={{ color: "var(--color-text)" }}>{d.claim}</span>
                <span style={{ color: "var(--color-text-tertiary)" }}>Filed</span><span style={{ color: "var(--color-text)" }}>{d.filingSays}</span>
                <span style={{ color: "var(--color-text-tertiary)" }}>Source</span><span style={{ color: "var(--color-text)" }}>{d.source}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <p style={sectionLabel}>Draft response</p>
          <textarea value={item.response} onChange={e => onChangeResponse(e.target.value)} placeholder="Draft response from the record..." style={textAreaStyle} />
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {item.citations.map(c => <CitationChip key={c.source} label={c.label} source={c.source} />)}
          </div>
        </div>

        <div>
          <p style={sectionLabel}>Exhibits</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {item.exhibits.length === 0 ? (
              <p style={{ margin: 0, color: "var(--color-text-tertiary)", fontSize: "var(--font-text-sm-size)" }}>No sealed exhibits attached yet.</p>
            ) : item.exhibits.map(exhibit => <ExhibitRow key={exhibit.id} exhibit={exhibit} />)}
          </div>
          <button type="button" style={{ ...ghostButton, marginTop: "0.625rem" }}>Add exhibit from Library</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button type="button" onClick={onMarkDrafted} style={ghostButton}>Mark Drafted</button>
          <button type="button" onClick={onMarkSent} style={primaryButton}>Mark Sent</button>
          {hasDeviations && (
            <button type="button" onClick={onOpenRisks} style={{ ...linkButton, alignSelf: "center", marginTop: "0.25rem" }}>
              View corresponding finding
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

function TimelineTab({ c, onAddEvent }: { c: DefenseCase; onAddEvent: () => void }) {
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
        <SectionHeading title="Event log" count={c.timeline.length} />
        <button type="button" onClick={onAddEvent} style={ghostButton}><Plus size={14} strokeWidth={1.5} /> Add event</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {c.timeline.map(event => (
          <div key={event.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: "0.75rem" }}>
            <span style={timelineIcon}><TimelineIcon type={event.type} /></span>
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.875rem 1rem", background: "var(--color-surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <span style={{ color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)" }}>{formatDate(event.date)}</span>
                <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)", textTransform: "capitalize" }}>{event.type}</span>
              </div>
              <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)", lineHeight: 1.45 }}>{event.note}</p>
              {event.attachment && <p style={{ margin: "0.375rem 0 0", color: "var(--color-text-info-soft)", fontSize: "var(--font-text-xs-size)" }}>{event.attachment}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineIcon({ type }: { type: TimelineEvent["type"] }) {
  if (type === "response" || type === "export") return <FileCheck2 size={14} strokeWidth={1.5} />
  if (type === "deadline" || type === "extension") return <Clock3 size={14} strokeWidth={1.5} />
  if (type === "stage") return <ShieldCheck size={14} strokeWidth={1.5} />
  return <FileArchive size={14} strokeWidth={1.5} />
}

function ResponsePackTab({ c, exportNotice, onExport }: { c: DefenseCase; exportNotice: string | null; onExport: (kind: "PDF" | "ZIP") => void }) {
  const drafted = c.items.filter(i => i.status === "drafted" || i.status === "sent")
  const hasDeviations = drafted.some(i => i.consistency.status === "deviations")
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: "1rem" }}>
      <section style={caseCard}>
        <p style={sectionLabel}>Cover response letter</p>
        {hasDeviations && (
          <div style={{ marginBottom: "0.75rem", color: "var(--color-text-danger-soft)", background: "var(--color-background-danger-soft)", border: "1px solid var(--color-border-danger-surface)", borderRadius: "var(--radius-md)", padding: "0.625rem", fontSize: "var(--font-text-sm-size)" }}>
            One drafted answer has unresolved filed-position deviations.
          </div>
        )}
        <div style={{ color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", lineHeight: 1.6 }}>
          <p>To {c.authority},</p>
          <p>We respond below to the information request for {c.entity} covering {c.years.join(" and ")}. The response pack is assembled from drafted answers in authority order and includes only sealed, verified exhibits.</p>
          {drafted.map(item => (
            <p key={item.id}><strong>Item {item.number}.</strong> {item.response || "Response pending."}</p>
          ))}
        </div>
      </section>

      <section style={caseCard}>
        <p style={sectionLabel}>Sealed exhibits</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {SEALED_EXHIBITS.map(exhibit => <ExhibitRow key={exhibit.id} exhibit={exhibit} />)}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button type="button" onClick={() => onExport("PDF")} style={primaryButton}>Export PDF pack</button>
          <button type="button" onClick={() => onExport("ZIP")} style={ghostButton}>Export ZIP</button>
        </div>
        {exportNotice && <p style={{ margin: "0.75rem 0 0", color: "var(--color-text-success-soft)", fontSize: "var(--font-text-xs-size)" }}>{exportNotice}</p>}
      </section>
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 9999,
      background: "var(--color-background-primary-soft)", color: "var(--color-text-secondary)", fontSize: "var(--font-text-xs-size)",
    }}>
      {children}
    </span>
  )
}

function CitationChip({ label, source }: { label: string; source: string }) {
  return (
    <span title={source} style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "2px 7px", borderRadius: 9999,
      background: "var(--color-background-info-soft)", color: "var(--color-text-info-soft)", border: "1px solid var(--color-border-info-surface)",
      fontSize: "var(--font-text-xs-size)",
    }}>
      {label}
    </span>
  )
}

function ExhibitRow({ exhibit }: { exhibit: { filename: string; filingDate: string; hash: string; source: string } }) {
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.625rem", background: "var(--color-surface-secondary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
        <FileCheck2 size={14} strokeWidth={1.5} style={{ color: "var(--color-text-success-soft)" }} />
        <span style={{ color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)" }}>{exhibit.filename}</span>
      </div>
      <p style={{ margin: 0, color: "var(--color-text-tertiary)", fontSize: "var(--font-text-xs-size)" }}>
        SHA-256 verified {"\u00b7"} filed {formatDate(exhibit.filingDate)} {"\u00b7"} {exhibit.hash} {"\u00b7"} unaltered
      </p>
    </div>
  )
}

const pageMain: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  padding: "1.5rem 2rem",
  overflow: "hidden",
}

const primaryButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.375rem",
  minHeight: 32,
  padding: "0 0.875rem",
  border: "none",
  borderRadius: "var(--radius-md)",
  background: "var(--color-background-primary-solid)",
  color: "var(--color-text-inverse)",
  fontSize: "var(--font-text-sm-size)",
  fontWeight: "var(--font-weight-medium)",
  cursor: "pointer",
}

const ghostButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.375rem",
  minHeight: 32,
  padding: "0 0.875rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface)",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-text-sm-size)",
  cursor: "pointer",
}

const linkButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--color-text-info-soft)",
  cursor: "pointer",
  padding: 0,
  fontSize: "var(--font-text-sm-size)",
}

const iconButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface)",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
}

const caseCard: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  background: "var(--color-surface)",
  padding: "1rem",
  color: "var(--color-text)",
}

const metricCard: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  background: "var(--color-surface)",
  padding: "0.875rem 1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
}

const metricLabel: CSSProperties = {
  color: "var(--color-text-tertiary)",
  fontSize: "var(--font-text-xs-size)",
}

const selectStyle: CSSProperties = {
  height: 32,
  padding: "0 0.625rem",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: "var(--font-text-sm-size)",
}

const dateInput: CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  color: "var(--color-text)",
  fontSize: "var(--font-text-sm-size)",
  padding: 0,
  outline: "none",
}

const ingestZone: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  border: "1px dashed var(--color-border-strong)",
  borderRadius: "var(--radius-lg)",
  background: "var(--color-surface-secondary)",
  padding: "0.875rem 1rem",
}

const emptyState: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  background: "var(--color-surface)",
  padding: "2rem",
  textAlign: "center",
  color: "var(--color-text-tertiary)",
  fontSize: "var(--font-text-sm-size)",
}

const sectionToggle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  width: "100%",
  border: "none",
  background: "var(--color-surface-secondary)",
  padding: "0.75rem 1rem",
  cursor: "pointer",
  textAlign: "left",
}

const closedRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  width: "100%",
  border: "none",
  borderTop: "1px solid var(--color-border-subtle)",
  background: "var(--color-surface)",
  padding: "0.75rem 1rem",
  cursor: "pointer",
  textAlign: "left",
}

const sectionLabel: CSSProperties = {
  fontSize: "var(--font-text-xs-size)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--color-text-tertiary)",
  margin: "0 0 0.5rem",
}

const textAreaStyle: CSSProperties = {
  width: "100%",
  minHeight: 160,
  resize: "vertical",
  boxSizing: "border-box",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface-secondary)",
  color: "var(--color-text)",
  fontSize: "var(--font-text-sm-size)",
  lineHeight: 1.5,
  padding: "0.75rem",
  outline: "none",
}

const timelineIcon: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-background-primary-soft)",
  color: "var(--color-text-secondary)",
}
