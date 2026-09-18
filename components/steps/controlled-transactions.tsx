"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Upload, Download, Plus, Trash2, AlertTriangle, Check } from "lucide-react"
import {
  api,
  CT_CATEGORIES,
  CT_DIRECTIONS,
  type ControlledTransaction,
  type ControlledTransactionInput,
  type LocalFileProject,
  type TxnPreview,
} from "@/lib/api"
import { Animate } from "@/components/ui/transition"
import { SelectControl } from "@/components/ui/select-control"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Validation issue codes (ct_intake) → human labels for the Excel preview.
const ISSUE_LABELS: Record<string, string> = {
  missing_category: "Missing transaction category",
  unknown_category: "Unrecognised category",
  missing_associated_enterprise: "Missing associated enterprise",
  invalid_country: "Invalid country",
  invalid_currency: "Invalid currency (use 3-letter ISO)",
  malformed_amount: "Amount is not a number",
  invalid_direction: "Direction must be payment or receipt",
  fiscal_period_mismatch: "Period outside the statutory year",
  duplicate_transaction: "Duplicate of another row",
}
const BLOCKING = new Set(["missing_category", "missing_associated_enterprise"])

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; document.body.appendChild(a); a.click()
  a.remove(); URL.revokeObjectURL(url)
}

const fmtAmount = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString())

// The add/edit form holds every field as a string so the inputs stay controlled; converted on save.
interface Form {
  transaction_category: string; description: string
  associated_enterprise_name: string; associated_enterprise_country: string; direction: string
  local_currency: string; local_currency_amount: string
  group_currency: string; group_currency_amount: string
  period_start: string; period_end: string; materiality_status: string; notes: string
}
const EMPTY_FORM: Form = {
  transaction_category: "services", description: "",
  associated_enterprise_name: "", associated_enterprise_country: "", direction: "payment",
  local_currency: "", local_currency_amount: "", group_currency: "", group_currency_amount: "",
  period_start: "", period_end: "", materiality_status: "", notes: "",
}
function formFromTxn(t: ControlledTransaction): Form {
  return {
    transaction_category: t.transaction_category, description: t.description ?? "",
    associated_enterprise_name: t.associated_enterprise_name ?? "",
    associated_enterprise_country: t.associated_enterprise_country ?? "", direction: t.direction,
    local_currency: t.local_currency ?? "", local_currency_amount: t.local_currency_amount != null ? String(t.local_currency_amount) : "",
    group_currency: t.group_currency ?? "", group_currency_amount: t.group_currency_amount != null ? String(t.group_currency_amount) : "",
    period_start: t.period_start ?? "", period_end: t.period_end ?? "",
    materiality_status: t.materiality_status ?? "", notes: t.notes ?? "",
  }
}
function bodyFromForm(f: Form): ControlledTransactionInput {
  const num = (s: string) => (s.trim() === "" ? null : Number(s))
  return {
    transaction_category: f.transaction_category,
    description: f.description || null,
    associated_enterprise_name: f.associated_enterprise_name || null,
    associated_enterprise_country: f.associated_enterprise_country || null,
    direction: f.direction,
    local_currency: f.local_currency || null, local_currency_amount: num(f.local_currency_amount),
    group_currency: f.group_currency || null, group_currency_amount: num(f.group_currency_amount),
    period_start: f.period_start || null, period_end: f.period_end || null,
    materiality_status: f.materiality_status || null, notes: f.notes || null,
  }
}

const label = { fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)" as const, color: "var(--color-text-tertiary)", marginBottom: "0.25rem" }
const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column" }

