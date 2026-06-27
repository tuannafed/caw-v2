"""Harness audit — entropy/drift score for the durable layer + conductor files.

Mirrors repository-harness `audit` (Phase 5 / HARNESS_AUDIT.md): detect drift in
durable state, sum a weighted entropy score (lower is better, capped 100), and
print findings that feed the improvement loop (M5 `propose`).

caw adds file-level checks the DB alone can't see, because caw projects still keep
markdown story files in docs/caw/. These encode real caw failure modes:
a story marked *-done with no plan.md (8 such cases in the 2026-05-27 audit), a
plan.md missing its `## Spec mandate` block, an unbounded backlog file.

Each check returns (count, weight, label, details[]). Score = sum(count*weight),
capped at 100.
"""

from __future__ import annotations

from pathlib import Path

# weight per drift category — same spirit as repository-harness HARNESS_AUDIT.md
WEIGHTS = {
    "orphaned_stories": 10,       # in_progress story with no trace
    "unverified_tasks": 5,       # task has verify_command but no recorded result
    "unverified_decisions": 5,   # decision has verify_command but no result
    "backlog_without_outcome": 2,  # implemented backlog item, no actual_outcome
    "stale_stories": 3,           # unimplemented story, latest trace > 30 days old
    "plandone_no_plan": 10,      # conductor story *-done but plan.md absent
    "plan_no_spec_mandate": 8,   # plan.md exists but no `## Spec mandate`
    "backlog_unbounded": 4,      # legacy markdown backlog exceeds bounded-growth limit
    "open_proposals": 1,         # backlog items proposed but never accepted/rejected
}

BACKLOG_LINE_LIMIT = 250  # bounded-growth guard; tune in conventions.md


def _finding(count, key, label, details):
    return {
        "key": key,
        "count": count,
        "weight": WEIGHTS[key],
        "points": count * WEIGHTS[key],
        "label": label,
        "details": details,
    }


# ----------------------------------------------------------------- DB checks
def _db_checks(conn):
    findings = []

    # orphaned stories: in_progress with zero traces
    rows = conn.execute(
        """SELECT t.id FROM story t
            WHERE t.status = 'in_progress'
              AND NOT EXISTS (SELECT 1 FROM trace tr WHERE tr.story_id = t.id)"""
    ).fetchall()
    findings.append(_finding(
        len(rows), "orphaned_stories",
        "in_progress stories with no trace",
        [r["id"] for r in rows],
    ))

    # unverified tasks: have a verify_command but no result
    rows = conn.execute(
        """SELECT story_id, task_key FROM task
            WHERE verify_command IS NOT NULL AND last_verified_result IS NULL"""
    ).fetchall()
    findings.append(_finding(
        len(rows), "unverified_tasks",
        "tasks with a verify_command but no recorded result",
        [f"{r['story_id']}/{r['task_key']}" for r in rows],
    ))

    # unverified decisions
    rows = conn.execute(
        """SELECT id FROM decision
            WHERE verify_command IS NOT NULL AND last_verified_result IS NULL"""
    ).fetchall()
    findings.append(_finding(
        len(rows), "unverified_decisions",
        "decisions with a verify_command but no recorded result",
        [r["id"] for r in rows],
    ))

    # implemented backlog items missing an outcome (broken predicted->actual loop)
    rows = conn.execute(
        """SELECT id, title FROM backlog
            WHERE status = 'implemented'
              AND (actual_outcome IS NULL OR actual_outcome = '')"""
    ).fetchall()
    findings.append(_finding(
        len(rows), "backlog_without_outcome",
        "implemented backlog items with no actual_outcome",
        [f"#{r['id']} {r['title']}" for r in rows],
    ))

    # stale stories: not yet implemented, latest linked trace older than 30 days
    rows = conn.execute(
        """SELECT t.id FROM story t
            WHERE t.status IN ('planned','in_progress')
              AND EXISTS (SELECT 1 FROM trace tr WHERE tr.story_id = t.id)
              AND (SELECT MAX(created_at) FROM trace tr WHERE tr.story_id = t.id)
                  < datetime('now','-30 days')"""
    ).fetchall()
    findings.append(_finding(
        len(rows), "stale_stories",
        "unimplemented stories whose latest trace is >30 days old",
        [r["id"] for r in rows],
    ))

    # open proposals: backlog items stuck in 'proposed' (the improvement loop
    # stalls if proposals are never triaged into accepted/rejected).
    rows = conn.execute(
        "SELECT id, title FROM backlog WHERE status = 'proposed'"
    ).fetchall()
    findings.append(_finding(
        len(rows), "open_proposals",
        "backlog items still 'proposed' (triage to accepted/rejected)",
        [f"#{r['id']} {r['title'][:50]}" for r in rows],
    ))

    return findings


