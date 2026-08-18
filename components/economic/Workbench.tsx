"use client"

// Class 3 · Financial Workbench — the in-Draft "Economic Analysis" surface (PRD §58): a five-step analysis nav
// (Financials / Segmentation / TNMM / Benchmark / Conclusion), a main area, and an evidence/warnings side panel.
// S1 shipped the shell; S2 makes the Financials view live (upload a dataset, see its summary, drill to
// source-linked rows). Later slices fill Segmentation / TNMM / Benchmark / Conclusion.

import { useCallback, useEffect, useRef, useState } from "react"
import { FileSpreadsheet, Layers, Calculator, BarChart3, Flag, Info, Upload, Loader2, Columns3, Sparkles, AlertTriangle, Plus, Trash2 } from "lucide-react"
import { api, FINANCIAL_CLASSIFICATIONS, SEGMENT_RULE_FIELDS, SEGMENT_RULE_OPERATORS, FINANCIAL_ADJUSTMENT_TYPES, FINANCIAL_ALLOCATION_BASES,
  type FinancialDatasetRead, type FinancialRowRead, type FinancialMappingRead,
  type FinancialSegmentRead, type SegmentPnL } from "@/lib/api"

export type WorkbenchView = "financials" | "segmentation" | "tnmm" | "benchmark" | "conclusion"

const NAV: { id: WorkbenchView; label: string; icon: typeof FileSpreadsheet }[] = [
  { id: "financials", label: "Financials", icon: FileSpreadsheet },
  { id: "segmentation", label: "Segmentation", icon: Layers },
  { id: "tnmm", label: "TNMM", icon: Calculator },
  { id: "benchmark", label: "Benchmark", icon: BarChart3 },
  { id: "conclusion", label: "Conclusion", icon: Flag },
]

const PLACEHOLDER: Record<Exclude<WorkbenchView, "financials">, { title: string; body: string }> = {
  segmentation: { title: "Segmentation", body: "Isolate the financial result for a controlled transaction or business segment — direct account mapping, exclusions, and allocations, with a segmented P&L that drills to source." },
  tnmm: { title: "TNMM", body: "Select the tested party (from the FAR analysis) and a PLI, then Veritax computes the result deterministically from the reconciled segment." },
  benchmark: { title: "Benchmark", body: "Import a comparable set with its rejection log. The arm's-length range is computed with the jurisdiction's statistical method." },
  conclusion: { title: "Conclusion", body: "The tested result against the arm's-length range — within / below / above — and any illustrative transfer-pricing adjustment for your review." },
}

const DATASET_TYPES = ["trial_balance", "general_ledger", "segmented_pl", "financial_statements", "management_accounts", "invoice_population"]
const fmtType = (t: string) => t.replace(/_/g, " ")
const fmtNum = (n: number | null) => (n === null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 2 }))
const fmtIssue = (code: string) => code.replace(/_/g, " ")

const toolbarBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "1.75rem", padding: "0 0.625rem",
  borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", cursor: "pointer",
  background: "var(--color-surface)", color: "var(--color-text-secondary)", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
}
const miniSelect: React.CSSProperties = {
  height: "1.75rem", padding: "0 0.375rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
  background: "var(--color-surface)", color: "var(--color-text)", fontSize: "var(--font-text-xs-size)",
}

