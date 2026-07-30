"""Section-by-section drafting with provenance captured as it generates.

Laws enforced in the prompt: every claim carries a citation (L1); numbers are placed from cited
sources, never generated/computed (L3); confidential documents are the primary authority and web
research is a gap-filler only. Documents are passed in directly (no vector search).
"""

from __future__ import annotations

import json_repair
import logging
import time
from dataclasses import dataclass, field
from typing import Protocol

from .config import settings
from .corpus import DocContext
from .requirements import ResolvedElement

log = logging.getLogger("veritax")

REGISTER_VOICE = {
    "local": (
        "Write in the register of a transfer-pricing LOCAL FILE: decisive, precise, and complete — "
        "leave no doubt. State positions factually and support each with its source."
    ),
    "planning": (
        "Write in the register of a transfer-pricing planning memo: forward-looking and management-facing. "
        "Address the group's management, and where appropriate make recommendations (\"we recommend the "
        "group adopt…\", \"the group should consider…\"). It advises on a go-forward position rather than "
        "defending a filed one — but every claim is still grounded in a source."
    ),
}

def _system_prompt(web: bool) -> str:
    gap_line = (
        "3. CONFIDENTIAL FIRST: the provided source documents are the primary, authoritative basis. Use "
        "web_search ONLY to fill genuine gaps the documents don't cover (industry/market context) — never "
        "as the main source. Web-sourced claims are cited to their URL.\n"
        if web else
        "3. CONFIDENTIAL FIRST: the provided source documents are the ONLY authoritative basis. If a "
        "required fact is not in the documents, write prose noting the gap — do not fill gaps from outside "
        "knowledge and do not invent.\n"
    )
    return (
        "You draft ONE section of a transfer-pricing LOCAL FILE for a single required element. "
        "You produce verifiable, cited prose — not a chatbot answer.\n\n"
        "LAWS (non-negotiable):\n"
        "1. PROVENANCE: every factual claim must carry a citation to its source. Place inline [n] markers "
        "in the prose and return a matching citation for each, captured as you write — never reconstructed "
        "afterward.\n"
        "2. NUMBERS ARE NEVER GENERATED: you may only state a figure (rate, amount, percentage, date) that "
        "appears verbatim in a source you cite. Never invent, estimate, or compute a number. If a required "
        "figure is not in the sources, write prose noting the gap instead of inventing it.\n"
        + gap_line +
        "4. SUFFICIENCY, NOT CORRECTNESS: draft the section from the sources; do not judge whether the tax "
        "positions are correct, arm's-length, or compliant.\n\n"
        "STYLE:\n"
        "- TELL THE STORY, don't enumerate. Write connected narrative that EXPLAINS the business: why the "
        "structure exists, who performs which functions, who bears which risks, and why that earns what it "
        "earns. A reviewer should understand the business from your prose alone, without opening the sources.\n"
        "- The INTERVIEW transcript is the functional story — draw the functional analysis and business "
        "narrative from it specifically (who does what, who bears which risk), told as narrative.\n"
        "- STRUCTURED DATA, NOT MARKDOWN TABLES: put tabular content (amounts by category/jurisdiction, "
        "entity/counterparty lists, comparables) in the `tables` array, and any chart of source figures in "
        "the `charts` array (bar/column/line/pie). Drop a `[[table:ID]]` or `[[chart:ID]]` marker in the "
        "prose where each belongs. NEVER write a Markdown table. A chart may only plot numbers that appear "
        "in the sources (Law 2) — never invent data to draw a graph.\n"
        "- Use Markdown sub-headings within the prose where helpful.\n\n"
        "Return the section by calling write_section with the Markdown content (inline [n] markers), the "
        "citation for each marker, and any tables/charts."
    )


SYSTEM_PROMPT = _system_prompt(web=True)        # Anthropic (native web search)
SYSTEM_PROMPT_NO_WEB = _system_prompt(web=False)  # DeepSeek (no web search)

WEB_SEARCH_TOOL = {"type": "web_search_20250305", "name": "web_search", "max_uses": 3}

