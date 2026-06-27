"""Tests for domain — the validation primitives every CLI write goes through.
These guard the DB's enum invariants (lane/status vocab) at the seam where the
review found the lane-vocabulary mismatch, so a wrong token is rejected loudly."""

import sys
from pathlib import Path

import pytest

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import domain  # noqa: E402


def test_risk_lanes_are_the_db_tokens():
    # The single source of truth for the lane vocabulary. Prose must match these.
    assert domain.RISK_LANES == ("tiny", "normal", "high_risk")


def test_check_choice_accepts_valid():
    assert domain.check_choice("high_risk", domain.RISK_LANES, "risk_lane") == "high_risk"


def test_check_choice_rejects_legacy_token():
    # 'risky'/'standard' are the OLD prose words — must NOT be storable.
    with pytest.raises(domain.ValidationError) as exc:
        domain.check_choice("risky", domain.RISK_LANES, "risk_lane")
    assert "risky" in str(exc.value)
    assert "high_risk" in str(exc.value)  # error names the allowed set


def test_check_choice_none_passes_through():
    assert domain.check_choice(None, domain.RISK_LANES, "risk_lane") is None


def test_require_rejects_missing_and_blank():
    with pytest.raises(domain.ValidationError):
        domain.require(None, "title")
    with pytest.raises(domain.ValidationError):
        domain.require("   ", "title")


def test_require_returns_value_when_present():
    assert domain.require("US-001", "id") == "US-001"


def test_status_vocab_is_v2():
    assert domain.STORY_STATUSES == ("planned", "in_progress", "implemented", "changed", "retired")
    assert domain.TASK_STATUSES == ("pending", "in_progress", "blocked", "done")
