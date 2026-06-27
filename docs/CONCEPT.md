# caw — Architecture & Design

The design doc behind the `caw` plugin. CLAUDE.md is the operational reference (how
to work in this repo); this is the *why* — the architecture and the decisions that
shaped it.

## The problem caw solves

A multi-step coding pipeline run by LLM agents has two failure modes that markdown
scaffolding alone doesn't fix:

1. **State amnesia across sessions.** An agent finishes a task, the session ends, and
   the next session has no durable record of what was done, what was proven, or what's
   left — so it re-derives, re-asks, or silently drops work.
2. **Drift between what's claimed and what's true.** Status gets restated in prose, the
   copies diverge, and "done" stops meaning done.

caw answers both with a **durable harness** (SQLite, project-local) holding *state*, and
a strict **state-vs-prose invariant** (ADR-0001): state lives in the DB, prose lives in
markdown, and the two never restate each other.

## Skill-first architecture

The core design choice: **five generic agents that load domain knowledge at runtime via
the Skill tool**, instead of many specialized agents or a large vendored skill catalog.

caw v1 was a shell template hub that symlinked 65 vendored skills from a static catalog.
That rotted — skills went stale, the catalog needed constant maintenance, and most
skills never fired. v2 deletes all of it and delegates:

| Knowledge | Source | Why |
|---|---|---|
| Workflow (TDD, debugging, verify, review, worktrees, parallel) | **Superpowers** plugin | Anthropic-maintained, always current |
| Framework/library docs (Next.js, Prisma, Stripe, …) | **Context7** MCP | Live docs, no static catalog to maintain |
| Frontend UI quality | **Frontend Design** plugin | Specialized, maintained |
| Archetype + quality skills caw can't delegate | **9 authored caw skills** | The irreducible core |

The trade-off is explicit: caw gives up self-containment (it depends on three companion
plugins being present, and Context7 needs network) in exchange for **zero catalog
maintenance** and **docs that are always current**. `/caw:setup` preflights the
companions and warns if any are missing.

## The five agents

A fixed pipeline — `setup → planner → coder → tester → reviewer` — deliberately kept at
five. Domain breadth comes from skills, not from spawning more agents (agent sprawl is
technical debt, not capability).

- **setup** — detect stack, verify the harness, scaffold `docs/caw/` + `.claude/rules/` +
  project conventions. One-time.
- **planner** — load the constitution (project invariants), run a clarify gate (block on
  plan-breaking ambiguity rather than guess), then write spec + API contract + tasks +
  self-challenge, and assign the `risk_lane`.
- **coder** — implement one task, loading skills from the task's `skills_hint`. A
  mandatory self-verify gate (type-check + lint) blocks `done`.
- **tester** — test behavior derived from the lane (tiny=skip, normal=backend, high_risk=
  full red→green TDD).
- **reviewer** — multi-dimensional review (security, perf, a11y, architecture,
  constitution, refactor, harness-compliance), severity-gated, with a mechanical proof
  gate (`harness-cli story gate`). Folds an evolution snapshot at story close.

Each agent is a subagent with `memory: project` — a team-shared lessons layer the harness
(which holds *state*) and markdown (which holds *prose*) didn't cover.

## The lane contract

`risk_lane` (`tiny | normal | high_risk`) is the single story-sizing field. Everything
downstream — test behavior, context-pull depth, ADR requirement, review breadth, the
in-flight doubt-check — derives from it. This is the speed contract: trivial work runs
lean, risky work gets the full gauntlet.

## The durable harness

A stdlib-only Python CLI (`harness-cli`) over a project-local SQLite DB (`harness.db`,
at the project root, gitignored — each project generates its own). It records story/task
state, proof results, traces, and backlog; markdown holds the narrative. An **evolution
layer** (audit / maturity / propose) scores entropy and surfaces improvement proposals —
run manually via `/caw:maintain`, and as an event-driven heartbeat at story close.

See [the harness README](../plugins/caw/harness/README.md) for the command surface and
[CLAUDE.md](../CLAUDE.md) for the operational contract.

## Distribution

caw ships as a Claude Code plugin catalogued by a marketplace at the repo root. The
marketplace ref tracks `main`, so a push ships the release and members pull it via
`/plugin marketplace update`. There is no build step — everything is markdown, shell,
and Python stdlib.
