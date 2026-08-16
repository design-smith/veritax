"""Deterministic functional-interview question generation (Class 2 §16, §22, §23).

Questions come from controlled modules — core + transaction-specific + role-specific — NOT 500 static questions
(§22). The generator picks the applicable modules for the participant's role and the transaction type(s); the
LLM may later SUGGEST adaptive follow-ups (§17) but never turns an answer into a conclusion.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DATA_PATH = Path(__file__).parent / "data" / "question_modules.json"


@lru_cache(maxsize=1)
def _data() -> dict:
    return json.loads(_DATA_PATH.read_text(encoding="utf-8"))


def question_modules_version() -> int:
    return int(_data()["version"])


def select_questions(participant_role: str | None = None,
                     transaction_types: tuple[str, ...] | list[str] | None = None) -> list[dict]:
    """Core questions + the modules matching the transaction type(s) and participant role, de-duplicated by
    question_key and sequenced. Unknown role/transaction types simply contribute nothing (no error)."""
    data = _data()
    out: list[dict] = []
    seen: set[str] = set()

    def add(questions: list[dict]) -> None:
        for q in questions:
            if q["question_key"] not in seen:
                seen.add(q["question_key"])
                out.append(q)

    add(data["core"])
    for t in transaction_types or ():
        add(data["transaction_modules"].get(t, []))
    if participant_role:
        add(data["role_modules"].get(participant_role, []))

    return [{**q, "sequence": i + 1} for i, q in enumerate(out)]
