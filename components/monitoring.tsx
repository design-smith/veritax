"use client"

import { Fragment, useMemo, useRef, useState, useEffect, type CSSProperties, type ReactNode } from "react"
import { ArrowRight, ChevronDown, Plus, X } from "lucide-react"
import {
  ALL_WATCH_ENTITIES,
  ALL_WATCH_JURISDICTIONS,
  SEEDED_WATCHES,
  WATCH_TYPES,
  boundaryLabel,
  currentValue,
  formatValue,
  impactLabel,
  linearSlope,
  projectedCrossing,
  statusOfWatch,
  type Boundary,
  type PositionWatch,
  type WatchStatus,
  type WatchType,
} from "@/lib/monitoring-data"

const STATUS_STYLE: Record<WatchStatus, { label: string; accent: string; bg: string; text: string; border: string }> = {
  breached: { label: "Breached", accent: "var(--color-border-danger-outline)", bg: "var(--color-background-danger-soft)", text: "var(--color-text-danger-soft)", border: "var(--color-border-danger-surface)" },
  drifting: { label: "Drifting", accent: "var(--color-border-caution-outline)", bg: "var(--color-background-caution-soft)", text: "var(--color-text-caution-soft)", border: "var(--color-border-caution-surface)" },
  inRange: { label: "In range", accent: "var(--color-border-success-outline)", bg: "var(--color-background-success-soft)", text: "var(--color-text-success-soft)", border: "var(--color-border-success-surface)" },
}
const STATUS_ORDER: Record<WatchStatus, number> = { breached: 0, drifting: 1, inRange: 2 }

function StatusPill({ status }: { status: WatchStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 9999, fontSize: "var(--font-text-xs-size)",
      fontWeight: "var(--font-weight-medium)", background: s.bg, color: s.text, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  )
}

function FilterSelect<T extends string>({ label, options, selected, onChange }: {
  label: string
  options: readonly T[]
  selected: T[]
  onChange: (v: T[]) => void
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
        background: "var(--color-surface)", color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)", cursor: "pointer",
      }}>
        {label}{selected.length ? ` \u00b7 ${selected.length}` : ""} <ChevronDown size={13} strokeWidth={1.5} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: 220, zIndex: 50,
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

