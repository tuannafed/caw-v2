"""Command implementations for the caw durable-layer CLI.

Each function takes (conn, args-ish) and returns a string to print (or raises
domain.ValidationError for a clean CLI error). Kept in one module for M1; split
per-table when this crosses ~600 lines (the ADR-0005 Rust-rewrite trigger).
"""

from __future__ import annotations

import json
import subprocess

from pathlib import Path

from . import audit, domain, importer, lint, maturity, propose, render, scoring, state_drift

# Fields shown in --summary for each table (compact, agent-friendly).
SUMMARY_FIELDS = {
    "intake": ["id", "input_type", "risk_lane", "summary", "story_id"],
    "story": ["id", "status", "risk_lane", "title"],
    "task": ["id", "story_id", "task_key", "status", "last_verified_result"],
    "decision": ["id", "status", "title", "last_verified_result"],
    "backlog": ["id", "status", "risk", "title"],
    "trace": ["id", "story_id", "agent", "outcome", "task_summary"],
}


def _json_array(value):
    """Accept a comma-separated CLI string OR None; store as JSON array text."""
    if value is None:
        return None
    items = [s.strip() for s in value.split(",") if s.strip()]
    return json.dumps(items, ensure_ascii=False)


# ---------------------------------------------------------------- intake
def intake_add(conn, a):
    domain.require(a.summary, "summary")
    domain.check_choice(a.input_type, domain.INPUT_TYPES, "input_type")
    domain.check_choice(a.risk_lane, domain.RISK_LANES, "risk_lane")
    cur = conn.execute(
        """INSERT INTO intake (input_type, summary, risk_lane, risk_flags,
                               affected_docs, story_id, notes)
           VALUES (?,?,?,?,?,?,?)""",
        (a.input_type, a.summary, a.risk_lane, _json_array(a.risk_flags),
         _json_array(a.affected_docs), a.story_id, a.notes),
    )
    conn.commit()
    return f"intake #{cur.lastrowid} recorded ({a.input_type}, {a.risk_lane})"


# ---------------------------------------------------------------- story
def story_add(conn, a):
    domain.require(a.id, "id")
    domain.require(a.title, "title")
    domain.check_choice(a.risk_lane, domain.RISK_LANES, "risk_lane")
    conn.execute(
        """INSERT INTO story (id, title, risk_lane, contract_doc, status, notes)
           VALUES (?,?,?,?,COALESCE(?,'planned'),?)""",
        (a.id, a.title, a.risk_lane, a.contract_doc, a.status, a.notes),
    )
    conn.commit()
    return f"story {a.id} created ({a.risk_lane})"


def story_update(conn, a):
    domain.require(a.id, "id")
    domain.check_choice(a.status, domain.STORY_STATUSES, "status")
    sets, vals = [], []
    for field in ("status", "title", "contract_doc", "evidence", "notes",
                  "unit_proof", "integration_proof", "e2e_proof", "platform_proof"):
        v = getattr(a, field, None)
        if v is not None:
            sets.append(f"{field} = ?")
            vals.append(v)
    if not sets:
        return f"story {a.id}: nothing to update"
    vals.append(a.id)
    n = conn.execute(f"UPDATE story SET {', '.join(sets)} WHERE id = ?", vals).rowcount
    conn.commit()
    if n == 0:
        raise domain.ValidationError(f"story {a.id} not found")
    return f"story {a.id} updated"


# ---------------------------------------------------------------- task
def task_add(conn, a):
    domain.require(a.story_id, "story_id")
    domain.require(a.task_key, "task_key")
    cur = conn.execute(
        """INSERT INTO task (story_id, task_key, description, verify_command, notes)
           VALUES (?,?,?,?,?)""",
        (a.story_id, a.task_key, a.description, a.verify_command, a.notes),
    )
    conn.commit()
    return f"task #{cur.lastrowid} ({a.story_id}/{a.task_key}) added"


