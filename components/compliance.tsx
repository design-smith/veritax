"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import multiMonthPlugin from "@fullcalendar/multimonth"
import { ChevronDown, Paperclip, Plus, ShieldCheck, X } from "lucide-react"
import {
  ALL_ENTITIES, ALL_JURISDICTIONS, generateObligations, iso, statusOf, daysUntil, STATUS,
  type Obligation, type Status,
} from "@/lib/compliance-data"

const fmtDate = (isoDate: string) =>
  new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
const daysText = (isoDate: string) => {
  const d = daysUntil(isoDate)
  return d < 0 ? `${-d} days overdue` : d === 0 ? "due today" : `due in ${d} days`
}

function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status]
  return (
    <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 9999, fontSize: "var(--font-text-xs-size)",
      fontWeight: "var(--font-weight-medium)", background: s.bg, color: s.text, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>{s.label}</span>
  )
}

function Owner({ initials }: { initials?: string }) {
  if (!initials) return <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>Unassigned</span>
  return (
    <span title={initials} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
      borderRadius: "9999px", background: "var(--color-background-primary-soft)", color: "var(--color-text-secondary)",
      fontSize: "10px", fontWeight: "var(--font-weight-semibold)" }}>{initials}</span>
  )
}

function FilterSelect<T extends string>({ label, options, selected, onChange }: {
  label: string; options: readonly T[]; selected: T[]; onChange: (v: T[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const toggle = (o: T) => onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o])
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: "0.375rem", height: 30, padding: "0 0.625rem",
        borderRadius: "var(--radius-md)", border: `1px solid ${selected.length ? "var(--color-border-strong)" : "var(--color-border)"}`,
        background: "var(--color-surface)", color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)", cursor: "pointer" }}>
        {label}{selected.length ? ` · ${selected.length}` : ""} <ChevronDown size={13} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: 200, zIndex: 50,
          background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-300)", padding: "0.25rem", maxHeight: 260, overflowY: "auto" }}>
          {options.map(o => (
            <label key={o} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.5rem",
              borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "var(--font-text-sm-size)", color: "var(--color-text)" }}>
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)}
                style={{ accentColor: "var(--color-background-primary-solid)" }} />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

type Row = { o: Obligation; status: Status }

function ObligationRow({ row, active, onClick, onOpenRequirements }: {
  row: Row; active: boolean; onClick: () => void; onOpenRequirements?: () => void
}) {
  const { o, status } = row
  const met = o.fulfillment.met
  return (
    <div onClick={onClick} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", padding: "0.75rem 1rem",
      borderBottom: "1px solid var(--color-border-subtle)", cursor: "pointer", background: active ? "var(--color-surface-secondary)" : "transparent" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.125rem" }}>
          <span style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{o.name}</span>
          <StatusPill status={status} />
          {o.source === "Manual" && <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xs)", padding: "0 4px" }}>Manual</span>}
        </div>
        <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", margin: "0 0 0.25rem" }}>
          {o.entity} · {o.jurisdiction} · <span style={{ color: "var(--color-text-tertiary)" }}>{o.legalSource}</span>
        </p>
        {met ? (
          <p style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-success-soft)", margin: 0 }}>
            <ShieldCheck size={12} /> Filed {o.fulfillment.filedDate ? fmtDate(o.fulfillment.filedDate) : ""}{o.fulfillment.evidence ? " · evidence attached" : ""}
          </p>
        ) : (
          <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0 }}>
            {o.fulfillment.progress}{" "}
            <button type="button" onClick={e => { e.stopPropagation(); onOpenRequirements?.() }}
              style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "var(--color-text-info-soft)", fontSize: "var(--font-text-xs-size)", textDecoration: "underline" }}>
              Open Requirements
            </button>
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
        <span style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text)" }}>{met ? "Filed" : fmtDate(o.dueDate)}</span>
        {!met && <span style={{ fontSize: "var(--font-text-xs-size)", color: status === "missed" ? "var(--color-text-danger-soft)" : status === "close" ? "var(--color-text-caution-soft)" : "var(--color-text-tertiary)" }}>{daysText(o.dueDate)}</span>}
        <Owner initials={o.owner} />
      </div>
    </div>
  )
}

