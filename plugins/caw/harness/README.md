# caw durable layer (v2)

Operational state agents produce and query during work, in a per-project SQLite
DB (`harness.db`), driven by a stdlib-only Python CLI. Policy stays in markdown
rules; this layer is "what agents did", not "what they should do" (ADR-0004,
ported from repository-harness). Shape mirrors repository-harness so a future Rust
rewrite migrates 1:1.

> **Two docs, two audiences.** This README is the **developer doc** for the harness
> *code* (layout, commands, tests). The concept/contract for *users* — mental model,
> durable-layer philosophy, spec lifecycle — lives in the scaffolded `docs/caw/HARNESS.md`
> (source: `templates/docs-caw/HARNESS.md`). Keep the two in sync when the CLI's
> command surface changes.

## Layout

```
scripts/
  bin/harness-cli      stdlib Python CLI (chmod +x; no toolchain needed)
  schema/001-init.sql  6 tables: intake, task, phase, decision, backlog, trace
  harness/             package: db, domain, render, commands, audit, scoring,
                       propose, lint, maturity
  tests/               pytest (67 tests)
```

`harness.db` is gitignored — each project generates its own. The schema + CLI are
committed.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | create/migrate `harness.db` |
| `intake add` | classify incoming work (type, lane, flags) |
| `task add/update/gate/verify-all` | a unit of work; `gate` is the pre-close proof check; `verify-all` runs every phase's proof |
| `phase add/update/verify` | steps inside a task; `verify` runs the proof command |
| `decision add/verify` | durable ADR **index** (status/proof); content stays in `decisions/*.md` |
| `intervention add` | record a human/reviewer/CI override of agent work |
| `tool register/remove` | register external project tools |
| `trace` | record an agent execution (auto-scores its tier) |
| `score-trace` | re-score a trace against its lane's required tier |
| `score-context` | score a trace's context reads against lane+phase rules |
| `backlog add/close` | improvement items with predicted→actual outcome loop |
| `query <table> [--json\|--summary] [--open\|--closed]` | read state |
| `query stats` | row counts per durable table (one-glance summary) |
| `query friction` | traces that recorded harness_friction (the `propose` signal) |
| `query sql "<SELECT …>"` | ad-hoc READ-ONLY SELECT for inspection |
| `matrix [--json\|--summary]` | test-matrix generated from task+phase (no markdown) |
| `audit [--conductor DIR]` | entropy/drift score (lower is better) |
| `propose [--commit]` | turn recurring friction + drift into backlog proposals |
| `import [--conductor DIR] [--dry-run]` | migrate caw v1 markdown state into the DB |
| `lint [--conductor DIR]` | enforce bounded-growth (exits non-zero on findings) |
| `maturity` | estimate the harness maturity level (H0–H5) |

**State vs prose (ADR-0001):** state (status/proof/backlog/intake/decision-status)
lives here in the DB; prose (ADR content, plan, narrative) stays in markdown. A v1
project migrates once with `import`. See `docs/GLOSSARY.md` and
`rules/common/harness-contract.md`.

Run `harness-cli <command> --help` for flags.

## The loop in one screen

```bash
harness-cli init
harness-cli task add --id T-1 --title "feature X" --risk-lane normal
harness-cli phase add --task-id T-1 --phase-key backend --verify "pnpm test"
# ...code the phase...
harness-cli phase verify --task-id T-1 --phase-key backend   # runs the proof
harness-cli task gate --task-id T-1                          # blocks approval until pass
harness-cli trace --summary "..." --outcome completed --task-id T-1 --agent coder ...
harness-cli audit       # is the project drifting?
harness-cli propose     # what should we fix next?
```

## Tests

The CLI is stdlib-only; pytest is needed ONLY to run the tests. Install it in a
venv (declared in `requirements-dev.txt`, pinned per supply-chain policy):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest scripts/tests -q
```

See `docs/HARNESS_MATURITY.md`, `docs/TRACE_SPEC.md`, `docs/IMPROVEMENT_PROTOCOL.md`
for the concepts.
