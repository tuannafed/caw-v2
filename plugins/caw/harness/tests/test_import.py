"""Tests for R4 — harness-cli import (caw v1 markdown → DB)."""

import sys
from pathlib import Path

import pytest

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import db as dbmod, importer  # noqa: E402


@pytest.fixture
def conn(tmp_path):
    c = dbmod.connect(str(tmp_path / "h.db"))
    yield c
    c.close()


def _conductor(tmp_path):
    c = tmp_path / "conductor"
    (c / "tasks").mkdir(parents=True)
    (c / "decisions").mkdir(parents=True)
    return c


def _task(conductor, tid, status="done", lane="standard", tasks=None, plan=False):
    d = conductor / "tasks" / tid
    d.mkdir()
    yaml = f"id: {tid}\ntitle: {tid} title\nstatus: {status}\nlane: {lane}\ntasks:\n"
    for t in (tasks or []):
        yaml += f"  - id: {t[0]}\n    status: {t[1]}\n"
    (d / "overview.yaml").write_text(yaml)
    if plan:
        (d / "plan.md").write_text("# Plan\n## Spec mandate\n> q\n")


# ----------------------------------------------------------------- overview parse
def test_imports_task_with_lane_mapping(conn, tmp_path):
    c = _conductor(tmp_path)
    _task(c, "t-1", status="done", lane="risky", tasks=[("db", "done"), ("be", "pending")])
    importer.run(conn, str(c))
    row = conn.execute("SELECT risk_lane, status FROM story WHERE id='t-1'").fetchone()
    assert row["risk_lane"] == "high_risk"   # risky -> high_risk
    assert row["status"] == "implemented"    # done -> implemented
    tasks = conn.execute("SELECT task_key, status FROM task WHERE story_id='t-1' ORDER BY task_key").fetchall()
    assert {t["task_key"]: t["status"] for t in tasks} == {"be": "pending", "db": "done"}


def test_standard_lane_maps_to_normal(conn, tmp_path):
    c = _conductor(tmp_path)
    _task(c, "t-2", lane="standard")
    importer.run(conn, str(c))
    assert conn.execute("SELECT risk_lane FROM story WHERE id='t-2'").fetchone()["risk_lane"] == "normal"


def test_import_is_idempotent(conn, tmp_path):
    c = _conductor(tmp_path)
    _task(c, "t-3")
    importer.run(conn, str(c))
    report = importer.run(conn, str(c))  # second run
    assert report["stories"] == 0
    assert report["stories_skipped"] == 1


def test_dry_run_writes_nothing(conn, tmp_path):
    c = _conductor(tmp_path)
    _task(c, "t-4")
    report = importer.run(conn, str(c), dry_run=True)
    assert report["stories"] == 1                     # would import 1 story
    assert conn.execute("SELECT count(*) FROM story").fetchone()[0] == 0  # but DB empty


# ----------------------------------------------------------------- decisions
def test_imports_decision_status(conn, tmp_path):
    c = _conductor(tmp_path)
    (c / "decisions" / "0007-some-choice.md").write_text(
        "# 0007 Some choice\n\n## Status\n\nAccepted\n\n## Context\n\nwhy\n")
    importer.run(conn, str(c))
    row = conn.execute("SELECT title, status, doc_path FROM decision WHERE id='0007'").fetchone()
    assert row["status"] == "accepted"
    assert "Some choice" in row["title"]
    assert row["doc_path"].endswith("0007-some-choice.md")


# ----------------------------------------------------------------- backlog
def test_imports_backlog_items_skipping_template(conn, tmp_path):
    c = _conductor(tmp_path)
    # mentions "## Resolved" in prose BEFORE the real heading — the trap dava2 hit
    (c / "harness-backlog.md").write_text(
        "# Backlog\n\nWhen resolved, move to ## Resolved.\n\n"
        "## Items\n\n"
        "### <short title>\n- template placeholder\n\n"
        "### Real friction one\n- pain\n\n"
        "### Real friction two\n- pain\n\n"
        "## Resolved\n\n- old thing (#1)\n"
    )
    report = importer.run(conn, str(c))
    titles = [r["title"] for r in conn.execute("SELECT title FROM backlog").fetchall()]
    assert "Real friction one" in titles
    assert "Real friction two" in titles
    assert not any(t.startswith("<") for t in titles)   # template skipped
    assert report["backlog"] == 2


def test_missing_conductor_is_empty_report(conn, tmp_path):
    report = importer.run(conn, str(tmp_path / "nope"))
    assert sum(report.values()) == 0
