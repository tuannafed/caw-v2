"""Context-rule scoring — did a trace read the right context for its lane+phase?

Ported from repository-harness (Phase 5 US-022 / CONTEXT_RULES.md). The goal is
not to maximize reading; it is to put the RIGHT docs in the model for the current
task phase and risk lane. This module scores a trace's recorded `files_read`
against per-phase / per-lane must-read and should-read rules, and flags
over-reading (files the lane says to skip).

Paths are caw-v2 conventions: docs/caw/* (policy + stories), scripts/caw/* (CLI +
schema). A "met" check passes when the trace read the target path OR (for
<changed-files>) actually changed files.
"""

from __future__ import annotations


# ── phase inference ──────────────────────────────────────────────────────────
def infer_phase(row):
    """Infer the workflow phase from trace fields (mirrors the Rust heuristic)."""
    changed = (_get(row, "files_changed") or "").strip()
    if _get(row, "outcome") == "completed":
        return "trace"
    if _get(row, "story_id") and changed and changed != "[]":
        return "implementation"
    if _get(row, "risk_lane"):
        return "planning"
    return "intake"


# ── base rules per phase × lane ───────────────────────────────────────────────
# Each rule is (label, target). `must`/`should` are requirements; `skipped` are
# paths the lane should NOT read (over-read signal).
def _base_rules(lane, phase):
    must, should, skipped = [], [], []
    if phase == "trace":
        must.append(("Trace specification", "docs/caw/TRACE_SPEC.md"))
        must.append(("Changed-file list", "git status --short"))
        target = ("Durable matrix", "scripts/caw/bin/harness-cli query matrix")
        (must if lane in ("normal", "high_risk") else should).append(target)
    elif phase == "implementation":
        must.append(("Files being changed", "<changed-files>"))
        if lane in ("normal", "high_risk"):
            must.append(("Relevant story packet", "docs/caw/stories/"))
            should.append(("Architecture rules", "docs/caw/ARCHITECTURE.md"))
        if lane == "high_risk":
            must.append(("Architecture rules", "docs/caw/ARCHITECTURE.md"))
            must.append(("High-risk story template", "docs/caw/templates/high-risk-story/"))
    elif phase == "planning":
        must.append(("Files to edit", "<changed-files>"))
        if lane in ("normal", "high_risk"):
            must.append(("Story template", "docs/caw/templates/story.md"))
            must.append(("Test matrix", "scripts/caw/bin/harness-cli query matrix"))
        if lane == "high_risk":
            must.append(("High-risk story template", "docs/caw/templates/high-risk-story/"))
            must.append(("Harness maturity", "docs/caw/HARNESS_MATURITY.md"))
    else:  # intake
        must.append(("Agent entrypoint", "CLAUDE.md"))
        must.append(("Feature intake", "docs/caw/FEATURE_INTAKE.md"))
        must.append(("Durable matrix", "scripts/caw/bin/harness-cli query matrix"))
        if lane == "tiny":
            skipped.append("docs/caw/ARCHITECTURE.md")
        else:
            must.append(("README", "README.md"))
            must.append(("Harness operating model", "docs/caw/HARNESS.md"))
    return must, should, skipped


# ── dynamic triggers ──────────────────────────────────────────────────────────
def _dynamic_rules(changed):
    """Extra must-reads triggered by WHAT the trace changed (caw-v2 paths)."""
    extra = []
    if any(p.startswith("scripts/caw/schema/") for p in changed):
        extra.append(("SQLite durable layer decision", "docs/caw/decisions/0001-db-is-state-refactor.md"))
    if any(p.startswith("scripts/caw/") or p.startswith("scripts/caw/bin/") for p in changed):
        extra.append(("Durable layer / CLI rules", "docs/caw/HARNESS.md"))
    return extra


# ── helpers ───────────────────────────────────────────────────────────────────
def _get(row, field):
    try:
        return row[field] if field in row.keys() else None
    except (TypeError, AttributeError):
        return row.get(field) if isinstance(row, dict) else None


def jsonish_list(value):
    """Parse a JSON-ish array string into a clean list of path strings.

    Tolerant: handles `["a","b"]`, `a, b`, surrounding whitespace, drops empties
    and the literal `null`."""
    if not value:
        return []
    inner = value.strip().lstrip("[").rstrip("]")
    out = []
    for item in inner.split(","):
        item = item.strip().strip('"').strip("'").strip()
        if item and item != "null":
            out.append(item)
    return out


def _path_matches(path, target):
    if target.endswith("/"):
        return path.startswith(target)
    return path == target or target in path


def _met(read, target, changed):
    if target == "<changed-files>":
        return bool(changed)
    return any(_path_matches(p, target) for p in read)


# ── scoring ───────────────────────────────────────────────────────────────────
def score_row(row):
    """Return a dict: {lane, phase, must:[...], should:[...], over_read:[...]}.

    Each must/should entry is {label, target, met}. over_read is a list of paths
    the lane should have skipped but the trace read anyway."""
    lane = _get(row, "risk_lane") or "unknown"
    phase = infer_phase(row)
    read = jsonish_list(_get(row, "files_read"))
    changed = jsonish_list(_get(row, "files_changed"))

    must, should, skipped = _base_rules(lane, phase)
    must += _dynamic_rules(changed)

    must_res = [{"label": l, "target": t, "met": _met(read, t, changed)} for l, t in must]
    should_res = [{"label": l, "target": t, "met": _met(read, t, changed)} for l, t in should]
    over_read = [p for p in read if any(_path_matches(p, s) for s in skipped)]

    return {
        "lane": lane,
        "phase": phase,
        "must": must_res,
        "should": should_res,
        "over_read": over_read,
    }


def format_assessment(trace_id, result):
    """Human/agent-readable report for `score-context`."""
    lines = [
        f"Context score — trace #{trace_id}",
        f"  lane:  {result['lane']}",
        f"  phase: {result['phase']}",
    ]
    must = result["must"]
    met = sum(1 for r in must if r["met"])
    lines.append(f"  must-read:   {met}/{len(must)} satisfied")
    for r in must:
        mark = "✓" if r["met"] else "✗"
        lines.append(f"    {mark} {r['label']} ({r['target']})")
    should = result["should"]
    if should:
        smet = sum(1 for r in should if r["met"])
        lines.append(f"  should-read: {smet}/{len(should)} satisfied")
        for r in should:
            mark = "✓" if r["met"] else "·"
            lines.append(f"    {mark} {r['label']} ({r['target']})")
    if result["over_read"]:
        lines.append(f"  over-read ({len(result['over_read'])} — lane says skip):")
        for p in result["over_read"]:
            lines.append(f"    ! {p}")
    missing = [r for r in must if not r["met"]]
    if missing:
        lines.append("")
        lines.append(f"⚠️  {len(missing)} required context source(s) not read for "
                     f"a {result['lane']} {result['phase']} trace.")
    else:
        lines.append("")
        lines.append("✅ all required context for this lane+phase was read.")
    return "\n".join(lines)
