"""Risk analysis over the COMPLETED draft.

Unlike Requirements (which must not judge correctness), Risks judges substance — defensibility and
exposure — because the draft finally exists. Two kinds of findings: internal discrepancies (the file
contradicts itself or the record) and substantive exposure (documented but weak positions). The model
identifies and explains; exposure magnitudes are severity bands / flagged estimates, never invented
precision (L3). Reads the draft + record directly (no vector search).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Protocol

from .config import settings
from .corpus import DocContext

SYSTEM_PROMPT = (
    "You review a COMPLETED transfer-pricing Planning File and surface where it is EXPOSED. Unlike "
    "earlier stages, you MUST judge substance here — is a position defensible? where is the exposure? — "
    "because the file now exists.\n\n"
    "Produce TWO distinct kinds of findings and keep them distinct:\n"
    "1. DISCREPANCY (consistency): the file contradicts ITSELF or the source record — e.g. one section "
    "states a royalty of 5% and another 5.5%. Objective. Quote the actual conflicting figures/sections "
    "as evidence.\n"
    "2. EXPOSURE (defensibility): the file is internally consistent but a position is WEAK — a service "
    "with no markup where cost-plus is expected, a margin outside the arm's-length range, an intangible "
    "with thin functional support. A judgment a tax authority would challenge.\n\n"
    "LAWS (non-negotiable):\n"
    "- NUMBERS: you do NOT compute or invent exposure figures. Give a severity band or a clearly-flagged "
    "ESTIMATE and set exposure_estimated=true — never present an estimate as a computed figure. Quote "
    "figures that actually appear in the file/record. A hallucinated exposure is worse than none.\n"
    "- RECOMMENDATIONS ARE OPTIONS, NOT INSTRUCTIONS: offer choices the practitioner decides between "
    "(adjust the position / strengthen the documentation / voluntary disclosure vs wait-and-see). Never "
    "dictate, and never say the file is 'compliant'.\n"
    "- DO NOT INVENT RISKS to seem thorough. Only supported concerns with evidence; where uncertain, "
    "lower the confidence and say so.\n\n"
    "Every finding: plain-language title + description, evidence (traceable to a section/figure/document), "
    "a severity, an exposure_label, a confidence, and recommendation options. Call record_findings."
)

RECORD_FINDINGS_TOOL = {
    "name": "record_findings",
    "description": "Record the prioritized risk findings for the completed file.",
    "input_schema": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "kind": {"type": "string", "enum": ["discrepancy", "exposure"]},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "severity": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
                        "exposure_label": {
                            "type": "string",
                            "description": "Severity band or clearly-flagged estimate — not computed precision.",
                        },
                        "exposure_estimated": {
                            "type": "boolean",
                            "description": "true when the magnitude is an estimate/qualitative (true unless a real computation produced it).",
                        },
                        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                        "evidence": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "kind": {"type": "string", "enum": ["section", "figure", "document"]},
                                    "reference": {"type": "string"},
                                    "detail": {"type": "string"},
                                    "source_filename": {
                                        "type": "string",
                                        "description": "The source document filename this evidence comes from, if any (so the user can open it).",
                                    },
                                },
                                "required": ["kind", "reference", "detail"],
                            },
                        },
                        "recommendations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Options the practitioner chooses between — never instructions.",
                        },
                    },
                    "required": ["kind", "title", "description", "severity", "exposure_label",
                                 "exposure_estimated", "confidence", "evidence", "recommendations"],
                },
            }
        },
        "required": ["findings"],
    },
}


@dataclass
class Evidence:
    kind: str
    reference: str
    detail: str
    source_filename: str | None = None  # maps to a document_id for a clickable pointer


@dataclass
class Finding:
    kind: str
    title: str
    description: str
    severity: str
    exposure_label: str
    exposure_estimated: bool
    confidence: str
    evidence: list[Evidence] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


class RiskAnalyzer(Protocol):
    def analyze(self, entity: str, jurisdiction: str, draft_text: str,
                documents: list[DocContext]) -> list[Finding]: ...


def _prompt(entity: str, jurisdiction: str, draft_text: str, documents: list[DocContext]) -> str:
    docs = "\n\n".join(
        f"--- SOURCE: {d.filename} (type: {d.kind}) ---\n{d.text.strip() or '(no extractable text)'}"
        for d in documents
    ) or "(no source documents)"
    return (
        f"ENTITY: {entity or 'the entity'}\nJURISDICTION: {jurisdiction}\n\n"
        f"COMPLETED DRAFT FILE:\n{draft_text}\n\n"
        f"UNDERLYING SOURCE RECORD (to check the draft against):\n{docs}\n\n"
        "Analyze this completed file for risk. Produce discrepancy findings (the file contradicts itself "
        "or the record — quote the conflicting figures) and exposure findings (documented but weak "
        "positions). Call record_findings."
    )


def _parse(payload: dict) -> list[Finding]:
    out: list[Finding] = []
    for f in payload.get("findings", []):
        out.append(
            Finding(
                kind=f["kind"],
                title=f["title"],
                description=f["description"],
                severity=f["severity"],
                exposure_label=f.get("exposure_label", ""),
                exposure_estimated=bool(f.get("exposure_estimated", True)),
                confidence=f.get("confidence", "low"),
                evidence=[
                    Evidence(e["kind"], e["reference"], e["detail"], e.get("source_filename"))
                    for e in f.get("evidence", [])
                ],
                recommendations=list(f.get("recommendations", [])),
            )
        )
    return out


class DeepSeekRiskAnalyzer:
    def __init__(self) -> None:
        self._model = settings.deepseek_model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
        return self._client

    def analyze(self, entity, jurisdiction, draft_text, documents):
        tool = {
            "type": "function",
            "function": {
                "name": "record_findings",
                "description": RECORD_FINDINGS_TOOL["description"],
                "parameters": RECORD_FINDINGS_TOOL["input_schema"],
            },
        }
        resp = self._get_client().chat.completions.create(
            model=self._model,
            max_tokens=4000,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _prompt(entity, jurisdiction, draft_text, documents)},
            ],
            tools=[tool],
            tool_choice={"type": "function", "function": {"name": "record_findings"}},
        )
        return _parse(json.loads(resp.choices[0].message.tool_calls[0].function.arguments))


class AnthropicRiskAnalyzer:
    def __init__(self) -> None:
        self._model = settings.draft_model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        return self._client

    def analyze(self, entity, jurisdiction, draft_text, documents):
        resp = self._get_client().messages.create(
            model=self._model,
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            tools=[RECORD_FINDINGS_TOOL],
            tool_choice={"type": "tool", "name": "record_findings"},
            messages=[{"role": "user", "content": _prompt(entity, jurisdiction, draft_text, documents)}],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "record_findings":
                return _parse(block.input)
        raise RuntimeError("risk analyzer returned no tool_use block")


class FakeRiskAnalyzer:
    """Deterministic — one discrepancy + one exposure finding. Tests + dev fallback. No network."""

    def analyze(self, entity, jurisdiction, draft_text, documents):
        doc_ref = documents[0].filename if documents else "the record"
        return [
            Finding(
                kind="discrepancy",
                title="Royalty rate stated inconsistently across sections",
                description="Two sections of the file cite different royalty rates for the same transaction.",
                severity="high",
                exposure_label="Potential adjustment — quantify once reconciled",
                exposure_estimated=True,
                confidence="high",
                evidence=[Evidence("figure", "Functional analysis vs Financial data",
                                   "One section states 5% while another states 5.5%.")],
                recommendations=[
                    "Reconcile the two sections to a single supported rate.",
                    "Confirm the rate against the executed agreement.",
                ],
            ),
            Finding(
                kind="exposure",
                title="Intra-group services charged without a documented markup",
                description="A service is documented at cost with no arm's-length markup where a cost-plus return would be expected.",
                severity="medium",
                exposure_label="Estimated exposure — precise figure requires computation",
                exposure_estimated=True,
                confidence="medium",
                evidence=[Evidence("document", doc_ref, "Services described at cost, no markup stated.", doc_ref)],
                recommendations=[
                    "Apply a cost-plus markup and document the basis.",
                    "Strengthen the functional analysis supporting a no-markup position.",
                    "Consider voluntary disclosure versus wait-and-see.",
                ],
            ),
        ]