function MiniChart({ watch, large = false }: { watch: PositionWatch; large?: boolean }) {
  const status = statusOfWatch(watch)
  const crossing = projectedCrossing(watch)
  const gradientId = `watch-area-${watch.id}-${large ? "large" : "small"}`
  const width = large ? 640 : 300
  const height = large ? 220 : 116
  const pad = { top: 12, right: 16, bottom: large ? 28 : 16, left: 28 }
  const values = watch.history.map(p => p.value)
  const boundaryValues = watch.boundary.kind === "range"
    ? [watch.boundary.low, watch.boundary.high]
    : [watch.boundary.value]
  const projectionEnd = crossing ? crossing.value : null
  const allY = [...values, ...boundaryValues, ...(projectionEnd == null ? [] : [projectionEnd])]
  const min = Math.min(...allY)
  const max = Math.max(...allY)
  const yPad = Math.max((max - min) * 0.18, watch.boundary.unit === "percent" ? 0.8 : 1_000_000)
  const yMin = min - yPad
  const yMax = max + yPad
  const xMax = watch.history.length - 1 + (crossing ? Math.max(crossing.quarters, 1) : 0)
  const x = (idx: number) => pad.left + (idx / Math.max(xMax, 1)) * (width - pad.left - pad.right)
  const y = (value: number) => pad.top + ((yMax - value) / Math.max(yMax - yMin, 1)) * (height - pad.top - pad.bottom)
  const path = watch.history.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ")
  const baseline = height - pad.bottom
  const areaPath = `${path} L ${x(watch.history.length - 1)} ${baseline} L ${x(0)} ${baseline} Z`
  const current = currentValue(watch)
  const slope = linearSlope(watch.history)
  const projectionPath = crossing
    ? `M ${x(watch.history.length - 1)} ${y(current)} L ${x(watch.history.length - 1 + crossing.quarters)} ${y(crossing.value)}`
    : ""

  return (
    <svg role="img" aria-label={`${watch.title} monitoring chart`} viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: large ? 220 : 116, display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1={pad.top} y2={baseline} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-text)" stopOpacity={0.16} />
          <stop offset="100%" stopColor="var(--color-text)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} rx={large ? 10 : 8} fill="var(--color-surface-secondary)" />
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t} x1={pad.left} x2={width - pad.right} y1={pad.top + t * (height - pad.top - pad.bottom)} y2={pad.top + t * (height - pad.top - pad.bottom)} stroke="var(--color-border-subtle)" strokeWidth={1} />
      ))}

      {watch.boundary.kind === "range" ? (
        <rect x={pad.left} y={y(watch.boundary.high)} width={width - pad.left - pad.right} height={Math.max(2, y(watch.boundary.low) - y(watch.boundary.high))}
          fill="var(--color-background-success-soft)" opacity={0.42} />
      ) : (
        <line x1={pad.left} x2={width - pad.right} y1={y(watch.boundary.value)} y2={y(watch.boundary.value)}
          stroke="var(--color-border-strong)" strokeWidth={1.4} />
      )}

      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke="var(--color-text)" strokeWidth={large ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" />
      {large && watch.history.map((p, i) => (
        <circle key={p.quarter} cx={x(i)} cy={y(p.value)} r={3.2} fill="var(--color-text)" />
      ))}
      {!large && <circle cx={x(watch.history.length - 1)} cy={y(current)} r={2.8} fill="var(--color-text)" />}

      {status === "drifting" && crossing && (
        <>
          <path d={projectionPath} fill="none" stroke="var(--color-text-caution-soft)" strokeWidth={large ? 2 : 1.6}
            strokeLinecap="round" strokeDasharray="4 4" />
          <circle cx={x(watch.history.length - 1 + crossing.quarters)} cy={y(crossing.value)} r={large ? 5 : 4}
            fill="var(--color-background-caution-soft)" stroke="var(--color-text-caution-soft)" strokeWidth={large ? 2 : 1.6} />
        </>
      )}

      {large && watch.history.map((p, i) => (
        <text key={p.quarter} x={x(i)} y={height - 8} textAnchor="middle" fontSize={9} fill="var(--color-text-tertiary)">
          {i % 2 === 0 ? p.quarter : ""}
        </text>
      ))}
      {large && (
        <text x={width - pad.right} y={pad.top + 10} textAnchor="end" fontSize={10} fill="var(--color-text-tertiary)">
          trend {slope >= 0 ? "+" : ""}{formatValue(slope, watch.boundary.unit)} / qtr
        </text>
      )}
    </svg>
  )
}

function watchDescription(watch: PositionWatch, status: WatchStatus, crossing: ReturnType<typeof projectedCrossing>): string {
  if (status === "breached") {
    return `${watch.metric} is outside its boundary now. Use this watch to validate the current value, size the adjustment, and route the issue to Risks.`
  }
  if (status === "drifting" && crossing) {
    return `${watch.metric} is still inside the boundary, but the trailing four-quarter trend reaches the boundary before fiscal year end.`
  }
  return `${watch.metric} remains inside its boundary, and the current projection stays in range for this period.`
}

