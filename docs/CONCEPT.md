# Caw — Architecture

Caw is a **template hub** that scaffolds a skill-first agent pipeline into any project. Domain knowledge lives in skills (auto-discovered, vendor-curated); agents are workflow primitives — no per-framework specialists.

---

## Pipeline

```
       Bootstrap                       Per-task
       ─────────                       ────────
        setup    →    planner   →   coder   →   tester   →   reviewer
       /caw-setup    /caw-plan    /caw-code    /caw-test    /caw-review
                                  (--all)                   /caw-verify
```

Each feature/bug/chore/refactor becomes a **task** at `.claude/conductor/tasks/<task-id>/`. Stages hand off via structured markdown files.

---

## Agents (5)

Each agent is a markdown file with YAML frontmatter (model, tools, maxTurns, permissionMode). All 5 agents have `Skill` in their `tools:` list and MUST invoke `Skill({skill: "<name>"})` before acting on project files.

| Agent      | Stage            | Purpose                                                                                                          |
| ---------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `setup`    | Bootstrap        | Detect stack, install skills, generate `conventions.md` + `skill-map.yaml`                                       |
| `planner`  | Plan             | Spec, API contract, phases (with `test_scenarios` + `skills_hint`), self-challenge, lane                         |
| `coder`    | Code (per phase) | Implement one phase. Loads skills from `skills_hint`. Generic across stack.                                      |
| `tester`   | Test             | Test mode derived from Plan's `lane` (tiny=skip / standard=backend-only / risky=all). Mobile = unit tests only.  |
| `reviewer` | Review           | Multi-dim review (security, performance, a11y, refactor, architecture). Severity-based findings. May amend Plan. |

---

## Commands (7)

