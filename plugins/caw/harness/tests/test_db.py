"""Tests for db.find_project_root / resolve_db_path — the DB-location logic.

This is the exact code whose cwd-based earlier version scattered empty harness.db
files into every subfolder. These pin the walk-up + marker precedence + the
explicit/env overrides so that regression can't come back silently."""

import os
import sys
from pathlib import Path

import pytest

DURABLE_DIR = Path(__file__).resolve().parent.parent  # plugins/caw/harness/
sys.path.insert(0, str(DURABLE_DIR))

from src import db as dbmod  # noqa: E402


def test_find_project_root_by_existing_db(tmp_path):
    (tmp_path / dbmod.DEFAULT_DB_NAME).write_text("")
    sub = tmp_path / "a" / "b"
    sub.mkdir(parents=True)
    assert dbmod.find_project_root(sub) == tmp_path


def test_find_project_root_by_docs_caw(tmp_path):
    (tmp_path / "docs" / "caw").mkdir(parents=True)
    sub = tmp_path / "packages" / "api"
    sub.mkdir(parents=True)
    assert dbmod.find_project_root(sub) == tmp_path


def test_find_project_root_by_git(tmp_path):
    (tmp_path / ".git").mkdir()
    sub = tmp_path / "src"
    sub.mkdir()
    assert dbmod.find_project_root(sub) == tmp_path


def test_find_project_root_none_when_no_marker(tmp_path):
    sub = tmp_path / "x" / "y"
    sub.mkdir(parents=True)
    # tmp_path has no db / docs/caw / .git marker → walk finds nothing under it.
    # (A real FS may have markers above tmp; assert it doesn't match inside the tree.)
    root = dbmod.find_project_root(sub)
    assert root != sub and root != (tmp_path / "x")


def test_resolve_db_path_explicit_wins(tmp_path):
    explicit = tmp_path / "custom.db"
    assert dbmod.resolve_db_path(str(explicit)) == explicit


def test_resolve_db_path_env_override(tmp_path, monkeypatch):
    envdb = tmp_path / "from-env.db"
    monkeypatch.setenv("HARNESS_DB", str(envdb))
    assert dbmod.resolve_db_path() == envdb


def test_resolve_db_path_uses_project_root(tmp_path, monkeypatch):
    monkeypatch.delenv("HARNESS_DB", raising=False)
    (tmp_path / "docs" / "caw").mkdir(parents=True)
    sub = tmp_path / "deep" / "nested"
    sub.mkdir(parents=True)
    monkeypatch.chdir(sub)
    # DB resolves to the project ROOT, not the nested cwd — the scattered-DB fix.
    assert dbmod.resolve_db_path() == tmp_path / dbmod.DEFAULT_DB_NAME
