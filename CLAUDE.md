# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

`caw-v2` is a **Claude Code plugin marketplace**. The deliverable is the
`caw` plugin under `plugins/caw/`, catalogued by
`.claude-plugin/marketplace.json` at the repo root. It is not a Node/Python
application; there is no build step. Everything ships as markdown, shell, and
Python stdlib.

`caw` provides a 5-agent pipeline (plan → code → test → review), a durable
SQLite harness, safety hooks, and 4 authored skills. Workflow knowledge, framework
docs, and UI quality come from companion plugins (Superpowers, Context7, Frontend
Design) rather than vendored skills.

> **Migration note (was: shell template hub).** caw v1 was a shell-based template
> hub: `caw init/upgrade/remove` scaffolded files into projects and symlinked **65
> vendored skills** from a static catalog. That whole flow is gone. Removed:
> `template/` (its contents migrated into `plugins/caw/`), the 65 vendored
> skills, `SKILLS-CATALOG.md`, `SKILLS-CHECKLIST.md`, `skills-lock.json`,
> `skills-defaults.yaml`, the catalog/matcher scripts (`cli/generate-catalog.*`,
> `cli/match-skills.py`, `cli/check-defaults.py`, `cli/generate-project-meta.py`),
> the shell install flow (`cli/caw.sh`, `init.sh`, `sync.sh`, `remove.sh`,
> `defs.sh`), and `setup.sh`. The vendored skills were replaced by:
> - **Workflow** (TDD, debugging, verify, review) → **Superpowers** plugin
> - **Framework/library docs** (Next.js, Prisma, Stripe, TanStack, Supabase, …) →
>   **Context7** (live docs, no static catalog)
> - **Frontend UI quality** → **Frontend Design** plugin
> - caw keeps only **4 authored skills**, bundled in `caw/skills/`.

## Installing (how a team consumes this)

```
/plugin marketplace add tuannafed/caw-v2     # team adds THIS repo as a marketplace
/plugin install caw@caw                 # install the caw plugin
```

Or commit a `.claude/settings.json` into the member project so everyone is prompted
to install on trust. A sample lives at `plugins/caw/project.settings.json`
(also scaffolded by `/caw:setup` as `plugins/caw/templates/project/settings.json`).
That settings file pins the `caw` marketplace and enables `caw` plus 3
companion plugins: `superpowers`, `frontend-design`, `context7`.

> **Pin a commit SHA for production.** In `marketplace.json` /
> `extraKnownMarketplaces`, reference a commit SHA, not a branch. A push to a
> branch silently changes what the team installs.

## Repository Structure

```
.claude-plugin/marketplace.json     # marketplace catalog (teams add THIS repo)
plugins/caw/                    # THE plugin
  .claude-plugin/plugin.json         # plugin manifest
  agents/        # 5 agents: setup, planner, coder, tester, reviewer
  commands/      # 6 commands: setup, plan, code, test, review, verify (invoked as /caw:setup, /caw:plan, …)
  skills/        # 4 AUTHORED skills: api-contract, error-handling-patterns,
                 #   nextjs-feature, react-component-testing (namespaced caw:<name>)
  hooks/         # hooks.json (uses ${CLAUDE_PLUGIN_ROOT}) + hook .js files
  rules/         # non-overridable coding rules every agent loads (common/, react/, typescript/)
  harness/       # durable layer: bin/harness-cli (Python stdlib) + harness/*.py + schema/*.sql
                 #   DB resolves to the PROJECT root, not the plugin cache
  templates/     # files /caw:setup scaffolds into a member project:
                 #   docs-caw/ → project docs/caw/ (policy docs, ADR/intake templates,
                 #               conventions.md/knowledge.md seeds, advisories)
                 #   project/  → AGENTS.md, CLAUDE.md (@-import), gitleaks.toml,
                 #               .claudeignore, settings.json
  README.md
  project.settings.json              # sample project settings (commit into member repo)
cli/tests/                           # harness-cli test suite (pytest); imports harness from the plugin
docs/CONCEPT.md                      # architecture design doc
tools/backlog/                       # Astro + React + shadcn Kanban UI (vendored, unchanged)
```

## Architecture

Caw uses a **skill-first architecture**: 5 generic agents load domain knowledge by
invoking the `Skill` tool, not by recalling it from priors. Skills come from the
caw plugin (4 authored), Superpowers (workflow), and Context7 (framework docs).
See [docs/CONCEPT.md](docs/CONCEPT.md) for the full design.