function Band({ title, accent, rows, collapsible, open, onToggle, onRowClick, selectedId, onOpenRequirements }: {
  title: string; accent: string; rows: Row[]; collapsible?: boolean; open: boolean; onToggle?: () => void
  onRowClick: (id: string) => void; selectedId: string | null; onOpenRequirements?: () => void
}) {
  if (rows.length === 0) return null
  return (
    <section style={{ marginBottom: "0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <button type="button" onClick={collapsible ? onToggle : undefined} style={{
        display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.625rem 1rem",
        borderLeft: `3px solid ${accent}`, border: "none", borderBottom: open ? "1px solid var(--color-border-subtle)" : "none",
        background: "var(--color-surface-secondary)", cursor: collapsible ? "pointer" : "default", textAlign: "left" }}>
        <span style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>{title}</span>
        <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>{rows.length}</span>
        {collapsible && <ChevronDown size={14} style={{ marginLeft: "auto", color: "var(--color-text-tertiary)", transform: open ? "none" : "rotate(-90deg)", transition: "transform 120ms" }} />}
      </button>
      {open && rows.map(r => (
        <ObligationRow key={r.o.id} row={r} active={r.o.id === selectedId} onClick={() => onRowClick(r.o.id)} onOpenRequirements={onOpenRequirements} />
      ))}
    </section>
  )
}