# Structured, renderable data — rendered natively on-screen and in the .docx. Referenced from the prose
# by [[table:ID]] / [[chart:ID]] markers, so the model never has to hand-format a Markdown table.
_TABLE_SCHEMA = {
    "type": "array",
    "description": "Tables of source data. Reference each from the prose with a [[table:ID]] marker. Use "
                   "these instead of Markdown tables.",
    "items": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "title": {"type": "string"},
            "columns": {"type": "array", "items": {"type": "string"}},
            "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}},
        },
        "required": ["id", "columns", "rows"],
    },
}
_CHART_SCHEMA = {
    "type": "array",
    "description": "Charts of figures that ACTUALLY APPEAR in the sources (never invented). Reference each "
                   "from the prose with a [[chart:ID]] marker.",
    "items": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "type": {"type": "string", "enum": ["bar", "column", "line", "pie"]},
            "title": {"type": "string"},
            "categories": {"type": "array", "items": {"type": "string"}},
            "series": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}, "values": {"type": "array", "items": {"type": "number"}}},
                    "required": ["name", "values"],
                },
            },
        },
        "required": ["id", "type", "title", "categories", "series"],
    },
}

WRITE_SECTION_TOOL = {
    "name": "write_section",
    "description": "Record the drafted section prose and the citation grounding each [n] marker.",
    "input_schema": {
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "Section prose in Markdown, with inline [n] citation markers keyed to citations.",
            },
            "citations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "marker": {"type": "integer"},
                        "kind": {"type": "string", "enum": ["document", "web"]},
                        "source_label": {
                            "type": "string",
                            "description": "Source document filename (document) or site/domain (web).",
                        },
                        "url": {"type": "string", "description": "URL for web citations; omit for document."},
                        "quote": {
                            "type": "string",
                            "description": "The supporting passage from the source that grounds this claim.",
                        },
                    },
                    "required": ["marker", "kind", "source_label", "quote"],
                },
            },
            "tables": _TABLE_SCHEMA,
            "charts": _CHART_SCHEMA,
        },
        "required": ["content", "citations"],
    },
}

WRITE_SECTIONS_TOOL = {
    "name": "write_sections",
    "description": "Record drafted section prose and citations for each requested local-file section.",
    "input_schema": {
        "type": "object",
        "properties": {
            "sections": {
                "type": "array",
                "description": "Exactly one drafted section per requested section.",
                "items": {
                    "type": "object",
                    "properties": {
                        "section_number": {
                            "type": "integer",
                            "description": "The requested section number exactly as listed in the prompt.",
                        },
                        **WRITE_SECTION_TOOL["input_schema"]["properties"],
                    },
                    "required": ["section_number", *WRITE_SECTION_TOOL["input_schema"]["required"]],
                },
            }
        },
        "required": ["sections"],
    },
}


@dataclass
class Citation:
    marker: int
    kind: str  # document | web
    source_label: str
    quote: str
    url: str | None = None


@dataclass
class DraftResult:
    content: str
    citations: list[Citation]
    tables: list[dict] = field(default_factory=list)   # {id, title, columns[], rows[][]}
    charts: list[dict] = field(default_factory=list)   # {id, type, title, categories[], series[{name, values[]}]}


class Drafter(Protocol):
    def draft(self, element: ResolvedElement, register: str, documents: list[DocContext],
              coverage_note: str) -> DraftResult: ...
    def draft_batch(
        self,
        elements: list[ResolvedElement],
        register: str,
        documents: list[DocContext],
        coverage_notes: dict[int, str],
    ) -> dict[int, DraftResult]: ...


def _prompt(element: ResolvedElement, register: str, documents: list[DocContext], coverage_note: str) -> str:
    subs = "\n".join(f"  - {s}" for s in element.sub_requirements) or "  (none)"
    docs = "\n\n".join(
        f"--- SOURCE: {d.filename} (type: {d.kind}) ---\n{d.text.strip() or '(no extractable text)'}"
        for d in documents
    ) or "(no confidential documents were provided)"
    voice = REGISTER_VOICE.get(register, REGISTER_VOICE["local"])
    note = f"\nCOVERAGE NOTE (from the Requirements assessment): {coverage_note}\n" if coverage_note else ""
    return (
        f"{voice}\n\n"
        f"REQUIRED ELEMENT: {element.element_name}\n"
        f"WHAT THIS SECTION MUST CONTAIN: {element.description}\n"
        f"SUB-REQUIREMENTS:\n{subs}\n"
        f"{note}\n"
        f"CONFIDENTIAL SOURCE MATERIALS (primary authority — cite these; use web_search only for gaps):\n"
        f"{docs}\n\n"
        "Draft this one section now and call write_section."
    )


