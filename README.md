# Claude Agent Workflow (caw)

> A Claude Code plugin marketplace. It ships **one** plugin, `caw`: a 5-agent software-delivery pipeline (plan → code → test → review) with a durable SQLite harness, safety hooks, non-overridable coding rules, and 10 authored skills.

---

## What is this?

`caw-v2` is a **Claude Code plugin marketplace**. Instead of scaffolding files into your repo with a CLI, you install a plugin — and your whole team gets the same pipeline from one command.

The single plugin, **`caw`**, turns each feature, bug, chore, or refactor into a **story** (broken into **tasks**) that flows through a structured pipeline with handoff between stages:

**Pipeline:** `Plan → Code → Test → Review`

Domain knowledge that caw used to vendor (framework docs, workflow skills, UI quality, TDD/review/refactor discipline) now comes from a small set of companion plugins, so `caw` stays focused on the pipeline itself.

---

## Install — the team installs in one command

```
/plugin marketplace add tuannafed/caw-v2
/plugin install caw@caw
```

That installs the `caw` plugin (pipeline, harness, hooks, rules, skills). **caw on
its own is not the full stack** — the agents depend on 4 companion plugins for
workflow skills, framework docs, UI quality, and pipeline skills (TDD, debugging,
code review, refactor, spec/task-breakdown, frontend engineering). Install those too:

```
/plugin install superpowers@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install context7@claude-plugins-official
/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills
```

`superpowers`/`frontend-design`/`context7` use `claude-plugins-official`, which is
built into Claude Code — you do **not** need to `marketplace add` it. `agent-skills`
is not built in and needs its own marketplace add, as shown above. If you skip any of
these four, agents that try to load a workflow skill (Superpowers), a pipeline skill
(agent-skills), or query framework docs (Context7) will fail mid-task with a "plugin
not enabled" error. `/caw:setup` preflights for them and warns if missing.

> **`agent-skills` ships its own competing pipeline** (`/spec`, `/plan`, `/build`,
> `/test`, `/review`, `/webperf`, `/code-simplify`, `/ship`, plus 4 auto-activating
> agent personas). Inside a caw project, `/caw:*` is the pipeline of record — the
> scaffolded project `CLAUDE.md` tells the agent to prefer `/caw:plan`/`/caw:code`/
> `/caw:verify` over agent-skills' equivalents.

### Share the whole stack with a committed settings file

Commit a `.claude/settings.json` into your project so members are **prompted to install on trust** when they open it. A ready sample lives at
[`plugins/caw/templates/project/settings.json`](plugins/caw/templates/project/settings.json). Its `enabledPlugins` block lists `caw` **and** all 4 companions — so a member who trusts the committed file gets the whole stack at once, **without running the 5 commands above**. The manual commands are only for the from-scratch path where no committed `settings.json` exists.

> **Honest note:** the companion plugins reach a member in exactly two ways:
> (1) they trust a committed `.claude/settings.json` whose `enabledPlugins` lists them
> (Claude Code then prompts to install — **clone → trust → approve**, not yet fully
> silent), **or** (2) they run the `/plugin install` commands above by hand.
> Installing `caw` alone does **not** pull the companions — don't assume the stack is
> complete just because `caw` is installed.

### Companion plugins

| Plugin | Slug | Provides |
| --- | --- | --- |
| **superpowers** | `superpowers@claude-plugins-official` | Remaining workflow skills — planning (`brainstorming`, `writing-plans`), verification |
| **context7** | `context7@claude-plugins-official` | Live framework / library docs (Next.js, Prisma, Stripe, TanStack, Supabase, …) |
| **frontend-design** | `frontend-design@claude-plugins-official` | Frontend / UI aesthetic quality |
| **agent-skills** | `agent-skills@addy-agent-skills` | Pipeline skills called directly by caw's agents — `spec-driven-development` / `planning-and-task-breakdown` (planner), `test-driven-development` (tester), `debugging-and-error-recovery` (coder, reviewer), `code-review-and-quality` / `code-simplification` (reviewer), `frontend-ui-engineering` (coder, frontend tasks) — plus non-pipeline skills (`interview-me`, `idea-refine`, `shipping-and-launch`, …) |

