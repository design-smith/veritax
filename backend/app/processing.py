from __future__ import annotations

import csv
import io
import re

# ── Text extraction by file type ─────────────────────────────────────────────
_VTT_SRT_TS = re.compile(r"^\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s*-->.*$")
_SRT_INDEX = re.compile(r"^\d+$")


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def extract_text(filename: str, content_type: str | None, data: bytes) -> str:
    ext = _ext(filename)
    try:
        if ext == "pdf":
            return _pdf(data)
        if ext == "docx":
            return _docx(data)
        if ext in ("xlsx", "xls"):
            return _xlsx(data)
        if ext == "csv":
            return _csv(data)
        if ext in ("vtt", "srt"):
            return _cues(data)
        if ext in ("txt", "md", "text", ""):
            return data.decode("utf-8", errors="ignore")
    except Exception:
        # Extraction is best-effort for findability; a parse failure yields no chunks, not a 500.
        return ""
    # Unknown binary types → no text (0 chunks).
    return ""


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _docx(data: bytes) -> str:
    from docx import Document as Docx

    doc = Docx(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs)


def _xlsx(data: bytes) -> str:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    rows: list[str] = []
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None]
            if cells:
                rows.append("\t".join(cells))
    return "\n".join(rows)


def _csv(data: bytes) -> str:
    text = data.decode("utf-8", errors="ignore")
    return "\n".join("\t".join(r) for r in csv.reader(io.StringIO(text)))


def _cues(data: bytes) -> str:
    """Strip WEBVTT/SRT timestamps and indices, keep spoken text."""
    lines: list[str] = []
    for raw in data.decode("utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line == "WEBVTT" or _VTT_SRT_TS.match(line) or _SRT_INDEX.match(line):
            continue
        lines.append(line)
    return "\n".join(lines)


# ── Chunking ─────────────────────────────────────────────────────────────────
# ponytail: naive fixed-size word window with overlap. Good enough for findability search now;
# swap for structural/semantic chunking when retrieval quality matters.
def chunk(text: str, words_per_chunk: int = 600, overlap: int = 80) -> list[str]:
    words = text.split()
    if not words:
        return []
    step = max(1, words_per_chunk - overlap)
    out: list[str] = []
    for start in range(0, len(words), step):
        piece = words[start : start + words_per_chunk]
        if piece:
            out.append(" ".join(piece))
        if start + words_per_chunk >= len(words):
            break
    return out