def _batch_prompt(
    elements: list[ResolvedElement],
    register: str,
    documents: list[DocContext],
    coverage_notes: dict[int, str],
) -> str:
    docs = "\n\n".join(
        f"--- SOURCE: {d.filename} (type: {d.kind}) ---\n{d.text.strip() or '(no extractable text)'}"
        for d in documents
    ) or "(no confidential documents were provided)"
    voice = REGISTER_VOICE.get(register, REGISTER_VOICE["local"])
    blocks: list[str] = []
    for i, element in enumerate(elements, 1):
        subs = "\n".join(f"    - {s}" for s in element.sub_requirements) or "    (none)"
        note = coverage_notes.get(i, "")
        blocks.append(
            f"SECTION {i}: {element.element_name}\n"
            f"  WHAT THIS SECTION MUST CONTAIN: {element.description}\n"
            f"  SUB-REQUIREMENTS:\n{subs}\n"
            f"  COVERAGE NOTE: {note or '(none)'}"
        )
    return (
        f"{voice}\n\n"
        f"Draft EACH of these {len(elements)} transfer-pricing local-file sections against the same "
        "confidential source materials. Each section must stand on its own, but the narrative should "
        "be consistent across the batch. Do not merge sections. Do not skip sections.\n\n"
        f"{chr(10).join(blocks)}\n\n"
        f"CONFIDENTIAL SOURCE MATERIALS (primary authority):\n{docs}\n\n"
        "Call write_sections once with exactly one entry per section_number."
    )


_CHART_TYPES = {"bar", "column", "line", "pie"}


def _clean_tables(raw) -> list[dict]:
    out = []
    for t in raw or []:
        if isinstance(t, dict) and t.get("id") and isinstance(t.get("columns"), list) and isinstance(t.get("rows"), list):
            out.append({
                "id": str(t["id"]), "title": str(t.get("title", "")),
                "columns": [str(c) for c in t["columns"]],
                "rows": [[str(v) for v in r] for r in t["rows"] if isinstance(r, list)],
            })
    return out


def _clean_charts(raw) -> list[dict]:
    out = []
    for c in raw or []:
        if not (isinstance(c, dict) and c.get("id") and c.get("type") in _CHART_TYPES and isinstance(c.get("series"), list)):
            continue
        series = [
            {"name": str(s.get("name", "")), "values": [float(v) for v in s.get("values", []) if isinstance(v, (int, float))]}
            for s in c["series"] if isinstance(s, dict)
        ]
        out.append({
            "id": str(c["id"]), "type": c["type"], "title": str(c.get("title", "")),
            "categories": [str(x) for x in c.get("categories", [])], "series": series,
        })
    return out


def _draft_result_from(payload: dict) -> DraftResult:
    cites = [
        Citation(
            marker=c["marker"],
            kind=c["kind"],
            source_label=c["source_label"],
            quote=c.get("quote", ""),
            url=c.get("url"),
        )
        for c in payload.get("citations", [])
    ]
    return DraftResult(
        content=payload["content"], citations=cites,
        tables=_clean_tables(payload.get("tables")), charts=_clean_charts(payload.get("charts")),
    )


def _draft_results_from(payload: dict) -> dict[int, DraftResult]:
    out: dict[int, DraftResult] = {}
    for item in payload.get("sections", []):
        if not isinstance(item, dict):
            continue
        section_number = item.get("section_number")
        if not isinstance(section_number, int) or not item.get("content"):
            continue
        out[section_number] = _draft_result_from(item)
    return out