export default function CompliancePage({ onOpenRequirements }: { onOpenRequirements?: () => void }) {
  const [view, setView] = useState<"register" | "calendar">("register")
  const [obligations, setObligations] = useState<Obligation[]>(() => generateObligations())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [fJur, setFJur] = useState<string[]>([])
  const [fEnt, setFEnt] = useState<string[]>([])
  const [fStatus, setFStatus] = useState<Status[]>([])
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [attachFor, setAttachFor] = useState<string | null>(null)

  const rows = useMemo<Row[]>(() => obligations.map(o => ({ o, status: statusOf(o) })), [obligations])
  const q = query.trim().toLowerCase()
  const scoped = rows.filter(({ o }) =>
    (fJur.length === 0 || fJur.includes(o.jurisdiction)) &&
    (fEnt.length === 0 || fEnt.includes(o.entity)) &&
    (q === "" || `${o.name} ${o.entity} ${o.jurisdiction} ${o.legalSource}`.toLowerCase().includes(q)))
  const counts = { missed: 0, close: 0, pending: 0, done: 0 }
  scoped.forEach(({ status }) => { counts[status]++ })
  const visible = scoped.filter(({ status }) => fStatus.length === 0 || fStatus.includes(status))

  const byDueAsc = (a: Row, b: Row) => a.o.dueDate.localeCompare(b.o.dueDate)
  const overdue = visible.filter(x => x.status === "missed").sort(byDueAsc)
  const dueSoon = visible.filter(x => x.status === "close").sort(byDueAsc)
  const upcoming = visible.filter(x => x.status === "pending").sort(byDueAsc)
  const completed = visible.filter(x => x.status === "done").sort((a, b) => (b.o.fulfillment.filedDate ?? "").localeCompare(a.o.fulfillment.filedDate ?? ""))

  const anyFilter = fJur.length + fEnt.length + fStatus.length > 0 || q !== ""
  const clearAll = () => { setFJur([]); setFEnt([]); setFStatus([]); setQuery("") }

  const selected = obligations.find(o => o.id === selectedId) ?? null
  const selStatus = selected ? statusOf(selected) : null

  function toggleComplete(id: string) {
    const o = obligations.find(x => x.id === id)
    if (!o) return
    const nowMet = !o.fulfillment.met
    setObligations(prev => prev.map(x => x.id === id
      ? { ...x, fulfillment: nowMet ? { met: true, filedDate: iso(0), evidence: x.fulfillment.evidence } : { met: false, progress: "Not started" } }
      : x))
    if (nowMet) setAttachFor(id)  // prompt (not force) to attach confirmation
  }
  function attachEvidence(id: string) {
    setObligations(prev => prev.map(x => x.id === id ? { ...x, fulfillment: { ...x.fulfillment, evidence: "filing-confirmation.pdf" } } : x))
    setAttachFor(null)
  }
  function addObligation(name: string, jurisdiction: string, entity: string, dueDate: string) {
    setObligations(prev => [...prev, {
      id: `manual-${Date.now()}`, name, jurisdiction, entity, authority: "—", legalSource: "Manual",
      timing: "Manually added", dueDate, fye: "—", source: "Manual", fulfillment: { met: false, progress: "Not started" },
    }])
    setShowAdd(false)
  }

  const events = useMemo(() => obligations.map(o => {
    const s = STATUS[statusOf(o)]
    return { id: o.id, title: o.name, start: o.dueDate, allDay: true, backgroundColor: s.bg, borderColor: s.border, textColor: s.text }
  }), [obligations])

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    height: 30, padding: "0 0.875rem", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer",
    fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)",
    background: active ? "var(--color-surface)" : "transparent", color: active ? "var(--color-text)" : "var(--color-text-tertiary)",
    boxShadow: active ? "var(--shadow-300)" : "none",
  })

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem 2rem", overflow: "hidden", minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
          <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: 0 }}>Compliance</h1>
          <div style={{ display: "inline-flex", gap: 3, padding: 3, background: "var(--color-surface-secondary)", borderRadius: "var(--radius-md)" }}>
            <button type="button" style={toggleStyle(view === "register")} onClick={() => setView("register")}>Register</button>
            <button type="button" style={toggleStyle(view === "calendar")} onClick={() => setView("calendar")}>Calendar</button>
          </div>
        </div>

        {view === "register" ? (
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {/* Filter bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search obligations…"
                style={{ height: 30, width: 220, padding: "0 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
                  background: "var(--color-surface)", color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", outline: "none" }} />
              <FilterSelect label="Jurisdiction" options={[...new Set(ALL_JURISDICTIONS)]} selected={fJur} onChange={setFJur} />
              <FilterSelect label="Entity" options={ALL_ENTITIES} selected={fEnt} onChange={setFEnt} />
              <FilterSelect label="Status" options={["pending", "close", "done", "missed"] as Status[]} selected={fStatus} onChange={setFStatus} />
              <div style={{ flex: 1 }} />
              <button type="button" onClick={() => setShowAdd(true)} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: 30, padding: "0 0.75rem",
                borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", cursor: "pointer" }}>
                <Plus size={14} /> Add obligation
              </button>
            </div>

            {/* Chips + clear all */}
            {anyFilter && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                {[...fJur.map(v => ["jur", v] as const), ...fEnt.map(v => ["ent", v] as const), ...fStatus.map(v => ["st", v] as const)].map(([k, v]) => (
                  <span key={k + v} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "1px 6px 1px 8px", borderRadius: 9999,
                    background: "var(--color-background-primary-soft)", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)" }}>
                    {k === "st" ? STATUS[v as Status].label : v}
                    <button type="button" aria-label="Remove" onClick={() => {
                      if (k === "jur") setFJur(fJur.filter(x => x !== v)); else if (k === "ent") setFEnt(fEnt.filter(x => x !== v)); else setFStatus(fStatus.filter(x => x !== v))
                    }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", display: "inline-flex", padding: 0 }}><X size={11} /></button>
                  </span>
                ))}
                <button type="button" onClick={clearAll} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-info-soft)", fontSize: "var(--font-text-xs-size)" }}>Clear all</button>
              </div>
            )}

            {/* Summary strip */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
              {([["missed", counts.missed, "missed"], ["close", counts.close, "due soon"], ["pending", counts.pending, "pending"], ["done", counts.done, "done"]] as const).map(([st, n, label], idx) => (
                <span key={st} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  {idx > 0 && <span style={{ color: "var(--color-text-tertiary)" }}>·</span>}
                  <button type="button" onClick={() => setFStatus([st as Status])} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text)", fontSize: "var(--font-text-sm-size)" }}>
                    <strong style={{ color: "var(--color-text)" }}>{n}</strong> {label}
                  </button>
                </span>
              ))}
            </div>

            {/* Bands */}
            {visible.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-sm-size)" }}>
                No obligations match these filters. <button type="button" onClick={clearAll} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-info-soft)" }}>Clear all</button>
              </div>
            ) : (
              <>
                <Band title="Overdue" accent="var(--color-border-danger-outline)" rows={overdue} open onRowClick={setSelectedId} selectedId={selectedId} onOpenRequirements={onOpenRequirements} />
                <Band title="Due soon" accent="var(--color-border-caution-outline)" rows={dueSoon} open onRowClick={setSelectedId} selectedId={selectedId} onOpenRequirements={onOpenRequirements} />
                <Band title="Upcoming" accent="var(--color-border-strong)" rows={upcoming} collapsible open={showUpcoming} onToggle={() => setShowUpcoming(v => !v)} onRowClick={setSelectedId} selectedId={selectedId} onOpenRequirements={onOpenRequirements} />
                <Band title="Completed" accent="var(--color-border-success-outline)" rows={completed} collapsible open={showCompleted} onToggle={() => setShowCompleted(v => !v)} onRowClick={setSelectedId} selectedId={selectedId} onOpenRequirements={onOpenRequirements} />
              </>
            )}
          </div>
        ) : (
          <div className="veritax-fc" style={{ flex: 1, minHeight: 0 }}>
            <FullCalendar
              plugins={[multiMonthPlugin, dayGridPlugin, timeGridPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: "prev,next today", center: "title", right: "multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay" }}
              buttonText={{ today: "Today", year: "Year", month: "Month", week: "Week", day: "Day" }}
              height="100%"
              events={events}
              eventClick={arg => setSelectedId(arg.event.id)}
              dayMaxEvents
            />
          </div>
        )}
      </main>

      {/* Shared detail panel */}
      {selected && selStatus && (
        <aside style={{ width: 360, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "1.25rem", borderBottom: "1px solid var(--color-border)" }}>
            <StatusPill status={selStatus} />
            <button type="button" aria-label="Close" onClick={() => setSelectedId(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.25rem" }}>{selected.name}</h2>
              <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>{selected.entity}</p>
            </div>
            {[["Jurisdiction", `${selected.jurisdiction} · ${selected.authority}`], ["Legal source", `${selected.legalSource} — ${selected.timing}`],
              ["Due date", `${fmtDate(selected.dueDate)}${selStatus !== "done" ? ` · ${daysText(selected.dueDate)}` : ""}`],
              ["Owner", selected.owner ?? "Unassigned"]].map(([label, val]) => (
              <div key={label}>
                <p style={{ fontSize: "var(--font-text-xs-size)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.25rem" }}>{label}</p>
                <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text)", margin: 0 }}>{val}</p>
              </div>
            ))}
            {/* Fulfillment / evidence */}
            <div>
              <p style={{ fontSize: "var(--font-text-xs-size)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: "0 0 0.375rem" }}>Fulfillment</p>
              {selected.fulfillment.met ? (
                <p style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-success-soft)", margin: 0 }}>
                  {selected.fulfillment.evidence ? <ShieldCheck size={14} /> : null}
                  Filed {selected.fulfillment.filedDate ? fmtDate(selected.fulfillment.filedDate) : ""}
                  {selected.fulfillment.evidence
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--color-text-secondary)" }}> · <Paperclip size={12} /> {selected.fulfillment.evidence}</span>
                    : <span style={{ color: "var(--color-text-tertiary)" }}> · no evidence attached</span>}
                </p>
              ) : (
                <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>
                  {selected.fulfillment.progress}{" "}
                  <button type="button" onClick={onOpenRequirements} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "var(--color-text-info-soft)", textDecoration: "underline", fontSize: "var(--font-text-sm-size)" }}>Open Requirements</button>
                </p>
              )}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", padding: "0.75rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
              <input type="checkbox" checked={selected.fulfillment.met} onChange={() => toggleComplete(selected.id)} style={{ accentColor: "var(--color-background-primary-solid)", width: 16, height: 16 }} />
              <span style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>Complete</span>
            </label>
          </div>
        </aside>
      )}

      {/* Attach-confirmation prompt (skippable) */}
      {attachFor && (
        <Modal onClose={() => setAttachFor(null)}>
          <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text)", margin: "0 0 1rem" }}>Attach filing confirmation?</p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setAttachFor(null)} style={btnGhost}>Skip</button>
            <button type="button" onClick={() => attachEvidence(attachFor)} style={btnPrimary}>Attach</button>
          </div>
        </Modal>
      )}

      {/* Add obligation */}
      {showAdd && <AddForm onClose={() => setShowAdd(false)} onAdd={addObligation} />}
    </div>
  )
}