function WatchFacts({ watch, status, crossing, includeDescription = false }: {
  watch: PositionWatch
  status: WatchStatus
  crossing: ReturnType<typeof projectedCrossing>
  includeDescription?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {includeDescription && (
        <p style={{ margin: 0, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {watchDescription(watch, status, crossing)}
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "0.625rem", rowGap: "0.25rem", fontSize: "var(--font-text-xs-size)" }}>
        <Label>Current</Label><Value>{formatValue(currentValue(watch), watch.boundary.unit)} (Q2 2026)</Value>
        <Label>Boundary</Label><Value>{boundaryLabel(watch.boundary)}</Value>
        {status === "drifting" && crossing && <><Label>Projected crossing</Label><Value>{crossing.label}</Value></>}
        {(status === "breached" || status === "drifting") && <><Label>Est. impact</Label><Value>{impactLabel(watch)}</Value></>}
      </div>
    </div>
  )
}

function WatchCard({ watch, onClick, featured = false, selected = false }: {
  watch: PositionWatch
  onClick: () => void
  featured?: boolean
  selected?: boolean
}) {
  const status = statusOfWatch(watch)
  const crossing = projectedCrossing(watch)
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} style={{
      display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: featured ? "auto" : 238,
      gridColumn: featured ? "1 / -1" : undefined,
      border: `1px solid ${selected ? "var(--color-border-strong)" : "var(--color-border)"}`,
      borderRadius: "var(--radius-lg)", background: selected ? "var(--color-surface-secondary)" : "var(--color-surface)", padding: "1rem",
      boxShadow: selected ? "var(--shadow-100)" : "none",
      transition: "background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
      textAlign: "left", cursor: "pointer", color: "var(--color-text)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <h3 style={{ flex: 1, fontSize: "var(--font-text-sm-size)", lineHeight: 1.35, fontWeight: "var(--font-weight-medium)", margin: 0 }}>
          {watch.title}
        </h3>
        <StatusPill status={status} />
      </div>
      <div style={featured ? {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
        gap: "1rem",
        alignItems: "center",
      } : { display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <MiniChart watch={watch} />
        <WatchFacts watch={watch} status={status} crossing={crossing} includeDescription={featured} />
      </div>
      <p style={{ margin: 0, fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", lineHeight: 1.45 }}>
        {watch.boundarySource}
      </p>
    </button>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <span style={{ color: "var(--color-text-tertiary)" }}>{children}:</span>
}

function Value({ children }: { children: ReactNode }) {
  return <span style={{ color: "var(--color-text)" }}>{children}</span>
}

export default function MonitoringPage({ onOpenRisks }: { onOpenRisks?: () => void }) {
  const [watches, setWatches] = useState<PositionWatch[]>(SEEDED_WATCHES)
  const [fJur, setFJur] = useState<string[]>([])
  const [fEnt, setFEnt] = useState<string[]>([])
  const [fType, setFType] = useState<WatchType[]>([])
  const [statusFilter, setStatusFilter] = useState<WatchStatus | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const filtered = watches
    .filter(watch =>
      (fJur.length === 0 || fJur.includes(watch.jurisdiction)) &&
      (fEnt.length === 0 || fEnt.includes(watch.entity)) &&
      (fType.length === 0 || fType.includes(watch.watchType)) &&
      (!statusFilter || statusOfWatch(watch) === statusFilter)
    )
    .slice()
    .sort((a, b) => STATUS_ORDER[statusOfWatch(a)] - STATUS_ORDER[statusOfWatch(b)] || a.title.localeCompare(b.title))
  const allFilter = fJur.length + fEnt.length + fType.length > 0 || statusFilter !== null
  const clearAll = () => { setFJur([]); setFEnt([]); setFType([]); setStatusFilter(null) }
  const counts = useMemo(() => {
    const scoped = watches.filter(watch =>
      (fJur.length === 0 || fJur.includes(watch.jurisdiction)) &&
      (fEnt.length === 0 || fEnt.includes(watch.entity)) &&
      (fType.length === 0 || fType.includes(watch.watchType))
    )
    return {
      breached: scoped.filter(w => statusOfWatch(w) === "breached").length,
      drifting: scoped.filter(w => statusOfWatch(w) === "drifting").length,
      inRange: scoped.filter(w => statusOfWatch(w) === "inRange").length,
    }
  }, [watches, fJur, fEnt, fType])

  const selected = watches.find(w => w.id === selectedId) ?? null
  const staleCount = watches.filter(w => w.staleSource).length

  function addWatch(watch: PositionWatch) {
    setWatches(prev => [watch, ...prev])
    setShowAdd(false)
    setSelectedId(watch.id)
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem 2rem", overflow: "hidden", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
          <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: 0 }}>Monitoring</h1>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)" }}>
            <span>{"Q2 2026 \u00b7 data through Jun 30"}</span>
            {staleCount > 0 && <span style={{ padding: "2px 8px", borderRadius: 9999, background: "var(--color-background-caution-soft)", color: "var(--color-text-caution-soft)", border: "1px solid var(--color-border-caution-surface)", fontSize: "var(--font-text-xs-size)" }}>{staleCount} sources stale</span>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <FilterSelect label="Jurisdiction" options={ALL_WATCH_JURISDICTIONS} selected={fJur} onChange={setFJur} />
          <FilterSelect label="Entity" options={ALL_WATCH_ENTITIES} selected={fEnt} onChange={setFEnt} />
          <FilterSelect label="Watch type" options={WATCH_TYPES} selected={fType} onChange={setFType} />
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setShowAdd(true)} style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem", height: 30, padding: "0 0.75rem",
            borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)",
            color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", cursor: "pointer",
          }}>
            <Plus size={14} strokeWidth={1.5} /> Add watch
          </button>
        </div>

        {allFilter && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            {[...fJur.map(v => ["jur", v] as const), ...fEnt.map(v => ["ent", v] as const), ...fType.map(v => ["type", v] as const)].map(([kind, value]) => (
              <Chip key={kind + value} onRemove={() => {
                if (kind === "jur") setFJur(fJur.filter(x => x !== value))
                if (kind === "ent") setFEnt(fEnt.filter(x => x !== value))
                if (kind === "type") setFType(fType.filter(x => x !== value))
              }}>{value}</Chip>
            ))}
            {statusFilter && <Chip onRemove={() => setStatusFilter(null)}>{STATUS_STYLE[statusFilter].label}</Chip>}
            <button type="button" onClick={clearAll} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-info-soft)", fontSize: "var(--font-text-xs-size)" }}>Clear all</button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
          <SummaryButton count={counts.breached} label="breached" active={statusFilter === "breached"} onClick={() => setStatusFilter(statusFilter === "breached" ? null : "breached")} />
          <Dot />
          <SummaryButton count={counts.drifting} label="drifting" active={statusFilter === "drifting"} onClick={() => setStatusFilter(statusFilter === "drifting" ? null : "drifting")} />
          <Dot />
          <SummaryButton count={counts.inRange} label="in range" active={statusFilter === "inRange"} onClick={() => setStatusFilter(statusFilter === "inRange" ? null : "inRange")} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem", paddingBottom: "2rem" }}>
          {watches.length === 0 ? (
            <EmptyState>Complete planning setup to generate position watches.</EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState>No watches match these filters. <button type="button" onClick={clearAll} style={linkButton}>Clear all</button></EmptyState>
          ) : counts.breached === 0 && counts.drifting === 0 ? (
            <>
              <p style={{ margin: 0, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>Nothing needs attention this period.</p>
              <CardGrid watches={filtered} selectedId={selectedId} onOpen={watch => setSelectedId(watch.id)} />
            </>
          ) : (
            <CardGrid watches={filtered} selectedId={selectedId} onOpen={watch => setSelectedId(watch.id)} />
          )}
        </div>
      </main>

      {selected && (
        <WatchDetail watch={selected} onClose={() => setSelectedId(null)} onOpenRisks={onOpenRisks} />
      )}

      {showAdd && <AddWatchModal onClose={() => setShowAdd(false)} onAdd={addWatch} />}
    </div>
  )
}

function SummaryButton({ count, label, active, onClick }: { count: number; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      border: "none", borderRadius: 9999, padding: active ? "2px 9px" : 0,
      background: active ? "var(--color-background-primary-soft)" : "transparent",
      cursor: "pointer", color: "var(--color-text)", fontSize: "var(--font-text-sm-size)",
    }}>
      <strong>{count}</strong> {label}
    </button>
  )
}

function CardGrid({ watches, selectedId, onOpen }: { watches: PositionWatch[]; selectedId: string | null; onOpen: (watch: PositionWatch) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "0.875rem" }}>
      {watches.map((watch, idx) => (
        <WatchCard key={watch.id} watch={watch} featured={idx === 0} selected={watch.id === selectedId} onClick={() => onOpen(watch)} />
      ))}
    </div>
  )
}

