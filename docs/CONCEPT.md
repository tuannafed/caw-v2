# Caw — Architecture

Caw is a **Claude Code plugin** (`caw`) that adds a generic agent pipeline to any project. Agents are workflow primitives — no per-framework specialists. Domain knowledge is **externalized**: a thin set of authored skills ship in the plugin; framework/library knowledge comes live from Context7; workflow skills come from Superpowers. Caw vendors and symlinks nothing.

---

## Packaging

Caw ships as a marketplace plugin, not a template hub:

- The repo root holds `.claude-plugin/marketplace.json` (marketplace name `caw`).
- The plugin itself lives at `plugins/caw/` with its own `.claude-plugin/plugin.json`.
- Users install it with `/plugin install caw@caw`. There is no `caw init`, no `caw upgrade`, no shell alias, no scaffolding step.

Everything the pipeline needs — agents, commands, rules, hooks, authored skills, and the durable harness binary — is bundled in `plugins/caw/` and resolved at runtime via `${CLAUDE_PLUGIN_ROOT}`.

---

## Pipeline

```
       Bootstrap                       Per-task
       ─────────                       ────────
        setup    →    planner   →   coder   →   tester   →   reviewer
       /caw:setup    /caw:plan    /caw:code    /caw:test    /caw:review
                                  (--all)                   /caw:verify
```

Each feature/bug/chore/refactor becomes a **task** at `docs/caw/tasks/<task-id>/`. Stages hand off via durable state (`harness.db`) plus structured markdown prose.

---

## Agents (5)

Each agent is a markdown file at `plugins/caw/agents/<name>.md` with YAML frontmatter (model, tools, maxTurns, permissionMode). All 5 have `Skill` in their `tools:` list and MUST invoke `Skill({skill: "<name>"})` before acting on project files.

| Agent      | Stage            | Purpose                                                                                                          |
| ---------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `setup`    | Bootstrap        | Detect stack, scaffold `docs/caw/` seeds from the plugin, verify the durable harness, write `conventions.md` + `project.yaml` |
| `planner`  | Plan             | Spec, API contract, phases (with `test_scenarios` + `skills_hint`), self-challenge, lane                         |
| `coder`    | Code (per phase) | Implement one phase. Loads skills from `skills_hint`. Generic across stack.                                      |
| `tester`   | Test             | Test mode derived from Plan's `lane` (tiny=skip / standard=backend-only / risky=all). Mobile = unit tests only.  |
| `reviewer` | Review           | Multi-dim review (security, performance, a11y, refactor, architecture). Severity-based findings. May amend Plan. |

**Setup is simplified in the plugin era.** It no longer matches or symlinks skills — there is no skill matcher, no install list, no `skill-map.yaml`. It detects the stack, copies the bundled `docs/caw/` seeds into the project, verifies the durable harness, and writes `conventions.md` + `.claude/project.yaml` (+ project rules).

---

## Commands (6)

