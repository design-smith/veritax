"""Per-requirement input-sufficiency assessment.

Judges whether the provided documents contain ENOUGH INFORMATION to write a requirement — presence and
completeness only. It must NOT opine on whether tax positions are correct/arm's-length/compliant. Reads
documents directly (callers pass full text); never uses vector search.
"""

from __future__ import annotations

import json_repair
import logging
import time
from dataclasses import dataclass
from typing import Protocol

from .config import settings
from .corpus import DocContext
from .evidence_quality import evidence_expectations
from .requirements import ResolvedElement

log = logging.getLogger("veritax")

# Restated in code because it is the instruction that drifts.
SYSTEM_PROMPT = (
    "You assess INPUT SUFFICIENCY for transfer-pricing documentation. Given a single required "
    "documentation element and the source materials a preparer has gathered, decide whether the "
    "sources contain enough information to WRITE that element.\n\n"
    "Return one of: 'present' (the information needed is fully there), 'partial' (some is there but "
    "a specific piece is missing), or 'missing' (the sources do not cover it).\n\n"
    "CRITICAL SCOPE LIMITS:\n"
    "- Assess PRESENCE and COMPLETENESS of information only.\n"
    "- 'Present' requires concrete source support for the specific local legal entity, jurisdiction, "
    "fiscal year/local-file period, controlled transaction, and counterparty scope when those facts are "
    "needed by the element.\n"
    "- Group-level annual-report material is background only. By itself it is NOT enough for local "
    "entity financials, controlled transactions, agreements, FAR, method selection, tested party, "
    "comparables, benchmarking, or arm's-length conclusions.\n"
    "- You MUST NOT judge whether the tax treatment is correct, arm's-length, compliant, or "
    "well-reasoned. That is a later stage. If tempted to evaluate correctness, refuse and confine "
    "yourself to whether the information is present.\n"
    "- Phrase 'whats_missing' as what the preparer should go get (e.g. 'the interview covers functions "
    "and assets but never establishes who bears inventory risk'), not as a compliance defect.\n"
    "- For every source that informed your judgment, return an evidence pointer: the filename AND the "
    "specific place in it (a short quoted passage, section, or page) where the information appears — so "
    "the user can be directed to exactly where it's mentioned. Only include sources you actually used."
)

ASSESS_TOOL = {
    "name": "record_assessment",
    "description": "Record the input-sufficiency assessment for one requirement element.",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ["present", "partial", "missing"]},
            "whats_present": {"type": "string", "description": "Brief note of what the sources cover."},
            "whats_missing": {
                "type": "string",
                "description": "The specific gap phrased as what to go get; empty if present.",
            },
            "evidence": {
                "type": "array",
                "description": "Where the supporting information appears — one per source used.",
                "items": {
                    "type": "object",
                    "properties": {
                        "source_filename": {"type": "string"},
                        "locator": {
                            "type": "string",
                            "description": "The section/page or a short quoted passage that satisfies this element.",
                        },
                    },
                    "required": ["source_filename", "locator"],
                },
            },
            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        },
        "required": ["status", "whats_present", "whats_missing", "evidence", "confidence"],
    },
}

# Batched variant: assess several elements in ONE call against shared context. Same per-element shape,
# wrapped in an array and keyed by element_number so results map back to the requested elements.
ASSESS_BATCH_TOOL = {
    "name": "record_assessments",
    "description": "Record the input-sufficiency assessment for EACH listed requirement element.",
    "input_schema": {
        "type": "object",
        "properties": {
            "assessments": {
                "type": "array",
                "description": "Exactly one entry per element listed in the prompt.",
                "items": {
                    "type": "object",
                    "properties": {
                        "element_number": {
                            "type": "integer",
                            "description": "The element's number exactly as listed in the prompt (1-based).",
                        },
                        **ASSESS_TOOL["input_schema"]["properties"],
                    },
                    "required": ["element_number", *ASSESS_TOOL["input_schema"]["required"]],
                },
            }
        },
        "required": ["assessments"],
    },
}


@dataclass
class EvidenceItem:
    source_filename: str
    locator: str  # section / page / quoted passage


@dataclass
class Assessment:
    status: str  # present | partial | missing
    whats_present: str
    whats_missing: str
    evidence: list[EvidenceItem]
    confidence: str  # high | medium | low


class Assessor(Protocol):
    def assess(self, element: ResolvedElement, documents: list[DocContext], scope_note: str = "") -> Assessment: ...
    def assess_batch(
        self, elements: list[ResolvedElement], documents: list[DocContext], scope_notes: dict[int, str] | None = None
    ) -> dict[int, Assessment]: ...


