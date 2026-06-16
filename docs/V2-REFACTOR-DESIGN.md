# CAW v2 — Refactor Design

A full-source read of CAW plus the real Dava2 project (80 tasks) drives this
design. It proposes the scope of a workflow + structure refactor, anchored to
evidence, not taste. Companion to `docs/V2-ROADMAP.md` (which sequences the work);
this doc decides the **shape**.

## Evidence base

- Read the full CAW source: distribution layer (`init.sh` 1028 lines,
  `upgrade.sh`, `remove.sh`), agent-pipeline (5 agents, 7 commands, 11 rules,
  conductor/), skills library (65 skills), and the Python harness layer.
- Read real workflow artifacts in Dava2 (4 representative tasks of 80).
- Read the Dava2 friction log + 2026-05-27 spec-backing audit.

## Three findings that shape the refactor

### Finding 1 — the durable layer (harness.db) was never delivered to Dava

Dava2 has **no `.claude/scripts/bin/harness-cli`** and its agents reference
`harness-cli` **zero times** across all 5 files. State lives entirely in
`overview.yaml` + conductor markdown, hand-edited through 12 Jun 2026.

Interpretation: this is **not** "the DB is bad so agents avoid it." The SQLite
durable layer is a newer port (from repository-harness, Rust) that simply
**never reached Dava** — Dava's agents predate it and only know markdown. So the
DB is unproven in practice, but not rejected.

### Finding 2 — per-task artifacts are heavy and state is duplicated 3 ways

Measured: each task = **~1,500–2,400 lines across 6–7 files**
(plan/overview/code/tests/review/test-matrix). State is duplicated:

- **Phase status:** `overview.yaml` `phases[].status` AND code/tests/review prose.
- **Test behaviors:** per-task `test-matrix.md` AND project `test-matrix.md`.
- **Headings drift:** `## Spec` vs `## Spec Mandate` — machine parsing breaks.

No sync mechanism exists, so the copies silently diverge.

### Finding 3 — the real pain is interpreting ambiguous client feedback

