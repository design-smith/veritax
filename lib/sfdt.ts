// Markdown → SFDT (Syncfusion Document Text). SFDT is the DocumentEditor's native, fully client-side
// format; Syncfusion paginates it into real A4 pages on its own. We build the minimal full-key SFDT
// (paragraphs, runs with bold/italic, headings, tables, lists) from our drafted Markdown.
import { marked } from "marked"

// A4 in points (1/72in): 210mm = 595.3, 297mm = 841.9; ~20mm margins = 56.7pt.
const A4_SECTION_FORMAT = {
  pageWidth: 595.3, pageHeight: 841.9,
  leftMargin: 56.7, rightMargin: 56.7, topMargin: 56.7, bottomMargin: 56.7,
}
const CONTENT_WIDTH = 595.3 - 56.7 * 2 // ≈ 481.9pt

type Fmt = { bold?: boolean; italic?: boolean; fontFamily?: string }
type Inline = { text: string; characterFormat?: Fmt }
type Run = Record<string, unknown>  // an inline run OR a bookmark marker
type Block = Record<string, unknown>

// Flatten marked inline tokens into SFDT runs, carrying bold/italic down the tree.
function inlines(tokens: unknown[] | undefined, base: Fmt = {}): Inline[] {
  const out: Inline[] = []
  const walk = (toks: unknown[], fmt: Fmt) => {
    for (const raw of toks ?? []) {
      const t = raw as { type: string; text?: string; raw?: string; tokens?: unknown[] }
      switch (t.type) {
        case "strong": walk(t.tokens ?? [], { ...fmt, bold: true }); break
        case "em": walk(t.tokens ?? [], { ...fmt, italic: true }); break
        case "codespan": out.push({ text: t.text ?? "", characterFormat: { ...fmt, fontFamily: "Consolas" } }); break
        case "link": walk(t.tokens ?? [], fmt); break
        case "br": out.push({ text: "\n" }); break
        case "text":
          if (t.tokens?.length) walk(t.tokens, fmt)
          else out.push({ text: t.text ?? "", characterFormat: { ...fmt } })
          break
        default:
          out.push({ text: t.text ?? t.raw ?? "", characterFormat: { ...fmt } })
      }
    }
  }
  walk(tokens ?? [], base)
  return out.length ? out : [{ text: "" }] // SFDT paragraphs need at least one (possibly empty) run
}

function paragraph(runs: Run[], styleName?: string): Block {
  return { paragraphFormat: styleName ? { styleName } : {}, inlines: runs }
}

// SFDT bookmark markers (start type 0 / end type 1) wrapping a heading so the section nav can jump to it.
const bookmarkStart = (name: string): Run => ({ name, bookmarkType: 0 })
const bookmarkEnd = (name: string): Run => ({ name, bookmarkType: 1 })

function tableBlock(header: { tokens?: unknown[] }[], rows: { tokens?: unknown[] }[][]): Block {
  const cols = header.length || rows[0]?.length || 1
  const width = CONTENT_WIDTH / cols
  const row = (cells: { tokens?: unknown[] }[], isHeader: boolean): Block => ({
    rowFormat: { isHeader },
    cells: cells.map(c => ({
      cellFormat: { preferredWidth: width, preferredWidthType: "Point" },
      blocks: [paragraph(inlines(c.tokens, isHeader ? { bold: true } : {}))],
    })),
  })
  return { tableFormat: { preferredWidthType: "Auto" }, rows: [row(header, true), ...rows.map(r => row(r, false))] }
}

export interface DocSection { heading: string; markdown: string; bookmark?: string }

// Build one A4 document: title (Heading 1) then each section (Heading 2 + its Markdown body).
export function markdownToSfdt(title: string, sections: DocSection[]): string {
  const blocks: Block[] = [paragraph([{ text: title }], "Heading 1")]

  for (const sec of sections) {
    const headingRuns: Run[] = sec.bookmark
      ? [bookmarkStart(sec.bookmark), { text: sec.heading }, bookmarkEnd(sec.bookmark)]
      : [{ text: sec.heading }]
    blocks.push(paragraph(headingRuns, "Heading 2"))
    for (const raw of marked.lexer(sec.markdown || "")) {
      const t = raw as { type: string; depth?: number; text?: string; tokens?: unknown[]; ordered?: boolean; start?: number; items?: { tokens?: unknown[] }[]; header?: { tokens?: unknown[] }[]; rows?: { tokens?: unknown[] }[][] }
      switch (t.type) {
        case "heading": blocks.push(paragraph(inlines(t.tokens), `Heading ${Math.min((t.depth ?? 2) + 1, 4)}`)); break
        case "paragraph": blocks.push(paragraph(inlines(t.tokens))); break
        case "table": blocks.push(tableBlock(t.header ?? [], t.rows ?? [])); break
        case "list":
          (t.items ?? []).forEach((it, i) => {
            const prefix = t.ordered ? `${(t.start ?? 1) + i}.  ` : "•  "
            blocks.push(paragraph([{ text: prefix }, ...inlines(it.tokens)]))
          })
          break
        case "code": blocks.push(paragraph([{ text: t.text ?? "", characterFormat: { fontFamily: "Consolas" } }])); break
        case "space": break
        default: if (t.text) blocks.push(paragraph([{ text: t.text }]))
      }
    }
  }
  return JSON.stringify({ sections: [{ sectionFormat: A4_SECTION_FORMAT, blocks }] })
}
