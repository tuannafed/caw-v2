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


def test_git_alone_is_not_a_marker(tmp_path):
    # Regression: `.git` must NOT be a project-root marker. If it were, a stray
    # harness-cli read in ANY git repo (a hook, an agent in another repo) would
    # create a harness.db at that repo's root even though caw was never set up.
    # A caw project is one with docs/caw/ (ran /caw:setup) or an existing harness.db.
    (tmp_path / ".git").mkdir()
    sub = tmp_path / "src"
    sub.mkdir()
    assert dbmod.find_project_root(sub) is None


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


def test_connect_create_false_does_not_materialize_db(tmp_path):
    # Regression: a READ on a project with no DB must NOT create the file.
    missing = tmp_path / dbmod.DEFAULT_DB_NAME
    assert dbmod.connect(str(missing), create=False) is None
    assert not missing.exists(), "read-only connect must not create harness.db"


def test_connect_create_true_makes_db(tmp_path):
    target = tmp_path / dbmod.DEFAULT_DB_NAME
    conn = dbmod.connect(str(target), create=True)
    assert conn is not None
    conn.close()
    assert target.is_file()