class AnthropicDrafter:
    """Claude (Sonnet by default) with native web search + write_section structured output."""

    def __init__(self) -> None:
        self._model = settings.draft_model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        return self._client

    def draft(self, element, register, documents, coverage_note):
        resp = self._get_client().messages.create(
            model=self._model,
            max_tokens=2500,
            system=SYSTEM_PROMPT,
            tools=[WEB_SEARCH_TOOL, WRITE_SECTION_TOOL],
            messages=[{"role": "user", "content": _prompt(element, register, documents, coverage_note)}],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "write_section":
                return _draft_result_from(block.input)
        raise RuntimeError("drafter returned no write_section block")

    def draft_batch(self, elements, register, documents, coverage_notes):
        prompt = _batch_prompt(elements, register, documents, coverage_notes)
        log.info("draft_batch[anthropic] START %d section(s) (prompt %d chars, %d docs)",
                 len(elements), len(prompt), len(documents))
        t0 = time.monotonic()
        resp = self._get_client().messages.create(
            model=self._model,
            max_tokens=8000,
            system=SYSTEM_PROMPT,
            tools=[WEB_SEARCH_TOOL, WRITE_SECTIONS_TOOL],
            messages=[{"role": "user", "content": prompt}],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "write_sections":
                results = _draft_results_from(block.input)
                log.info("draft_batch[anthropic] DONE %d/%d section(s) in %.1fs",
                         len(results), len(elements), time.monotonic() - t0)
                return results
        raise RuntimeError("drafter returned no write_sections block")


class DeepSeekDrafter:
    """DeepSeek (OpenAI-compatible) via function calling. No native web search — confidential-only."""

    def __init__(self) -> None:
        self._model = settings.deepseek_model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(
                api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url
            )
        return self._client

    def draft(self, element, register, documents, coverage_note):
        tool = {
            "type": "function",
            "function": {
                "name": "write_section",
                "description": WRITE_SECTION_TOOL["description"],
                "parameters": WRITE_SECTION_TOOL["input_schema"],
            },
        }
        resp = self._get_client().chat.completions.create(
            model=self._model,
            max_tokens=8192,  # headroom: v4 thinking mode spends tokens reasoning before the tool JSON
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_NO_WEB},
                {"role": "user", "content": _prompt(element, register, documents, coverage_note)},
            ],
            tools=[tool],
            tool_choice={"type": "function", "function": {"name": "write_section"}},
            extra_body={"thinking": {"type": "disabled"}},  # off: faster, no token burn, forced tool_choice works
            timeout=120,
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            raise RuntimeError(f"DeepSeek returned no tool call: {(msg.content or '')[:200]}")
        return _draft_result_from(json_repair.loads(msg.tool_calls[0].function.arguments))

    def draft_batch(self, elements, register, documents, coverage_notes):
        tool = {
            "type": "function",
            "function": {
                "name": "write_sections",
                "description": WRITE_SECTIONS_TOOL["description"],
                "parameters": WRITE_SECTIONS_TOOL["input_schema"],
            },
        }
        prompt = _batch_prompt(elements, register, documents, coverage_notes)
        log.info("draft_batch[deepseek] START %d section(s) (prompt %d chars, %d docs)",
                 len(elements), len(prompt), len(documents))
        t0 = time.monotonic()
        try:
            resp = self._get_client().chat.completions.create(
                model=self._model,
                max_tokens=8192,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_NO_WEB},
                    {"role": "user", "content": prompt},
                ],
                tools=[tool],
                tool_choice={"type": "function", "function": {"name": "write_sections"}},
                extra_body={"thinking": {"type": "disabled"}},
                timeout=180,
            )
        except Exception:
            log.exception("draft_batch[deepseek] call FAILED after %.1fs", time.monotonic() - t0)
            raise
        msg = resp.choices[0].message
        if not msg.tool_calls:
            raise RuntimeError(f"DeepSeek returned no tool call: {(msg.content or '')[:200]}")
        results = _draft_results_from(json_repair.loads(msg.tool_calls[0].function.arguments))
        log.info("draft_batch[deepseek] DONE %d/%d section(s) in %.1fs",
                 len(results), len(elements), time.monotonic() - t0)
        return results


class FakeDrafter:
    """Deterministic stub for tests + dev fallback. No network, no web search."""

    def draft(self, element, register, documents, coverage_note):
        if documents:
            d = documents[0]
            content = (
                f"## {element.element_name}\n\n"
                f"{element.description} This section is drafted from the material on file.[1] "
                f"Figures are summarised in [[table:t1]] and the trend in [[chart:c1]]."
            )
            quote = (d.text.strip()[:160] or element.description)
            return DraftResult(
                content, [Citation(1, "document", d.filename, quote)],
                tables=[{"id": "t1", "title": "Illustrative figures", "columns": ["Year", "Value"],
                         "rows": [["2024", "100"], ["2025", "110"]]}],
                charts=[{"id": "c1", "type": "bar", "title": "Illustrative trend", "categories": ["2024", "2025"],
                         "series": [{"name": "Value", "values": [100.0, 110.0]}]}],
            )
        content = (
            f"## {element.element_name}\n\n"
            f"{element.description} No confidential source covers this element yet — supplement it in "
            f"Requirements."
        )
        return DraftResult(content, [])

    def draft_batch(self, elements, register, documents, coverage_notes):
        return {
            i: self.draft(element, register, documents, coverage_notes.get(i, ""))
            for i, element in enumerate(elements, 1)
        }