export default function EconomicWorkbench({ engagementId }: { engagementId: string }) {
  const [view, setView] = useState<WorkbenchView>("financials")

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--color-background)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.875rem 3.5rem 0.75rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
        {NAV.map(({ id, label, icon: Icon }) => {
          const on = id === view
          return (
            <button key={id} type="button" onClick={() => setView(id)} style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem",
              padding: "0.3125rem 0.75rem", borderRadius: "9999px", border: "none", cursor: "pointer",
              background: on ? "var(--color-background-primary-solid)" : "var(--alpha-04)",
              color: on ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
              fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
              transition: "all var(--transition-duration-basic)",
            }}>
              <Icon size={13} />
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "1.5rem 3.5rem" }}>
          {view === "financials"
            ? <FinancialsView engagementId={engagementId} />
            : view === "segmentation"
              ? <SegmentationView engagementId={engagementId} />
              : <Placeholder {...PLACEHOLDER[view]} />}
        </div>

        <aside style={{ width: "18rem", flexShrink: 0, borderLeft: "1px solid var(--color-border-subtle)", padding: "1.25rem", overflow: "auto", background: "var(--color-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--color-text-secondary)" }}>
            <Info size={13} />
            <span style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Evidence &amp; calculations</span>
          </div>
          <p style={{ margin: "0.75rem 0 0", fontSize: "var(--font-text-xs-size)", lineHeight: 1.5, color: "var(--color-text-tertiary)" }}>
            Every figure traces here to its source: dataset, segment, adjustment, PLI calculation, and comparable set. Warnings (unreconciled totals, stale benchmarks) surface in this panel.
          </p>
        </aside>
      </div>
    </div>
  )
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ border: "1px dashed var(--color-border)", borderRadius: "0.75rem", padding: "2.5rem 2rem", textAlign: "center", maxWidth: "38rem", margin: "0 auto" }}>
      <h2 style={{ margin: 0, fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>{title}</h2>
      <p style={{ margin: "0.625rem 0 0", fontSize: "var(--font-text-sm-size)", lineHeight: 1.5, color: "var(--color-text-secondary)" }}>{body}</p>
      <p style={{ margin: "1rem 0 0", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>Coming soon</p>
    </div>
  )
}

function FinancialsView({ engagementId }: { engagementId: string }) {
  const [datasets, setDatasets] = useState<FinancialDatasetRead[] | null>(null)
  const [datasetType, setDatasetType] = useState(DATASET_TYPES[0])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      setDatasets(await api.listFinancialDatasets(engagementId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load financial datasets")
    }
  }, [engagementId])

  useEffect(() => { void refresh() }, [refresh])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    try {
      await api.uploadFinancialDataset(engagementId, file, datasetType)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
      {/* Upload control */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <select value={datasetType} onChange={e => setDatasetType(e.target.value)} style={{
          height: "var(--control-size-md)", padding: "0 0.625rem", borderRadius: "var(--control-radius-md)",
          border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)",
          fontSize: "var(--font-text-sm-size)",
        }}>
          {DATASET_TYPES.map(t => <option key={t} value={t}>{fmtType(t)}</option>)}
        </select>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-md)", padding: "0 0.875rem",
          borderRadius: "var(--control-radius-md)", border: "none", cursor: uploading ? "not-allowed" : "pointer",
          background: "var(--color-background-primary-solid)", color: "var(--color-text-inverse)",
          fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)",
        }}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload XLSX / CSV
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" onChange={onFile} style={{ display: "none" }} />
      </div>

      {error && <p style={{ margin: "0 0 1rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-danger-soft)" }}>{error}</p>}

      {datasets === null
        ? <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>Loading…</p>
        : datasets.length === 0
          ? <Placeholder title="No financial data yet" body="Upload a trial balance, GL, or segmented P&L above. Rows are parsed with source provenance and the original file is preserved unchanged." />
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {datasets.map(ds => (
                <DatasetCard key={ds.id} ds={ds} open={openId === ds.id} onToggle={() => setOpenId(openId === ds.id ? null : ds.id)} />
              ))}
            </div>
          )}
    </div>
  )
}

