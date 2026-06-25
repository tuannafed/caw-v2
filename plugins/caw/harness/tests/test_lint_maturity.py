"""Tests for harness-lint (bounded growth) and maturity estimation."""

import sys
from pathlib import Path

import pytest

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
REPO_ROOT = DURABLE_DIR.parent.parent.parent          # repo root (has rules/ + docs/)
sys.path.insert(0, str(DURABLE_DIR))

from src import db as dbmod, lint, maturity  # noqa: E402


# ----------------------------------------------------------------- lint
def test_lint_clean_when_under_limit(tmp_path):
    c = tmp_path / "conductor"
    c.mkdir()
    (c / "harness-backlog.md").write_text("## Items\n\n- one open item\n\n## Resolved\n\n- done (#1)\n")
    assert lint.run(str(c)) == []


def test_lint_flags_file_too_long(tmp_path):
    c = tmp_path / "conductor"
    c.mkdir()
    big = "\n".join(f"line {i}" for i in range(lint.FILE_LIMITS["harness-backlog.md"] + 5))
    (c / "harness-backlog.md").write_text(big)
    findings = lint.run(str(c))
    assert any(f["rule"] == "file-too-long" for f in findings)


def test_lint_flags_uncollapsed_resolved_item(tmp_path):
    c = tmp_path / "conductor"
    c.mkdir()
    text = (
        "## Resolved\n\n"
        "- A resolved item that should be one line\n"
        "  but it spills onto a second line of detail.\n"
    )
    (c / "harness-backlog.md").write_text(text)
    findings = lint.run(str(c))
    assert any(f["rule"] == "resolved-not-collapsed" for f in findings)


def test_lint_collapsed_resolved_item_ok(tmp_path):
    c = tmp_path / "conductor"
    c.mkdir()
    text = "## Resolved\n\n- one-line item (#1)\n- another one-line item (#2)\n"
    (c / "harness-backlog.md").write_text(text)
    assert [f for f in lint.run(str(c)) if f["rule"] == "resolved-not-collapsed"] == []


def test_lint_missing_dir_is_noop(tmp_path):
    assert lint.run(str(tmp_path / "nope")) == []


# ----------------------------------------------------------------- maturity
@pytest.fixture
def conn(tmp_path):
    c = dbmod.connect(str(tmp_path / "h.db"))
    yield c
    c.close()


def test_maturity_assesses_against_real_repo(conn):
    # repo_root = the caw source root (has rules/ + docs/).
    repo_root = REPO_ROOT
    level, evidence = maturity.assess(conn, repo_root=str(repo_root))
    # The v2 rules + docs exist, so at least H2 is reached even on an empty DB.
    assert level in {"H2", "H3", "H4", "H5"}
    assert any("H2" in e for e in evidence)


def test_maturity_reaches_h5_when_fully_exercised(conn):
    repo_root = REPO_ROOT
    conn.execute("INSERT INTO story (id,title,risk_lane,status) VALUES ('t','T','normal','in_progress')")
    conn.execute("INSERT INTO task (story_id,task_key,verify_command,last_verified_result) "
                 "VALUES ('t','be','true','pass')")
    conn.execute("INSERT INTO trace (task_summary,outcome,story_id) VALUES ('a real summary','completed','t')")
    conn.execute("INSERT INTO backlog (title,risk,status) VALUES ('p','tiny','proposed')")
    conn.commit()
    level, _ = maturity.assess(conn, repo_root=str(repo_root))
    assert level == "H5"