def task_update(conn, a):
    domain.require(a.story_id, "story_id")
    domain.require(a.task_key, "task_key")
    domain.check_choice(a.status, domain.TASK_STATUSES, "status")
    sets, vals = [], []
    for field in ("status", "description", "verify_command", "notes"):
        v = getattr(a, field, None)
        if v is not None:
            sets.append(f"{field} = ?")
            vals.append(v)
    if not sets:
        return "task: nothing to update"
    vals.extend([a.story_id, a.task_key])
    n = conn.execute(
        f"UPDATE task SET {', '.join(sets)} WHERE story_id = ? AND task_key = ?", vals
    ).rowcount
    conn.commit()
    if n == 0:
        raise domain.ValidationError(f"task {a.story_id}/{a.task_key} not found")
    return f"task {a.story_id}/{a.task_key} updated"


# ---------------------------------------------------------------- decision
def decision_add(conn, a):
    domain.require(a.id, "id")
    domain.require(a.title, "title")
    domain.check_choice(a.status, domain.DECISION_STATUSES, "status")
    conn.execute(
        """INSERT INTO decision (id, title, status, doc_path, verify_command,
                                 predicted_impact, notes)
           VALUES (?,?,COALESCE(?,'proposed'),?,?,?,?)""",
        (a.id, a.title, a.status, a.doc_path, a.verify_command,
         a.predicted_impact, a.notes),
    )
    conn.commit()
    return f"decision {a.id} recorded"


# ---------------------------------------------------------------- backlog
def backlog_add(conn, a):
    domain.require(a.title, "title")
    domain.check_choice(a.risk, domain.RISK_LANES, "risk")
    cur = conn.execute(
        """INSERT INTO backlog (title, discovered_while, current_pain,
                                suggested_improvement, risk, predicted_impact, notes)
           VALUES (?,?,?,?,?,?,?)""",
        (a.title, a.discovered_while, a.current_pain, a.suggested_improvement,
         a.risk, a.predicted_impact, a.notes),
    )
    conn.commit()
    return f"backlog #{cur.lastrowid} added ({a.title})"


def backlog_close(conn, a):
    domain.require(a.id, "id")
    status = a.status or "implemented"
    domain.check_choice(status, domain.BACKLOG_STATUSES, "status")
    if status == "implemented":
        domain.require(a.outcome, "outcome (required to close as implemented)")
    n = conn.execute(
        """UPDATE backlog
              SET status = ?, actual_outcome = ?, implemented_at = datetime('now')
            WHERE id = ?""",
        (status, a.outcome, a.id),
    ).rowcount
    conn.commit()
    if n == 0:
        raise domain.ValidationError(f"backlog #{a.id} not found")
    return f"backlog #{a.id} closed as {status}"


