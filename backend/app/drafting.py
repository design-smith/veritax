"""Section-by-section drafting with provenance captured as it generates.

Laws enforced in the prompt: every claim carries a citation (L1); numbers are placed from cited
sources, never generated/computed (L3); confidential documents are the primary authority and web
research is a gap-filler only. Documents are passed in directly (no vector search).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

from .config import settings
from .corpus import DocContext
from .requirements import ResolvedElement

REGISTER_VOICE = {
    "local": (
        "Write in the register of a transfer-pricing LOCAL FILE: decisive, precise, and complete — "
        "leave no doubt. State positions factually and support each with its source."
    ),
    "planning": (
        "Write in the register of a transfer-pricing PLANNING FILE: forward-looking and management-facing. "
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
        "You draft ONE section of a transfer-pricing PLANNING FILE for a single required element. "
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
        "- Use Markdown structure: sub-headings where helpful, and Markdown TABLES wherever the content is "
        "tabular (amounts by category and jurisdiction, entity/counterparty lists, comparables data) — "
        "never flat prose for columnar numeric content.\n\n"
        "Return the section by calling write_section with Markdown content (inline [n] markers) and the "
        "citation for each marker."
    )


SYSTEM_PROMPT = _system_prompt(web=True)        # Anthropic (native web search)
SYSTEM_PROMPT_NO_WEB = _system_prompt(web=False)  # DeepSeek (no web search)

WEB_SEARCH_TOOL = {"type": "web_search_20250305", "name": "web_search", "max_uses": 3}

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
        },
        "required": ["content", "citations"],
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


class Drafter(Protocol):
    def draft(self, element: ResolvedElement, register: str, documents: list[DocContext],
              coverage_note: str) -> DraftResult: ...


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
                d = block.input
                cites = [
                    Citation(
                        marker=c["marker"],
                        kind=c["kind"],
                        source_label=c["source_label"],
                        quote=c.get("quote", ""),
                        url=c.get("url"),
                    )
                    for c in d.get("citations", [])
                ]
                return DraftResult(content=d["content"], citations=cites)
        raise RuntimeError("drafter returned no write_section block")


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
            max_tokens=4000,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_NO_WEB},
                {"role": "user", "content": _prompt(element, register, documents, coverage_note)},
            ],
            tools=[tool],
            tool_choice={"type": "function", "function": {"name": "write_section"}},
        )
        d = json.loads(resp.choices[0].message.tool_calls[0].function.arguments)
        cites = [
            Citation(
                marker=c["marker"],
                kind=c["kind"],
                source_label=c["source_label"],
                quote=c.get("quote", ""),
                url=c.get("url"),
            )
            for c in d.get("citations", [])
        ]
        return DraftResult(content=d["content"], citations=cites)


class FakeDrafter:
    """Deterministic stub for tests + dev fallback. No network, no web search."""

    def draft(self, element, register, documents, coverage_note):
        if documents:
            d = documents[0]
            content = (
                f"## {element.element_name}\n\n"
                f"{element.description} This section is drafted from the material on file.[1]"
            )
            quote = (d.text.strip()[:160] or element.description)
            return DraftResult(content, [Citation(1, "document", d.filename, quote)])
        content = (
            f"## {element.element_name}\n\n"
            f"{element.description} No confidential source covers this element yet — supplement it in "
            f"Requirements."
        )
        return DraftResult(content, [])
