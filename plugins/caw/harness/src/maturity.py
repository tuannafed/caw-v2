"""harness-cli maturity — estimate which maturity level caw has reached.

Checks observable criteria (durable tables populated, CLI capabilities present)
rather than asking the agent to self-assess. See docs/HARNESS_MATURITY.md.
"""

from __future__ import annotations

from pathlib import Path

LEVELS = [
    ("H0", "Bare environment"),
    ("H1", "Scaffolding & policy"),
    ("H2", "Specification layer"),
    ("H3", "Active observability"),
    ("H4", "Mechanical verification"),
    ("H5", "Evolution infrastructure"),
]


def _has_rows(conn, table):
    return conn.execute(f"SELECT 1 FROM {table} LIMIT 1").fetchone() is not None


def assess(conn, repo_root=None):
    """Return (level_code, evidence_lines). repo_root locates rule/doc files."""
    root = Path(repo_root) if repo_root else Path.cwd()
    # Rules + policy docs live in different places depending on context:
    #   - installed project: .claude/rules/common + docs/caw/
    #   - caw source repo (plugin era): plugins/caw/rules/common +
    #     plugins/caw/templates/docs-caw/
    # Prefer whichever exists so maturity works from either location.
    def _first_dir(*candidates):
        for c in candidates:
            if c.is_dir():
                return c
        return candidates[0]

    rules = _first_dir(
        root / "rules" / "common",
        root / ".claude" / "rules" / "common",
        root / "plugins" / "caw" / "rules" / "common",
    )
    # Resolve docs to the candidate that actually holds the policy docs
    # (the repo's own docs/ has only design notes, not TRACE_SPEC.md etc.).
    def _docs_with(marker, *candidates):
        for c in candidates:
            if (c / marker).is_file():
                return c
        return candidates[0]

    docs = _docs_with(
        "TRACE_SPEC.md",
        root / "docs" / "caw",
        root / "plugins" / "caw" / "templates" / "docs-caw",
        root / "docs",
    )

    evidence = []
    reached = "H1"  # the durable layer existing implies H1 scaffolding

    # H2 — specification layer rules present
    spec_rules = [
        rules / "spec-traceability.md",
        rules / "test-tiers.md",
        rules / "runtime-smoke-test.md",
    ]
    if all(p.is_file() for p in spec_rules):
        reached = "H2"
        evidence.append("H2: spec-traceability + test-tiers + runtime-smoke rules present")

    # H3 — active observability: traces recorded + TRACE_SPEC
    if (docs / "TRACE_SPEC.md").is_file() and _has_rows(conn, "trace"):
        reached = "H3"
        evidence.append("H3: TRACE_SPEC.md present and trace rows recorded")
    elif (docs / "TRACE_SPEC.md").is_file():
        evidence.append("H3 (partial): TRACE_SPEC.md present but no trace rows yet")

    # H4 — mechanical verification: a task has been verified
    verified = conn.execute(
        "SELECT 1 FROM task WHERE last_verified_result IS NOT NULL LIMIT 1"
    ).fetchone()
    if reached == "H3" and verified:
        reached = "H4"
        evidence.append("H4: at least one task recorded a verification result")
    elif verified is None:
        evidence.append("H4 (partial): no task verification recorded yet")

    # H5 — evolution: improvement protocol present + a proposal has been filed
    proposed = conn.execute(
        "SELECT 1 FROM backlog WHERE status = 'proposed' LIMIT 1"
    ).fetchone()
    if reached == "H4" and (docs / "IMPROVEMENT_PROTOCOL.md").is_file() and proposed:
        reached = "H5"
        evidence.append("H5: improvement protocol present and a proposal filed")
    elif (docs / "IMPROVEMENT_PROTOCOL.md").is_file():
        evidence.append("H5 (partial): protocol present; file a proposal via `propose --commit`")

    # Coverage signals (post-refactor): the 3 gut responsibilities caw filled.
    if (docs / "CONTEXT_RULES.md").is_file():
        evidence.append("context: CONTEXT_RULES.md present (responsibility #2)")
    if conn.execute("SELECT 1 FROM intervention LIMIT 1").fetchone():
        evidence.append("intervention: recorded (responsibility #11)")

    return reached, evidence


def format_report(level, evidence):
    name = dict(LEVELS).get(level, "?")
    lines = [f"Harness maturity: {level} — {name}", ""]
    lines += [f"  {e}" for e in evidence] if evidence else ["  (no evidence captured)"]
    lines.append("")
    lines.append("Maturity is the machinery being USED — keep recording traces and "
                 "closing proposals; watch `audit` trend toward 0.")
    return "\n".join(lines)
