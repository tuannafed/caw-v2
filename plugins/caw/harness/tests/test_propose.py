"""Tests for the improvement-proposal loop (friction clustering + audit drift)."""

import sys
from pathlib import Path

import pytest

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import db as dbmod, propose  # noqa: E402


@pytest.fixture
def conn(tmp_path):
    c = dbmod.connect(str(tmp_path / "h.db"))
    yield c
    c.close()


def _trace(conn, friction):
    conn.execute(
        "INSERT INTO trace (task_summary,outcome,harness_friction) VALUES (?,?,?)",
        ("a summary here ok", "completed", friction),
    )
    conn.commit()


# ----------------------------------------------------------------- friction
def test_single_friction_is_not_a_proposal(conn):
    _trace(conn, "verify command shape unclear, had to probe")
    assert propose._friction_proposals(conn) == []


def test_repeated_friction_clusters_into_one_proposal(conn):
    _trace(conn, "verify command shape unclear, had to probe help")
    _trace(conn, "verify command shape unclear, guessed the flags")
    props = propose._friction_proposals(conn)
    assert len(props) == 1
    assert "2 traces" in props[0]["evidence"]


def test_distinct_frictions_not_merged(conn):
    _trace(conn, "verify command shape unclear, had to probe help")
    _trace(conn, "verify command shape unclear, guessed the flags")
    _trace(conn, "database fixture teardown leaked rows everywhere")
    props = propose._friction_proposals(conn)
    # only the verify-command pair clusters; the DB friction is a singleton
    assert len(props) == 1


def test_none_friction_ignored(conn):
    _trace(conn, "none")
    _trace(conn, "none")
    assert propose._friction_proposals(conn) == []


# ----------------------------------------------------------------- audit drift
def test_audit_drift_becomes_proposal(conn):
    conn.execute("INSERT INTO backlog (title,risk,status) VALUES "
                 "('x','tiny','implemented')")  # implemented, no outcome -> drift
    conn.commit()
    props = propose._audit_proposals(conn, conductor_dir=None)
    assert any("Resolve drift" in p["title"] for p in props)


# ----------------------------------------------------------------- commit
def test_commit_files_backlog_rows(conn):
    _trace(conn, "verify command shape unclear, had to probe help")
    _trace(conn, "verify command shape unclear, guessed the flags")
    props = propose.generate(conn)
    n = propose.commit(conn, props)
    assert n == len(props) >= 1
    rows = conn.execute("SELECT status, predicted_impact FROM backlog").fetchall()
    assert all(r["status"] == "proposed" for r in rows)
    assert all(r["predicted_impact"] for r in rows)


def test_commit_skips_duplicate_titles(conn):
    _trace(conn, "verify command shape unclear, had to probe help")
    _trace(conn, "verify command shape unclear, guessed the flags")
    props = propose.generate(conn)
    propose.commit(conn, props)
    second = propose.commit(conn, props)  # same titles again
    assert second == 0


def test_no_friction_no_drift_yields_nothing(conn):
    assert propose.generate(conn) == []