# ---------------------------------------------------------------- trace
def trace_add(conn, a):
    domain.require(a.summary, "summary")
    domain.check_choice(a.outcome, domain.TRACE_OUTCOMES, "outcome")
    cur = conn.execute(
        """INSERT INTO trace (task_summary, intake_id, story_id, agent,
                              actions_taken, files_read, files_changed,
                              decisions_made, errors, outcome,
                              duration_seconds, token_estimate, harness_friction, notes)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (a.summary, a.intake_id, a.story_id, a.agent,
         _json_array(a.actions), _json_array(a.files_read),
         _json_array(a.files_changed), _json_array(a.decisions),
         _json_array(a.errors), a.outcome,
         a.duration_seconds, a.token_estimate, a.friction, a.notes),
    )
    conn.commit()
    trace_id = cur.lastrowid
    # Auto-score on write (Phase 3 US-016): immediate tier feedback.
    row = conn.execute("SELECT * FROM trace WHERE id = ?", (trace_id,)).fetchone()
    lane = _lane_for_story(conn, a.story_id)
    summary = scoring.format_assessment(trace_id, row, lane)
    return f"trace #{trace_id} recorded ({a.outcome})\n{summary}"


def _lane_for_story(conn, story_id):
    if not story_id:
        return None
    r = conn.execute("SELECT risk_lane FROM story WHERE id = ?", (story_id,)).fetchone()
    return r["risk_lane"] if r else None


def score_trace(conn, a):
    """Score a trace against its lane requirement. Default: most recent trace."""
    if a.id:
        row = conn.execute("SELECT * FROM trace WHERE id = ?", (a.id,)).fetchone()
    else:
        row = conn.execute("SELECT * FROM trace ORDER BY id DESC LIMIT 1").fetchone()
    if row is None:
        raise domain.ValidationError("no trace found to score")
    lane = _lane_for_story(conn, row["story_id"])
    return scoring.format_assessment(row["id"], row, lane)


# ---------------------------------------------------------------- intervention (R1)
def intervention_add(conn, a):
    domain.require(a.summary, "summary")
    domain.check_choice(a.source, domain.INTERVENTION_SOURCES, "source")
    cur = conn.execute(
        """INSERT INTO intervention (source, story_id, trace_id, summary, rationale, notes)
           VALUES (?,?,?,?,?,?)""",
        (a.source, a.story_id, a.trace_id, a.summary, a.rationale, a.notes),
    )
    conn.commit()
    return f"intervention #{cur.lastrowid} recorded ({a.source})"


# ---------------------------------------------------------------- tool registry (R1)
def tool_register(conn, a):
    domain.require(a.name, "name")
    domain.require(a.command, "command")
    try:
        conn.execute(
            """INSERT INTO tool (name, command, responsibility, description)
               VALUES (?,?,?,?)""",
            (a.name, a.command, a.responsibility, a.description),
        )
    except Exception as e:
        raise domain.ValidationError(f"tool '{a.name}' already registered" if "UNIQUE" in str(e) else str(e))
    conn.commit()
    return f"tool '{a.name}' registered"


def tool_remove(conn, a):
    domain.require(a.name, "name")
    n = conn.execute("DELETE FROM tool WHERE name = ?", (a.name,)).rowcount
    conn.commit()
    if n == 0:
        raise domain.ValidationError(f"tool '{a.name}' not found")
    return f"tool '{a.name}' removed"


# ---------------------------------------------------------------- matrix (R1)
def matrix(conn, a):
    """Project-wide test-matrix, generated FROM story+task (replaces the markdown
    index). One row per story: lane, status, task count, verified count."""
    rows = conn.execute(
        """SELECT s.id, s.status, s.risk_lane,
                  COUNT(t.id) AS tasks,
                  COALESCE(SUM(t.verify_command IS NOT NULL), 0) AS verifiable,
                  COALESCE(SUM(t.last_verified_result = 'pass'), 0) AS passed
             FROM story s LEFT JOIN task t ON t.story_id = s.id
            GROUP BY s.id
            ORDER BY s.id"""
    ).fetchall()
    fields = ["id", "status", "risk_lane", "tasks", "verifiable", "passed"]
    fmt = "json" if a.json else ("summary" if a.summary else "table")
    return render.emit(rows, fmt, fields)


# ---------------------------------------------------------------- query
QUERYABLE = set(SUMMARY_FIELDS) | {"intervention", "tool"}
SUMMARY_FIELDS["intervention"] = ["id", "source", "story_id", "summary"]
SUMMARY_FIELDS["tool"] = ["id", "name", "command", "responsibility"]


OPEN_STATUSES = ("proposed", "accepted")
CLOSED_STATUSES = ("implemented", "rejected")


def query(conn, a):
    table = a.table
    if table not in QUERYABLE:
        raise domain.ValidationError(
            f"query: unknown table '{table}'. Choose: {', '.join(sorted(QUERYABLE))}"
        )
    sql = f"SELECT * FROM {table}"  # table name validated against allowlist above
    params = ()
    # --open/--closed filter on backlog status (the predicted->actual loop view).
    want_open = getattr(a, "open", False)
    want_closed = getattr(a, "closed", False)
    if (want_open or want_closed) and table != "backlog":
        raise domain.ValidationError("--open/--closed only apply to `query backlog`")
    if want_open:
        sql += " WHERE status IN (?, ?)"
        params = OPEN_STATUSES
    elif want_closed:
        sql += " WHERE status IN (?, ?)"
        params = CLOSED_STATUSES
    sql += " ORDER BY 1"
    # Bound output by default so a large project (e.g. 80 tasks) can't flood the
    # agent's context in one query. --all lifts the cap; --limit N overrides it.
    limit = _resolve_limit(a)
    if limit is not None:
        sql += " LIMIT ?"
        params = (*params, limit)
    rows = conn.execute(sql, params).fetchall()
    fmt = "json" if a.json else ("summary" if a.summary else "table")
    out = render.emit(rows, fmt, SUMMARY_FIELDS[table])
    if limit is not None and len(rows) == limit:
        out += (f"\n\n… showing {limit} rows (default cap). "
                f"Use --limit N or --all to see more.")
    return out


DEFAULT_QUERY_LIMIT = 20


def _resolve_limit(a):
    """None means unbounded (--all); otherwise an int row cap (default 20)."""
    if getattr(a, "all", False):
        return None
    limit = getattr(a, "limit", None)
    if limit is None:
        return DEFAULT_QUERY_LIMIT
    if limit <= 0:
        raise domain.ValidationError("--limit must be a positive integer")
    return limit


# ---------------------------------------------------------------- propose
def propose_cmd(conn, a):
    proposals = propose.generate(conn, conductor_dir=a.conductor)
    if a.commit:
        n = propose.commit(conn, proposals)
        return f"{n} proposal(s) filed as proposed backlog items " \
               f"({len(proposals) - n} skipped as duplicates)."
    return propose.format_proposals(proposals)


# ---------------------------------------------------------------- verify gate
def _run_verify(command):
    """Run a verify command via the shell; return (result, exit_code, tail).

    `result` is 'pass' on exit 0, else 'fail'. tail is the last lines of combined
    output for the agent to read without dumping the whole log.
    """
    proc = subprocess.run(
        command, shell=True, capture_output=True, text=True
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    tail = "\n".join(out.strip().splitlines()[-8:])
    return ("pass" if proc.returncode == 0 else "fail"), proc.returncode, tail


def task_verify(conn, a):
    domain.require(a.story_id, "story_id")
    domain.require(a.task_key, "task_key")
    row = conn.execute(
        "SELECT verify_command FROM task WHERE story_id = ? AND task_key = ?",
        (a.story_id, a.task_key),
    ).fetchone()
    if row is None:
        raise domain.ValidationError(f"task {a.story_id}/{a.task_key} not found")
    cmd = row["verify_command"]
    if not cmd:
        raise domain.ValidationError(
            f"task {a.story_id}/{a.task_key} has no verify_command — set one with "
            f"`task update --story-id {a.story_id} --task-key {a.task_key} --verify '<cmd>'`"
        )
    result, code, tail = _run_verify(cmd)
    conn.execute(
        """UPDATE task
              SET last_verified_result = ?, last_verified_at = datetime('now')
            WHERE story_id = ? AND task_key = ?""",
        (result, a.story_id, a.task_key),
    )
    conn.commit()
    mark = "✅" if result == "pass" else "❌"
    return f"{mark} task {a.story_id}/{a.task_key} verify {result} (exit {code})\n{tail}"


def decision_verify(conn, a):
    domain.require(a.id, "id")
    row = conn.execute(
        "SELECT verify_command FROM decision WHERE id = ?", (a.id,)
    ).fetchone()
    if row is None:
        raise domain.ValidationError(f"decision {a.id} not found")
    if not row["verify_command"]:
        raise domain.ValidationError(f"decision {a.id} has no verify_command")
    result, code, tail = _run_verify(row["verify_command"])
    conn.execute(
        """UPDATE decision
              SET last_verified_result = ?, last_verified_at = datetime('now')
            WHERE id = ?""",
        (result, a.id),
    )
    conn.commit()
    mark = "✅" if result == "pass" else "❌"
    return f"{mark} decision {a.id} verify {result} (exit {code})\n{tail}"


def story_verify_all(conn, a):
    """Run every task verify_command — for one story (--story-id) or all stories.

    repository-harness `story verify-all` (Phase 5 US-020): the Evaluator scales
    beyond a single task. Records each result; returns a summary.
    """
    if a.story_id:
        tasks = conn.execute(
            "SELECT story_id, task_key FROM task "
            "WHERE story_id = ? AND verify_command IS NOT NULL",
            (a.story_id,),
        ).fetchall()
    else:
        tasks = conn.execute(
            "SELECT story_id, task_key FROM task WHERE verify_command IS NOT NULL"
        ).fetchall()
    if not tasks:
        return "verify-all: no tasks with a verify_command."

    results = []
    for t in tasks:
        row = conn.execute(
            "SELECT verify_command FROM task WHERE story_id = ? AND task_key = ?",
            (t["story_id"], t["task_key"]),
        ).fetchone()
        result, code, _ = _run_verify(row["verify_command"])
        conn.execute(
            "UPDATE task SET last_verified_result = ?, last_verified_at = datetime('now') "
            "WHERE story_id = ? AND task_key = ?",
            (result, t["story_id"], t["task_key"]),
        )
        results.append((t["story_id"], t["task_key"], result))
    conn.commit()

    passed = sum(1 for _, _, r in results if r == "pass")
    lines = [f"verify-all: {passed}/{len(results)} passed"]
    for sid, key, r in results:
        lines.append(f"  {'✅' if r == 'pass' else '❌'} {sid}/{key}: {r}")
    return "\n".join(lines)


def story_gate(conn, a):
    """Pre-close gate: is the story safe to approve?

    A story fails the gate if any of its tasks carries a verify_command that has
    not recorded a `pass`. This is what reviewer.md / caw-verify must consult
    before declaring ready-to-commit. Exit-style: returns text; raises
    ValidationError (exit 2) when the gate is NOT satisfied, so a calling script
    can branch on the exit code.
    """
    domain.require(a.story_id, "story_id")
    if conn.execute("SELECT 1 FROM story WHERE id = ?", (a.story_id,)).fetchone() is None:
        raise domain.ValidationError(f"story {a.story_id} not found")

    tasks = conn.execute(
        """SELECT task_key, verify_command, last_verified_result
             FROM task WHERE story_id = ? AND verify_command IS NOT NULL""",
        (a.story_id,),
    ).fetchall()

    if not tasks:
        return (f"⚠️  story {a.story_id}: gate PASSES vacuously — no task carries a "
                f"verify_command. If this story touches real I/O, add one and verify.")

    not_passed = [t["task_key"] for t in tasks if t["last_verified_result"] != "pass"]
    if not_passed:
        raise domain.ValidationError(
            f"story {a.story_id}: GATE BLOCKED — {len(not_passed)} task(s) not verified "
            f"pass: {', '.join(not_passed)}. Run `task verify --story-id {a.story_id} "
            f"--task-key <key>` for each before approving."
        )
    return f"✅ story {a.story_id}: gate PASSES — all {len(tasks)} verifiable task(s) pass."


# ---------------------------------------------------------------- audit
def audit_cmd(conn, a):
    score, findings = audit.run(conn, conductor_dir=a.conductor)
    return audit.format_report(score, findings, fmt="json" if a.json else "table")


# ---------------------------------------------------------------- import (R4)
def import_cmd(conn, a):
    if not a.conductor:
        raise domain.ValidationError(
            "import needs a conductor dir (no docs/caw auto-detected)"
        )
    report = importer.run(conn, a.conductor, dry_run=a.dry_run)
    return importer.format_report(report, a.dry_run)


# ---------------------------------------------------------------- lint
def lint_cmd(conn, a):
    if not a.conductor:
        raise domain.ValidationError(
            "lint needs a conductor dir (no docs/caw auto-detected)"
        )
    # Two independent gates: bounded-growth (markdown size) + state-drift
    # (DB-owned status restated in prose). Both findings types fail the lint.
    growth = lint.run(a.conductor)
    drift = state_drift.run(a.conductor)
    out = lint.format_findings(growth) + "\n\n" + state_drift.format_findings(drift)
    if growth or drift:
        raise domain.ValidationError(out)  # non-zero exit for commit hooks
    return out


# ---------------------------------------------------------------- maturity
def maturity_cmd(conn, a):
    # repo_root: the dir containing rules/ and docs/ — parent of scripts/.
    repo_root = Path(__file__).resolve().parent.parent.parent
    level, evidence = maturity.assess(conn, repo_root=str(repo_root))
    return maturity.format_report(level, evidence)