# ----------------------------------------------------------------- file checks
def _conductor_checks(conductor_dir):
    """File-level drift in docs/caw/ (caw-specific). Returns [] if absent."""
    root = Path(conductor_dir)
    if not root.is_dir():
        return []

    findings = []
    # v2 keeps stories at docs/caw/stories/ (incl. epics/); v1 used tasks/. Status
    # lives in the DB now, not overview.yaml, so the file-level checks key off the
    # presence + content of plan.md, which is the markdown contract the planner owns.
    stories_dir = root / "stories"
    if not stories_dir.is_dir():
        stories_dir = root / "tasks"          # v1 fallback

    plandone_no_plan = []
    plan_no_spec = []
    if stories_dir.is_dir():
        markers = ("plan.md", "code.md", "tests.md", "review.md")
        for story_dir in sorted(p for p in stories_dir.rglob("*") if p.is_dir()):
            # a story folder is one holding any of the prose markers (recurses epics/)
            if not any((story_dir / m).is_file() for m in markers):
                continue
            plan = story_dir / "plan.md"
            # work products exist (code/tests/review authored) but no plan.md
            has_work = any((story_dir / m).is_file() for m in markers[1:])
            if has_work and not plan.is_file():
                plandone_no_plan.append(f"{story_dir.name} (work products, no plan.md)")
            # plan.md present but missing the mandatory Spec mandate block
            if plan.is_file() and "## Spec mandate" not in _read(plan):
                plan_no_spec.append(story_dir.name)

    findings.append(_finding(
        len(plandone_no_plan), "plandone_no_plan",
        "stories with code/tests/review but no plan.md",
        plandone_no_plan,
    ))
    findings.append(_finding(
        len(plan_no_spec), "plan_no_spec_mandate",
        "plan.md files missing a `## Spec mandate` section",
        plan_no_spec,
    ))

    # bounded-growth: harness-backlog.md must not grow unbounded.
    # Post-refactor, backlog lives in the DB — a large markdown backlog means the
    # project hasn't migrated yet (run `harness-cli import`). Flag it as legacy drift.
    backlog = root / "harness-backlog.md"
    over = []
    if backlog.is_file():
        n = len(_read(backlog).splitlines())
        if n > BACKLOG_LINE_LIMIT:
            over.append(f"harness-backlog.md is {n} lines (limit {BACKLOG_LINE_LIMIT}) "
                        f"— markdown backlog is legacy; migrate with `harness-cli import`")
    findings.append(_finding(
        len(over), "backlog_unbounded",
        "legacy markdown backlog exceeding bounded-growth limit (migrate to DB)",
        over,
    ))

    return findings


def _read(path):
    try:
        return path.read_text(errors="replace")
    except OSError:
        return ""


# ----------------------------------------------------------------- entrypoint
def run(conn, conductor_dir=None):
    findings = _db_checks(conn)
    if conductor_dir:
        findings += _conductor_checks(conductor_dir)
    score = min(100, sum(f["points"] for f in findings))
    return score, findings


def interpret(score):
    if score == 0:
        return "Perfect — records are traced, verified, and healthy."
    if score <= 25:
        return "Healthy — minor housekeeping remains."
    if score <= 50:
        return "Attention needed — drift is accumulating."
    return "Action required — stale state undermines harness value."


def format_report(score, findings, fmt="table"):
    if fmt == "json":
        import json
        return json.dumps(
            {"score": score, "interpretation": interpret(score), "findings": findings},
            indent=2, ensure_ascii=False,
        )

    lines = [
        f"Harness entropy score: {score}/100  —  {interpret(score)}",
        "",
    ]
    active = [f for f in findings if f["count"] > 0]
    if not active:
        lines.append("No drift detected across all checks. ✅")
        return "\n".join(lines)

    for f in sorted(active, key=lambda x: -x["points"]):
        lines.append(f"[{f['points']:>3} pts] {f['count']}× {f['label']}")
        for d in f["details"][:10]:
            lines.append(f"          - {d}")
        if len(f["details"]) > 10:
            lines.append(f"          … and {len(f['details']) - 10} more")
    return "\n".join(lines)