// ── Small modal primitives ───────────────────────────────────────────────────
const btnPrimary: React.CSSProperties = { height: 34, padding: "0 0.875rem", border: "none", borderRadius: "var(--radius-md)", background: "var(--color-background-primary-solid)", color: "var(--color-text-inverse)", fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", cursor: "pointer" }
const btnGhost: React.CSSProperties = { height: 34, padding: "0 0.875rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-surface)", color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)", cursor: "pointer" }
const inputStyle: React.CSSProperties = { width: "100%", height: 36, padding: "0 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", outline: "none", boxSizing: "border-box" }

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 340, background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem", boxShadow: "var(--shadow-300)" }}>
        {children}
      </div>
    </div>
  )
}

function AddForm({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, jur: string, ent: string, due: string) => void }) {
  const [name, setName] = useState("")
  const [jur, setJur] = useState(ALL_JURISDICTIONS[0])
  const [ent, setEnt] = useState("")
  const [due, setDue] = useState(iso(30))
  return (
    <Modal onClose={onClose}>
      <p style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.875rem" }}>Add obligation</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <input style={inputStyle} placeholder="Obligation name" value={name} onChange={e => setName(e.target.value)} />
        <select style={inputStyle} value={jur} onChange={e => setJur(e.target.value)}>
          {[...new Set(ALL_JURISDICTIONS)].map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        <input style={inputStyle} placeholder="Entity" value={ent} onChange={e => setEnt(e.target.value)} />
        <input style={inputStyle} type="date" value={due} onChange={e => setDue(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
        <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
        <button type="button" disabled={!name.trim()} onClick={() => onAdd(name.trim(), jur, ent.trim() || "—", due)} style={{ ...btnPrimary, opacity: name.trim() ? 1 : 0.5 }}>Add</button>
      </div>
    </Modal>
  )
}
