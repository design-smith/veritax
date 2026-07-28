// Markdown → SFDT (Syncfusion Document Text). SFDT is the DocumentEditor's native, fully client-side
// format; Syncfusion paginates it into real A4 pages on its own. We build a generic document template:
//   1. a plain, distinct COVER page (its own section, no page number),
//   2. a BODY section whose drafted sections are Heading 1 (sub-headings → H2/H3),
//   3. a footer with a live PAGE-number field.
import { marked } from "marked"

// A4 in points (1/72in): 210mm = 595.3, 297mm = 841.9; ~20mm margins = 56.7pt.
const A4 = {
  pageWidth: 595.3, pageHeight: 841.9,
  leftMargin: 56.7, rightMargin: 56.7, topMargin: 56.7, bottomMargin: 56.7,
}
const CONTENT_WIDTH = 595.3 - 56.7 * 2 // ≈ 481.9pt

type Fmt = { bold?: boolean; italic?: boolean; fontFamily?: string; fontSize?: number; fontColor?: string }
type Inline = { text: string; characterFormat?: Fmt }
type Run = Record<string, unknown>  // an inline run, a bookmark marker, or a field marker
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

// A paragraph with an optional built-in style ("Heading 1"/"Heading 2"/…) and extra paragraph formatting.
function paragraph(runs: Run[], styleName?: string, pFmt?: Record<string, unknown>): Block {
  const paragraphFormat: Record<string, unknown> = { ...(pFmt ?? {}) }
  if (styleName) paragraphFormat.styleName = styleName
  return { paragraphFormat, inlines: runs }
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

// ── Cover page + running header/footer ───────────────────────────────────────
const CENTER = { textAlignment: "Center" as const }
const EMPTY = (): Block => paragraph([{ text: "" }])

function coverBlocks(c: CoverInfo): Block[] {
  const date = c.date ?? new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  return [
    EMPTY(), EMPTY(), EMPTY(), EMPTY(), EMPTY(), EMPTY(),  // push the title into the upper third
    paragraph([{ text: c.documentTitle, characterFormat: { bold: true, fontSize: 30 } }], undefined, { ...CENTER, afterSpacing: 12 }),
    paragraph([{ text: c.entity || "Entity", characterFormat: { fontSize: 16 } }], undefined, { ...CENTER, afterSpacing: 2 }),
    paragraph([{ text: c.jurisdiction, characterFormat: { fontSize: 14, fontColor: "#555555" } }], undefined, CENTER),
    EMPTY(), EMPTY(),
    paragraph([{ text: date, characterFormat: { fontSize: 11, fontColor: "#777777" } }], undefined, CENTER),
  ]
}

// Live "Page N" field: field-begin (0) · code · separator (2) · result placeholder · field-end (1).
function pageNumberFooter(): Block {
  const fmt = { fontSize: 9, fontColor: "#888888" }
  const runs: Run[] = [
    { text: "Page ", characterFormat: fmt },
    { characterFormat: fmt, fieldType: 0 },
    { characterFormat: fmt, text: " PAGE " },
    { characterFormat: fmt, fieldType: 2 },
    { characterFormat: fmt, text: "1" },
    { characterFormat: fmt, fieldType: 1 },
  ]
  return paragraph(runs, undefined, CENTER)
}

function runningHeader(c: CoverInfo): Block {
  return paragraph([{ text: `${c.entity || "Entity"} — ${c.jurisdiction}`, characterFormat: { fontSize: 9, fontColor: "#999999" } }],
    undefined, { textAlignment: "Right" })
}

export interface DocSection { heading: string; markdown: string; bookmark?: string }
export interface CoverInfo { documentTitle: string; entity: string; jurisdiction: string; date?: string }

// Build the document: a cover section (no page number) + a body section (Heading-1 sections, page footer).
export function markdownToSfdt(cover: CoverInfo, sections: DocSection[]): string {
  const bodyBlocks: Block[] = []
  for (const sec of sections) {
    const headingRuns: Run[] = sec.bookmark
      ? [bookmarkStart(sec.bookmark), { text: sec.heading }, bookmarkEnd(sec.bookmark)]
      : [{ text: sec.heading }]
    bodyBlocks.push(paragraph(headingRuns, "Heading 1"))
    for (const raw of marked.lexer(sec.markdown || "")) {
      const t = raw as { type: string; depth?: number; text?: string; tokens?: unknown[]; ordered?: boolean; start?: number; items?: { tokens?: unknown[] }[]; header?: { tokens?: unknown[] }[]; rows?: { tokens?: unknown[] }[][] }
      switch (t.type) {
        // a drafted section's own Markdown headings sit UNDER its Heading 1: md h1 → H2, md h2 → H3, …
        case "heading": bodyBlocks.push(paragraph(inlines(t.tokens), `Heading ${Math.min((t.depth ?? 1) + 1, 4)}`)); break
        case "paragraph": bodyBlocks.push(paragraph(inlines(t.tokens))); break
        case "table": bodyBlocks.push(tableBlock(t.header ?? [], t.rows ?? [])); break
        case "list":
          (t.items ?? []).forEach((it, i) => {
            const prefix = t.ordered ? `${(t.start ?? 1) + i}.  ` : "•  "
            bodyBlocks.push(paragraph([{ text: prefix }, ...inlines(it.tokens)]))
          })
          break
        case "code": bodyBlocks.push(paragraph([{ text: t.text ?? "", characterFormat: { fontFamily: "Consolas" } }])); break
        case "space": break
        default: if (t.text) bodyBlocks.push(paragraph([{ text: t.text }]))
      }
    }
  }

  return JSON.stringify({
    sections: [
      // Cover: its own page, no header/footer → unnumbered.
      { sectionFormat: { ...A4 }, blocks: coverBlocks(cover) },
      // Body: page numbering restarts at 1, running header + page footer.
      {
        sectionFormat: { ...A4, restartPageNumbering: true, pageStartingNumber: 1 },
        blocks: bodyBlocks,
        headersFooters: {
          header: { blocks: [runningHeader(cover)] },
          footer: { blocks: [pageNumberFooter()] },
        },
      },
    ],
  })
}
