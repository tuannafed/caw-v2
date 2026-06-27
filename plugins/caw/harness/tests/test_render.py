"""Tests for render — the json/summary/table output shapes the CLI emits. These
are what agents parse, so a regression here silently corrupts every `query`."""

import json
import sys
from pathlib import Path

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import render  # noqa: E402


class Row(dict):
    """Minimal sqlite3.Row stand-in: dict with .keys() (which dict already has)."""


ROWS = [
    Row(id="US-001", status="implemented", risk_lane="high_risk"),
    Row(id="US-002", status="planned", risk_lane="tiny"),
]
FIELDS = ["id", "status", "risk_lane"]


def test_as_json_roundtrips():
    out = render.as_json(ROWS)
    parsed = json.loads(out)
    assert parsed[0]["id"] == "US-001"
    assert parsed[1]["risk_lane"] == "tiny"


def test_as_summary_one_line_per_row():
    out = render.as_summary(ROWS, FIELDS)
    lines = out.splitlines()
    assert len(lines) == 2
    assert "id=US-001" in lines[0]
    assert " · " in lines[0]


def test_as_summary_empty_is_marked():
    assert render.as_summary([], FIELDS) == "(no rows)"


def test_as_table_has_header_separator_and_rows():
    out = render.as_table(ROWS, FIELDS)
    lines = out.splitlines()
    assert lines[0].split()[0] == "id"        # header
    assert set(lines[1]) <= {"-", " "}        # separator row
    assert "US-001" in lines[2]
    assert "US-002" in lines[3]


def test_as_table_empty_is_marked():
    assert render.as_table([], FIELDS) == "(no rows)"


def test_emit_dispatches_by_format():
    assert render.emit(ROWS, "json", FIELDS).startswith("[")
    assert "id=US-001" in render.emit(ROWS, "summary", FIELDS)
    # unknown format falls back to table
    assert render.emit(ROWS, "table", FIELDS) == render.as_table(ROWS, FIELDS)
    assert render.emit(ROWS, "whatever", FIELDS) == render.as_table(ROWS, FIELDS)
