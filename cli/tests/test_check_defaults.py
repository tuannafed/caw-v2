"""Tests for check-defaults.py — the mandatory-default-skills pre-flight gate.

Pins that the canonical skills-defaults.yaml is the single source of truth and
that a project missing any unconditional default fails the check (so a drifted
setup can't silently ship a partial install — the dava2 lesson).
"""

import importlib.util
import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent

_loader = SourceFileLoader("check_defaults", str(SCRIPTS_DIR / "check-defaults.py"))
_spec = importlib.util.spec_from_loader("check_defaults", _loader)
cd = importlib.util.module_from_spec(_spec)
_loader.exec_module(cd)


def test_canonical_list_parses():
    g = cd.load_defaults()
    assert len(g["workflow"]) == 14
    assert len(g["product"]) == 7
    assert len(g["cross_cutting"]) == 3
    # comments stripped, names clean
    assert "react-component-testing" in g["workflow"]
    assert "typescript-advanced-types" in g["cross_cutting"]
    assert all("#" not in s for grp in g.values() for s in grp)


def test_unconditional_is_workflow_plus_product():
    g = cd.load_defaults()
    assert len(cd.unconditional(g)) == 21


def test_missing_defaults_detected(tmp_path):
    (tmp_path / ".agents" / "skills" / "to-prd").mkdir(parents=True)  # only 1 of 21
    g = cd.load_defaults()
    required, missing = cd.check_project(str(tmp_path), g)
    assert len(required) == 21
    assert len(missing) == 20
    assert "to-prd" not in missing


def test_all_present_passes(tmp_path):
    g = cd.load_defaults()
    for s in cd.unconditional(g):
        (tmp_path / ".agents" / "skills" / s).mkdir(parents=True)
    _, missing = cd.check_project(str(tmp_path), g)
    assert missing == []
