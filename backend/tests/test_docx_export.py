"""Pure-Python native .docx generation (no DB, no binary). The tracer bullet: prove a real, editable
Word chart lands in the file — a chart part + its embedded workbook — not an image."""

import io
import zipfile

from app.docx_export import build_document

COVER = {
    "documentTitle": "Transfer Pricing Local File",
    "entity": "Acme B.V.",
    "jurisdiction": "Netherlands",
    "status": "Draft prepared for review",
    "preparedBy": "Veritax",
    "preparedOn": "July 29, 2026",
}
SECTIONS = [
    {
        "heading": "1. Financial results",
        "content": "Revenue is shown in [[table:t1]]; operating margin in [[chart:c1]].",
        "tables": [{"id": "t1", "title": "Revenue by year", "columns": ["Year", "Revenue (€m)"],
                    "rows": [["2024", "42.0"], ["2025", "45.5"]]}],
        "charts": [{"id": "c1", "type": "bar", "title": "Operating margin (%)",
                    "categories": ["2024", "2025"], "series": [{"name": "Margin %", "values": [3.1, 3.4]}]}],
    },
]


def _zip(b: bytes) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(b))


def test_docx_has_native_table_and_editable_chart():
    b = build_document(COVER, SECTIONS)
    assert b[:2] == b"PK"                       # a real .docx (zip)
    z = _zip(b)
    names = z.namelist()
    # a native Word chart part + its embedded workbook = editable-in-Word, not an image
    assert any(n.startswith("word/charts/chart") and n.endswith(".xml") for n in names), names
    assert any("embeddings" in n and n.endswith(".xlsx") for n in names), names
    assert "chart+xml" in z.read("[Content_Types].xml").decode("utf-8")  # registered → Word-openable
    doc = z.read("word/document.xml").decode("utf-8")
    assert "w:tbl" in doc                        # native table
    assert "Transfer Pricing Local File" in doc
    assert "Draft prepared for review" in doc
    assert "Prepared by Veritax" in doc
    assert "Planning File" not in doc
    assert "Financial results" in doc


def test_no_chart_part_when_section_has_no_charts():
    b = build_document(COVER, [{"heading": "1. Intro", "content": "Plain prose only.", "tables": [], "charts": []}])
    z = _zip(b)
    assert not any(n.startswith("word/charts/") for n in z.namelist())
    assert "Plain prose only." in z.read("word/document.xml").decode("utf-8")
