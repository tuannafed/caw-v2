"""Trace quality scoring — does a trace meet the tier its lane requires?

Ported from repository-harness (Phase 3 US-008): TRACE_SPEC.md defines three
tiers (minimal/standard/detailed) by field presence, and a lane→tier mapping. This
module scores a trace row mechanically so the agent self-checks instead of relying
on memory. Full field reference: docs/TRACE_SPEC.md.
"""

from __future__ import annotations

# lane → minimum required tier (numeric)
LANE_REQUIRED_TIER = {"tiny": 1, "normal": 2, "high_risk": 3}
TIER_NAME = {1: "minimal", 2: "standard", 3: "detailed"}


def _present(row, field, min_len=1):
    v = row[field] if field in row.keys() else None
    if v is None:
        return False
    if isinstance(v, str):
        return len(v.strip()) >= min_len
    return True


def score_row(row):
    """Return (achieved_tier:int, missing:list[str]) for a trace row.

    Tiers are cumulative; we report the missing fields for the NEXT tier up so the
    agent knows exactly what to add.
    """
    # Minimal (1)
    minimal_missing = []
    if not _present(row, "task_summary", min_len=10):
        minimal_missing.append("task_summary (>=10 chars)")
    if not _present(row, "outcome"):
        minimal_missing.append("outcome")
    if minimal_missing:
        return 0, minimal_missing

    # Standard (2): all minimal + agent + the array fields + at least one of
    # errors / harness_friction.
    standard_missing = []
    if not _present(row, "agent"):
        standard_missing.append("agent")
    for f in ("actions_taken", "files_read", "files_changed"):
        if not _present(row, f):
            standard_missing.append(f)
    if not _present(row, "errors") and not _present(row, "harness_friction"):
        standard_missing.append("errors or harness_friction")
    if standard_missing:
        return 1, standard_missing

    # Detailed (3): all standard + decisions_made + errors(always) +
    # duration_seconds + token_estimate.
    detailed_missing = []
    if not _present(row, "decisions_made"):
        detailed_missing.append("decisions_made")
    if not _present(row, "errors"):
        detailed_missing.append("errors (explicit, 'none' if clean)")
    if not _present(row, "duration_seconds"):
        detailed_missing.append("duration_seconds")
    if not _present(row, "token_estimate"):
        detailed_missing.append("token_estimate")
    if detailed_missing:
        return 2, detailed_missing

    return 3, []


def required_tier_for_lane(lane):
    return LANE_REQUIRED_TIER.get(lane, 2)


def assess(row, lane=None):
    """Full assessment dict: achieved tier, required tier (if lane known), gap."""
    achieved, missing = score_row(row)
    result = {
        "achieved_tier": achieved,
        "achieved_name": TIER_NAME.get(achieved, "below-minimal"),
        "missing_for_next": missing,
    }
    if lane:
        req = required_tier_for_lane(lane)
        result["required_tier"] = req
        result["required_name"] = TIER_NAME[req]
        result["meets_requirement"] = achieved >= req
    return result


def format_assessment(trace_id, row, lane=None):
    a = assess(row, lane)
    lines = [
        f"trace #{trace_id}: tier {a['achieved_tier']} ({a['achieved_name']})"
    ]
    if "required_tier" in a:
        mark = "✅" if a["meets_requirement"] else "❌"
        lines[0] += (
            f"  —  lane requires {a['required_tier']} "
            f"({a['required_name']}) {mark}"
        )
    if a["missing_for_next"]:
        label = "below requirement, missing" if not a.get("meets_requirement", True) \
            else "to reach next tier, add"
        lines.append(f"  {label}: {', '.join(a['missing_for_next'])}")
    return "\n".join(lines)