function DatasetCard({ ds, open, onToggle }: { ds: FinancialDatasetRead; open: boolean; onToggle: () => void }) {
  const [rows, setRows] = useState<FinancialRowRead[] | null>(null)
  const [mapping, setMapping] = useState<FinancialMappingRead | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [showMapping, setShowMapping] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadRows = useCallback(() => {
    void api.getFinancialRows(ds.id, 50, 0).then(p => setRows(p.rows)).catch(() => setRows([]))
  }, [ds.id])

  useEffect(() => {
    if (!open) return
    if (rows === null) loadRows()
    if (mapping === null) {
      void api.getFinancialMapping(ds.id).then(m => { setMapping(m); setDraft({ ...m.effective }) }).catch(() => {})
    }
  }, [open, rows, mapping, ds.id, loadRows])

  async function suggest() {
    try {
      const s = await api.getFinancialMappingSuggestions(ds.id)
      setDraft(prev => {
        const next = { ...prev }
        for (const [f, h] of Object.entries(s.suggestions)) if (!next[f]) next[f] = h
        return next
      })
      setShowMapping(true)
    } catch { /* suggestions are optional */ }
  }

  async function apply() {
    setBusy(true)
    try {
      const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v))
      await api.updateFinancialMapping(ds.id, clean)
      loadRows()
      const m = await api.getFinancialMapping(ds.id); setMapping(m); setDraft({ ...m.effective })
    } finally { setBusy(false) }
  }

  async function setClass(rowId: string, classification: string) {
    setRows(prev => prev ? prev.map(r => r.id === rowId ? { ...r, classification, classification_source: "override" } : r) : prev)
    try { await api.overrideRowClassification(rowId, classification) } catch { loadRows() }
  }

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "0.75rem", overflow: "hidden", background: "var(--color-surface)" }}>
      <button type="button" onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1.125rem",
        border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>
            {ds.source_filename ?? "dataset"}
          </div>
          <div style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", marginTop: "0.125rem" }}>
            {fmtType(ds.dataset_type)}{ds.period ? ` · ${ds.period}` : ""} · {ds.row_count.toLocaleString()} rows
            {(ds.diagnostics?.rows_with_issues ?? 0) > 0 && (
              <span style={{ color: "var(--color-text-caution-soft, #8a5a00)" }}> · {ds.diagnostics!.rows_with_issues} flagged</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.875rem", flexShrink: 0 }}>
          {ds.totals_by_currency.map(t => (
            <div key={t.currency ?? "—"} style={{ textAlign: "right" }}>
              <div style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{fmtNum(t.total_amount)}</div>
              <div style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>{t.currency ?? "no currency"}</div>
            </div>
          ))}
        </div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--color-border-subtle)", overflow: "auto" }}>
          {/* Column-mapping toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <button type="button" onClick={() => setShowMapping(v => !v)} style={toolbarBtn}>
              <Columns3 size={13} /> Columns
            </button>
            <button type="button" onClick={suggest} style={toolbarBtn} title="Suggest a mapping for unmapped columns (you confirm before it applies)">
              <Sparkles size={13} /> Suggest
            </button>
          </div>

          {/* Validation diagnostics (§15) — invalid rows are flagged, never dropped */}
          {ds.diagnostics && (ds.diagnostics.rows_with_issues > 0 || ds.diagnostics.missing_required_columns.length > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", padding: "0.625rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-background-caution-soft, #fff8e5)", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-caution-soft, #8a5a00)" }}>
              <AlertTriangle size={13} />
              {ds.diagnostics.missing_required_columns.length > 0 && (
                <span>Missing required column(s): {ds.diagnostics.missing_required_columns.join(", ")}.</span>
              )}
              {Object.entries(ds.diagnostics.issue_counts).map(([code, n]) => (
                <span key={code} style={{ padding: "0.0625rem 0.375rem", borderRadius: "9999px", background: "var(--alpha-06)" }}>{fmtIssue(code)} ×{n}</span>
              ))}
            </div>
          )}

          {showMapping && mapping && (
            <div style={{ padding: "0.875rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-background)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))", gap: "0.5rem 1rem" }}>
                {mapping.canonical_fields.map(field => (
                  <label key={field} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)" }}>
                    <span style={{ width: "6.5rem", flexShrink: 0 }}>{field.replace(/_/g, " ")}</span>
                    <select value={draft[field] ?? ""} onChange={e => setDraft(prev => ({ ...prev, [field]: e.target.value }))} style={{
                      flex: 1, minWidth: 0, height: "1.75rem", padding: "0 0.375rem", borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "var(--font-text-xs-size)",
                    }}>
                      <option value="">— unmapped —</option>
                      {mapping.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <button type="button" onClick={apply} disabled={busy} style={{
                marginTop: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm, 1.75rem)", padding: "0 0.75rem",
                borderRadius: "var(--control-radius-md)", border: "none", cursor: busy ? "not-allowed" : "pointer",
                background: "var(--color-background-primary-solid)", color: "var(--color-text-inverse)", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
              }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : null} Apply mapping
              </button>
            </div>
          )}

          {rows === null
            ? <p style={{ padding: "0.875rem 1.125rem", margin: 0, fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>Loading rows…</p>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-text-xs-size)" }}>
                <thead>
                  <tr style={{ color: "var(--color-text-tertiary)", textAlign: "left" }}>
                    {["Account", "Name", "BU", "Amount", "Ccy", "Class", "Source", "Issues"].map(h => (
                      <th key={h} style={{ padding: "0.5rem 1.125rem", fontWeight: "var(--font-weight-medium)", borderBottom: "1px solid var(--color-border-subtle)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} style={{ color: "var(--color-text-secondary)" }}>
                      <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{r.account_code ?? "—"}</td>
                      <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{r.account_name ?? "—"}</td>
                      <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{r.business_unit ?? "—"}</td>
                      <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(r.amount)}</td>
                      <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{r.currency ?? "—"}</td>
                      <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                        <select value={r.classification} onChange={e => void setClass(r.id, e.target.value)}
                          title={r.classification_source === "override" ? "Overridden by reviewer" : `Classified by ${r.classification_source}`}
                          style={{ height: "1.5rem", padding: "0 0.25rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
                            background: r.classification_source === "override" ? "var(--color-background-primary-soft)" : "var(--color-surface)",
                            color: "var(--color-text-secondary)", fontSize: "var(--font-text-xs-size)" }}>
                          {FINANCIAL_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-tertiary)" }} title="Traces to the original source cell">{r.source_locator}</td>
                      <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                        {r.issues.length > 0
                          ? <span style={{ color: "var(--color-text-caution-soft, #8a5a00)" }} title={r.issues.map(fmtIssue).join(", ")}>{r.issues.map(fmtIssue).join(", ")}</span>
                          : <span style={{ color: "var(--color-text-tertiary)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}
    </div>
  )
}

function SegmentationView({ engagementId }: { engagementId: string }) {
  const [segments, setSegments] = useState<FinancialSegmentRead[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")

  const refresh = useCallback(async () => {
    const list = await api.listFinancialSegments(engagementId)
    setSegments(list)
    setSelectedId(prev => prev ?? (list[0]?.id ?? null))
  }, [engagementId])

  useEffect(() => { void refresh() }, [refresh])

  async function create() {
    if (!newName.trim()) return
    const seg = await api.createFinancialSegment(engagementId, newName.trim())
    setNewName("")
    await refresh()
    setSelectedId(seg.id)
  }

  if (segments === null) return <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>Loading…</p>

  return (
    <div style={{ maxWidth: "56rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        {segments.map(s => (
          <button key={s.id} type="button" onClick={() => setSelectedId(s.id)} style={{
            padding: "0.3125rem 0.75rem", borderRadius: "9999px", border: "none", cursor: "pointer",
            background: s.id === selectedId ? "var(--color-background-primary-solid)" : "var(--alpha-04)",
            color: s.id === selectedId ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
            fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
          }}>{s.name}</button>
        ))}
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New segment name"
          onKeyDown={e => { if (e.key === "Enter") void create() }}
          style={{ height: "var(--control-size-md)", padding: "0 0.625rem", borderRadius: "var(--control-radius-md)",
            border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "var(--font-text-sm-size)" }} />
        <button type="button" onClick={create} style={toolbarBtn}><Plus size={13} /> Add segment</button>
      </div>

      {selectedId
        ? <SegmentDetail key={selectedId} segmentId={selectedId} />
        : <Placeholder title="No segment yet" body="Create a segment above, then add include/exclude rules to isolate the financial result for a controlled transaction or business unit." />}
    </div>
  )
}

function SegmentDetail({ segmentId }: { segmentId: string }) {
  const [seg, setSeg] = useState<FinancialSegmentRead | null>(null)
  const [pnl, setPnl] = useState<SegmentPnL | null>(null)
  const [rows, setRows] = useState<FinancialRowRead[] | null>(null)
  const [showRows, setShowRows] = useState(false)
  const [field, setField] = useState<string>(SEGMENT_RULE_FIELDS[0])
  const [operator, setOperator] = useState<string>(SEGMENT_RULE_OPERATORS[0])
  const [value, setValue] = useState("")
  const [action, setAction] = useState("include")
  const [reason, setReason] = useState("")
  const [adjType, setAdjType] = useState<string>(FINANCIAL_ADJUSTMENT_TYPES[0])
  const [adjAccount, setAdjAccount] = useState("")
  const [adjAmount, setAdjAmount] = useState("")
  const [adjReason, setAdjReason] = useState("")
  const [allocPool, setAllocPool] = useState("")
  const [allocAmount, setAllocAmount] = useState("")
  const [allocBase, setAllocBase] = useState<string>(FINANCIAL_ALLOCATION_BASES[0])
  const [allocPct, setAllocPct] = useState("")
  const [allocSource, setAllocSource] = useState("")

  const refresh = useCallback(async () => {
    const [s, p] = await Promise.all([api.getFinancialSegment(segmentId), api.getSegmentPnl(segmentId)])
    setSeg(s); setPnl(p)
    if (showRows) setRows((await api.getSegmentRows(segmentId, 100, 0)).rows)
  }, [segmentId, showRows])

  useEffect(() => { void refresh() }, [refresh])

  async function addRule() {
    if (!value.trim()) return
    await api.addSegmentRule(segmentId, { field, operator, value: value.trim(), action, reason: reason.trim() || undefined })
    setValue(""); setReason("")
    await refresh()
  }
  async function delRule(id: string) { await api.deleteSegmentRule(id); await refresh() }

  async function addAdj() {
    const amt = parseFloat(adjAmount)
    if (Number.isNaN(amt)) return
    await api.addSegmentAdjustment(segmentId, {
      adjustment_type: adjType, adjustment_amount: amt,
      account_ref: adjAccount.trim() || undefined, reason: adjReason.trim() || undefined,
    })
    setAdjAccount(""); setAdjAmount(""); setAdjReason("")
    await refresh()
  }
  async function delAdj(id: string) { await api.deleteSegmentAdjustment(id); await refresh() }

  async function addAlloc() {
    const pool = parseFloat(allocAmount), pct = parseFloat(allocPct)
    if (!allocPool.trim() || Number.isNaN(pool) || Number.isNaN(pct)) return
    await api.addSegmentAllocation(segmentId, {
      cost_pool: allocPool.trim(), pool_amount: pool, allocation_base: allocBase, allocation_percentage: pct,
      source: allocSource.trim() || undefined,
    })
    setAllocPool(""); setAllocAmount(""); setAllocPct(""); setAllocSource("")
    await refresh()
  }
  async function delAlloc(id: string) { await api.deleteSegmentAllocation(id); await refresh() }

  if (!seg || !pnl) return <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>Loading…</p>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ border: "1px solid var(--color-border)", borderRadius: "0.75rem", padding: "1rem 1.125rem", background: "var(--color-surface)" }}>
        <div style={{ fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--color-text-secondary)", marginBottom: "0.625rem" }}>Membership rules</div>
        {seg.rules.length === 0 && <p style={{ margin: "0 0 0.625rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>No rules yet — add an include rule to bring accounts into this segment.</p>}
        {seg.rules.map(r => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", padding: "0.25rem 0" }}>
            <span style={{ padding: "0.0625rem 0.375rem", borderRadius: "9999px", background: r.action === "exclude" ? "var(--color-background-caution-soft, #fff8e5)" : "var(--alpha-06)" }}>{r.action}</span>
            <span>{r.field.replace(/_/g, " ")} {r.operator} “{r.value}”</span>
            {r.reason && <span style={{ color: "var(--color-text-tertiary)" }}>· {r.reason}</span>}
            <button type="button" onClick={() => void delRule(r.id)} style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)" }} title="Remove rule"><Trash2 size={13} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.75rem" }}>
          <select value={action} onChange={e => setAction(e.target.value)} style={miniSelect}><option value="include">include</option><option value="exclude">exclude</option></select>
          <select value={field} onChange={e => setField(e.target.value)} style={miniSelect}>{SEGMENT_RULE_FIELDS.map(f => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}</select>
          <select value={operator} onChange={e => setOperator(e.target.value)} style={miniSelect}>{SEGMENT_RULE_OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}</select>
          <input value={value} onChange={e => setValue(e.target.value)} placeholder="value" style={{ ...miniSelect, width: "8rem" }} />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="reason (optional)" style={{ ...miniSelect, width: "12rem" }} />
          <button type="button" onClick={addRule} style={toolbarBtn}><Plus size={13} /> Add rule</button>
        </div>
      </div>

      <div style={{ border: "1px solid var(--color-border)", borderRadius: "0.75rem", overflow: "hidden", background: "var(--color-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0.875rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <div style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>Segmented P&amp;L</div>
          <button type="button" onClick={() => setShowRows(v => !v)} style={{ ...toolbarBtn, marginLeft: "auto" }}>{showRows ? "Hide" : "Drill to"} rows ({pnl.row_count})</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-text-xs-size)" }}>
          <tbody>
            {pnl.lines.map(ln => (
              <tr key={ln.classification} style={{ color: "var(--color-text-secondary)" }}>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{ln.classification.replace(/_/g, " ")}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-tertiary)" }}>{ln.row_count} rows</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(ln.total)}</td>
              </tr>
            ))}
            <tr style={{ color: "var(--color-text)", fontWeight: "var(--font-weight-semibold)" }}>
              <td style={{ padding: "0.5rem 1.125rem" }}>Operating result</td>
              <td />
              <td style={{ padding: "0.5rem 1.125rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(pnl.operating_result)} {pnl.currency ?? ""}</td>
            </tr>
            {pnl.adjustments.length > 0 && (
              <tr style={{ color: "var(--color-text-secondary)" }}>
                <td style={{ padding: "0.4375rem 1.125rem" }}>Adjustments</td>
                <td style={{ padding: "0.4375rem 1.125rem", color: "var(--color-text-tertiary)" }}>{pnl.adjustments.length}</td>
                <td style={{ padding: "0.4375rem 1.125rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(pnl.adjustments_total)}</td>
              </tr>
            )}
            {pnl.allocations.length > 0 && (
              <tr style={{ color: "var(--color-text-secondary)" }}>
                <td style={{ padding: "0.4375rem 1.125rem" }}>Allocations</td>
                <td style={{ padding: "0.4375rem 1.125rem", color: "var(--color-text-tertiary)" }}>{pnl.allocations.length}</td>
                <td style={{ padding: "0.4375rem 1.125rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(pnl.allocations_total)}</td>
              </tr>
            )}
            {(pnl.adjustments.length > 0 || pnl.allocations.length > 0) && (
              <tr style={{ color: "var(--color-text)", fontWeight: "var(--font-weight-semibold)", borderTop: "2px solid var(--color-border)" }}>
                <td style={{ padding: "0.5rem 1.125rem" }}>Adjusted operating result</td>
                <td />
                <td style={{ padding: "0.5rem 1.125rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(pnl.adjusted_operating_result)} {pnl.currency ?? ""}</td>
              </tr>
            )}
          </tbody>
        </table>
        {showRows && rows && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-text-xs-size)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <thead><tr style={{ color: "var(--color-text-tertiary)", textAlign: "left" }}>{["Account", "Name", "Amount", "Class", "Source"].map(h => <th key={h} style={{ padding: "0.5rem 1.125rem", fontWeight: "var(--font-weight-medium)" }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ color: "var(--color-text-secondary)" }}>
                  <td style={{ padding: "0.4375rem 1.125rem" }}>{r.account_code ?? "—"}</td>
                  <td style={{ padding: "0.4375rem 1.125rem" }}>{r.account_name ?? "—"}</td>
                  <td style={{ padding: "0.4375rem 1.125rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(r.amount)}</td>
                  <td style={{ padding: "0.4375rem 1.125rem" }}>{r.classification.replace(/_/g, " ")}</td>
                  <td style={{ padding: "0.4375rem 1.125rem", color: "var(--color-text-tertiary)" }} title="Traces to the original source cell">{r.source_locator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Adjustment workpaper (§61) — auditable amount adjustments; raw rows are never mutated (§75) */}
      <div style={{ border: "1px solid var(--color-border)", borderRadius: "0.75rem", overflow: "hidden", background: "var(--color-surface)" }}>
        <div style={{ padding: "0.875rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>Adjustment workpaper</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-text-xs-size)" }}>
          <thead><tr style={{ color: "var(--color-text-tertiary)", textAlign: "left" }}>{["Account", "Original", "Treatment", "Adjustment", "Reason", ""].map((h, i) => <th key={i} style={{ padding: "0.5rem 1.125rem", fontWeight: "var(--font-weight-medium)", borderBottom: "1px solid var(--color-border-subtle)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {pnl.adjustments.map(a => (
              <tr key={a.id} style={{ color: "var(--color-text-secondary)" }}>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{a.account_ref ?? "—"}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{a.original_amount === null ? "—" : fmtNum(a.original_amount)}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{a.adjustment_type.replace(/_/g, " ")}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(a.adjustment_amount)}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-tertiary)" }}>{a.reason ?? "—"}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <button type="button" onClick={() => void delAdj(a.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)" }} title="Remove adjustment"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {pnl.adjustments.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "0.625rem 1.125rem", color: "var(--color-text-tertiary)" }}>No adjustments — the raw figures stand.</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center", padding: "0.75rem 1.125rem", borderTop: "1px solid var(--color-border-subtle)" }}>
          <select value={adjType} onChange={e => setAdjType(e.target.value)} style={miniSelect}>{FINANCIAL_ADJUSTMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select>
          <input value={adjAccount} onChange={e => setAdjAccount(e.target.value)} placeholder="account / target" style={{ ...miniSelect, width: "9rem" }} />
          <input value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="amount (+/-)" inputMode="decimal" style={{ ...miniSelect, width: "7rem" }} />
          <input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="reason" style={{ ...miniSelect, width: "12rem" }} />
          <button type="button" onClick={addAdj} style={toolbarBtn}><Plus size={13} /> Add adjustment</button>
        </div>
      </div>

      {/* Allocations (§22-23) — shared-cost pools split by a base; allocated amount computed server-side */}
      <div style={{ border: "1px solid var(--color-border)", borderRadius: "0.75rem", overflow: "hidden", background: "var(--color-surface)" }}>
        <div style={{ padding: "0.875rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>Allocations</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-text-xs-size)" }}>
          <thead><tr style={{ color: "var(--color-text-tertiary)", textAlign: "left" }}>{["Cost pool", "Pool", "Base", "%", "Allocated", "Source", ""].map((h, i) => <th key={i} style={{ padding: "0.5rem 1.125rem", fontWeight: "var(--font-weight-medium)", borderBottom: "1px solid var(--color-border-subtle)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {pnl.allocations.map(a => (
              <tr key={a.id} style={{ color: "var(--color-text-secondary)" }}>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{a.cost_pool}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(a.pool_amount)}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{a.allocation_base.replace(/_/g, " ")}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", textAlign: "right" }}>{a.allocation_percentage}%</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(a.allocated_amount)}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-tertiary)" }}>{a.source ?? "—"}</td>
                <td style={{ padding: "0.4375rem 1.125rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <button type="button" onClick={() => void delAlloc(a.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)" }} title="Remove allocation"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {pnl.allocations.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "0.625rem 1.125rem", color: "var(--color-text-tertiary)" }}>No allocations.</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center", padding: "0.75rem 1.125rem", borderTop: "1px solid var(--color-border-subtle)" }}>
          <input value={allocPool} onChange={e => setAllocPool(e.target.value)} placeholder="cost pool" style={{ ...miniSelect, width: "9rem" }} />
          <input value={allocAmount} onChange={e => setAllocAmount(e.target.value)} placeholder="pool amount" inputMode="decimal" style={{ ...miniSelect, width: "7rem" }} />
          <select value={allocBase} onChange={e => setAllocBase(e.target.value)} style={miniSelect}>{FINANCIAL_ALLOCATION_BASES.map(b => <option key={b} value={b}>{b.replace(/_/g, " ")}</option>)}</select>
          <input value={allocPct} onChange={e => setAllocPct(e.target.value)} placeholder="%" inputMode="decimal" style={{ ...miniSelect, width: "4.5rem" }} />
          <input value={allocSource} onChange={e => setAllocSource(e.target.value)} placeholder="source of base" style={{ ...miniSelect, width: "11rem" }} />
          <button type="button" onClick={addAlloc} style={toolbarBtn}><Plus size={13} /> Allocate</button>
        </div>
      </div>
    </div>
  )
}
