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
- `docs/caw/conventions.md` — project-specific archetype + patterns
- `scripts/caw/bin/harness-cli query matrix` — current story/task state

Use the harness CLI at `scripts/caw/bin/harness-cli` (Python 3, stdlib-only —
no toolchain, cross-platform) as the main operational tool. This is a thin
wrapper that `/caw:setup` writes; it execs the real binary shipped by the
`caw` plugin and writes `harness.db` to the project root. Read state with
`harness-cli query …`, write it with `harness-cli story/task/decision/backlog …`.

**State vs prose** — the single source-of-truth rule (state → `harness.db`,
prose → markdown) is defined once in `.claude/rules/common/harness-contract.md`.
Read it before recording anything; do not restate task status in markdown.

Before a step that could use an external tool, run `scripts/caw/bin/harness-cli
query tools --capability <name> --status present` to see what is equipped; an
absent capability is a clean skip.
<!-- HARNESS:END -->
