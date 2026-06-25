"""Tests for R1 — the 3 repository-harness gaps caw filled:
intervention recording, tool registry, query matrix, verify-all."""

import sys
from pathlib import Path

import pytest

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import commands, db as dbmod  # noqa: E402


class Args:
    def __init__(self, **kw):
        self.__dict__.update(kw)


@pytest.fixture
def conn(tmp_path):
    c = dbmod.connect(str(tmp_path / "h.db"))
    yield c
    c.close()


def _task(conn, tid="t1"):
    conn.execute("INSERT INTO story (id,title,risk_lane,status) VALUES (?,?,?,?)",
                 (tid, "T", "normal", "planned"))
    conn.commit()


# ----------------------------------------------------------------- migration 002
def test_migration_002_tables_exist(conn):
    names = {r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert {"intervention", "tool"} <= names
    versions = [r[0] for r in conn.execute(
        "SELECT version FROM schema_version ORDER BY version").fetchall()]
    assert versions == [1, 2]


# ----------------------------------------------------------------- intervention
def test_intervention_add(conn):
    _task(conn)
    out = commands.intervention_add(conn, Args(
        source="reviewer", story_id="t1", trace_id=None,
        summary="overrode a partial mock", rationale="Tier-1 leak", notes=None))
    assert "recorded" in out
    r = conn.execute("SELECT source, summary FROM intervention").fetchone()
    assert r["source"] == "reviewer"


def test_intervention_bad_source_rejected(conn):
    with pytest.raises(commands.domain.ValidationError):
        commands.intervention_add(conn, Args(
            source="alien", story_id=None, trace_id=None,
            summary="x", rationale=None, notes=None))


# ----------------------------------------------------------------- tool registry
def test_tool_register_and_remove(conn):
    commands.tool_register(conn, Args(
        name="lint", command="pnpm lint", responsibility="verification", description=None))
    assert conn.execute("SELECT 1 FROM tool WHERE name='lint'").fetchone()
    commands.tool_remove(conn, Args(name="lint"))
    assert conn.execute("SELECT 1 FROM tool WHERE name='lint'").fetchone() is None


def test_tool_duplicate_rejected(conn):
    commands.tool_register(conn, Args(name="lint", command="x", responsibility=None, description=None))
    with pytest.raises(commands.domain.ValidationError):
        commands.tool_register(conn, Args(name="lint", command="y", responsibility=None, description=None))


def test_tool_remove_unknown_errors(conn):
    with pytest.raises(commands.domain.ValidationError):
        commands.tool_remove(conn, Args(name="ghost"))


# ----------------------------------------------------------------- matrix
def test_matrix_counts_phases_and_passes(conn):
    _task(conn)
    conn.execute("INSERT INTO task (story_id,task_key,verify_command,last_verified_result) "
                 "VALUES ('t1','a','true','pass')")
    conn.execute("INSERT INTO task (story_id,task_key,verify_command) VALUES ('t1','b','false')")
    conn.commit()
    out = commands.matrix(conn, Args(json=True, summary=False))
    assert '"tasks": 2' in out
    assert '"verifiable": 2' in out
    assert '"passed": 1' in out


def test_query_matrix_is_an_alias_for_matrix(conn):
    # Agents and docs reference both `matrix` and `query matrix`; the latter must
    # route to the matrix view, not error as an unknown table.
    _task(conn)
    conn.execute("INSERT INTO task (story_id,task_key,verify_command,last_verified_result) "
                 "VALUES ('t1','a','true','pass')")
    conn.commit()
    out = commands.query(conn, Args(table="matrix", json=True, summary=False))
    assert '"tasks": 1' in out
    assert '"passed": 1' in out


# ----------------------------------------------------------------- verify-all
def test_verify_all_runs_every_phase(conn):
    _task(conn)
    conn.execute("INSERT INTO task (story_id,task_key,verify_command) VALUES ('t1','a','true')")
    conn.execute("INSERT INTO task (story_id,task_key,verify_command) VALUES ('t1','b','false')")
    conn.commit()
    out = commands.story_verify_all(conn, Args(story_id="t1"))
    assert "1/2 passed" in out
    results = {r["task_key"]: r["last_verified_result"]
               for r in conn.execute("SELECT task_key,last_verified_result FROM task").fetchall()}
    assert results == {"a": "pass", "b": "fail"}


def test_verify_all_no_commands(conn):
    _task(conn)
    conn.execute("INSERT INTO task (story_id,task_key) VALUES ('t1','a')")
    conn.commit()
    out = commands.story_verify_all(conn, Args(story_id="t1"))
    assert "no tasks" in out
