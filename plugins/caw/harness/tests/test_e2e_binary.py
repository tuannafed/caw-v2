"""End-to-end test through the SHIPPED binary (subprocess), not in-process main().

The unit/CLI tests call main() directly. This one runs `bin/harness-cli` the way an
agent, the project wrapper, and CI actually invoke it — catching breakage a direct
import can't see (a bad shebang, a broken sys.path bootstrap, an import that only
fails when run as a script). It walks the real story lifecycle:

  init -> intake -> story add -> task add (with a verify cmd) -> gate FAILS (unverified)
       -> task verify (runs the cmd, records pass) -> gate PASSES -> query json

so the proof gate the reviewer relies on is exercised over the wire.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

BIN = Path(__file__).resolve().parents[1] / "bin" / "harness-cli"


def cli(db, *args, expect=0):
    """Run the shipped binary via subprocess. Returns (stdout). Asserts exit code."""
    proc = subprocess.run(
        [sys.executable, str(BIN), "--db", str(db), *args],
        capture_output=True, text=True,
    )
    assert proc.returncode == expect, (
        f"`{' '.join(args)}` exit {proc.returncode} (wanted {expect})\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    return proc.stdout


@pytest.fixture
def db(tmp_path):
    return tmp_path / "harness.db"


def test_binary_runs_and_reports_version():
    proc = subprocess.run(
        [sys.executable, str(BIN), "--version"], capture_output=True, text=True
    )
    assert proc.returncode == 0
    assert proc.stdout.strip()


def test_full_story_lifecycle_through_binary(db):
    cli(db, "init")
    cli(db, "intake", "add", "--input-type", "new_spec",
        "--risk-lane", "high_risk", "--summary", "ship the thing", "--story-id", "US-001-x")
    cli(db, "story", "add", "--id", "US-001-x", "--title", "Ship the thing",
        "--risk-lane", "high_risk")
    # a task whose proof is a real command that PASSES
    cli(db, "task", "add", "--story-id", "US-001-x", "--task-key", "backend",
        "--verify", "true")

    # gate must FAIL before the verify is recorded (proof-unverified) → exit 2
    cli(db, "story", "gate", "--story-id", "US-001-x", expect=2)

    # run the proof; it executes `true` → records pass
    out = cli(db, "task", "verify", "--story-id", "US-001-x", "--task-key", "backend")
    assert "pass" in out.lower()

    # now the gate PASSES → exit 0
    out = cli(db, "story", "gate", "--story-id", "US-001-x")
    assert "PASS" in out.upper()

    # query returns the story as JSON with the DB-token lane
    rows = json.loads(cli(db, "query", "story", "--json"))
    assert rows[0]["id"] == "US-001-x"
    assert rows[0]["risk_lane"] == "high_risk"


def test_gate_fails_when_proof_command_fails(db):
    cli(db, "init")
    cli(db, "story", "add", "--id", "US-002-y", "--title", "y", "--risk-lane", "tiny")
    cli(db, "task", "add", "--story-id", "US-002-y", "--task-key", "be", "--verify", "false")
    # `false` exits non-zero → recorded as fail
    out = cli(db, "task", "verify", "--story-id", "US-002-y", "--task-key", "be")
    assert "fail" in out.lower()
    # a recorded failing proof keeps the gate shut
    cli(db, "story", "gate", "--story-id", "US-002-y", expect=2)