def _assessment_from(d: dict) -> Assessment:
    evidence = [
        EvidenceItem(e["source_filename"], e.get("locator", ""))
        for e in d.get("evidence", [])
        if e.get("source_filename")
    ]
    return Assessment(
        status=d["status"],
        whats_present=d.get("whats_present", ""),
        whats_missing=d.get("whats_missing", ""),
        evidence=evidence,
        confidence=d.get("confidence", "low"),
    )


_VALID_STATUS = {"present", "partial", "missing"}


def _assessments_from(payload: dict) -> dict[int, Assessment]:
    """Batch payload → {element_number: Assessment}. Tolerant: skips items missing a number/status so
    one garbled entry can't sink the batch (the caller marks any un-returned element failed)."""
    out: dict[int, Assessment] = {}
    for item in payload.get("assessments", []):
        if not isinstance(item, dict):
            continue
        num = item.get("element_number")
        if not isinstance(num, int) or item.get("status") not in _VALID_STATUS:
            continue
        out[num] = _assessment_from(item)
    return out


def _element_prompt(element: ResolvedElement, documents: list[DocContext], scope_note: str = "") -> str:
    subs = "\n".join(f"  - {s}" for s in element.sub_requirements) or "  (none)"
    docs = "\n\n".join(
        f"--- SOURCE: {d.filename} (type: {d.kind}) ---\n{d.text.strip() or '(no extractable text)'}"
        for d in documents
    ) or "(no documents uploaded)"
    scope = scope_note or evidence_expectations(element.element_name)
    return (
        f"REQUIRED ELEMENT: {element.element_name}\n"
        f"DESCRIPTION: {element.description}\n"
        f"SUB-REQUIREMENTS:\n{subs}\n\n"
        f"SCOPE / EVIDENCE STANDARD:\n{scope}\n\n"
        f"SOURCE MATERIALS:\n{docs}\n\n"
        "Assess whether these sources contain concrete, scoped evidence that satisfies this element. "
        "Call record_assessment with your result."
    )


def _batch_prompt(
    elements: list[ResolvedElement],
    documents: list[DocContext],
    scope_notes: dict[int, str] | None = None,
) -> str:
    docs = "\n\n".join(
        f"--- SOURCE: {d.filename} (type: {d.kind}) ---\n{d.text.strip() or '(no extractable text)'}"
        for d in documents
    ) or "(no documents uploaded)"
    blocks = []
    for i, el in enumerate(elements, 1):
        subs = "\n".join(f"    - {s}" for s in el.sub_requirements) or "    (none)"
        scope = (scope_notes or {}).get(i) or evidence_expectations(el.element_name)
        blocks.append(
            f"ELEMENT {i}: {el.element_name}\n"
            f"  DESCRIPTION: {el.description}\n"
            f"  SUB-REQUIREMENTS:\n{subs}\n"
            f"  SCOPE / EVIDENCE STANDARD: {scope}"
        )
    return (
        f"Assess EACH of these {len(elements)} required elements against the SHARED source materials "
        "below. Judge each element independently on presence/completeness only; return exactly one "
        "assessment per element, with element_number matching the numbers below. Present requires concrete, "
        "scoped evidence; narrative background alone is partial or missing.\n\n"
        f"{chr(10).join(blocks)}\n\n"
        f"SHARED SOURCE MATERIALS:\n{docs}\n\n"
        "Call record_assessments once, with one entry per element."
    )


