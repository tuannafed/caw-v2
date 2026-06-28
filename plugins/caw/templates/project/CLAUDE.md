# Project Rules — {{PROJECT_NAME}}

<!-- HARNESS:BEGIN -->
## Harness

Claude Code loads this file into every session, but it does not auto-load
`AGENTS.md`. The bare `@` lines below import the always-required harness
context (the "Must in all lanes" set from `docs/caw/CONTEXT_RULES.md`) at
context-load time. Never wrap them in backticks; that disables the import.

@AGENTS.md

@docs/caw/FEATURE_INTAKE.md

Also run `scripts/caw/bin/harness-cli query matrix` before starting work.

Lane-dependent context (`docs/caw/HARNESS.md`, `docs/caw/ARCHITECTURE.md`,
`docs/caw/CONTEXT_RULES.md`, product docs, stories, decisions) is intentionally not
imported — read it per lane, as `docs/caw/CONTEXT_RULES.md` prescribes. The project's
own rules in `.claude/rules/project.md` auto-inject on code edits via their `paths:`.

### caw owns where work goes — override any skill's hard-coded paths

This project runs the **caw** harness. Its directory contract is the law for where
prose and state live, and it **overrides any skill's built-in output location**
(Superpowers skills hard-code their own paths). When a skill activates inside a caw
flow, apply its *thinking* but route the artifact to the caw location:

- **Specs / designs / plans** → `docs/caw/stories/<story-id>/plan.md` (the planner's
  `## Spec mandate` + `## Plan`). **NOT** `docs/superpowers/specs/…` or
  `docs/superpowers/plans/…`.
- **Decisions / ADRs** → `docs/caw/decisions/` (+ a `harness-cli decision` row).
- **State** (story/task status, proof) → `harness.db` via `harness-cli`, never a
  markdown status table.

Also, do **not** auto-commit and do **not** pause to ask for design approval as a
skill might instruct — caw has its own clarify gate (planner Step 0.7) and the user
drives commits. (Per Superpowers' own rule, these user/project instructions take
precedence over a skill's defaults.)
<!-- HARNESS:END -->
