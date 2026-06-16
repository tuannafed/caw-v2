"""Tests for the pre-close verification gate (task/decision verify + task gate)."""

import sqlite3
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent          # cli/
DURABLE_DIR = SCRIPTS_DIR.parent / "template" / "durable"     # harness package + bin
sys.path.insert(0, str(DURABLE_DIR))

from harness import commands, db as dbmod  # noqa: E402


class Args:
    def __init__(self, **kw):
        self.__dict__.update(kw)


@pytest.fixture
def conn(tmp_path):
    c = dbmod.connect(str(tmp_path / "h.db"))
    c.execute("INSERT INTO story (id,title,risk_lane,status) VALUES "
              "('t1','T','normal','in_progress')")
    c.commit()
    yield c
    c.close()


def _phase(conn, key, verify):
    conn.execute(
        "INSERT INTO task (story_id,task_key,verify_command) VALUES (?,?,?)",
        ("t1", key, verify),
    )
    conn.commit()


# ----------------------------------------------------------------- task verify
def test_phase_verify_pass_records_result(conn):
    _phase(conn, "be", "true")
    out = commands.task_verify(conn, Args(story_id="t1", task_key="be"))
    assert "pass" in out
    r = conn.execute(
        "SELECT last_verified_result FROM task WHERE task_key='be'"
    ).fetchone()
    assert r["last_verified_result"] == "pass"


def test_phase_verify_fail_records_fail(conn):
    _phase(conn, "be", "false")
    out = commands.task_verify(conn, Args(story_id="t1", task_key="be"))
    assert "fail" in out
    r = conn.execute(
        "SELECT last_verified_result FROM task WHERE task_key='be'"
    ).fetchone()
    assert r["last_verified_result"] == "fail"


def test_phase_verify_without_command_errors(conn):
    _phase(conn, "be", None)
    with pytest.raises(commands.domain.ValidationError):
        commands.task_verify(conn, Args(story_id="t1", task_key="be"))


def test_phase_verify_unknown_phase_errors(conn):
    with pytest.raises(commands.domain.ValidationError):
        commands.task_verify(conn, Args(story_id="t1", task_key="ghost"))


# ----------------------------------------------------------------- task gate
def test_gate_blocks_before_verify(conn):
    _phase(conn, "be", "true")
    with pytest.raises(commands.domain.ValidationError) as e:
        commands.story_gate(conn, Args(story_id="t1"))
    assert "GATE BLOCKED" in str(e.value)


def test_gate_passes_after_all_phases_pass(conn):
    _phase(conn, "be", "true")
    _phase(conn, "db", "true")
    commands.task_verify(conn, Args(story_id="t1", task_key="be"))
    commands.task_verify(conn, Args(story_id="t1", task_key="db"))
    out = commands.story_gate(conn, Args(story_id="t1"))
    assert "gate PASSES" in out


def test_gate_blocks_when_one_phase_fails(conn):
    _phase(conn, "be", "true")
    _phase(conn, "db", "false")
    commands.task_verify(conn, Args(story_id="t1", task_key="be"))
    commands.task_verify(conn, Args(story_id="t1", task_key="db"))
    with pytest.raises(commands.domain.ValidationError) as e:
        commands.story_gate(conn, Args(story_id="t1"))
    assert "db" in str(e.value)


def test_gate_vacuous_when_no_verify_commands(conn):
    conn.execute("INSERT INTO task (story_id,task_key) VALUES ('t1','be')")
    conn.commit()
    out = commands.story_gate(conn, Args(story_id="t1"))
    assert "vacuously" in out


def test_gate_unknown_task_errors(conn):
    with pytest.raises(commands.domain.ValidationError):
        commands.story_gate(conn, Args(story_id="nope"))


# ----------------------------------------------------------------- decision verify
def test_decision_verify_pass(conn):
    conn.execute("INSERT INTO decision (id,title,verify_command) VALUES "
                 "('0001','D','true')")
    conn.commit()
    out = commands.decision_verify(conn, Args(id="0001"))
    assert "pass" in out
    r = conn.execute(
        "SELECT last_verified_result FROM decision WHERE id='0001'"
    ).fetchone()
    assert r["last_verified_result"] == "pass"
