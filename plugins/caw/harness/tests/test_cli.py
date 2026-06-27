"""Tests for the caw durable-layer CLI.

Drives the real `main()` (argparse + commands + sqlite) against a temp DB file,
so a regression in wiring, validation, or SQL is caught — not just the happy path.
Run: pytest scripts/tests
"""

import importlib.util
import sqlite3
import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

import pytest

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

# harness-cli has no .py extension — load it with an explicit source loader
# (spec_from_file_location can't infer a loader for an extensionless file).
_loader = SourceFileLoader("harness_cli", str(DURABLE_DIR / "bin" / "harness-cli"))
_spec = importlib.util.spec_from_loader("harness_cli", _loader)
cli = importlib.util.module_from_spec(_spec)
_loader.exec_module(cli)

from src import db as dbmod  # noqa: E402


@pytest.fixture
def dbfile(tmp_path):
    return str(tmp_path / "harness.db")


def run(dbfile, *args):
    """Invoke the CLI with --db pointing at the temp file; return exit code."""
    return cli.main(["--db", dbfile, *args])


def rows(dbfile, table):
    conn = sqlite3.connect(dbfile)
    conn.row_factory = sqlite3.Row
    try:
        return conn.execute(f"SELECT * FROM {table}").fetchall()
    finally:
        conn.close()


# ----------------------------------------------------------------- migration
def test_init_creates_schema(dbfile):
    assert run(dbfile, "init") == 0
    conn = dbmod.connect(dbfile)
    try:
        names = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
    finally:
        conn.close()
    assert {"intake", "story", "task", "decision", "backlog", "trace"} <= names


def test_migrate_is_idempotent(dbfile):
    run(dbfile, "init")
    n_migrations = len(dbmod.schema_files())  # don't hard-code: grows with each migration
    # second connect/migrate must not re-apply or duplicate schema_version rows
    conn = dbmod.connect(dbfile)
    try:
        ver = dbmod.migrate(conn)
        count = conn.execute("SELECT COUNT(*) FROM schema_version").fetchone()[0]
    finally:
        conn.close()
    assert ver == n_migrations          # latest version == number of migration files
    assert count == n_migrations        # one schema_version row per applied migration


# ----------------------------------------------------------------- intake
def test_intake_add(dbfile):
    run(dbfile, "init")
    code = run(
        dbfile, "intake", "add",
        "--input-type", "change_request",
        "--risk-lane", "normal",
        "--summary", "do a thing",
        "--risk-flags", "auth, data_model",
    )
    assert code == 0
    r = rows(dbfile, "intake")[0]
    assert r["input_type"] == "change_request"
    # comma list stored as JSON array text
    assert r["risk_flags"] == '["auth", "data_model"]'


def test_intake_bad_input_type_rejected(dbfile, capsys):
    run(dbfile, "init")
    code = run(
        dbfile, "intake", "add",
        "--input-type", "nonsense", "--risk-lane", "normal", "--summary", "x",
    )
    assert code == 2
    assert "not valid" in capsys.readouterr().err
    assert rows(dbfile, "intake") == []


# ----------------------------------------------------------------- story + task
def test_story_and_task_lifecycle(dbfile):
    run(dbfile, "init")
    run(dbfile, "story", "add", "--id", "t1", "--title", "T", "--risk-lane", "high_risk")
    run(dbfile, "task", "add", "--story-id", "t1", "--task-key", "be", "--verify", "pytest")
    run(dbfile, "task", "update", "--story-id", "t1", "--task-key", "be", "--status", "done")

    p = rows(dbfile, "task")[0]
    assert p["story_id"] == "t1"
    assert p["status"] == "done"
    assert p["verify_command"] == "pytest"


def test_task_update_unknown_id_errors(dbfile):
    run(dbfile, "init")
    code = run(dbfile, "story", "update", "--id", "missing", "--status", "implemented")
    assert code == 2


def test_task_bad_status_rejected(dbfile, capsys):
    run(dbfile, "init")
    run(dbfile, "story", "add", "--id", "t1", "--title", "T", "--risk-lane", "tiny")
    run(dbfile, "task", "add", "--story-id", "t1", "--task-key", "be")
    code = run(dbfile, "task", "update", "--story-id", "t1", "--task-key", "be",
               "--status", "wat")
    assert code == 2
    assert "not valid" in capsys.readouterr().err


