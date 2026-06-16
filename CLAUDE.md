# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

`claude-agent-team` is a **template hub** — a collection of agent definitions, slash commands, skills, hooks, and scripts that get scaffolded into other projects via `caw init`. It is not a Node/Python application; there is no build step. Everything ships as shell scripts and markdown.

## CLI Entry Points

```bash
# Install globally (adds `caw` alias to shell RC + behavioral guidelines to ~/.claude/CLAUDE.md)
./setup.sh
./setup.sh --uninstall       # Remove alias

# Scaffold into a project
caw init ~/Projects/my-app       # Prompts to opt-in for backlog viewer (Astro UI)
caw upgrade ~/Projects/my-app    # Sync latest templates (+ backlog viewer source if installed)
caw remove ~/Projects/my-app     # Remove claude agent workflow (--keep-tasks to preserve task files)
```

**Backlog (opt-in during `caw init`)** — `caw init` asks whether to copy
the Astro + React + shadcn Kanban UI into `<project>/backlog/` (project root,
alongside `docs/` and `scripts/`). If accepted, run it from the project:

```bash
cd <project>/backlog
pnpm install
CAW_PROJECT_ROOT="$(pwd)/.." pnpm dev
# open http://localhost:4321
```

> **pnpm version note:** `tools/backlog/` is pinned to `pnpm@9.15.0` (pre-11). This is a deliberate exception — the tool is vendored and copied into target projects as-is. Do not upgrade it to pnpm 11 without testing the full `caw init` + viewer flow, as lifecycle-script gating behavior differs between major versions.

The `caw` alias dispatches to `scripts/caw.sh`, which routes subcommands to `scripts/init.sh`, `scripts/upgrade.sh`, `scripts/remove.sh`, etc.

## Repository Structure

```
agents/             # 5 agents: setup, planner, coder, tester, reviewer
commands/           # 7 commands: caw-setup, caw-plan, caw-code, caw-test, caw-review, caw-verify, caw-status
scripts/            # CLI scripts (caw.sh, init.sh, upgrade.sh, remove.sh, generate-catalog.{sh,py}, hooks/)
rules/              # Non-overridable coding rules loaded by every agent
  ├── common/       #   coding-standards, coding-style, commit-conventions, code-review,
  │                 #   harness-contract, package-manager, skill-loading (7 files)
  └── typescript/   #   coding-style (1 file)
conductor/          # Seed files + format templates scaffolded (flattened) into <project>/docs/caw/
                    #   seeds: conventions.md, knowledge.md, backlog.md, test-matrix.md, harness-backlog.md
                    #   templates: adr.md, intake.md, task-test-matrix.md
templates/          # Files copied verbatim into target projects
  ├── skills/       # 5 caw-owned skills (api-contract, error-handling-patterns, nextjs-feature, better-context, react-component-testing)
  ├── advisories/   # Supply-chain advisory templates scaffolded into target projects
  ├── settings.json
  ├── PULL_REQUEST_TEMPLATE.md
  └── ...
tools/backlog/      # Astro + React + shadcn Kanban UI (source — copied to <project>/backlog/ on opt-in)
.agents/skills/     # 57 hub skills pulled via skills.sh — used by /caw-setup as source for project copies
SKILLS-CATALOG.md   # Machine-readable index for /caw-setup (auto-generated)
SKILLS-CHECKLIST.md # Curated source breakdown of all skills
skills-lock.json    # Lockfile for caw repo's hub skills (maintained by the skills.sh CLI)
docs/CONCEPT.md     # Architecture design doc
```

> **Note:** Folder `templates/skills/` holds caw-owned skills in a flat layout. The folder name (not `skills/`) avoids name collision with the `skills.sh` CLI, which auto-detects a top-level `skills/` folder.

## Architecture

Caw uses a **skill-first architecture**: 5 generic agents load domain knowledge from auto-discovered skills (5 caw-owned + 57 hub-curated). See [docs/CONCEPT.md](docs/CONCEPT.md) for the full design.

### Agents (5)

Each agent file (`agents/*.md`) has YAML frontmatter (model, tools, maxTurns, permissionMode).

