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
<!-- HARNESS:END -->