> **Context7 rate limits (teams / large projects).** Context7 runs as an MCP server.
> Without a key it uses a shared anonymous tier with a low rate limit — a whole team
> hammering it can get throttled. Set `CONTEXT7_API_KEY` (free key at
> [context7.com/dashboard](https://context7.com/dashboard)) to get your own quota.
> The settings template has an empty `CONTEXT7_API_KEY` slot in its `env` block —
> fill it in locally; never commit a real key.

---

## Usage

```
/caw:setup                     # detect stack, scaffold docs/caw seeds, verify harness, write the project rule file(s)
/caw:plan "<description>"      # generate a Plan (spec + API contract + tasks + self-challenge + lane)
/caw:code <story-id> --all     # implement all tasks (parallel where the plan allows, each in its own git worktree)
/caw:verify <story-id>         # test + review in parallel
```

Or step-by-step:

```
/caw:plan "<description>"
/caw:code <story-id>            # one task at a time
/caw:test <story-id>            # write tests (mode driven by the Plan's lane)
/caw:review <story-id>          # multi-dim review with severity findings
/caw:verify <story-id>          # test + review in parallel
```

Also: `/caw:maintain` (harness self-maintenance — audit + maturity + propose),
`/caw:spec` (fold implemented stories into a canonical capability spec), `/caw:backlog`
(scaffold the optional Kanban viewer).

---

## What's in `caw`

| Component | What |
| --- | --- |
| **5 agents** | `setup`, `planner`, `coder`, `tester`, `reviewer` |
| **9 commands** | `/caw:setup`, `/caw:plan`, `/caw:code`, `/caw:test`, `/caw:review`, `/caw:verify`, `/caw:maintain`, `/caw:spec`, `/caw:backlog` |
| **10 authored skills** | `api-contract`, `error-handling-patterns`, `nextjs-feature`, `react-component-testing`, `doubt-check`, `adversarial-test-design`, `security-hardening`, `performance-optimization`, `observability`, `context-engineering` (namespaced `caw:<name>`) |
| **Durable harness** | `harness-cli` (Python stdlib) + SQLite; state lives in `harness.db` at the **project root** (never in the plugin cache) |
| **Hooks** | Safety + workflow hooks, profile-gated by `CAW_HOOK_PROFILE` (`minimal` / `standard` / `strict`) |
| **Rules** | Non-overridable coding rules — some auto-inject via `paths:` frontmatter once scaffolded into a project's `.claude/rules/`, others agents `Read` explicitly per lane |

---

## What moved out (coming from old caw?)

caw no longer vendors framework/library skills or scaffolds files via a shell CLI. The pieces you remember now live elsewhere:

| Old caw piece | Now |
| --- | --- |
| Remaining workflow skills (planning, verification) | **Superpowers** (official plugin) |
| Framework / library docs (Next.js, Prisma, Stripe, TanStack, Supabase, …) | **Context7** (live docs) |
| Frontend UI aesthetic quality | **Frontend Design** (official plugin) |
| Pipeline skills (TDD, debugging, code review, refactor, spec/task-breakdown, frontend engineering) | **agent-skills** (addyosmani/agent-skills) — called directly, not vendored |
| 65 vendored skills, `skills-lock.json`, catalog, symlink machinery | removed — the plugin handles distribution |

There is no more `caw init` / `caw upgrade` / `caw remove` / `caw sync`, no `setup.sh`, and no skills catalog or symlink machinery. Install the plugin instead.

---

## Architecture

### The 5-stage pipeline

| Stage | Purpose | Agent |
| --- | --- | --- |
| **Setup** | One-time: detect stack, scaffold `docs/caw` seeds, verify harness, write the project rule file(s) | setup |
| **Plan** | Spec, API contract, tasks, self-challenge, lane | planner |
| **Code** | Implement one task at a time, loading skills as needed | coder |
| **Test** | Lane-driven tests (red + green where required) | tester |
| **Review** | Multi-dim review (security / perf / a11y / architecture / constitution / refactor / harness-compliance) with severity findings | reviewer |

### The "lane" concept

`risk_lane` is the single story-sizing field. `planner` sets it from risk flags + heuristics (hard gates like auth, payments, or data migration always force `high_risk`), and it **gates which stages run and how deep** — so trivial work skips the ceremony and risky work gets full TDD:

| `risk_lane` | Triggers | Behavior |
| --- | --- | --- |
| `tiny` | chore, rename, narrow bug fix, < 50 LOC and no hard gate | Code only — skip test + review. Manual verify. |
| `normal` | normal feature, medium-risk bug, bounded blast radius | Code → backend tests after impl → scoped review. |
| `high_risk` | any hard gate (auth, payments, data migration, public API change, …) | Full TDD: failing tests first (red) → code (green) → full review. ADR mandatory. |

### Severity-based review findings

| Severity | Action |
| --- | --- |
| **CRITICAL / HIGH** | Block commit. Loop back to coder. Reviewer may amend the Plan. |
| **MEDIUM** | Fix if scope allows. Else create a follow-up task. |
| **LOW** | Create follow-up task. Don't block. |

### Story file format

Each story lives at `docs/caw/stories/<story-id>/` (or grouped under
`docs/caw/stories/epics/<epic>/<story-id>/` when it belongs to a larger theme):

| File | Owner | Purpose |
| --- | --- | --- |
| `plan.md` | planner | Spec + API contract + tasks + challenge + revisions |
| `code.md` | coder | Files changed per task |
| `tests.md` | tester | Tests written, coverage |
| `review.md` | reviewer | Findings by severity |
| `test-matrix.md` | tester | Behavior-level coverage rows |

Story/task **state** (status, lane, proof) lives in `harness.db`, read/written via
`harness-cli` — there is no `overview.yaml` or hand-edited status file; state and
prose are never restated in each other (ADR-0001). `plan.md` is a **living document**
— the reviewer may amend it (with a `## Revisions` audit trail) when CRITICAL/HIGH
findings require plan changes.

---

## Hook profiles

Hooks are gated by `CAW_HOOK_PROFILE`. Disable individual hooks with `CAW_DISABLED_HOOKS` (comma-separated).

| Profile | Behavior |
| --- | --- |
| `minimal` | No hooks run |
| `standard` | The standard set (record-trace, session-summary, stop-format-typecheck, post-edit-accumulator) |
| `strict` | The standard set plus strict-only hooks (task-read-gate, prompt-injection-detector) |

(Destructive-command blocking is a native `permissions.deny` rule in the settings
template, not a `CAW_HOOK_PROFILE` hook; secret scanning is a gitleaks `pre-commit`
hook `/caw:setup` installs.)

---

## Repository layout

```
caw-v2/
├── .claude-plugin/
│   └── marketplace.json        Marketplace manifest (ships the caw plugin)
├── plugins/
│   └── caw/                    The plugin
│       ├── .claude-plugin/     plugin.json manifest
│       ├── agents/             5 agents (setup, planner, coder, tester, reviewer)
│       ├── commands/           9 commands (setup, plan, code, test, review, verify, maintain, spec, backlog)
│       ├── skills/             10 authored skills
│       ├── hooks/               Safety + workflow hooks (hooks.json) + dispatcher
│       ├── rules/               Non-overridable coding rules (common/ + typescript/ + react/)
│       ├── harness/             Durable layer — harness-cli (Python stdlib) + SQLite schema + tests/
│       ├── statusline/          Status bar script (active story · lane · progress)
│       └── templates/           Project + docs/caw seeds (incl. sample settings.json)
├── docs/
│   └── CONCEPT.md               Architecture design doc
└── tools/
    └── backlog/                 Optional companion Kanban UI (Astro + React + shadcn)
```

### Backlog viewer (optional companion UI)

`tools/backlog/` is an Astro + React + shadcn Kanban that renders `docs/caw/stories/` + `harness.db`:

```bash
cd tools/backlog
pnpm install
CAW_PROJECT_ROOT="<your-project>" pnpm dev
# open http://localhost:4321
```

---

## Security & production notes

- **Plugin hooks run shell with the member's user permissions.** `caw` is first-party; `superpowers`/`context7`/`frontend-design` are official; `agent-skills` is a well-known third-party community plugin (MIT). **Vet any other plugin before enabling it** — enabling a plugin grants it the ability to run hooks as you.
- **The marketplace ref tracks `main` by default.** The scaffolded settings set `extraKnownMarketplaces.caw.source.ref` to `"main"`, so members get the latest by running `/plugin marketplace update caw` — no settings edit. For a frozen install (locked to a known-good build), pin `ref` to a tag or commit SHA instead.
- **`harness.db` is per-project.** The CLI runs from `${CLAUDE_PLUGIN_ROOT}/harness/bin/harness-cli` but resolves its DB to the project (git root). It never writes into the plugin cache.

---

## Releasing & updating

The marketplace ref tracks `main`, so **pushing to `main` ships the release** — there
is no separate tag/bump step beyond keeping `VERSION` / `plugin.json` /
`marketplace.json` in sync (see [CHANGELOG.md](CHANGELOG.md)).

```bash
# Maintainer — cut a release:
git push origin main

# Member — pull the latest (no settings edit):
/plugin marketplace update caw
/plugin update caw@caw
```

Because every push to `main` reaches members on their next update, treat `main` as the
release branch: land changes through a PR / branch and keep it green. If you need a
build that can't drift, pin a member's `ref` to a tag or commit SHA instead of `"main"`.

---

## Documentation

- [docs/CONCEPT.md](docs/CONCEPT.md) — architecture design doc
- [plugins/caw/README.md](plugins/caw/README.md) — plugin-level reference
- [CLAUDE.md](CLAUDE.md) — caw repo's own Claude Code context
- [CHANGELOG.md](CHANGELOG.md) — release history

---

## License

MIT