| Agent | Stage | Purpose |
|---|---|---|
| `setup` | Bootstrap | Detect stack, copy caw-curated skills, ask before pulling hub skills, generate conventions.md + skill-map.yaml |
| `planner` | Plan + Challenge | Spec, API contract, phases (with test_scenarios + skills_hint), self-challenge, lane |
| `coder` | Code (per phase) | Implement one phase at a time. Loads skills via `Skill` tool from phase's `skills_hint`. Generic across stack. |
| `tester` | Test | Test mode derived from Plan's `lane`: tiny=skip / standard=backend-only / risky=all (red+green). Mobile = unit tests only. |
| `reviewer` | Review | Multi-dim review (security, perf, a11y, refactor, architecture). Severity-based findings. May amend Plan. |

All 5 agents have `Skill` in their `tools:` list — domain knowledge is auto-discovered.

### Commands (7)

| Command | Action |
|---|---|
| `/caw-setup` | Detect stack, install skills, generate conventions (one-time) |
| `/caw-plan "<desc>"` | Generate Plan |
| `/caw-code <id> [<phase>] [--all]` | Implement one phase (or all phases with `--all`) |
| `/caw-test <id>` | Test (mode derived from Plan's lane) |
| `/caw-review <id>` | Multi-dim review |
| `/caw-verify <id>` | Test + review parallel |
| `/caw-status [<id>]` | Show task state |

Commands use `caw-` prefix (not `/caw <subcommand>`) to avoid namespace collisions with other Claude Code skills/commands.

## Project lifecycle

```
caw init <project>     # Maintainer scaffold (core only — agents, commands, rules, hooks)
                       # Also appends .agents/, .claude/, CLAUDE.md to target's .gitignore (machine-local)
                       # Also writes CAW_HOME to user's shell rc (for /caw-setup to find caw repo)
/init                  # Claude Code built-in — generates CLAUDE.md
/caw-setup             # Reads CLAUDE.md + <CAW_HOME>/SKILLS-CATALOG.md → installs skills + conventions
/caw-plan "<desc>"     # Per-task planning
/caw-code <id> --all   # Implementation (all phases)
/caw-verify <id>       # Test + review parallel
```

**Caw repo discovery (for `/caw-setup`):** `caw init` writes the repo path into 2 locations:

1. **`<project>/.claude/caw.config.json`** (primary) — project-local JSON with `caw_home` field. Survives shell switches, works in CI, no env var needed.
2. **`$CAW_HOME` in `~/.zshrc` or `~/.bashrc`** (fallback) — for CLI use outside Claude Code.

The `setup` agent reads the project-local config first, then falls back through env var → shell rc → caw alias → canonical default. No user prompts during discovery.

## Task File Format

Tasks live at `docs/caw/tasks/<task-id>/`:

| File | Owner | Purpose |
|---|---|---|
| `overview.yaml` | all agents | State file — task status, lane, phase status, next_phase |
| `plan.md` | planner | Spec + API contract + phases + challenge + revisions |
| `code.md` | coder | Files changed per phase (appended) |
| `tests.md` | tester | Tests written, coverage |
| `review.md` | reviewer | Findings by severity |
| `test-matrix.md` | tester | This task's behavior-level coverage rows (project-wide `conductor/test-matrix.md` keeps only a one-line index per task) |

`overview.yaml` is the structured source of truth for task progress — every agent reads/writes it. `plan.md` is a **living document** — reviewer may amend it (with `## Revisions` audit trail) when CRITICAL/HIGH findings require plan changes.

## Skills System

Two sources of skills end up in `.claude/skills/` of the target project. Rules (`rules/`) are separate — they are always loaded by agents and are not installed as skills.

| Source | Location | Role | Examples |
|---|---|---|---|
| **caw-owned** | `templates/skills/<name>/SKILL.md` (flat layout) | Workflow / archetype / convention skills caw can't delegate | api-contract, error-handling-patterns, nextjs-feature, better-context, react-component-testing |
| **hub** | `.agents/skills/<name>/SKILL.md` (vendor-curated) | Framework / library expertise pulled from external hubs via `skills.sh` | Vercel (Next.js, React), Prisma, Expo, Cloudflare, Auth0, Supabase, shadcn, Turborepo, Software Mansion (RN), Callstack |

**Each skill is a folder** containing `SKILL.md` with YAML frontmatter (`name`, `description`) + skill body. The `name` field MUST match the folder name.

**Source of truth split:**

- `templates/skills/` — caw-owned: workflow handoff (`api-contract`, `error-handling-patterns`), project archetype (`nextjs-feature`), tooling integration (`better-context`). Modify freely.
- `.agents/skills/` — hub-curated by vendors. Treat as immutable. Update via `npx skills update`.
- **Priority rule:** if a topic is covered by a hub skill, prefer hub. Caw-owned skill exists only when no authoritative external source covers it.

**Init logic:** `init.sh` does NOT copy skills — it only ships agents/commands/rules/hooks. `/caw-setup` (run after `/init`) reads `<CAW_HOME>/SKILLS-CATALOG.md`, detects stack, copies caw-curated skills (priority 1), and asks user before pulling hub skills (priority 2).

**`/caw-setup` install pattern:** two paths by skill source.
- **caw-curated skills** (already vendored in this repo) — `cp -R` the folder from `<CAW_HOME>/.agents/skills/` or `<CAW_HOME>/templates/skills/` into the project, then `ln -sfn` a symlink. Offline, deterministic, idempotent.
- **hub skills** (not in caw repo, user-approved) — `npx skills add <repo> -s <skill-name> -y`, which needs network.

Either way skills end up as a real folder at `.agents/skills/<name>/` plus a symlink at `.claude/skills/<name>/` (verify with `ls -la` — the `.claude/skills/` entries must show `lrwxr-xr-x`).

**Skills catalog:** `SKILLS-CATALOG.md` (caw repo root) is the LLM-readable index of available skills with `triggers` field for stack matching. Auto-generated via `scripts/generate-catalog.sh`. Maintainer regenerates after `npx skills add` or `npx skills update`.

## Hook Profile System

Hooks live in `scripts/hooks/`. Execution is gated by `CAW_HOOK_PROFILE` env var:

- `minimal` — no hooks run
- `standard` — all hooks except dangerous-actions-blocker
- `strict` — all hooks including dangerous-actions-blocker

The dispatcher `scripts/hooks/run-with-flags.js` reads the profile and `CAW_DISABLED_HOOKS` (comma-separated list) before invoking any hook.

**Hook inventory:** dangerous-actions-blocker, pre-commit-secrets, prompt-injection-detector, suggest-compact, warn-debug-leftovers, post-edit-accumulator, session-summary, stop-format-typecheck. Dispatch/helper scripts: run-with-flags.js, hook-flags.js, resolve-formatter.js.

## Adding a New Agent

The architecture has 5 fixed agents (`setup`, `planner`, `coder`, `tester`, `reviewer`) — domain knowledge moves to skills, not new agents. Avoid creating new agents unless absolutely necessary.

If you must add one:
1. Create `agents/<name>.md` with YAML frontmatter + role prompt
2. Create a matching `commands/caw-<name>.md` slash command
3. Add the agent to the `AGENTS=` list in `scripts/init.sh` **and** the `AGENTS=` + `COMMANDS=` lists in `scripts/upgrade.sh`. (`init.sh` copies commands with a `commands/*.md` glob, so it needs no `COMMANDS=` list.)
4. Update README.md agent table

## Adding a New Skill

### Caw-owned (workflow / archetype / integration)
1. Create `templates/skills/<skill-name>/SKILL.md` with YAML frontmatter (flat layout — no layer subfolder)
2. The skill is automatically picked up by `/caw-setup` and copied to projects
3. Only add a caw skill if it's workflow/archetype/convention. For framework expertise, prefer pulling from a hub.

### Hub-curated (framework / library expertise)
1. Pull skill: `npx skills add <repo>:<skill-name>`
2. Add metadata to `scripts/generate-catalog.py` META dict (triggers + domain)
3. Regenerate catalog: `./scripts/generate-catalog.sh`
4. Update the source-breakdown table + counts in `SKILLS-CHECKLIST.md`
5. Commit `.agents/skills/<skill-name>/`, `skills-lock.json`, `SKILLS-CATALOG.md`, `SKILLS-CHECKLIST.md`

## Key Conventions in This Repo

- **No build step** — all files are interpreted directly; do not add a build pipeline
- **Markdown-first** — agent prompts, skills, and commands are all `.md` files
- **Shell scripts use bash ≥ 4** — arrays, associative arrays, `[[ ]]` tests are all fine
- **`conventions.md`** (in scaffolded projects, not this repo) is the source of truth for project-specific archetype + patterns; every code-writing agent reads it before proposing architecture
- Skills use folder format (`templates/skills/<name>/SKILL.md`) in a flat layout. The folder name (not `skills/`) avoids name collision with the `skills.sh` CLI, which auto-detects a top-level `skills/` folder.