| Command                            | Action                                              |
| ---------------------------------- | --------------------------------------------------- |
| `/caw:setup`                       | Detect stack, scaffold seeds, verify harness, write conventions |
| `/caw:plan "<desc>"`               | Generate Plan from description                      |
| `/caw:code <id> [<phase>] [--all]` | Implement one phase, or all phases with `--all`     |
| `/caw:test <id>`                   | Tests (mode derived from Plan's lane)               |
| `/caw:review <id>`                 | Multi-dim review                                    |
| `/caw:verify <id>`                 | Test + review in parallel                           |

The `caw-` prefix avoids namespace collisions with other Claude Code skills/commands.

---

## Task File Format

Tasks live at `docs/caw/tasks/<task-id>/`:

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
heuristics, and every downstream behavior (test mode, doc depth, ADR
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

## Durable Layer

State and prose are kept separate. **State** lives in a SQLite database; **prose** lives in markdown. This split keeps task status machine-queryable while letting agents write rich, human-readable handoffs.

- **State → `harness.db`.** The harness CLI binary ships in the plugin at `${CLAUDE_PLUGIN_ROOT}/harness/bin/harness-cli`, but writes its DB to the **project root** (`./harness.db`, resolved from CWD — never the plugin cache). Every agent reads/writes task status, lane, and phase progress through it.
- **Stable wrapper.** `/caw:setup` writes a thin wrapper at the project's `scripts/caw/bin/harness-cli` that `exec`s the plugin binary. It resolves the binary via `$CLAUDE_PLUGIN_ROOT` in-session, and outside a session discovers it by pattern under `~/.claude/plugins` — no hardcoded cache layout. If neither resolves, it exits non-zero with guidance rather than exec'ing a guessed path. This keeps one documented path stable for all tools regardless of where the plugin cache lives.
- **Prose → markdown.** Per-task handoffs (`plan.md`, `code.md`, `tests.md`, `review.md`) and the project-level living docs below.

Beyond per-task files, caw keeps project-level living docs under `docs/caw/`. Agents follow a **pull-then-push** contract (`rules/common/harness-contract.md`) — read them before working, update them after.

| Doc | Lives at | Maintained by |
| --- | --- | --- |
| ADRs | `docs/caw/decisions/NNNN-*.md` | planner + coder create on trigger; reviewer enforces |
| Test matrix (index) | `docs/caw/test-matrix.md` | one row per task; tester maintains |
| Test matrix (detail) | `docs/caw/tasks/<id>/test-matrix.md` | behavior rows for that task; tester writes, reviewer advances status |
| Harness backlog | `docs/caw/harness-backlog.md` | any agent appends on friction; resolved items pruned to `## Resolved` |

The harness grows from friction: when an agent hits a missing rule, an ambiguous
template, or a recurring failure, it logs a backlog item the maintainer ports back
into caw. Missing artifacts surface as review findings (missing ADR for an auth
change = `CRITICAL`; missing matrix row = `MEDIUM`).

---

## Skills System — Thin Authored Core + Externalized Knowledge

The defining shift in caw v2: there is **no install step, no static catalog, no symlinked skill set, and no `skill-map.yaml`**. Domain knowledge comes from three sources, all available the moment the relevant plugins are enabled:

| Source | What it covers | How it loads |
| --- | --- | --- |
| **Authored (caw)** | The 4 skills caw owns — workflow/archetype/convention knowledge with no authoritative external source | Bundled in the plugin at `plugins/caw/skills/<name>/SKILL.md`. Namespaced, always present once the plugin is enabled. |
| **Workflow (Superpowers)** | TDD, systematic debugging, verification, code review | Loaded via the Superpowers plugin's namespace. |
| **Framework docs (Context7)** | Live library docs (Next.js, Prisma, Stripe, TanStack, Supabase, …) | Queried on demand. No static catalog to match against; always current. |
| **Frontend (Frontend Design)** | UI/UX quality for frontend work | Loaded via the Frontend Design plugin. |

The 4 authored skills are namespaced `caw:*`:

- `caw:api-contract`
- `caw:error-handling-patterns`
- `caw:nextjs-feature`
- `caw:react-component-testing`

**`skills_hint` is a hint, not a gate.** A Plan task's `skills_hint` names which skills/topics to load (`caw:*`, a Superpowers skill, or a Context7 framework). Agents do **not** verify it against any installed-skill manifest — none exists. They load the named skill via the `Skill` tool, or query Context7 for the named framework, directly.

**On a failed load**, agents do not silently fall back to generic knowledge: a missing `caw:*` skill means the plugin isn't enabled (`/plugin install caw@caw`); a missing workflow skill means Superpowers isn't enabled; a missing framework topic routes to Context7 (no install needed).

This is "thin authored core + delegate framework knowledge to Context7 + workflow skills to Superpowers" — the inverse of the old "vendor and symlink a curated skill set" model, which carried 65 skills, a generated catalog, a matcher, and per-project symlink maintenance.

---

## Lifecycle

```
/plugin install caw@caw   # Install from the caw marketplace
/init                          # Claude Code built-in — generates CLAUDE.md
/caw:setup                     # Detect stack, scaffold docs/caw seeds, verify harness, write conventions
/caw:plan "<desc>"             # Per-task planning
/caw:code <id> --all           # Implementation (all phases)
/caw:verify <id>               # Test + review parallel
```

`/caw:setup` is the only bootstrap step, and it is purely local: it scaffolds the
`docs/caw/` seeds the plugin ships, writes the stable `scripts/caw/bin/harness-cli`
wrapper, verifies `harness.db` initializes at the project root, and generates
`conventions.md` + `.claude/project.yaml`. No network, no catalog, no symlinks.

---

## Hooks

Pre-commit secret scanning (gitleaks) is **mandatory**. Optional hooks ship in
the plugin's `hooks/` directory. Execution is gated by `CAW_HOOK_PROFILE`:

| Profile    | Behavior                                      |
| ---------- | --------------------------------------------- |
| `minimal`  | No hooks                                      |
| `standard` | All hooks except dangerous-actions-blocker    |
| `strict`   | All hooks including dangerous-actions-blocker |

The dispatcher reads `CAW_HOOK_PROFILE` + `CAW_DISABLED_HOOKS` (comma-separated)
before invoking any hook.

---

## Design Principles

1. **Generic agents, externalized knowledge.** The 5 agents are workflow primitives. Framework support is never a new agent — it's a Context7 query, a Superpowers skill, or (rarely) a new authored `caw:*` skill.
2. **Thin authored core.** Caw ships only what no external source covers (4 skills). Everything else is delegated, so there is nothing to vendor, catalog, or keep in sync.
3. **State vs. prose.** Machine-queryable status lives in `harness.db`; rich handoffs live in markdown. Neither leaks into the other.
4. **Plan as living document.** Edits flow planner → reviewer → planner via `## Revisions`, not separate Plan files.
5. **Skills are authoritative.** When a loaded skill says "use X pattern", agents defer to it over their own assumptions.
6. **MANDATORY skill load.** Every agent must invoke `Skill({skill: "..."})` for every required name before touching project files. Listing skills in output without invoking is a reporting failure.
7. **Severity decides action.** CRITICAL/HIGH always block; MEDIUM/LOW always create follow-ups. No ad-hoc judgment calls.
8. **Idempotent bootstrap.** `/caw:setup` is safe to re-run — seed scaffolding, the wrapper write, and `harness init` are all idempotent.
