-- caw v2 durable layer — migration 002
-- Fills two repository-harness responsibilities caw v2 (M1) didn't port:
--   #11 Intervention recording — human/reviewer/CI overrides of agent work
--   #3  Tool access (registry)  — user-registered external tools
-- Ported 1:1 in spirit from repository-harness schema 003/004.

INSERT INTO schema_version (version) VALUES (2);

----------------------------------------------------------------------
-- Intervention: a durable record of a human/reviewer/CI/agent override.
-- Separate from `trace` so "where did a human step in?" is queryable on its own
-- (repository-harness Phase 5 US-021).
----------------------------------------------------------------------
CREATE TABLE intervention (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    source       TEXT    NOT NULL
                        CHECK(source IN ('human','reviewer','ci','agent')),
    story_id     TEXT    REFERENCES story(id),
    trace_id     INTEGER REFERENCES trace(id),
    summary      TEXT    NOT NULL,   -- what was overridden / corrected
    rationale    TEXT,               -- why
    notes        TEXT
);

----------------------------------------------------------------------
-- Tool: a user-registered external tool the harness should know about
-- (repository-harness US-019). Compiled-in harness-cli commands are not stored;
-- this is for project scripts / custom CLIs agents may use.
----------------------------------------------------------------------
CREATE TABLE tool (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,
    command         TEXT    NOT NULL,   -- how to invoke
    responsibility  TEXT,               -- which harness area it serves
    description     TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_intervention_story ON intervention(story_id);
