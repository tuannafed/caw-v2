# ADR-0001 (caw v2) — Durable DB is the single source of truth for state

Date: 2026-06-12
Status: Accepted

## Context

caw v1 stored operational state in markdown (`overview.yaml` status/lane,
`harness-backlog.md`, `intake.md`, `test-matrix.md`). caw v2 added a SQLite
durable layer (M1) but only *added* it — markdown-as-state stayed. A real test on
the CMM project surfaced the consequence: the same state (task status, backlog,
intake, decision status) lived in two places, free to diverge. This is exactly
the failure repository-harness ADR-0004 names ("editing markdown tables is
error-prone; no structured query; markdown and DB may drift").

## Decision

Apply the repository-harness model: **the durable DB holds STATE; markdown holds
PROSE.** Every piece of information has exactly one source of truth:

- Machine-queried/measured/gated data (status, lane, proof results, backlog,
  intake, decision status) → `harness.db`.
- Human-read rationale (ADR content, plan approach, narrative, conventions) →
  markdown.
- Artifacts that mix both (`overview.yaml`, ADR files) are split: state to db,
  prose stays in markdown, and markdown never re-states the db's state.

caw keeps its own layers on top of the gut model: spec-traceability,
runtime-smoke-test, test-tiers, skill-loading, and the 5-agent workflow. caw
keeps the **task→phase** unit (finer than gut's story-centric model), not a
rewrite to story packets.

## Consequences

- Agent prompts and `harness-contract.md` must write state via `harness-cli`, not
  by editing markdown. (Refactor phase R3.)
- Projects with existing markdown state (dava2, 80 tasks) need a one-time
  `harness-cli import`. (Phase R4.)
- conductor markdown-state templates (`intake.md`, `harness-backlog.md`,
  `test-matrix.md` as state) are removed from the caw source. (Phase R6.)
- No data loss: markdown prose stays; git history preserves everything; import
  copies, never deletes, until confirmed.

## Alternatives rejected

- **Markdown stays source of truth, DB is a generated index.** Keeps the root
  disease (markdown-as-state) and adds a sync layer that drifts. Both
  repository-harness and the ADR-0004 rationale reject this.
- **Rewrite to story-centric like gut.** Loses caw's finer per-phase proof model
  for no benefit; the task→phase schema already maps cleanly onto the gut tables.