### Agents (5)

Each agent file (`plugins/caw/agents/*.md`) has YAML frontmatter (model, tools,
maxTurns, permissionMode). All 5 have `Skill` in their `tools:` list.

| Agent | Stage | Purpose |
|---|---|---|
| `setup` | Bootstrap | Detect stack, verify the harness, generate conventions.md + project.yaml + project rules |
| `planner` | Plan + Challenge | Spec, API contract, phases (with test_scenarios + skills_hint), self-challenge, lane |
| `coder` | Code (per phase) | Implement one phase at a time. Loads skills via `Skill` from the phase's `skills_hint`. Generic across stack. |
| `tester` | Test | Test mode derived from Plan's `lane`: tiny=skip / standard=backend-only / risky=all (red+green). Mobile = unit tests only. |
| `reviewer` | Review | Multi-dim review (security, perf, a11y, refactor, architecture). Severity-based findings. May amend Plan. |

### Commands (6)

| Command | Action |
|---|---|
| `/caw:setup` | Detect stack, verify harness, generate conventions + project rules (one-time; `--refresh` to re-run) |
| `/caw:plan "<desc>"` | Generate Plan |
| `/caw:code <id> [<phase>] [--all]` | Implement one phase (or all phases with `--all`) |
| `/caw:test <id>` | Test (mode derived from Plan's lane) |
| `/caw:review <id>` | Multi-dim review |
| `/caw:verify <id>` | Test + review parallel |

Commands use the `caw-` prefix (not `/caw <subcommand>`) to avoid namespace
collisions with other Claude Code skills/commands.

## Project lifecycle

```
/plugin install caw@caw   # install the plugin (or trust a committed settings.json)
/init                          # Claude Code built-in — generates/enriches CLAUDE.md
/caw:setup                     # detect stack, verify harness, scaffold docs/caw + conventions + project rules
/caw:plan "<desc>"             # per-task planning
/caw:code <id> --all           # implementation (all phases)
/caw:verify <id>               # test + review parallel
```

There is no shell install step and no caw-repo discovery dance. The plugin is
resolved by Claude Code's plugin system; `${CLAUDE_PLUGIN_ROOT}` points at the
plugin's cache directory for any path the agents/hooks/commands need.

## Harness (durable layer)

The real binary ships in the plugin at
`${CLAUDE_PLUGIN_ROOT}/harness/bin/harness-cli` — a stdlib-only Python CLI (no
toolchain needed). `/caw:setup` writes a **thin wrapper** at the project's
`scripts/caw/bin/harness-cli` so the documented invocation path is stable across
tools (Claude Code, Codex, Antigravity, CI), regardless of where the plugin cache
lives. **`harness.db` lives at the PROJECT root** (gitignored; each project
generates its own). The schema + CLI are committed in the plugin.

The harness records "what agents did" (state: task/phase/decision status, proof,
backlog, traces) in a per-project SQLite DB; prose (plan, ADR content, narrative)
stays in markdown (ADR-0001). See `plugins/caw/harness/README.md` for the
full command list.

## Task File Format

Tasks live at `docs/caw/tasks/<task-id>/`:

| File | Owner | Purpose |
|---|---|---|
| `overview.yaml` | all agents | State file — task status, lane, phase status, next_phase |
| `plan.md` | planner | Spec + API contract + phases + challenge + revisions |
| `code.md` | coder | Files changed per phase (appended) |
| `tests.md` | tester | Tests written, coverage |
| `review.md` | reviewer | Findings by severity |
| `test-matrix.md` | tester | This task's behavior-level coverage rows |

`overview.yaml` is the structured source of truth for task progress — every agent
reads/writes it. `plan.md` is a **living document** — the reviewer may amend it (with
a `## Revisions` audit trail) when CRITICAL/HIGH findings require plan changes.

## Skills System (plugin era)

There is **no install step, no `skill-map.yaml`, no symlinked vendored skills**.
Skills come from three places, all available the moment the relevant plugins are
enabled:

| Source | Where | Role | Examples |
|---|---|---|---|
| **Authored (caw)** | `plugins/caw/skills/<name>/SKILL.md`, namespaced `caw:<name>` | Workflow/archetype skills caw can't delegate | `caw:api-contract`, `caw:error-handling-patterns`, `caw:nextjs-feature`, `caw:react-component-testing` |
| **Workflow (Superpowers)** | external plugin | TDD, systematic debugging, verification, code review | loaded by their Superpowers namespace |
| **Framework docs (Context7)** | external plugin | Live library docs (Next.js, Prisma, Stripe, TanStack, Supabase, …) | queried on demand; no static catalog |

A `skills_hint` in a Plan task names which skills to load when the task runs. It is
a **HINT, not a gate** — agents do NOT verify it against any installed-skill
manifest (none exists). Agents load the named skill directly via the `Skill` tool,
or query Context7 for the named framework. The full contract is in
`plugins/caw/rules/common/skill-loading.md`.

Rules (`plugins/caw/rules/`) are separate from skills — they are
non-overridable and always loaded by agents, never installed as skills.

## Hook Profile System

Hooks ship via the plugin's `plugins/caw/hooks/hooks.json` (entries invoke
`node ${CLAUDE_PLUGIN_ROOT}/hooks/run-with-flags.js …`). Execution is gated by the
`CAW_HOOK_PROFILE` env var:

- `minimal` — no hooks run
- `standard` — all hooks except dangerous-actions-blocker
- `strict` — all hooks including dangerous-actions-blocker

The dispatcher `hooks/run-with-flags.js` reads the profile and `CAW_DISABLED_HOOKS`
(comma-separated list) before invoking any hook.

**Hook inventory:** dangerous-actions-blocker, pre-commit-secrets,
prompt-injection-detector, suggest-compact, warn-debug-leftovers,
post-edit-accumulator, session-summary, stop-format-typecheck. Dispatch/helper
scripts: run-with-flags.js, hook-flags.js, resolve-formatter.js.

## Tests

```bash
python -m pytest cli/tests       # harness-cli suite; CI runs this
```

The tests import the harness package from `plugins/caw/harness`.

## Adding a New Agent

The architecture has 5 fixed agents (`setup`, `planner`, `coder`, `tester`,
`reviewer`) — domain knowledge moves to skills, not new agents. Avoid creating new
agents unless absolutely necessary.

If you must add one:
1. Create `plugins/caw/agents/<name>.md` with YAML frontmatter + role prompt.
2. Create a matching `plugins/caw/commands/caw-<name>.md` slash command.
3. Update the agent/command tables in this file and in `plugins/caw/README.md`.

## Adding a New Skill

### Authored (workflow / archetype) — bundled in caw
1. Create `plugins/caw/skills/<skill-name>/SKILL.md` with YAML frontmatter
   (`name`, `description`). The `name` MUST match the folder name; it resolves as
   `caw:<skill-name>`.
2. It is available immediately once the plugin is enabled — no install/symlink step.
3. Only add an authored skill if it's workflow/archetype/convention caw can't
   delegate. **For framework/library expertise, prefer Context7 over a new skill.**

### Framework / library expertise
Don't author a skill — use **Context7** (live docs, no static catalog to maintain).

## Key Conventions in This Repo

- **No build step** — all files are interpreted directly; do not add a build pipeline.
- **Markdown + shell + Python stdlib only** — agent prompts, skills, commands, and
  rules are `.md`; the harness CLI is stdlib Python (no third-party deps).
- **Shell scripts use bash ≥ 4** — arrays, associative arrays, `[[ ]]` tests are fine.
- **`${CLAUDE_PLUGIN_ROOT}`** — hooks/commands/agents reference plugin-internal paths
  through this variable, never hardcoded absolute paths.
- **Pin a commit SHA** in `marketplace.json` / `extraKnownMarketplaces` for
  production — a branch push silently changes what the team installs.
- **`conventions.md`** (scaffolded into projects, not this repo) is the source of
  truth for project-specific archetype + patterns; every code-writing agent reads it
  before proposing architecture.
- **docs/caw file naming** — `UPPER_CASE.md` = read-only guide/policy (agent only
  reads it; identical across projects). `lower-case.md` = fill-in: format templates
  (`templates/docs-caw/templates/{adr,intake}.md` → `docs/caw/templates/`) or seed
  prose the project writes into (`conventions.md`, `knowledge.md`,
  `harness-backlog.md`). `README.md` is the universal UPPER exception. When adding a
  doc: agent only reads it → UPPER; project writes into it → lower.

## Backlog Viewer (tools/backlog)

`tools/backlog/` is a vendored Astro + React + shadcn Kanban UI, unchanged by the
plugin migration. It is pinned to `pnpm@9.15.0` (pre-11) deliberately — do not
upgrade it without testing the full flow, as lifecycle-script gating differs between
pnpm major versions.
