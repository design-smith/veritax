"""Backward-compatible shim. Jurisdiction requirements now live in the regulatory registry (the single source
of truth for jurisdiction rules — PRD Class 1 "subsume"); this re-exports them so existing callers keep working.
"""

from regulatory.requirements import (
    ResolvedElement,
    available_jurisdictions,
    draft_elements,
    resolve_requirements,
)

__all__ = ["ResolvedElement", "available_jurisdictions", "draft_elements", "resolve_requirements"]