| Command                            | Action                                          |
| ---------------------------------- | ----------------------------------------------- |
| `/caw-setup`                       | Detect stack, install skills, write conventions |
| `/caw-plan "<desc>"`               | Generate Plan from description                  |
| `/caw-code <id> [<phase>] [--all]` | Implement one phase, or all phases with `--all` |
| `/caw-test <id>`                   | Tests (mode derived from Plan's lane)           |
| `/caw-review <id>`                 | Multi-dim review                                |
| `/caw-verify <id>`                 | Test + review in parallel                       |
| `/caw-status [<id>]`               | Show task state                                 |

The `caw-` prefix avoids namespace collisions with other Claude Code skills/commands.

---

## Task File Format

Tasks live at `.claude/conductor/tasks/<task-id>/`:

| File             | Owner    | Purpose                                              |
| ---------------- | -------- | ---------------------------------------------------- |
| `overview.yaml`  | all      | Status, lane, phases table, files generated          |
| `plan.md`        | planner  | Spec + API contract + phases + challenge + revisions |
| `code.md`        | coder    | Files changed per phase + skills loaded              |
| `tests.md`       | tester   | Tests written, coverage, skills loaded               |
| `review.md`      | reviewer | Findings by severity, skills loaded                  |
| `test-matrix.md` | tester   | This task's behavior-level coverage rows             |

The Plan is a **living document** — reviewer may amend it (with `## Revisions` audit trail) when CRITICAL/HIGH findings require plan changes.

---

## Lane-driven TDD

`lane` is the single task-sizing field — `planner` sets it from risk flags +
heuristics, and every downstream behavior (test mode, pull depth, ADR
requirement) is derived from it. There is no separate `tdd_mode` field.

| Lane       | Triggers                                | Test behavior (tester derives)                       |
| ---------- | --------------------------------------- | ---------------------------------------------------- |
| `tiny`     | chore, simple refactor, low-risk bug    | No tests. Manual verify.                             |
| `standard` | normal feature, medium-risk bug         | Tests for backend phases post-impl. Frontend visual. |
| `risky`    | security, payment, auth, data migration | All phases test-first (red → green).                 |

Risky lane requires user confirmation before proceeding — never auto-downgrade.

---

## Severity-based Review

| Severity     | Action                                                     |
| ------------ | ---------------------------------------------------------- |
| **CRITICAL** | Block commit. Loop back to coder. Reviewer may amend Plan. |
| **HIGH**     | Block commit. Loop back to coder. Reviewer may amend Plan. |
| **MEDIUM**   | Fix if scope allows. Else create follow-up task.           |
| **LOW**      | Auto-create follow-up task. Don't block.                   |

---

## Harness Contract

Beyond per-task files, caw keeps three project-level living docs. Agents follow a
**pull-then-push** contract (`rules/common/harness-contract.md`) — read them before
working, update them after.

| Doc | Lives at | Maintained by |
| --- | --- | --- |
| ADRs | `.claude/conductor/decisions/NNNN-*.md` | planner + coder create on trigger; reviewer enforces |
| Test matrix (index) | `.claude/conductor/test-matrix.md` | one row per task; tester maintains |
| Test matrix (detail) | `.claude/conductor/tasks/<id>/test-matrix.md` | behavior rows for that task; tester writes, reviewer advances status |
| Harness backlog | `.claude/conductor/harness-backlog.md` | any agent appends on friction; resolved items pruned to `## Resolved` |

The harness grows from friction: when an agent hits a missing rule, an ambiguous
template, or a recurring failure, it logs a backlog item the maintainer ports back
into caw. Missing artifacts surface as review findings (missing ADR for an auth
change = `CRITICAL`; missing matrix row = `MEDIUM`).

---

## Skills System

Two sources of skills, both end up in `.claude/skills/` of the target project:

| Source        | Location                           | Role                                          |
| ------------- | ---------------------------------- | --------------------------------------------- |
| **caw-owned** | `templates/skills/<name>/SKILL.md` | Workflow / archetype / convention skills      |
| **hub**       | `.agents/skills/<name>/SKILL.md`   | Framework / library expertise pulled from hub |

**Each skill is a folder** containing `SKILL.md` with YAML frontmatter (`name`, `description`) + skill body. The `name` field MUST match the folder name.

**Source of truth split:**

- `templates/skills/` — caw-owned: workflow handoff (`api-contract`, `error-handling-patterns`), project archetype (`nextjs-feature`), tooling integration (`better-context`). Modify freely.
- `.agents/skills/` — hub-curated by vendors. Treat as immutable. Update via `npx skills update`.

**Priority rule:** if a topic is covered by a hub skill, prefer hub. Caw-owned skill exists only when no authoritative external source covers it.

### Mandatory defaults (always installed)

`setup` agent installs these regardless of detected stack — downstream agents depend on them:

**Workflow defaults (11):**
`to-prd`, `webapp-testing`, `javascript-testing-patterns`, `react-component-testing`, `code-review-excellence`, `performance`, `accessibility`, `refactor`, `systematic-debugging`, `find-skills`, `validate-skills`

**Product/PM defaults (7):**
`prd-development`, `user-story`, `user-story-splitting`, `prioritization-advisor`, `business-analyst`, `create-specification`, `roadmap-planning`

Stack-mapped skills are added on top. Minimum install count is 18.

### Skill catalog

`SKILLS-CATALOG.md` (caw repo root) is the LLM-readable index of available skills with `triggers` field for stack matching. Auto-generated via `scripts/generate-catalog.sh`. Maintainer regenerates after `npx skills add` or `npx skills update`.

---

## Project Lifecycle

```
caw init <project>     # Maintainer scaffold (core only — agents, commands, rules, hooks)
                       # Appends .agents/, .claude/, CLAUDE.md to target's .gitignore (machine-local)
                       # Writes CAW_HOME to user's shell rc (for /caw-setup to find caw repo)
/init                  # Claude Code built-in — generates CLAUDE.md
/caw-setup             # Reads CLAUDE.md + <CAW_HOME>/SKILLS-CATALOG.md → installs skills + conventions
/caw-plan "<desc>"     # Per-task planning
/caw-code <id> --all   # Implementation (all phases)
/caw-verify <id>       # Test + review parallel
```

### Caw repo discovery

`caw init` writes the repo path into 2 locations so `/caw-setup` can find it:

1. **`<project>/.claude/caw.config.json`** (primary) — project-local JSON with `caw_home` field. Survives shell switches, works in CI, no env var needed.
2. **`$CAW_HOME` in `~/.zshrc` or `~/.bashrc`** (fallback) — for CLI use outside Claude Code.

The `setup` agent reads the project-local config first, then falls back through env var → shell rc → caw alias → canonical default. No user prompts during discovery.

---

## Hooks

Pre-commit secret scanning (gitleaks) is **mandatory** — installed automatically.

Optional hooks live in `scripts/hooks/`. Execution gated by `CAW_HOOK_PROFILE`:

| Profile    | Behavior                                      |
| ---------- | --------------------------------------------- |
| `minimal`  | No hooks                                      |
| `standard` | All hooks except dangerous-actions-blocker    |
| `strict`   | All hooks including dangerous-actions-blocker |

Dispatcher `scripts/hooks/run-with-flags.js` reads `CAW_HOOK_PROFILE` + `CAW_DISABLED_HOOKS` (comma-separated) before invoking any hook.

**Inventory:** dangerous-actions-blocker, pre-commit-secrets, prompt-injection-detector, check-dev-server, suggest-compact, warn-console-log, post-edit-accumulator, session-summary, stop-format-typecheck, pre-compact.

---

## Design Principles

1. **Markdown-first.** Agent prompts, skills, commands are all `.md` files. No build pipeline.
2. **Skills, not specialists.** New framework support = add a skill, not an agent.
3. **Plan as living document.** Edits flow planner → reviewer → planner via `## Revisions`, not separate Plan files.
4. **Skills are authoritative.** When a skill says "use X pattern", agents defer to it over their own assumptions.
5. **MANDATORY skill load.** Every agent must invoke `Skill({skill: "..."})` for every required name before touching project files. Listing skills in output without invoking is a reporting failure.
6. **Severity decides action.** CRITICAL/HIGH always block; MEDIUM/LOW always create follow-ups. No ad-hoc judgment calls.
7. **Idempotent operations.** `caw sync`, `cp -R -f`, `ln -sfn` all safe to re-run.
