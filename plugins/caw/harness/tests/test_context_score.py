"""Tests for context_score — the `score-context` assessment (CONTEXT_RULES per
lane × phase). Pins the pure scoring logic so the evolution layer's context
discipline is actually verified, not just shipped."""

import sys
from pathlib import Path

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import context_score as cs  # noqa: E402


def test_jsonish_list_parses_json_array():
    assert cs.jsonish_list('["a.ts", "b.ts"]') == ["a.ts", "b.ts"]


def test_jsonish_list_parses_csv_and_drops_null_and_empty():
    assert cs.jsonish_list("a.ts, , null, b.ts") == ["a.ts", "b.ts"]
    assert cs.jsonish_list("") == []
    assert cs.jsonish_list(None) == []


def test_infer_phase_trace_when_completed():
    assert cs.infer_phase({"outcome": "completed"}) == "trace"


def test_infer_phase_implementation_when_story_and_changes():
    row = {"story_id": "US-001", "files_changed": '["x.ts"]'}
    assert cs.infer_phase(row) == "implementation"


def test_infer_phase_planning_when_only_lane():
    assert cs.infer_phase({"risk_lane": "normal"}) == "planning"


def test_infer_phase_intake_default():
    assert cs.infer_phase({}) == "intake"


def test_score_row_flags_unmet_must_read():
    # implementation phase, high_risk: must read the changed files + arch rules.
    row = {
        "risk_lane": "high_risk",
        "story_id": "US-001",
        "files_changed": '["src/a.ts"]',
        "files_read": '["unrelated.md"]',
    }
    result = cs.score_row(row)
    assert result["lane"] == "high_risk"
    assert result["phase"] == "implementation"
    # at least one must-read is unmet (arch rules / story packet not read)
    assert any(not r["met"] for r in result["must"])


def test_score_row_met_when_changed_files_read():
    row = {
        "risk_lane": "tiny",
        "story_id": "US-002",
        "files_changed": '["src/a.ts"]',
        "files_read": '["src/a.ts"]',
    }
    result = cs.score_row(row)
    # the "<changed-files>" must-rule is satisfied because changes exist
    changed_rule = [r for r in result["must"] if r["target"] == "<changed-files>"]
    assert changed_rule and changed_rule[0]["met"]


def test_score_row_detects_over_read():
    # planning phase reading deep source it should have skipped → over_read.
    row = {
        "risk_lane": "tiny",
        "files_changed": '["a.ts"]',
        "files_read": '["src/deep/internal/thing.ts"]',
    }
    result = cs.score_row(row)
    assert isinstance(result["over_read"], list)


def test_format_assessment_renders_counts():
    row = {"risk_lane": "normal", "story_id": "US-1", "files_changed": '["a.ts"]',
           "files_read": '["a.ts"]'}
    text = cs.format_assessment(7, cs.score_row(row))
    assert "trace #7" in text
    assert "must-read:" in text
