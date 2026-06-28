# Context Engineering Rules

What to read, when, and when to stop — by task phase × risk lane. Ported from
repository-harness (Phase 2) and merged with caw's existing lane-gated pull depth
(`rules/common/harness-contract.md`) and skill-loading contract.

The goal is not maximum context. It is putting the right information in the model
for the current phase and lane. caw's durable layer means **state** is read with
`harness-cli query`, not by loading markdown — these tables cover the **policy +
prose** an agent reads to decide *how* to work.

## Lane → required tier (recap)

| Lane | Reads | Test | Smoke |
| --- | --- | --- | --- |
| `tiny` | overview state + plan + ADRs in the touched area only | light | skippable |
| `normal` | full pull list | standard | required |
| `high_risk` | full + `Status: Proposed` ADRs in flight | detailed + delta-count | required |

## Intake phase — classify + choose lane

| Source | tiny | normal | high_risk |
| --- | --- | --- | --- |
| `CLAUDE.md` / `AGENTS.md` | Must | Must | Must |
| `harness-cli query intake` / `query matrix` | Must | Must | Must |
| `.claude/rules/project.md` (auto-injects on code edits; read explicitly at intake/plan time) | Should | Must | Must |
| `rules/common/spec-traceability.md` | Skip | Must | Must |
| relevant ADRs (`query decision` + `decisions/*.md` content) | Skip | Should | Must |

## Planning phase — smallest safe approach + expected proof

| Source | tiny | normal | high_risk |
| --- | --- | --- | --- |
| Files to edit | Must | Must | Must |
| The source spec (verbatim quote for `## Spec mandate`) | Skip if copy-only | Must | Must |
| `rules/common/test-tiers.md` | Skip | Must if tests touch I/O | Must |
| `rules/common/runtime-smoke-test.md` | Skip | Must | Must |
| relevant ADRs | Skip | Should | Must |

## Implementation phase — scoped to the phase

| Source | tiny | normal | high_risk |
| --- | --- | --- | --- |
| Files being changed | Must | Must | Must |
| Adjacent files, same pattern | Should | Must | Must |
| `skills_hint` skills (via Skill tool — `rules/common/skill-loading.md`) | as listed | Must | Must |
| `rules/react/react-state-deps.md` (React UI) | Skip | Must if React | Must |
| Provider / API / security docs | Skip | Should if touched | Must |

## Validation phase — prove, don't claim

| Source | tiny | normal | high_risk |
| --- | --- | --- | --- |
| `harness-cli task gate` / `verify-all` | Should | Must | Must |
| `query matrix` (this task's proof state) | Should | Must | Must |
| runtime-smoke checklist | Skip if no route/schema/env | Must | Must |
| delta-count evidence (test-tiers #8) for `*.db` tests | n/a | Must | Must |

## Trace phase — leave evidence

Record a trace with `harness-cli trace`; the auto-score tells you if it meets the
lane tier. high_risk needs `detailed` (decisions_made, errors, duration, tokens).

## Note on architecture

repository-harness ships an `ARCHITECTURE.md` for greenfield "no stack chosen
yet" projects. caw installs **into an existing project** with a detected stack, so
architecture context comes from the project's own `.claude/rules/project.md`
(generated from a codebase scan), not a generic doc. Record stack-constraining
choices as ADRs.