export default function ControlledTransactionsStep({ engagementId, jurisdictions, activeJurisdiction, onJurisdictionChange, onContinue }: {
  engagementId: string | null
  jurisdictions: string[]
  activeJurisdiction: string
  onJurisdictionChange: (jurisdiction: string) => void
  onContinue: () => void
}) {
  const [projectByJuris, setProjectByJuris] = useState<Record<string, LocalFileProject>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Header (project details) editing
  const [header, setHeader] = useState({
    statutory_period_start: "", statutory_period_end: "", statutory_currency: "",
    consolidation_period_start: "", consolidation_period_end: "", group_reporting_currency: "", status: "draft",
  })
  const [savingHeader, setSavingHeader] = useState(false)

  // Add/edit panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [savingTxn, setSavingTxn] = useState(false)

  // Excel flow
  const [preview, setPreview] = useState<TxnPreview | null>(null)
  const [previewName, setPreviewName] = useState("")
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const project = projectByJuris[activeJurisdiction] ?? null

  const loadProject = useCallback(async (j: string) => {
    if (!engagementId || !j) return
    setLoading(true); setError(null)
    try {
      const p = await api.getLocalFile(engagementId, j)
      setProjectByJuris(prev => ({ ...prev, [j]: p }))
    } catch (e) {
      console.error("[veritax] load local file project failed:", e)
      setError("Could not load the Local File project. Retry.")
    } finally {
      setLoading(false)
    }
  }, [engagementId])

  useEffect(() => {
    if (engagementId && activeJurisdiction && !projectByJuris[activeJurisdiction]) void loadProject(activeJurisdiction)
  }, [engagementId, activeJurisdiction, projectByJuris, loadProject])

  // Sync the header editor whenever the active project loads/changes.
  useEffect(() => {
    if (!project) return
    setHeader({
      statutory_period_start: project.statutory_period_start ?? "",
      statutory_period_end: project.statutory_period_end ?? "",
      statutory_currency: project.statutory_currency ?? "",
      consolidation_period_start: project.consolidation_period_start ?? "",
      consolidation_period_end: project.consolidation_period_end ?? "",
      group_reporting_currency: project.group_reporting_currency ?? "",
      status: project.status ?? "draft",
    })
  }, [project])

  function selectJurisdiction(j: string) {
    onJurisdictionChange(j); setPreview(null); setPreviewFile(null); setImportMsg(null); setPanelOpen(false)
  }

  async function saveHeader() {
    if (!project) return
    setSavingHeader(true); setError(null)
    try {
      const p = await api.patchLocalFileProject(project.id, {
        statutory_period_start: header.statutory_period_start || null,
        statutory_period_end: header.statutory_period_end || null,
        statutory_currency: header.statutory_currency || null,
        consolidation_period_start: header.consolidation_period_start || null,
        consolidation_period_end: header.consolidation_period_end || null,
        group_reporting_currency: header.group_reporting_currency || null,
        status: header.status,
      })
      setProjectByJuris(prev => ({ ...prev, [activeJurisdiction]: p }))
    } catch (e) {
      console.error("[veritax] save project details failed:", e)
      setError("Could not save project details. Retry.")
    } finally {
      setSavingHeader(false)
    }
  }

  function openAdd() { setEditingId(null); setForm(EMPTY_FORM); setPanelOpen(true) }
  function openEdit(t: ControlledTransaction) { setEditingId(t.id); setForm(formFromTxn(t)); setPanelOpen(true) }

  async function saveTxn() {
    if (!project) return
    setSavingTxn(true); setError(null)
    try {
      if (editingId) await api.updateTransaction(editingId, bodyFromForm(form))
      else await api.createTransaction(project.id, bodyFromForm(form))
      await loadProject(activeJurisdiction)
      setPanelOpen(false)
    } catch (e) {
      console.error("[veritax] save transaction failed:", e)
      setError("Could not save the transaction. Check the fields and retry.")
    } finally {
      setSavingTxn(false)
    }
  }

  async function removeTxn(t: ControlledTransaction) {
    setError(null)
    try {
      await api.deleteTransaction(t.id)
      await loadProject(activeJurisdiction)
    } catch (e) {
      console.error("[veritax] delete transaction failed:", e)
      setError("Could not delete the transaction. Retry.")
    }
  }

  async function downloadTemplate() {
    if (!engagementId) return
    try {
      const blob = await api.downloadTransactionTemplate(engagementId)
      triggerDownload(blob, "controlled-transactions-template.xlsx")
    } catch (e) {
      console.error("[veritax] template download failed:", e)
      setError("Could not download the template. Retry.")
    }
  }

  async function onPreviewFile(file: File) {
    if (!project) return
    setBusy(true); setError(null); setImportMsg(null); setPreviewFile(file); setPreviewName(file.name)
    try {
      setPreview(await api.previewTransactions(project.id, file))
    } catch (e) {
      console.error("[veritax] preview transactions failed:", e)
      setError("Could not read that file. Use the template (XLSX/CSV).")
      setPreview(null); setPreviewFile(null)
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!project || !previewFile) return
    setBusy(true); setError(null)
    try {
      const res = await api.importTransactions(project.id, previewFile)
      setProjectByJuris(prev => ({ ...prev, [activeJurisdiction]: { ...project, transactions: res.transactions } }))
      setImportMsg(`Imported ${res.imported} transaction${res.imported === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} skipped (missing category or associated enterprise)` : ""}.`)
      setPreview(null); setPreviewFile(null)
    } catch (e) {
      console.error("[veritax] import transactions failed:", e)
      setError("Import failed. Retry.")
    } finally {
      setBusy(false)
    }
  }

  if (!engagementId) {
    return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Preparing session…</main>
  }
  if (jurisdictions.length === 0) {
    return <main style={{ flex: 1, padding: "3rem 3.5rem", color: "var(--color-text-tertiary)" }}>Select a jurisdiction in Planning first.</main>
  }

  const txns = project?.transactions ?? []

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>

        {/* Jurisdiction tabs + continue */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--color-surface)", padding: "1rem 3.5rem 0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            {jurisdictions.map(j => {
              const isActive = j === activeJurisdiction
              return (
                <button key={j} type="button" onClick={() => selectJurisdiction(j)} style={{
                  display: "inline-flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "none", cursor: "pointer",
                  background: isActive ? "var(--color-background-primary-solid)" : "var(--alpha-06)",
                  color: isActive ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                  fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
                  transition: "all var(--transition-duration-basic)",
                }}>{j}</button>
              )
            })}
          </div>
          <Button size="md" onClick={onContinue}>Continue to Requirements</Button>
        </div>

        <div style={{ padding: "1.5rem 3.5rem 3rem", maxWidth: 900 }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <h1 style={{ fontSize: "var(--font-text-xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.375rem" }}>
              Which related-party transactions does this file cover?
            </h1>
            <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>
              The Local File begins with its controlled-transaction population. Enter each transaction at the
              TP-category level (e.g. “Provision of IT services — US Parent — INR 84M”), not individual invoices.
              <span style={{ color: "var(--color-text-tertiary)" }}> · {activeJurisdiction}</span>
            </p>
          </div>

          {error && (
            <div style={{ margin: "0 0 1rem", padding: "0.625rem 0.875rem", border: "1px solid var(--color-border-danger)", borderRadius: "var(--radius-md)", background: "var(--color-background-danger-soft)", color: "var(--color-text-danger-soft)", fontSize: "var(--font-text-sm-size)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {loading && !project ? (
            <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>
              <Loader2 size={14} className="animate-spin" /> Loading {activeJurisdiction}…
            </p>
          ) : null}

          {/* Project / fiscal-year header */}
          {project && (
            <div style={{ margin: "0 0 1.25rem", padding: "1rem 1.125rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-background-secondary)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "var(--font-text-xs-size)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", margin: 0 }}>
                  Fiscal-year workspace · FY {project.fiscal_year ?? "—"}
                </p>
                <Button size="sm" variant="outline" loading={savingHeader} onClick={saveHeader}>Save details</Button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
                <div style={fieldWrap}>
                  <span style={label}>Statutory period start</span>
                  <Input type="date" controlSize="sm" value={header.statutory_period_start} onChange={e => setHeader(h => ({ ...h, statutory_period_start: e.target.value }))} />
                </div>
                <div style={fieldWrap}>
                  <span style={label}>Statutory period end</span>
                  <Input type="date" controlSize="sm" value={header.statutory_period_end} onChange={e => setHeader(h => ({ ...h, statutory_period_end: e.target.value }))} />
                </div>
                <div style={fieldWrap}>
                  <span style={label}>Statutory (local) currency</span>
                  <Input controlSize="sm" placeholder="INR" value={header.statutory_currency} onChange={e => setHeader(h => ({ ...h, statutory_currency: e.target.value.toUpperCase() }))} />
                </div>
                <div style={fieldWrap}>
                  <span style={label}>Status</span>
                  <SelectControl size="sm" block value={header.status} onValueChange={v => setHeader(h => ({ ...h, status: v }))}>
                    {["draft", "in_progress", "complete"].map(s => <SelectControl.Item key={s} value={s}>{s.replace("_", " ")}</SelectControl.Item>)}
                  </SelectControl>
                </div>
                <div style={fieldWrap}>
                  <span style={label}>Group consolidation start</span>
                  <Input type="date" controlSize="sm" value={header.consolidation_period_start} onChange={e => setHeader(h => ({ ...h, consolidation_period_start: e.target.value }))} />
                </div>
                <div style={fieldWrap}>
                  <span style={label}>Group consolidation end</span>
                  <Input type="date" controlSize="sm" value={header.consolidation_period_end} onChange={e => setHeader(h => ({ ...h, consolidation_period_end: e.target.value }))} />
                </div>
                <div style={fieldWrap}>
                  <span style={label}>Group reporting currency</span>
                  <Input controlSize="sm" placeholder="USD" value={header.group_reporting_currency} onChange={e => setHeader(h => ({ ...h, group_reporting_currency: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: "0.75rem 0 0" }}>
                Local statutory periods are kept separate from the group consolidation period so the same relationship can show different amounts across jurisdictions.
              </p>
            </div>
          )}

          {/* Excel workflow */}
          {project && (
            <div style={{ margin: "0 0 1.25rem", padding: "1rem 1.125rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)", margin: "0 0 0.125rem" }}>Bulk import from Excel</p>
                  <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0 }}>Download the template, fill it offline, then upload to validate and import.</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button size="sm" variant="outline" onClick={downloadTemplate}><Download size={14} /> Template</Button>
                  <label style={{ display: "inline-flex" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-sm)", borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent", fontSize: "var(--control-font-size-md)", color: "var(--color-text-secondary)", cursor: busy ? "not-allowed" : "pointer" }}>
                      <Upload size={14} /> Upload
                    </span>
                    <input type="file" accept=".xlsx,.xlsm,.xls,.csv" style={{ display: "none" }} disabled={busy} onChange={e => {
                      const f = e.target.files?.[0]; if (f) void onPreviewFile(f); e.currentTarget.value = ""
                    }} />
                  </label>
                </div>
              </div>
              {importMsg && (
                <p style={{ margin: "0.75rem 0 0", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-success-soft)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <Check size={14} /> {importMsg}
                </p>
              )}

              {/* Preview (before import) */}
              {preview && (
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", margin: 0 }}>
                      {previewName} · {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"}
                      {preview.diagnostics.rows_with_issues > 0 && <span style={{ color: "var(--color-text-caution-soft)" }}> · {preview.diagnostics.rows_with_issues} with issues</span>}
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button size="sm" variant="ghost" onClick={() => { setPreview(null); setPreviewFile(null) }}>Cancel</Button>
                      <Button size="sm" loading={busy} onClick={runImport}>Import {preview.rows.filter(r => !r.issues.some(i => BLOCKING.has(i))).length} rows</Button>
                    </div>
                  </div>
                  {preview.diagnostics.missing_required_columns.length > 0 && (
                    <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-danger-soft)", margin: "0 0 0.5rem" }}>
                      Missing required column(s): {preview.diagnostics.missing_required_columns.join(", ")}
                    </p>
                  )}
                  <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "var(--font-text-xs-size)" }}>
                      <thead>
                        <tr style={{ background: "var(--color-background-secondary)", textAlign: "left" }}>
                          {["Category", "AE", "Country", "Direction", "Local amount", "Ccy", "Issues"].map(h => (
                            <th key={h} style={{ padding: "0.4rem 0.6rem", fontWeight: "var(--font-weight-medium)", color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i) => {
                          const v = r.values as Record<string, unknown>
                          const blocked = r.issues.some(x => BLOCKING.has(x))
                          return (
                            <tr key={i} style={{ borderTop: "1px solid var(--color-border)", opacity: blocked ? 0.6 : 1 }}>
                              <td style={{ padding: "0.4rem 0.6rem" }}>{String(v.transaction_category ?? "—")}</td>
                              <td style={{ padding: "0.4rem 0.6rem" }}>{String(v.associated_enterprise_name ?? "—")}</td>
                              <td style={{ padding: "0.4rem 0.6rem" }}>{String(v.associated_enterprise_country ?? "—")}</td>
                              <td style={{ padding: "0.4rem 0.6rem" }}>{String(v.direction ?? "—")}</td>
                              <td style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>{v.local_currency_amount == null ? "—" : Number(v.local_currency_amount).toLocaleString()}</td>
                              <td style={{ padding: "0.4rem 0.6rem" }}>{String(v.local_currency ?? "—")}</td>
                              <td style={{ padding: "0.4rem 0.6rem" }}>
                                {r.issues.length === 0
                                  ? <span style={{ color: "var(--color-text-success-soft)" }}>OK</span>
                                  : r.issues.map(code => (
                                      <span key={code} title={ISSUE_LABELS[code] ?? code} style={{ display: "inline-block", marginRight: 4, padding: "1px 6px", borderRadius: "9999px", background: BLOCKING.has(code) ? "var(--color-background-danger-soft)" : "var(--color-background-caution-soft)", color: BLOCKING.has(code) ? "var(--color-text-danger-soft)" : "var(--color-text-caution-soft)", whiteSpace: "nowrap" }}>{ISSUE_LABELS[code] ?? code}</span>
                                    ))}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transactions table */}
          {project && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <p style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)", margin: 0 }}>
                  Controlled transactions · {txns.length}
                </p>
                <Button size="sm" variant="outline" onClick={openAdd}><Plus size={14} /> Add transaction</Button>
              </div>
              {txns.length === 0 ? (
                <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)", padding: "1.5rem 0", textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-md)" }}>
                  No transactions yet. Add one, or import the Excel template above.
                </p>
              ) : (
                <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "var(--font-text-sm-size)" }}>
                    <thead>
                      <tr style={{ background: "var(--color-background-secondary)", textAlign: "left" }}>
                        {["Transaction", "AE", "Country", "Direction", "Amount", "Ccy", ""].map((h, i) => (
                          <th key={i} style={{ padding: "0.5rem 0.7rem", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map(t => (
                        <tr key={t.id} onClick={() => openEdit(t)} style={{ borderTop: "1px solid var(--color-border)", cursor: "pointer" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--color-background-primary-ghost-hover)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={{ padding: "0.5rem 0.7rem" }}>
                            <span style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{t.transaction_category}</span>
                            {t.description && <span style={{ color: "var(--color-text-tertiary)" }}> — {t.description}</span>}
                          </td>
                          <td style={{ padding: "0.5rem 0.7rem" }}>{t.associated_enterprise_name ?? "—"}</td>
                          <td style={{ padding: "0.5rem 0.7rem" }}>{t.associated_enterprise_country ?? "—"}</td>
                          <td style={{ padding: "0.5rem 0.7rem" }}>{t.direction}</td>
                          <td style={{ padding: "0.5rem 0.7rem", textAlign: "right", whiteSpace: "nowrap" }}>{fmtAmount(t.local_currency_amount)}</td>
                          <td style={{ padding: "0.5rem 0.7rem" }}>{t.local_currency ?? "—"}</td>
                          <td style={{ padding: "0.5rem 0.7rem", textAlign: "right" }}>
                            <button type="button" aria-label="Delete" title="Delete" onClick={e => { e.stopPropagation(); void removeTxn(t) }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 2 }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / edit panel */}
      {panelOpen && (
        <Animate as="aside" enter="slide-up" duration={150} style={{ width: 380, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-border)", padding: "1rem 1.25rem" }}>
            <span style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>{editingId ? "Edit transaction" : "Add transaction"}</span>
            <button type="button" aria-label="Close" onClick={() => setPanelOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
          </div>
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={fieldWrap}>
              <span style={label}>Transaction category</span>
              <SelectControl size="sm" block value={form.transaction_category} onValueChange={v => setForm(f => ({ ...f, transaction_category: v }))}>
                {CT_CATEGORIES.map(c => <SelectControl.Item key={c} value={c}>{c}</SelectControl.Item>)}
              </SelectControl>
            </div>
            <div style={fieldWrap}>
              <span style={label}>Description</span>
              <Input controlSize="sm" placeholder="Provision of IT services" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={fieldWrap}>
              <span style={label}>Associated enterprise</span>
              <Input controlSize="sm" placeholder="US Parent Inc" value={form.associated_enterprise_name} onChange={e => setForm(f => ({ ...f, associated_enterprise_name: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
              <div style={fieldWrap}>
                <span style={label}>AE country</span>
                <Input controlSize="sm" placeholder="US" value={form.associated_enterprise_country} onChange={e => setForm(f => ({ ...f, associated_enterprise_country: e.target.value }))} />
              </div>
              <div style={fieldWrap}>
                <span style={label}>Direction</span>
                <SelectControl size="sm" block value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v }))}>
                  {CT_DIRECTIONS.map(d => <SelectControl.Item key={d} value={d}>{d}</SelectControl.Item>)}
                </SelectControl>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
              <div style={fieldWrap}>
                <span style={label}>Local currency</span>
                <Input controlSize="sm" placeholder="INR" value={form.local_currency} onChange={e => setForm(f => ({ ...f, local_currency: e.target.value.toUpperCase() }))} />
              </div>
              <div style={fieldWrap}>
                <span style={label}>Local amount</span>
                <Input controlSize="sm" type="number" inputMode="decimal" placeholder="84000000" value={form.local_currency_amount} onChange={e => setForm(f => ({ ...f, local_currency_amount: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
              <div style={fieldWrap}>
                <span style={label}>Group currency</span>
                <Input controlSize="sm" placeholder="USD" value={form.group_currency} onChange={e => setForm(f => ({ ...f, group_currency: e.target.value.toUpperCase() }))} />
              </div>
              <div style={fieldWrap}>
                <span style={label}>Group amount</span>
                <Input controlSize="sm" type="number" inputMode="decimal" placeholder="1000000" value={form.group_currency_amount} onChange={e => setForm(f => ({ ...f, group_currency_amount: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
              <div style={fieldWrap}>
                <span style={label}>Period start</span>
                <Input controlSize="sm" type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
              </div>
              <div style={fieldWrap}>
                <span style={label}>Period end</span>
                <Input controlSize="sm" type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
              </div>
            </div>
            <div style={fieldWrap}>
              <span style={label}>Materiality</span>
              <Input controlSize="sm" placeholder="material" value={form.materiality_status} onChange={e => setForm(f => ({ ...f, materiality_status: e.target.value }))} />
            </div>
            <div style={fieldWrap}>
              <span style={label}>Notes</span>
              <Input controlSize="sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              <Button size="sm" loading={savingTxn} disabled={!form.transaction_category} onClick={saveTxn}>{editingId ? "Save changes" : "Add transaction"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)}>Cancel</Button>
            </div>
          </div>
        </Animate>
      )}
    </div>
  )
}
