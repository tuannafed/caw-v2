"""Tests for the harness audit (entropy/drift scoring)."""

import sqlite3
import sys
from pathlib import Path

import pytest

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import audit, db as dbmod  # noqa: E402


@pytest.fixture
def conn(tmp_path):
    c = dbmod.connect(str(tmp_path / "h.db"))
    yield c
    c.close()


# ----------------------------------------------------------------- DB scoring
def test_clean_db_scores_zero(conn):
    score, findings = audit.run(conn)
    assert score == 0
    assert all(f["count"] == 0 for f in findings)


def test_orphaned_task_scores_10(conn):
    conn.execute("INSERT INTO story (id,title,risk_lane,status) VALUES "
                 "('t1','T','normal','in_progress')")
    conn.commit()
    score, findings = audit.run(conn)
    assert score == 10
    f = next(f for f in findings if f["key"] == "orphaned_stories")
    assert f["details"] == ["t1"]


def test_traced_in_progress_task_not_orphaned(conn):
    conn.execute("INSERT INTO story (id,title,risk_lane,status) VALUES "
                 "('t1','T','normal','in_progress')")
    conn.execute("INSERT INTO trace (task_summary,story_id,outcome) VALUES "
                 "('did x','t1','partial')")
    conn.commit()
    score, _ = audit.run(conn)
    assert score == 0


def test_unverified_phase_and_decision(conn):
    conn.execute("INSERT INTO story (id,title,risk_lane,status) VALUES "
                 "('t1','T','normal','implemented')")
    conn.execute("INSERT INTO task (story_id,task_key,verify_command) VALUES "
                 "('t1','be','pytest')")
    conn.execute("INSERT INTO decision (id,title,verify_command) VALUES "
                 "('0001','D','echo ok')")
    conn.commit()
    score, _ = audit.run(conn)
    assert score == 10  # 5 + 5


def test_verified_phase_scores_zero(conn):
    conn.execute("INSERT INTO story (id,title,risk_lane,status) VALUES "
                 "('t1','T','normal','implemented')")
    conn.execute("INSERT INTO task (story_id,task_key,verify_command,"
                 "last_verified_result) VALUES ('t1','be','pytest','pass')")
    conn.commit()
    score, _ = audit.run(conn)
    assert score == 0


def test_implemented_backlog_without_outcome(conn):
    conn.execute("INSERT INTO backlog (title,risk,status) VALUES "
                 "('B','tiny','implemented')")
    conn.commit()
    score, findings = audit.run(conn)
    assert score == 2
    f = next(f for f in findings if f["key"] == "backlog_without_outcome")
    assert f["count"] == 1


def test_backlog_with_outcome_scores_zero(conn):
    conn.execute("INSERT INTO backlog (title,risk,status,actual_outcome) VALUES "
                 "('B','tiny','implemented','it helped')")
    conn.commit()
    score, _ = audit.run(conn)
    assert score == 0


def test_score_capped_at_100(conn):
    for i in range(20):  # 20 orphan stories * 10 = 200 -> capped 100
        conn.execute("INSERT INTO story (id,title,risk_lane,status) VALUES "
                     f"('t{i}','T','normal','in_progress')")
    conn.commit()
    score, _ = audit.run(conn)
    assert score == 100


# ----------------------------------------------------------------- file checks
def _make_story(conductor, name, work=False, plan_text=None):
    # v2 layout: docs/caw/stories/<story-id>/. Status lives in the DB, not a file,
    # so a "work product" is the presence of code/tests/review.md.
    d = conductor / "stories" / name
    d.mkdir(parents=True)
    if work:
        (d / "code.md").write_text(f"# Code for {name}\n\nWrote the handler.\n")
    if plan_text is not None:
        (d / "plan.md").write_text(plan_text)
    return d


def test_work_without_plan_scores_10(conn, tmp_path):
    conductor = tmp_path / "conductor"
    _make_story(conductor, "US-001-x", work=True)  # code.md but no plan.md
    score, findings = audit.run(conn, conductor_dir=str(conductor))
    assert score == 10
    f = next(f for f in findings if f["key"] == "plandone_no_plan")
    assert "US-001-x" in f["details"][0]


def test_plan_missing_spec_mandate_scores_8(conn, tmp_path):
    conductor = tmp_path / "conductor"
    _make_story(conductor, "US-002-y", work=True,
                plan_text="# Plan\n\nSome plan without the mandate block.\n")
    score, findings = audit.run(conn, conductor_dir=str(conductor))
    # plan.md exists (so not plandone_no_plan) but lacks `## Spec mandate`
    assert score == 8
    f = next(f for f in findings if f["key"] == "plan_no_spec_mandate")
    assert f["details"] == ["US-002-y"]


def test_compliant_story_scores_zero(conn, tmp_path):
    conductor = tmp_path / "conductor"
    _make_story(conductor, "US-003-z", work=True,
                plan_text="# Plan\n\n## Spec mandate\n\n> quote\n")
    score, _ = audit.run(conn, conductor_dir=str(conductor))
    assert score == 0


def test_story_nested_under_epics_is_scanned(conn, tmp_path):
    conductor = tmp_path / "conductor"
    _make_story(conductor, "epics/billing/US-004-w", work=True)  # no plan.md
    score, findings = audit.run(conn, conductor_dir=str(conductor))
    f = next(f for f in findings if f["key"] == "plandone_no_plan")
    assert f["count"] == 1


def test_unbounded_backlog_flagged(conn, tmp_path):
    conductor = tmp_path / "conductor"
    conductor.mkdir(parents=True)
    big = "\n".join(f"line {i}" for i in range(audit.BACKLOG_LINE_LIMIT + 5))
    (conductor / "harness-backlog.md").write_text(big)
    score, findings = audit.run(conn, conductor_dir=str(conductor))
    assert score == audit.WEIGHTS["backlog_unbounded"]
    f = next(f for f in findings if f["key"] == "backlog_unbounded")
    assert f["count"] == 1


def test_missing_conductor_dir_is_noop(conn, tmp_path):
    score, _ = audit.run(conn, conductor_dir=str(tmp_path / "does-not-exist"))
    assert score == 0


# ----------------------------------------------------------------- interpret
@pytest.mark.parametrize("score,word", [
    (0, "Perfect"), (10, "Healthy"), (40, "Attention"), (80, "Action"),
])
def test_interpret_bands(score, word):
    assert word in audit.interpret(score)


# --- format_report + interpret (the human/json output of `audit`) -------------

def _finding(count, label, points):
    return {"count": count, "label": label, "points": points, "key": "k", "details": []}


def test_format_report_json_shape():
    import json
    out = audit.format_report(12, [_finding(2, "x", 12)], fmt="json")
    d = json.loads(out)
    assert d["score"] == 12
    assert "interpretation" in d
    assert d["findings"][0]["label"] == "x"


def test_format_report_table_clean_when_no_active_findings():
    out = audit.format_report(0, [_finding(0, "x", 0)], fmt="table")
    assert "No drift detected" in out


def test_format_report_table_lists_active_findings():
    f = {"count": 3, "label": "orphans", "points": 30, "key": "o",
         "details": [f"item-{i}" for i in range(12)]}
    out = audit.format_report(30, [f], fmt="table")
    assert "orphans" in out
    assert "and 2 more" in out  # details truncated at 10


def test_interpret_covers_score_bands():
    # low score = healthy, high score = action required
    assert isinstance(audit.interpret(0), str)
    assert isinstance(audit.interpret(100), str)
    assert audit.interpret(0) != audit.interpret(100)