function Dot() {
  return <span style={{ color: "var(--color-text-tertiary)" }}>{"\u00b7"}</span>
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "1px 6px 1px 8px", borderRadius: 9999,
      background: "var(--color-background-primary-soft)", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)" }}>
      {children}
      <button type="button" aria-label="Remove" onClick={onRemove} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", display: "inline-flex", padding: 0 }}>
        <X size={11} strokeWidth={1.5} />
      </button>
    </span>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-sm-size)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
      {children}
    </div>
  )
}

function WatchDetail({ watch, onClose, onOpenRisks }: { watch: PositionWatch; onClose: () => void; onOpenRisks?: () => void }) {
  const status = statusOfWatch(watch)
  const crossing = projectedCrossing(watch)
  return (
    <aside style={{ width: 390, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "1.25rem", borderBottom: "1px solid var(--color-border)" }}>
        <StatusPill status={status} />
        <button type="button" aria-label="Close" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 20, lineHeight: 1 }}>x</button>
      </div>
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: "var(--font-text-lg-size)", lineHeight: 1.35, fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.25rem" }}>{watch.title}</h2>
          <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>{watch.entity} {"\u00b7"} {watch.jurisdiction} {"\u00b7"} {watch.watchType}</p>
        </div>

        <MiniChart watch={watch} large />

        <InfoGrid rows={[
          ["Current", `${formatValue(currentValue(watch), watch.boundary.unit)} (Q2 2026)`],
          ["Boundary", boundaryLabel(watch.boundary)],
          ...(crossing ? [["Projected crossing", crossing.label] as [string, string]] : []),
          ...(status === "breached" || status === "drifting" ? [["Est. impact", impactLabel(watch)] as [string, string]] : []),
        ]} />

        <div>
          <p style={sectionLabel}>History by quarter</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {watch.history.map(row => (
                <tr key={row.quarter}>
                  <td style={tableCell}>{row.quarter}</td>
                  <td style={{ ...tableCell, textAlign: "right", color: "var(--color-text)" }}>{formatValue(row.value, watch.boundary.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p style={sectionLabel}>Boundary source</p>
          <p style={{ margin: 0, fontSize: "var(--font-text-sm-size)", color: "var(--color-text)", lineHeight: 1.5 }}>{watch.fullCitation}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {status === "breached" && (
            <button type="button" onClick={onOpenRisks} style={primaryButton}>
              View in Risks <ArrowRight size={14} strokeWidth={1.5} />
            </button>
          )}
          {(status === "breached" || status === "drifting") && (
            <button type="button" disabled style={{ ...ghostButton, opacity: 0.65, cursor: "not-allowed" }}>
              Model a fix in Simulation {"\u00b7"} coming soon
            </button>
          )}
        </div>

        <InfoGrid rows={[
          ["Watch metadata", `${watch.sourceKind} \u00b7 created ${watch.createdDate}`],
          ["Data source", watch.dataSource],
          ["Boundary type", watch.boundary.kind === "range" ? "Range band" : "Single threshold"],
        ]} />
      </div>
    </aside>
  )
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "0.875rem", rowGap: "0.375rem", fontSize: "var(--font-text-sm-size)" }}>
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <span style={{ color: "var(--color-text-tertiary)" }}>{label}:</span>
          <span style={{ color: "var(--color-text)" }}>{value}</span>
        </Fragment>
      ))}
    </div>
  )
}

