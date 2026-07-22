"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { registerLicense } from "@syncfusion/ej2-base"
import {
  DocumentEditorComponent, Editor, Selection, EditorHistory, SfdtExport, WordExport,
} from "@syncfusion/ej2-react-documenteditor"
import { Pencil, Check, Bold, Italic, Underline, List, ListOrdered, Undo2, Redo2, Download } from "lucide-react"

// Base editor + only the modules we use — no ribbon, no properties pane, no "weird functions".
DocumentEditorComponent.Inject(Editor, Selection, EditorHistory, SfdtExport, WordExport)

const LICENSE = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY
if (LICENSE) registerLicense(LICENSE)

const CSS_HREF = "https://cdn.syncfusion.com/ej2/34.1.30/material.css"

export interface DocNavItem { order: number; name: string; bookmark: string }

export default function DraftDocEditor({ sfdt, fileName, sections }: { sfdt: string; fileName: string; sections: DocNavItem[] }) {
  const ref = useRef<DocumentEditorComponent>(null)
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (document.querySelector(`link[href="${CSS_HREF}"]`)) return
    const link = document.createElement("link")
    link.rel = "stylesheet"; link.href = CSS_HREF
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    if (!ready) return
    const ed = ref.current
    if (ed && sfdt) { try { ed.open(sfdt) } catch (e) { console.error("[veritax] SFDT open failed:", e) } }
  }, [ready, sfdt])

  const run = (fn: (d: DocumentEditorComponent) => void) => { const d = ref.current; if (d) { try { fn(d) } catch (e) { console.error(e) } } }
  const goto = (bm: string) => run(d => d.selection.selectBookmark(bm))
  const download = () => run(d => d.save(fileName.replace(/[^\w]+/g, "-").replace(/^-|-$/g, ""), "Docx"))

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>

      {/* Minimal toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem 1rem", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <button type="button" onClick={() => setEditing(e => !e)} style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-md)",
          borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", cursor: "pointer",
          fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)",
          background: editing ? "var(--color-background-primary-soft)" : "transparent",
          color: editing ? "var(--color-text-info-solid)" : "var(--color-text-secondary)",
        }}>
          {editing ? <Check size={14} /> : <Pencil size={14} />}{editing ? "Done" : "Edit"}
        </button>

        {editing && (
          <>
            <Sep />
            <TBtn label="Bold" onDo={() => run(d => d.editor.toggleBold())}><Bold size={15} /></TBtn>
            <TBtn label="Italic" onDo={() => run(d => d.editor.toggleItalic())}><Italic size={15} /></TBtn>
            <TBtn label="Underline" onDo={() => run(d => d.editor.toggleUnderline("Single"))}><Underline size={15} /></TBtn>
            <Sep />
            <TBtn label="Bulleted list" onDo={() => run(d => d.editor.applyBullet("", "Symbol"))}><List size={15} /></TBtn>
            <TBtn label="Numbered list" onDo={() => run(d => d.editor.applyNumbering("%1.", "Arabic"))}><ListOrdered size={15} /></TBtn>
            <Sep />
            <TBtn label="Undo" onDo={() => run(d => d.editorHistory.undo())}><Undo2 size={15} /></TBtn>
            <TBtn label="Redo" onDo={() => run(d => d.editorHistory.redo())}><Redo2 size={15} /></TBtn>
          </>
        )}

        <button type="button" onClick={download} style={{
          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-md)",
          borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent",
          color: "var(--color-text-secondary)", fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer",
        }}>
          <Download size={14} /> Download .docx
        </button>
      </div>

      <DocumentEditorComponent
        ref={ref}
        height="100%"
        isReadOnly={!editing}
        enableEditor={true}
        enableSelection={true}
        enableEditorHistory={true}
        enableSfdtExport={true}
        enableWordExport={true}
        created={() => setReady(true)}
        style={{ display: "block", flex: 1, minHeight: 0 }}
      />

      {/* Floating section selector */}
      {sections.length > 0 && (
        <nav style={{
          position: "fixed", top: 168, right: 40, zIndex: 15, width: 210, maxHeight: "68vh", overflowY: "auto",
          background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-300)", padding: "0.75rem 0.5rem",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: "var(--font-weight-medium)", padding: "0 0.5rem", marginBottom: "0.375rem" }}>Sections</p>
          {sections.map(s => (
            <button key={s.bookmark} type="button" onClick={() => goto(s.bookmark)}
              className="hover:bg-[var(--color-background-primary-ghost-hover)]"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.5rem", textAlign: "left", width: "100%", border: "none", background: "transparent", cursor: "pointer", borderRadius: "var(--radius-md)" }}>
              <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", fontVariant: "tabular-nums", flexShrink: 0 }}>{String(s.order).padStart(2, "0")}</span>
              <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: "var(--color-border)", margin: "0 0.25rem" }} />
}

// onMouseDown + preventDefault keeps the editor selection so the command applies to the selected text.
function TBtn({ label, onDo, children }: { label: string; onDo: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label}
      onMouseDown={e => { e.preventDefault(); onDo() }}
      className="hover:bg-[var(--color-background-primary-ghost-hover)]"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "none", background: "transparent", borderRadius: "var(--radius-md)", cursor: "pointer", color: "var(--color-text-secondary)" }}>
      {children}
    </button>
  )
}