class AnthropicAssessor:
    """Claude (Haiku by default) via tool-use for structured output. Lazy client init."""

    def __init__(self) -> None:
        self._model = settings.assessment_model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        return self._client

    def assess(self, element: ResolvedElement, documents: list[DocContext], scope_note: str = "") -> Assessment:
        resp = self._get_client().messages.create(
            model=self._model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[ASSESS_TOOL],
            tool_choice={"type": "tool", "name": "record_assessment"},
            messages=[{"role": "user", "content": _element_prompt(element, documents, scope_note)}],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "record_assessment":
                d = block.input
                return _assessment_from(d)
        raise RuntimeError("assessor returned no tool_use block")

    def assess_batch(self, elements, documents, scope_notes=None):
        resp = self._get_client().messages.create(
            model=self._model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=[ASSESS_BATCH_TOOL],
            tool_choice={"type": "tool", "name": "record_assessments"},
            messages=[{"role": "user", "content": _batch_prompt(elements, documents, scope_notes)}],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "record_assessments":
                return _assessments_from(block.input)
        raise RuntimeError("assessor returned no tool_use block")


class DeepSeekAssessor:
    """DeepSeek (OpenAI-compatible) via function calling for structured output. Lazy client."""

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

    def assess(self, element: ResolvedElement, documents: list[DocContext], scope_note: str = "") -> Assessment:
        tool = {
            "type": "function",
            "function": {
                "name": "record_assessment",
                "description": ASSESS_TOOL["description"],
                "parameters": ASSESS_TOOL["input_schema"],
            },
        }
        prompt = _element_prompt(element, documents, scope_note)
        log.info("assess[deepseek] START '%s' (prompt %d chars, %d docs)", element.element_name, len(prompt), len(documents))
        t0 = time.monotonic()
        try:
            resp = self._get_client().chat.completions.create(
                model=self._model,
                max_tokens=8192,  # headroom: v4 thinking mode spends tokens reasoning before the tool JSON
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                tools=[tool],
                tool_choice={"type": "function", "function": {"name": "record_assessment"}},
                extra_body={"thinking": {"type": "disabled"}},  # off: faster, no token burn, forced tool_choice works
                timeout=90,  # fail visibly rather than hang the whole loop
            )
        except Exception:
            log.exception("assess[deepseek] '%s' call FAILED after %.1fs", element.element_name, time.monotonic() - t0)
            raise
        msg = resp.choices[0].message
        if not msg.tool_calls:
            raise RuntimeError(f"DeepSeek returned no tool call: {(msg.content or '')[:200]}")
        call = msg.tool_calls[0]
        d = json_repair.loads(call.function.arguments)  # tolerant: DeepSeek tool JSON is sometimes malformed
        log.info("assess[deepseek] DONE '%s' -> %s in %.1fs", element.element_name, d.get("status"), time.monotonic() - t0)
        return _assessment_from(d)

    def assess_batch(self, elements, documents, scope_notes=None):
        tool = {
            "type": "function",
            "function": {
                "name": "record_assessments",
                "description": ASSESS_BATCH_TOOL["description"],
                "parameters": ASSESS_BATCH_TOOL["input_schema"],
            },
        }
        prompt = _batch_prompt(elements, documents, scope_notes)
        log.info("assess_batch[deepseek] START %d element(s) (prompt %d chars, %d docs)",
                 len(elements), len(prompt), len(documents))
        t0 = time.monotonic()
        try:
            resp = self._get_client().chat.completions.create(
                model=self._model,
                max_tokens=8192,  # a batch of verdicts; thinking is off so this is pure tool JSON
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                tools=[tool],
                tool_choice={"type": "function", "function": {"name": "record_assessments"}},
                extra_body={"thinking": {"type": "disabled"}},
                timeout=120,  # a batch is a larger single call than a per-element assess
            )
        except Exception:
            log.exception("assess_batch[deepseek] call FAILED after %.1fs", time.monotonic() - t0)
            raise
        msg = resp.choices[0].message
        if not msg.tool_calls:
            raise RuntimeError(f"DeepSeek returned no tool call: {(msg.content or '')[:200]}")
        results = _assessments_from(json_repair.loads(msg.tool_calls[0].function.arguments))
        log.info("assess_batch[deepseek] DONE %d/%d verdict(s) in %.1fs",
                 len(results), len(elements), time.monotonic() - t0)
        return results


class FakeAssessor:
    """Deterministic keyword-overlap heuristic for tests + dev fallback. No network."""

    def assess(self, element: ResolvedElement, documents: list[DocContext], scope_note: str = "") -> Assessment:
        words = {w.lower() for w in element.element_name.split() if len(w) > 4}
        if not words:
            words = {w.lower() for w in element.description.split() if len(w) > 5}
        blob = " ".join(d.text.lower() for d in documents)
        matched = {w for w in words if w in blob}
        # evidence pointer per matching doc: filename + a short quoted locator
        evidence = [
            EvidenceItem(d.filename, (d.text.strip()[:80] or element.element_name))
            for d in documents
            if any(w in d.text.lower() for w in words)
        ]
        ratio = (len(matched) / len(words)) if words else 0.0

        if ratio >= 0.5:
            return Assessment("present", f"Sources cover {element.element_name}.", "", evidence, "high")
        if matched:
            return Assessment(
                "partial",
                f"Some material on {element.element_name}.",
                f"Establish the remaining details for {element.element_name}.",
                evidence,
                "medium",
            )
        return Assessment(
            "missing",
            "",
            f"No source covers {element.element_name}; add material describing it.",
            [],
            "low",
        )

    def assess_batch(self, elements, documents, scope_notes=None):
        return {i: self.assess(el, documents, (scope_notes or {}).get(i, "")) for i, el in enumerate(elements, 1)}