def test_task_fk_requires_existing_story(dbfile):
    run(dbfile, "init")
    # foreign_keys=ON → inserting a task for a non-existent story must fail
    with pytest.raises(sqlite3.IntegrityError):
        run(dbfile, "task", "add", "--story-id", "ghost", "--task-key", "x")


# ----------------------------------------------------------------- backlog loop
def test_backlog_predicted_then_outcome(dbfile):
    run(dbfile, "init")
    run(dbfile, "backlog", "add", "--title", "B", "--risk", "tiny",
        "--predicted", "saves time")
    run(dbfile, "backlog", "close", "--id", "1", "--outcome", "it did")
    b = rows(dbfile, "backlog")[0]
    assert b["status"] == "implemented"
    assert b["predicted_impact"] == "saves time"
    assert b["actual_outcome"] == "it did"
    assert b["implemented_at"] is not None


def test_backlog_close_implemented_requires_outcome(dbfile, capsys):
    run(dbfile, "init")
    run(dbfile, "backlog", "add", "--title", "B", "--risk", "tiny")
    code = run(dbfile, "backlog", "close", "--id", "1")  # no --outcome
    assert code == 2
    assert "required" in capsys.readouterr().err


def test_backlog_close_rejected_status_skips_outcome(dbfile):
    run(dbfile, "init")
    run(dbfile, "backlog", "add", "--title", "B", "--risk", "tiny")
    code = run(dbfile, "backlog", "close", "--id", "1", "--status", "rejected")
    assert code == 0
    assert rows(dbfile, "backlog")[0]["status"] == "rejected"


# ----------------------------------------------------------------- trace
def test_trace_records_json_arrays(dbfile):
    run(dbfile, "init")
    run(dbfile, "trace", "--summary", "did work", "--outcome", "completed",
        "--files-changed", "a.py, b.py", "--agent", "coder")
    t = rows(dbfile, "trace")[0]
    assert t["outcome"] == "completed"
    assert t["files_changed"] == '["a.py", "b.py"]'


def test_trace_bad_outcome_rejected(dbfile):
    run(dbfile, "init")
    code = run(dbfile, "trace", "--summary", "x", "--outcome", "kinda")
    assert code == 2


# ----------------------------------------------------------------- query
def test_query_unknown_table_rejected(dbfile, capsys):
    run(dbfile, "init")
    code = run(dbfile, "query", "robots")
    assert code == 2
    assert "unknown table" in capsys.readouterr().err


def test_query_json_and_summary(dbfile, capsys):
    run(dbfile, "init")
    run(dbfile, "story", "add", "--id", "t1", "--title", "T", "--risk-lane", "tiny")
    run(dbfile, "query", "story", "--json")
    out = capsys.readouterr().out
    assert '"id": "t1"' in out
    run(dbfile, "query", "story", "--summary")
    assert "id=t1" in capsys.readouterr().out


# --------------------------------------------------- ported: query stats/friction/sql
def test_query_stats_counts(dbfile, capsys):
    run(dbfile, "init")
    run(dbfile, "story", "add", "--id", "s1", "--title", "T", "--risk-lane", "tiny")
    run(dbfile, "query", "stats")
    out = capsys.readouterr().out
    assert "story" in out and "1" in out
    assert "trace" in out and "intervention" in out


def test_query_friction_only_friction_traces(dbfile, capsys):
    run(dbfile, "init")
    run(dbfile, "trace", "--summary", "clean run no friction", "--outcome", "completed")
    run(dbfile, "trace", "--summary", "hit a snag", "--outcome", "partial",
        "--friction", "skill-map lookup slow")
    run(dbfile, "query", "friction", "--summary")
    out = capsys.readouterr().out
    assert "skill-map lookup slow" in out
    assert "clean run no friction" not in out


def test_query_sql_read_ok(dbfile, capsys):
    run(dbfile, "init")
    run(dbfile, "story", "add", "--id", "s1", "--title", "T", "--risk-lane", "tiny")
    run(dbfile, "query", "sql", "SELECT id FROM story")
    assert "s1" in capsys.readouterr().out


