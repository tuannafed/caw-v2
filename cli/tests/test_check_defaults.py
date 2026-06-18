"""Tests for check-defaults.py — the global_core pre-flight gate.

Pins that the canonical skills-defaults.yaml is the single source of truth and
that a project missing any global_core skill fails the check (so a drifted setup
can't silently ship a partial install). Context-optimized model: the enforced
floor is `global_core` (symlinked into <project>/.claude/skills/), not the old
workflow+product bulk defaults.
"""

import importlib.util
from importlib.machinery import SourceFileLoader
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent

_loader = SourceFileLoader("check_defaults", str(SCRIPTS_DIR / "check-defaults.py"))
_spec = importlib.util.spec_from_loader("check_defaults", _loader)
cd = importlib.util.module_from_spec(_spec)
_loader.exec_module(cd)


def test_canonical_list_parses():
    g = cd.load_defaults()
    assert len(g["global_core"]) == 8
    assert len(g["on_demand"]) == 15
    assert len(g["cross_cutting"]) == 3
    # comments stripped, names clean
    assert "react-component-testing" in g["global_core"]
    assert "test-driven-development" in g["global_core"]
    assert "typescript-advanced-types" in g["cross_cutting"]
    assert "prd-development" in g["on_demand"]
    assert all("#" not in s for grp in g.values() for s in grp)


def test_floor_is_global_core():
    g = cd.load_defaults()
    assert cd.floor(g) == g["global_core"]
    assert len(cd.floor(g)) == 8


def test_missing_core_detected(tmp_path):
    # symlink target dir is .claude/skills/ in the new model; only 1 of 8 present
    (tmp_path / ".claude" / "skills" / "refactor").mkdir(parents=True)
    g = cd.load_defaults()
    required, missing = cd.check_project(str(tmp_path), g)
    assert len(required) == 8
    assert len(missing) == 7
    assert "refactor" not in missing


def test_all_present_passes(tmp_path):
    g = cd.load_defaults()
    for s in cd.floor(g):
        (tmp_path / ".claude" / "skills" / s).mkdir(parents=True)
    _, missing = cd.check_project(str(tmp_path), g)
    assert missing == []
