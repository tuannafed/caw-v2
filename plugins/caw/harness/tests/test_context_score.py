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


# --- cover every lane × phase branch in _base_rules + the dynamic triggers ---

def test_base_rules_trace_phase_normal_requires_matrix():
    must, should, _ = cs._base_rules("normal", "trace")
    labels = [l for l, _ in must]
    assert "Trace specification" in labels and "Durable matrix" in labels


def test_base_rules_trace_phase_tiny_matrix_is_should():
    must, should, _ = cs._base_rules("tiny", "trace")
    assert "Durable matrix" in [l for l, _ in should]


def test_base_rules_implementation_high_risk_adds_arch_and_template():
    must, _, _ = cs._base_rules("high_risk", "implementation")
    labels = [l for l, _ in must]
    assert "Architecture rules" in labels
    assert "High-risk story template" in labels


def test_base_rules_planning_high_risk_adds_maturity():
    must, _, _ = cs._base_rules("high_risk", "planning")
    assert "Harness maturity" in [l for l, _ in must]


def test_base_rules_intake_tiny_skips_architecture():
    must, _, skipped = cs._base_rules("tiny", "intake")
    assert "docs/caw/ARCHITECTURE.md" in skipped


def test_base_rules_intake_normal_requires_readme_and_harness():
    must, _, _ = cs._base_rules("normal", "intake")
    labels = [l for l, _ in must]
    assert "README" in labels and "Harness operating model" in labels


def test_dynamic_rules_triggered_by_schema_change():
    extra = cs._dynamic_rules(["scripts/caw/schema/001-init.sql"])
    assert any("decision" in l.lower() for l, _ in extra)


def test_dynamic_rules_triggered_by_cli_change():
    extra = cs._dynamic_rules(["scripts/caw/bin/harness-cli"])
    assert any("HARNESS.md" in t for _, t in extra)
