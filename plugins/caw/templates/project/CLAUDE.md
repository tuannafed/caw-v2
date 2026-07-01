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

**Commit only on an explicit user instruction.** Never run `git commit` (or `git push`)
because a stage "finished" or a verdict said "ready to commit" — that wording is a
status report to the human, not a trigger. Run `git commit` ONLY after the user
explicitly tells you to (e.g. they say "commit"). When a story is ready, stop and say
so; let the user decide when to commit. (Commit/push are also in the settings `ask`
list, so they prompt — do not treat the prompt as license to commit unprompted.)

### agent-skills is enabled too — /caw:* is still the pipeline of record

This project also enables the `agent-skills` plugin (addyosmani/agent-skills) for its
non-pipeline skills (`interview-me`, `idea-refine`, `frontend-ui-engineering`,
`shipping-and-launch`, `documentation-and-adrs`, etc. — anything caw doesn't already
cover). It ships its own competing pipeline and slash commands: `/spec`, `/plan`,
`/build`, `/test`, `/review`, `/webperf`, `/code-simplify`, `/ship`, plus 4 auto-activating
agent personas (`code-reviewer`, `test-engineer`, `security-auditor`,
`web-performance-auditor`).

**In this project, always prefer the caw equivalent:**

| Instead of (agent-skills) | Use (caw) |
|---|---|
| `/spec`, `/plan` | `/caw:plan "<description>"` |
| `/build`, `/build auto` | `/caw:code <story-id> [--all]` |
| `/test` | `/caw:test <story-id>` |
| `/review` | `/caw:review <story-id>` |
| (no caw equivalent) | `/caw:verify <story-id>` runs test + review together |

If a non-pipeline agent-skills skill activates automatically mid-flow and starts
writing plan/spec/review artifacts, redirect it to the caw locations per "caw owns
where work goes" above — the same override applies to agent-skills as to Superpowers.
Do not let its `code-reviewer`/`test-engineer` personas replace caw's `reviewer`/`tester`
agents inside a `/caw:*` flow.
<!-- HARNESS:END -->
