"""Tests for the anti-drift gate (state restated in prose — ADR-0001).

The DB owns task/task status in caw v2. Prose files (code.md/tests.md/review.md)
must not restate it. These tests pin the line between a status DECLARATION (drift)
and ordinary narrative (fine), so the gate catches real drift without flagging
every sentence that happens to contain the word "done".
"""

import sys
from pathlib import Path

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import state_drift  # noqa: E402


def _task(tmp_path, fname, body):
    # v2 layout: stories live under <conductor>/stories/<story-id>/.
    story = tmp_path / "conductor" / "stories" / "US-001-x"
    story.mkdir(parents=True)
    (story / fname).write_text(body)
    return str(tmp_path / "conductor")


def test_flags_status_assignment(tmp_path):
    c = _task(tmp_path, "code.md", "# Code\n\nstatus: done\n")
    findings = state_drift.run(c)
    assert len(findings) == 1
    assert findings[0]["rule"] == "state-in-prose"
    assert "code.md" in findings[0]["file"]


def test_flags_per_task_status_line(tmp_path):
    c = _task(tmp_path, "review.md", "# Review\n\ntask backend: done\n")
    assert any(f["rule"] == "state-in-prose" for f in state_drift.run(c))


def test_flags_proof_restated(tmp_path):
    c = _task(tmp_path, "tests.md", "# Tests\n\nverify: passed\n")
    assert state_drift.run(c)


def test_narrative_is_not_flagged(tmp_path):
    # Ordinary prose mentioning the words is fine — only declarations are drift.
    c = _task(
        tmp_path,
        "code.md",
        "# Code\n\nImplemented the handler and the migration is done now.\n"
        "Once the tests pass we move on. The work failed twice before succeeding.\n",
    )
    assert state_drift.run(c) == []


def test_references_to_the_db_are_not_flagged(tmp_path):
    # A line that points at the DB references state, doesn't restate it.
    c = _task(
        tmp_path,
        "code.md",
        "# Code\n\nRun `harness-cli task update --status done` to record this.\n",
    )
    assert state_drift.run(c) == []


def test_blockquote_example_not_flagged(tmp_path):
    # review.md often quotes commands/examples — those are not declarations.
    c = _task(tmp_path, "review.md", "# Review\n\n> status: done\n")
    assert state_drift.run(c) == []


def test_clean_task_passes(tmp_path):
    c = _task(tmp_path, "code.md", "# Code\n\nWrote the redirect handler.\n")
    assert state_drift.run(c) == []
    assert "no DB-owned status" in state_drift.format_findings([])


def test_missing_stories_dir_is_noop(tmp_path):
    (tmp_path / "conductor").mkdir()
    assert state_drift.run(str(tmp_path / "conductor")) == []


def test_story_nested_under_epics_is_scanned(tmp_path):
    # Stories may live under stories/epics/<epic>/<story>/ — must recurse.
    story = tmp_path / "conductor" / "stories" / "epics" / "billing" / "US-002-y"
    story.mkdir(parents=True)
    (story / "code.md").write_text("# Code\n\nstatus: done\n")
    findings = state_drift.run(str(tmp_path / "conductor"))
    assert any(f["rule"] == "state-in-prose" for f in findings)


def test_v1_tasks_layout_still_scanned(tmp_path):
    # Back-compat: an un-migrated v1 tree (tasks/) is still scanned when there's
    # no stories/ dir.
    task = tmp_path / "conductor" / "tasks" / "task-1"
    task.mkdir(parents=True)
    (task / "code.md").write_text("# Code\n\nstatus: done\n")
    findings = state_drift.run(str(tmp_path / "conductor"))
    assert any(f["rule"] == "state-in-prose" for f in findings)