const sectionLabel: CSSProperties = {
  fontSize: "var(--font-text-xs-size)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--color-text-tertiary)",
  margin: "0 0 0.5rem",
}

const tableCell: CSSProperties = {
  padding: "0.375rem 0",
  borderBottom: "1px solid var(--color-border-subtle)",
  fontSize: "var(--font-text-xs-size)",
  color: "var(--color-text-secondary)",
}

const primaryButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.375rem",
  height: 34,
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
  height: 34,
  padding: "0 0.875rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface)",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-text-sm-size)",
  cursor: "pointer",
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 0.625rem",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: "var(--font-text-sm-size)",
  outline: "none",
  boxSizing: "border-box",
}

const linkButton: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "var(--color-text-info-soft)",
  fontSize: "var(--font-text-sm-size)",
  padding: 0,
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 360, background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem", boxShadow: "var(--shadow-300)" }}>
        {children}
      </div>
    </div>
  )
}

function AddWatchModal({ onClose, onAdd }: { onClose: () => void; onAdd: (watch: PositionWatch) => void }) {
  const [entity, setEntity] = useState(ALL_WATCH_ENTITIES[0] ?? "Manual entity")
  const [jurisdiction, setJurisdiction] = useState(ALL_WATCH_JURISDICTIONS[0] ?? "United States")
  const [watchType, setWatchType] = useState<WatchType>("Threshold")
  const [metric, setMetric] = useState("Manual threshold")
  const [current, setCurrent] = useState("10")
  const [boundary, setBoundary] = useState("20")
  const [source, setSource] = useState("Manual")

  function submit() {
    const currentNumber = Number(current)
    const boundaryNumber = Number(boundary)
    const b: Boundary = { kind: "limit", direction: "max", value: Number.isFinite(boundaryNumber) ? boundaryNumber : 20, unit: "percent" }
    const safeCurrent = Number.isFinite(currentNumber) ? currentNumber : 10
    onAdd({
      id: `manual-watch-${Date.now()}`,
      title: `${entity} - ${metric}`,
      entity,
      jurisdiction,
      watchType,
      metric,
      boundary: b,
      history: ["Q3 2024", "Q4 2024", "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"].map((quarter, idx) => ({
        quarter,
        value: Math.max(0, safeCurrent - (7 - idx) * 0.15),
      })),
      boundarySource: "Manual",
      fullCitation: source.trim() || "Manual",
      fiscalYearEnd: "2026-12-31",
      sourceKind: "Manual",
      createdDate: "2026-07-27",
      dataSource: "Manual entry",
      estimatedImpact: null,
    })
  }

  return (
    <Modal onClose={onClose}>
      <p style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.875rem" }}>Add watch</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <select style={inputStyle} value={entity} onChange={e => setEntity(e.target.value)}>
          {ALL_WATCH_ENTITIES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select style={inputStyle} value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}>
          {ALL_WATCH_JURISDICTIONS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select style={inputStyle} value={watchType} onChange={e => setWatchType(e.target.value as WatchType)}>
          {WATCH_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <input style={inputStyle} value={metric} onChange={e => setMetric(e.target.value)} placeholder="Metric" />
        <input style={inputStyle} value={current} onChange={e => setCurrent(e.target.value)} placeholder="Current value" />
        <input style={inputStyle} value={boundary} onChange={e => setBoundary(e.target.value)} placeholder="Boundary value" />
        <input style={inputStyle} value={source} onChange={e => setSource(e.target.value)} placeholder="Source note" />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
        <button type="button" onClick={onClose} style={ghostButton}>Cancel</button>
        <button type="button" disabled={!metric.trim()} onClick={submit} style={{ ...primaryButton, opacity: metric.trim() ? 1 : 0.5 }}>Add</button>
      </div>
    </Modal>
  )
}
