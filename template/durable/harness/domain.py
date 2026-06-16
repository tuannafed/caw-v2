"""Domain vocabulary — enums and value validation.

Single source of truth for the allowed values the SQLite CHECK constraints also
enforce. Keeping them here lets the CLI fail fast with a clear message before the
DB raises an opaque IntegrityError.
"""

from __future__ import annotations

INPUT_TYPES = (
    "new_spec",
    "spec_slice",
    "change_request",
    "new_initiative",
    "maintenance",
    "harness_improvement",
)

RISK_LANES = ("tiny", "normal", "high_risk")

STORY_STATUSES = ("planned", "in_progress", "implemented", "changed", "retired")

TASK_STATUSES = ("pending", "in_progress", "blocked", "done")

DECISION_STATUSES = ("proposed", "accepted", "superseded", "rejected")

BACKLOG_STATUSES = ("proposed", "accepted", "implemented", "rejected")

TRACE_OUTCOMES = ("completed", "blocked", "partial", "failed")

VERIFY_RESULTS = ("pass", "fail")

INTERVENTION_SOURCES = ("human", "reviewer", "ci", "agent")


class ValidationError(ValueError):
    """Raised when a CLI argument violates the domain vocabulary."""


def check_choice(value, allowed, field):
    """Return value if it is in `allowed`, else raise ValidationError.

    None passes through (callers decide whether a field is required).
    """
    if value is None:
        return None
    if value not in allowed:
        raise ValidationError(
            f"{field}: '{value}' is not valid. Allowed: {', '.join(allowed)}"
        )
    return value


def require(value, field):
    """Raise ValidationError if a required value is missing/empty."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        raise ValidationError(f"{field} is required")
    return value
