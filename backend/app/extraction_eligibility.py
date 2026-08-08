from __future__ import annotations

from dataclasses import dataclass

from .extraction_schemas import schema_keys_for_document_type


@dataclass(frozen=True)
class ExtractionEligibility:
    status: str
    schema_keys: list[str]
    scope_warnings: list[str]


def _scope_warnings(source_validation_result: dict) -> list[str]:
    return [
        f"{key}: {value}"
        for key, value in source_validation_result.items()
        if str(value).lower() not in {"pass", "passed"}
    ]


def extraction_eligibility(
    *,
    document_type: str,
    classification_state: str,
    relevance: str,
    source_validation_result: dict,
    document_active: bool = True,
) -> ExtractionEligibility:
    if not document_active:
        return ExtractionEligibility("skipped_deleted", [], [])
    if relevance == "out_of_scope":
        return ExtractionEligibility("skipped_out_of_scope", [], [])
    if relevance == "unknown" or document_type == "Unknown" or classification_state in {"unknown", "rejected"}:
        return ExtractionEligibility("skipped_unknown", [], [])

    keys = schema_keys_for_document_type(document_type)
    if not keys:
        return ExtractionEligibility("skipped_not_supported", [], [])
    if classification_state == "needs_review" and len(keys) != 1:
        return ExtractionEligibility("skipped_ambiguous", [], _scope_warnings(source_validation_result))
    return ExtractionEligibility("pending", keys, _scope_warnings(source_validation_result))