def test_query_sql_write_rejected(dbfile, capsys):
    run(dbfile, "init")
    code = run(dbfile, "query", "sql", "DELETE FROM story")
    assert code == 2
    assert "read-only" in capsys.readouterr().err


def test_query_sql_multi_statement_rejected(dbfile, capsys):
    run(dbfile, "init")
    code = run(dbfile, "query", "sql", "SELECT 1; DROP TABLE story")
    assert code == 2
    assert "single statement" in capsys.readouterr().err


def test_query_sql_empty_rejected(dbfile, capsys):
    run(dbfile, "init")
    code = run(dbfile, "query", "sql")
    assert code == 2
    assert "needs a statement" in capsys.readouterr().err


# --------------------------------------------------- ported: score-context
def test_score_context_implementation_lane(dbfile, capsys):
    run(dbfile, "init")
    run(dbfile, "story", "add", "--id", "s1", "--title", "Auth", "--risk-lane", "normal")
    run(dbfile, "trace", "--summary", "impl backend phase", "--outcome", "partial",
        "--story-id", "s1", "--agent", "coder",
        "--files-read", "docs/caw/stories/s1/plan.md,docs/caw/ARCHITECTURE.md",
        "--files-changed", "src/auth.ts")
    code = run(dbfile, "score-context")
    out = capsys.readouterr().out
    assert code == 0
    assert "phase: implementation" in out
    assert "Relevant story packet" in out


def test_score_context_no_trace(dbfile, capsys):
    run(dbfile, "init")
    code = run(dbfile, "score-context")
    assert code == 2
    assert "no trace found" in capsys.readouterr().err


def _seed_stories(dbfile, n):
    run(dbfile, "init")
    conn = sqlite3.connect(dbfile)
    for i in range(n):
        conn.execute(
            "INSERT INTO story (id,title,risk_lane,status) VALUES (?,?,?,?)",
            (f"s-{i:02d}", "x", "normal", "planned"),
        )
    conn.commit()
    conn.close()


def test_query_default_caps_at_20(dbfile, capsys):
    _seed_stories(dbfile, 25)
    run(dbfile, "query", "story", "--summary")
    out = capsys.readouterr().out
    assert out.count("id=s-") == 20          # capped
    assert "default cap" in out               # hint shown


def test_query_all_lifts_the_cap(dbfile, capsys):
    _seed_stories(dbfile, 25)
    run(dbfile, "query", "story", "--summary", "--all")
    out = capsys.readouterr().out
    assert out.count("id=s-") == 25
    assert "default cap" not in out


def test_query_limit_overrides_default(dbfile, capsys):
    _seed_stories(dbfile, 25)
    run(dbfile, "query", "story", "--summary", "--limit", "5")
    assert capsys.readouterr().out.count("id=s-") == 5


def test_query_limit_zero_rejected(dbfile, capsys):
    _seed_stories(dbfile, 3)
    code = run(dbfile, "query", "story", "--limit", "0")
    assert code == 2
    assert "positive integer" in capsys.readouterr().err


def test_version_flag(dbfile, capsys):
    with pytest.raises(SystemExit) as exc:
        run(dbfile, "--version")
    assert exc.value.code == 0
    assert "harness-cli" in capsys.readouterr().out


# --- flag consistency: story commands accept --story-id (alias of --id) --------

def test_story_add_accepts_story_id_alias(dbfile):
    run(dbfile, "init")
    # --story-id matches task/intake/gate; must work the same as --id
    assert run(dbfile, "story", "add", "--story-id", "US-1", "--title", "T",
               "--risk-lane", "tiny") == 0
    assert rows(dbfile, "story")[0]["id"] == "US-1"


def test_story_add_still_accepts_id(dbfile):
    run(dbfile, "init")
    assert run(dbfile, "story", "add", "--id", "US-2", "--title", "T",
               "--risk-lane", "tiny") == 0
    assert rows(dbfile, "story")[0]["id"] == "US-2"


def test_story_update_accepts_story_id_alias(dbfile):
    run(dbfile, "init")
    run(dbfile, "story", "add", "--id", "US-3", "--title", "T", "--risk-lane", "tiny")
    assert run(dbfile, "story", "update", "--story-id", "US-3",
               "--status", "implemented") == 0
    assert rows(dbfile, "story")[0]["status"] == "implemented"
