"""SQLite connection + migration runner for the caw durable layer."""

from __future__ import annotations

import sqlite3
from pathlib import Path

# harness/src/db.py -> harness/ is parent.parent (holds schema/ + bin/)
SCRIPTS_DIR = Path(__file__).resolve().parent.parent
SCHEMA_DIR = SCRIPTS_DIR / "schema"
DEFAULT_DB_NAME = "harness.db"


def schema_files():
    """Migration files sorted by their numeric prefix (001-, 002-, ...)."""
    return sorted(SCHEMA_DIR.glob("[0-9][0-9][0-9]-*.sql"))


def _current_version(conn):
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    ).fetchone()
    if not row:
        return 0
    ver = conn.execute("SELECT MAX(version) FROM schema_version").fetchone()[0]
    return ver or 0


def _file_version(path):
    """001-init.sql -> 1."""
    return int(path.name.split("-", 1)[0])


def migrate(conn):
    """Apply any schema file whose version is newer than the DB's current one.

    Each migration file is responsible for its own `INSERT INTO schema_version`,
    matching repository-harness convention. Idempotent: already-applied files are
    skipped by version comparison.
    """
    applied = _current_version(conn)
    for path in schema_files():
        if _file_version(path) <= applied:
            continue
        conn.executescript(path.read_text())
        conn.commit()
    return _current_version(conn)


def connect(db_path=None, create=True):
    """Open the durable DB and ensure it is migrated.

    Pass ":memory:" for tests. Returns a sqlite3.Connection with Row factory and
    foreign keys enforced.

    `create=True` (default) creates the DB file if absent — used by writes (`init`,
    `story/task add`, etc.). `create=False` opens read-only and returns None if the
    file does not exist yet, so a READ on a project that never ran `/caw:setup`
    returns "no data" instead of silently materializing an empty `harness.db` at the
    repo root (the harness.db-in-every-git-repo leak).
    """
    target = ":memory:" if db_path == ":memory:" else str(db_path or DEFAULT_DB_NAME)
    if not create and target != ":memory:":
        if not Path(target).is_file():
            return None
    conn = sqlite3.connect(target)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    migrate(conn)
    return conn


def find_project_root(start=None):
    """Walk up from `start` (default cwd) to locate the caw project root.

    A subfolder invocation (e.g. `cd packages/api-client && harness-cli …`) must
    resolve to the ONE project DB, not create a fresh empty one in the subfolder.
    Marker priority, checked at each ancestor from the deepest up:
      1. an existing `harness.db`  — already-initialized project DB wins
      2. `docs/caw/`               — a caw-scaffolded project

    `.git/` is deliberately NOT a marker: it would make EVERY git repo look like a
    caw project, so a stray harness-cli call (a hook, an agent in another repo) would
    create a `harness.db` at that repo's root even though caw was never set up there.
    A caw project is one that ran `/caw:setup` (has `docs/caw/`) or already has a DB.
    Returns the matched directory, or None if no marker is found anywhere up the tree.
    """
    here = (start or Path.cwd()).resolve()
    for d in (here, *here.parents):
        if (d / DEFAULT_DB_NAME).is_file():
            return d
        if (d / "docs" / "caw").is_dir():
            return d
    return None


def resolve_db_path(explicit=None):
    """Where harness.db lives for a project.

    caw v2 layout (mirrors repository-harness): harness.db lives at the project
    ROOT, alongside scripts/ and docs/ — not under .claude/.
    Order: explicit arg > HARNESS_DB env > project root (walked up from cwd) >
    cwd (only when no project marker is found anywhere up the tree).
    """
    import os

    if explicit:
        return Path(explicit)
    env = os.environ.get("HARNESS_DB")
    if env:
        return Path(env)
    root = find_project_root()
    return (root or Path.cwd()) / DEFAULT_DB_NAME