The spec-backing audit found **0 fabricated** plans (15/17 spec-backed). The
expensive failure was a mis-digested client sentence ("Q#4 misread cost a full
day"). The feedback → interpretation layer has no gate, unlike spec → plan.
(Detailed in `docs/V2-ROADMAP.md` Wave 1.)

## Refactor scope — intervention level per layer

| Layer | Evidence | v2 action |
| --- | --- | --- |
| State model (overview.yaml vs harness.db) | DB never delivered; state duplicated 3× | **REFACTOR (core decision)** |
| Per-task artifacts | 1,500–2,400 lines, duplicated | **REFACTOR** — separate state from prose |
| Workflow (5 steps) | sound but no feedback gate, verbose | **REFACTOR** — add input gate, trim |
| Distribution (`init.sh`) | 1028 lines, does many jobs | **TIDY** — keep logic, modularize |
| Harness CLI / Skills | healthy | **KEEP** (skills optimize later, P2) |

Harness CLI and skills are the healthiest parts — do not rewrite them. Where
workflow needs new fields, that is a schema migration, not a redesign.

## Core decision — the state model (DECIDED)

**Decision: CAW v2 uses the durable layer (SQLite DB + `harness-cli`, the Python
port) as the state store. `overview.yaml` is retired. Markdown holds prose only.**

**Runtime = stdlib Python, not Rust.** The repository-harness original is Rust
(~5,600 lines), but the Rust toolchain is version-sensitive (it fails to build on
an older `cargo` — e.g. `edition2024` needs Rust ≥ 1.85), which makes it fragile
to distribute to a team. The stdlib-Python port runs on any `python3` with zero
toolchain, copies as plain files, and is easy for agents to read/edit. Command
shape mirrors the Rust CLI 1:1, so a future Rust rewrite stays a drop-in. Speed is
a non-issue: the CLI is invoked discretely (~150ms/call), not in a hot loop.

This is Option A below. It is now a settled decision, not an open question,
because two constraints were lifted:

1. **Dava is v1 and is NOT a v2 constraint.** v2 ships first; Dava migrates only
   after v2 release. So there is no live project to keep backward-compatible —
   v2 can target the clean end-state directly instead of a staged C→A path.
2. **The durable layer is already built.** CAW already ported the Rust harness to
   Python (83 tests pass) with `task`/`phase`/`intake`/`trace`/`decision`/
   `backlog`/`intervention` tables. The missing piece was never the code — it was
   that agents were never taught to call `harness-cli` and `overview.yaml` ran in
   parallel. v2 closes that gap.

### Option A — DB is the single source of truth (CHOSEN)
Drop `overview.yaml`. Agents read/write state via `harness-cli`; markdown holds
prose only.
- ✅ Queryable, drift-proof, one truth, enables audit/propose/score as designed.
- ✅ Already implemented (Python port, 83 tests) — this is adoption, not new code.
- ⚠️ Every agent must call the CLI for state; requires python3 present (the
  install layer guarantees it — `init.sh` already runs `harness-cli init`).

### Option B — Markdown is the source of truth (rejected)
`overview.yaml` + conductor canonical; CLI a read-only view.
- ✅ Simplest; no toolchain.
- ❌ Not queryable at scale (Dava's 80 tasks proved this); hand-edited YAML
  drifts (the 3-way duplication this doc documents); discards the audit/propose/
  score machinery and the Python port. **This is essentially v1 — the thing v2
  is fixing.**

### Option C — DB + markdown hard split, staged toward A (superseded)
Was the earlier recommendation as a *de-risking path* for a live Dava. Since Dava
is not a v2 constraint, the staging is unnecessary — go straight to A.

### What "state vs prose" means concretely

The split follows the repository-harness (Rust) model — *"policy docs describe
how to work; the durable layer stores what happened."*

| Data | Store | Why |
| --- | --- | --- |
| task/phase status, lane, proof flags, intake type, decision status, trace, intervention | **DB** | structured, queryable, drift-proof, feeds audit/propose/score |
| plan rationale, code/tests/review narrative, ADR content, conventions | **Markdown** | human-read, git-diffable, no tool needed |
| project test-matrix / index | **Generated from DB** | never hand-maintained → cannot drift |

**Golden rule (the anti-drift invariant):** every fact lives in exactly ONE
store. Status lives in the DB; markdown *points to* it, never *restates* it. This
is the rule v1 stated as a convention and let rot — v2 enforces it (a phase's
status must not appear as text in code.md/review.md; reviewer/gate rejects it).

### v2 migration steps (within CAW itself)

- Teach all 5 agents to read/write state via `harness-cli` (currently they
  reference `overview.yaml`; Dava's agents reference `harness-cli` zero times).
- Retire `overview.yaml` from the planner output and `init.sh` scaffolding.
- Make the project test-matrix a generated view (`harness-cli matrix`), not a
  hand-edited file.
- Keep code.md/tests.md/review.md as prose; strip restated status from them.

## Per-task artifact redesign (proposal)

Given Option A (DB is state truth), the artifact footprint shrinks by removing
duplication, not by deleting prose:

| v1 today | v2 proposal |
| --- | --- |
| `overview.yaml` holds state + mirrors plan detail | State → DB. `overview.yaml` **retired** (agents read/write via `harness-cli`). |
| Phase status in YAML **and** code/tests/review prose | Status → DB only. Prose references it, never restates it. |
| per-task `test-matrix.md` **and** project `test-matrix.md` | Project matrix **generated** from per-task data (or DB); never hand-maintained twice. |
| `## Spec` vs `## Spec Mandate` (drifts) | One canonical heading, machine-checkable. |
| code.md / tests.md / review.md as primary record | Keep as prose augmentation; the queryable record is the DB. |

Net effect: prose stays for humans; state stops being copied; the project-level
index becomes a computed view, not a second hand-edited file.

## Workflow redesign (proposal)

Keep the Plan→Code→Test→Review separation (it is a quality lever, and Dava's
real pain is not "too many steps"). Two changes:

1. **Add an input gate before planning** (the feedback quote-back gate, Wave 1) —
   the highest-value change because it treats the most expensive Dava failure.
2. **Clarify the agent/command boundary** (settled earlier):
   - `setup`, `planner` → commands (planner needs dialogue with the user to
     quote-back ambiguous feedback).
   - `coder`, `tester`, `reviewer` → subagents (clean context; reviewer's
     isolation is the objectivity gate).

## What this design does NOT do

- Does not rewrite the harness CLI or schema (only extends with migrations).
- Does not touch the skills library mechanism (P2 optimization later).
- Does not collapse the 5 roles into one (separation is intentional).
- Does not keep `overview.yaml` — state moves to the DB (Option A).

## Decided

State model: **Option A — DB (durable layer) is the single source of truth;
markdown holds prose only.** Enabled by two facts: Dava (v1) is not a v2
constraint, and the durable layer is already built (Python port, 83 tests). v2's
job is adoption + retiring `overview.yaml`, not new infrastructure.

Open items that still need a call (not blocking the state-model decision):

- **python3 guarantee on dev machines.** Option A requires `python3` present.
  `init.sh` already runs `harness-cli init` and warns if python3 is missing —
  confirm every team machine has it (macOS/Linux do by default).
- **Anti-drift enforcement.** The golden rule (one fact, one store) needs a
  mechanical check so it doesn't rot like v1. Candidate: a `harness-cli` lint /
  reviewer gate that rejects status text restated in prose files.
