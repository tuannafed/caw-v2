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


def connect(db_path=None):
    """Open (creating if needed) the durable DB and ensure it is migrated.

    Pass ":memory:" for tests. Returns a sqlite3.Connection with Row factory and
    foreign keys enforced.
    """
    target = ":memory:" if db_path == ":memory:" else str(db_path or DEFAULT_DB_NAME)
    conn = sqlite3.connect(target)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    migrate(conn)
    return conn


def resolve_db_path(explicit=None):
    """Where harness.db lives for a project.

    caw v2 layout (mirrors repository-harness): harness.db lives at the project
    ROOT, alongside scripts/ and docs/ — not under .claude/.
    Order: explicit arg > HARNESS_DB env > ./harness.db (project root / cwd).
    """
    import os

    if explicit:
        return Path(explicit)
    env = os.environ.get("HARNESS_DB")
    if env:
        return Path(env)
    return Path.cwd() / DEFAULT_DB_NAME
