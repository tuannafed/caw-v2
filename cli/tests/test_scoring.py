"""Tests for trace quality scoring (TRACE_SPEC tiers + lane requirement)."""

import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent          # cli/
DURABLE_DIR = SCRIPTS_DIR.parent / "plugins" / "caw" / "harness"     # harness package + bin
sys.path.insert(0, str(DURABLE_DIR))

from src import db as dbmod, scoring  # noqa: E402


@pytest.fixture
def conn(tmp_path):
    c = dbmod.connect(str(tmp_path / "h.db"))
    yield c
    c.close()


def _trace(conn, **kw):
    cols = ", ".join(kw)
    qs = ", ".join("?" for _ in kw)
    cur = conn.execute(f"INSERT INTO trace ({cols}) VALUES ({qs})", tuple(kw.values()))
    conn.commit()
    return conn.execute("SELECT * FROM trace WHERE id = ?", (cur.lastrowid,)).fetchone()


def test_below_minimal_when_summary_too_short(conn):
    row = _trace(conn, task_summary="short", outcome="completed")
    tier, missing = scoring.score_row(row)
    assert tier == 0
    assert any("task_summary" in m for m in missing)


def test_minimal_tier(conn):
    row = _trace(conn, task_summary="a real summary here", outcome="completed")
    tier, _ = scoring.score_row(row)
    assert tier == 1


def test_standard_tier(conn):
    row = _trace(
        conn, task_summary="a real summary here", outcome="completed",
        agent="coder", actions_taken='["x"]', files_read='["a"]',
        files_changed='["b"]', harness_friction="none",
    )
    tier, _ = scoring.score_row(row)
    assert tier == 2


def test_detailed_tier(conn):
    row = _trace(
        conn, task_summary="a real summary here", outcome="completed",
        agent="coder", actions_taken='["x"]', files_read='["a"]',
        files_changed='["b"]', decisions_made='["chose x"]', errors="none",
        duration_seconds=100, token_estimate=2000,
    )
    tier, missing = scoring.score_row(row)
    assert tier == 3
    assert missing == []


def test_lane_requirement_met(conn):
    row = _trace(
        conn, task_summary="a real summary here", outcome="completed",
        agent="coder", actions_taken='["x"]', files_read='["a"]',
        files_changed='["b"]', harness_friction="none",
    )
    a = scoring.assess(row, lane="normal")
    assert a["meets_requirement"] is True


def test_lane_requirement_not_met(conn):
    row = _trace(conn, task_summary="a real summary here", outcome="completed")
    a = scoring.assess(row, lane="high_risk")
    assert a["meets_requirement"] is False
    assert a["required_tier"] == 3


@pytest.mark.parametrize("lane,tier", [("tiny", 1), ("normal", 2), ("high_risk", 3)])
def test_lane_tier_mapping(lane, tier):
    assert scoring.required_tier_for_lane(lane) == tier


def test_format_assessment_shows_mark(conn):
    row = _trace(conn, task_summary="a real summary here", outcome="completed")
    out = scoring.format_assessment(row["id"], row, lane="high_risk")
    assert "❌" in out
    assert "tier 1" in out
