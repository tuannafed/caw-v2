-- caw v2 durable layer — migration 001
--
-- Operational state that agents PRODUCE and QUERY during work. Policy docs
-- (CLAUDE.md, conventions.md, rules/*) stay as human-readable references —
-- this database is "what agents wrote", not "what they should do" (ADR-0004,
-- repository-harness). The schema is version-controlled; harness.db is NOT
-- (each project generates its own state).
--
-- Shape is ported 1:1 from repository-harness so a future Rust rewrite migrates
-- cleanly. The 2-tier model: a story owns many tasks (mirroring overview.yaml phases).
-- A task is a unit of work; a phase was renamed to task. Everything else is upstream.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

----------------------------------------------------------------------
-- Schema version
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO schema_version (version) VALUES (1);

----------------------------------------------------------------------
-- Intake: classifying incoming work
----------------------------------------------------------------------
CREATE TABLE intake (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    input_type    TEXT    NOT NULL
                         CHECK(input_type IN (
                           'new_spec','spec_slice','change_request',
                           'new_initiative','maintenance','harness_improvement'
                         )),
    summary       TEXT    NOT NULL,
    risk_lane     TEXT    NOT NULL
                         CHECK(risk_lane IN ('tiny','normal','high_risk')),
    risk_flags    TEXT,          -- JSON array, e.g. ["auth","data_model"]
    affected_docs TEXT,          -- JSON array of doc paths
    story_id      TEXT,          -- links to story.id when one is created
    notes         TEXT
);

----------------------------------------------------------------------
-- Story: a unit of work (caw maps lanes tiny/normal/high_risk).
-- Replaces hand-edited test-matrix.md index rows. Owns many tasks (below).
----------------------------------------------------------------------
CREATE TABLE story (
    id               TEXT PRIMARY KEY,   -- e.g. story-v2.0-001-foo or US-001
    title            TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    risk_lane        TEXT NOT NULL
                     CHECK(risk_lane IN ('tiny','normal','high_risk')),
    contract_doc     TEXT,               -- path to the spec/plan doc
    status           TEXT NOT NULL DEFAULT 'planned'
                     CHECK(status IN (
                       'planned','in_progress','implemented','changed','retired'
                     )),
    unit_proof        INTEGER NOT NULL DEFAULT 0,
    integration_proof INTEGER NOT NULL DEFAULT 0,
    e2e_proof         INTEGER NOT NULL DEFAULT 0,
    platform_proof    INTEGER NOT NULL DEFAULT 0,
    evidence         TEXT,
    notes            TEXT
);

----------------------------------------------------------------------
-- Task: one step inside a story (mirrors overview.yaml tasks).
-- This is where the pre-close verification gate (M3) hangs: each task
-- can carry a verify_command and its last recorded result.
----------------------------------------------------------------------
CREATE TABLE task (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id              TEXT    NOT NULL REFERENCES story(id),
    task_key       TEXT    NOT NULL,   -- short id: db, backend, frontend, smoke...
    description           TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    status                TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(status IN (
                            'pending','in_progress','blocked','done'
                          )),
    verify_command        TEXT,              -- mechanical proof for this task
    last_verified_at      TEXT,
    last_verified_result  TEXT
                          CHECK(last_verified_result IN ('pass','fail') OR
                                last_verified_result IS NULL),
    notes                 TEXT,
    UNIQUE(story_id, task_key)
);

----------------------------------------------------------------------
-- Decision: durable records with optional verification
----------------------------------------------------------------------
CREATE TABLE decision (
    id                    TEXT PRIMARY KEY,  -- e.g. 0001
    title                 TEXT NOT NULL,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    status                TEXT NOT NULL DEFAULT 'proposed'
                          CHECK(status IN (
                            'proposed','accepted','superseded','rejected'
                          )),
    doc_path              TEXT,              -- path to the markdown ADR
    verify_command        TEXT,              -- optional check command
    last_verified_at      TEXT,
    last_verified_result  TEXT
                          CHECK(last_verified_result IN ('pass','fail') OR
                                last_verified_result IS NULL),
    predicted_impact      TEXT,
    actual_outcome        TEXT,
    notes                 TEXT
);

----------------------------------------------------------------------
-- Backlog: harness improvement proposals with evidence loop
-- (predicted_impact at creation, actual_outcome at close — Phase 3 loop)
----------------------------------------------------------------------
CREATE TABLE backlog (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    title                 TEXT    NOT NULL,
    discovered_while      TEXT,
    current_pain          TEXT,
    suggested_improvement TEXT,
    risk                  TEXT    CHECK(risk IN ('tiny','normal','high_risk')),
    status                TEXT    NOT NULL DEFAULT 'proposed'
                          CHECK(status IN (
                            'proposed','accepted','implemented','rejected'
                          )),
    predicted_impact      TEXT,
    actual_outcome        TEXT,
    implemented_at        TEXT,
    notes                 TEXT
);

----------------------------------------------------------------------
-- Trace: agent task execution records (observability foundation)
----------------------------------------------------------------------
CREATE TABLE trace (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    task_summary    TEXT    NOT NULL,
    intake_id       INTEGER REFERENCES intake(id),
    story_id        TEXT    REFERENCES story(id),
    agent           TEXT,
    actions_taken   TEXT,       -- JSON array
    files_read      TEXT,       -- JSON array
    files_changed   TEXT,       -- JSON array
    decisions_made  TEXT,       -- JSON array
    errors          TEXT,       -- JSON array
    outcome         TEXT
                    CHECK(outcome IN (
                      'completed','blocked','partial','failed'
                    )),
    duration_seconds INTEGER,
    token_estimate   INTEGER,
    harness_friction TEXT,
    notes            TEXT
);

CREATE INDEX idx_task_story   ON task(story_id);
CREATE INDEX idx_trace_story  ON trace(story_id);
CREATE INDEX idx_intake_story ON intake(story_id);
