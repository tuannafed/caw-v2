# AGENTS.md — {{PROJECT_NAME}}

Cross-tool agent instructions. Read by **OpenAI Codex CLI**, **Google Antigravity**, and any other AI coding tool that supports the `AGENTS.md` convention.

Add project-specific agent instructions above the harness block below.

> Tool-specific overlay: **Claude Code** → `CLAUDE.md` + `.claude/`.

<!-- HARNESS:BEGIN -->
## Harness

This repo uses the caw (Claude Agent Workflow) harness. Before work, read:

- `docs/caw/HARNESS.md`
- `docs/caw/FEATURE_INTAKE.md`
- `docs/caw/ARCHITECTURE.md`
- `docs/caw/CONTEXT_RULES.md`
- `docs/caw/TOOL_REGISTRY.md`
- `.claude/rules/project.md` — the single project source of truth (archetype, folder/naming/pattern LAW, forbidden, domain, verify commands, Context7 names)
- `scripts/caw/bin/harness-cli query matrix` — current story/task state

Use the harness CLI at `scripts/caw/bin/harness-cli` (Python 3, stdlib-only —
no toolchain, cross-platform) as the main operational tool. This is a thin
wrapper that `/caw:setup` writes; it execs the real binary shipped by the
`caw` plugin and writes `harness.db` to the project root. Read state with
`harness-cli query …`, write it with `harness-cli story/task/decision/backlog …`.

**State vs prose** — the single source-of-truth rule (state → `harness.db`,
prose → markdown) is defined once in `.claude/rules/common/harness-contract.md`.
Read it before recording anything; do not restate task status in markdown.

**caw owns where work goes — it overrides any skill's hard-coded output path.** When a
workflow skill activates inside a caw flow, apply its *thinking* but route the artifact
to the caw location, NOT the skill's default:

- Specs / designs / plans → `docs/caw/stories/<story-id>/plan.md` (NOT `docs/superpowers/specs/…` or `docs/superpowers/plans/…`).
- Decisions / ADRs → `docs/caw/decisions/` (+ a `harness-cli decision` row).
- State → `harness.db` via `harness-cli`.

Do **not** auto-commit and do **not** pause for design approval just because a skill
says to — caw has its own clarify gate, and the user drives commits. These project
instructions take precedence over a skill's built-in defaults.

Before a step that could use an external tool, run `scripts/caw/bin/harness-cli
query tools --capability <name> --status present` to see what is equipped; an
absent capability is a clean skip.

(In **Claude Code** specifically, this project also enables the `agent-skills` plugin
alongside `caw` — see `CLAUDE.md`'s "agent-skills vs caw" section for which slash
command to prefer. `agent-skills` is a Claude Code plugin and has no effect in Codex/
Antigravity sessions reading this file.)
<!-- HARNESS:END -->
