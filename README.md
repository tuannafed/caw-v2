# Claude Agent Workflow (caw)

> A Claude Code plugin marketplace. It ships **one** plugin, `caw`: a 5-agent software-delivery pipeline (plan → code → test → review) with a durable SQLite harness, safety hooks, non-overridable coding rules, and 4 authored skills.

---

## What is this?

`caw-v2` is a **Claude Code plugin marketplace**. Instead of scaffolding files into your repo with a CLI, you install a plugin — and your whole team gets the same pipeline from one command.

The single plugin, **`caw`**, turns each feature, bug, chore, or refactor into a **task** that flows through a structured pipeline with handoff between stages:

**Pipeline:** `Plan → Code → Test → Review`

Domain knowledge that caw used to vendor (framework docs, workflow skills, UI quality) now comes from a small set of official companion plugins, so `caw` stays focused on the pipeline itself.

---

## Install — the team installs in one command

```
/plugin marketplace add tuannafed/caw-v2
/plugin install caw@caw
```

That's it. The pipeline, harness, hooks, rules, and skills are all in the plugin.

### Share the whole stack with a committed settings file

Commit a `.claude/settings.json` into your project so members are **prompted to install on trust** when they open it. A ready sample lives at
[`plugins/caw/templates/project/settings.json`](plugins/caw/templates/project/settings.json). It registers the `caw` marketplace, enables `caw`, and enables the **3 companion plugins** (`superpowers`, `frontend-design`, `context7`) — so members get the whole stack at once.

> **Honest note:** `enabledPlugins` makes the plugin discoverable and prompts the member to approve it — it is **clone → trust → approve**, not fully silent auto-install yet.

### Companion plugins (official)

| Plugin | Provides |
| --- | --- |
| **superpowers** | Workflow skills — TDD, debugging, verification, review |
| **context7** | Live framework / library docs (Next.js, Prisma, Stripe, TanStack, Supabase, …) |
| **frontend-design** | Frontend / UI quality |

---

## Usage

```
/caw-setup                 # detect stack, scaffold docs/caw seeds, verify harness, write conventions.md + project.yaml
/caw-plan "<description>"   # generate a Plan (spec + API contract + phases + self-challenge + lane)
/caw-code <id> --all       # implement all phases (parallel where the plan allows)
/caw-verify <id>           # test + review in parallel
```

Or step-by-step:

```
/caw-plan "<description>"
/caw-code <id>             # one phase at a time
/caw-test <id>             # write tests (mode driven by the Plan's lane)
/caw-review <id>           # multi-dim review with severity findings
/caw-verify <id>           # test + review in parallel
```

---

## What's in `caw`

| Component | What |
| --- | --- |
| **5 agents** | `setup`, `planner`, `coder`, `tester`, `reviewer` |
| **6 commands** | `/caw-setup`, `/caw-plan`, `/caw-code`, `/caw-test`, `/caw-review`, `/caw-verify` |
| **4 authored skills** | `api-contract`, `error-handling-patterns`, `nextjs-feature`, `react-component-testing` (namespaced `caw:<name>`) |
| **Durable harness** | `harness-cli` (Python stdlib) + SQLite; state lives in `harness.db` at the **project root** (never in the plugin cache) |
| **Hooks** | Safety + workflow hooks, profile-gated by `CAW_HOOK_PROFILE` (`minimal` / `standard` / `strict`) |
| **Rules** | Non-overridable coding rules every agent loads |

---

## What moved out (coming from old caw?)

caw no longer vendors framework/library skills or scaffolds files via a shell CLI. The pieces you remember now live elsewhere:

| Old caw piece | Now |
| --- | --- |
| Workflow skills (TDD, debug, verify, review) | **Superpowers** (official plugin) |
| Framework / library docs (Next.js, Prisma, Stripe, TanStack, Supabase, …) | **Context7** (live docs) |
| Frontend UI quality | **Frontend Design** (official plugin) |
| 65 vendored skills, `skills-lock.json`, catalog, symlink machinery | removed — the plugin handles distribution |

There is no more `caw init` / `caw upgrade` / `caw remove` / `caw sync`, no `setup.sh`, and no skills catalog or symlink machinery. Install the plugin instead.

---

## Architecture

### The 5-stage pipeline

| Stage | Purpose | Agent |
| --- | --- | --- |
| **Setup** | One-time: detect stack, scaffold `docs/caw` seeds, verify harness, write `conventions.md` + `project.yaml` | setup |
| **Plan** | Spec, API contract, phases, self-challenge, lane | planner |
| **Code** | Implement one phase at a time, loading skills as needed | coder |
| **Test** | Lane-driven tests (red + green where required) | tester |
| **Review** | Multi-dim review (security / perf / a11y / refactor / architecture) with severity findings | reviewer |

### The "lane" concept

`lane` is the single task-sizing field. `planner` sets it from risk flags + heuristics, and it **gates which stages run** — so trivial work skips the ceremony and risky work gets full TDD:

| Lane | Triggers | Behavior |
| --- | --- | --- |
| `tiny` | chore, rename, narrow bug fix, < 50 LOC and no hard gate | Code only — skip test + review. Manual verify. |
| `standard` | normal feature, medium-risk bug, bounded blast radius | Code → backend tests after impl → scoped review. |
| `risky` | any hard gate (security, payment, auth, data migration, …) | Full TDD: failing tests first (red) → code (green) → full review. ADR mandatory. |

### Severity-based review findings

| Severity | Action |
| --- | --- |
| **CRITICAL / HIGH** | Block commit. Loop back to coder. Reviewer may amend the Plan. |
| **MEDIUM** | Fix if scope allows. Else create a follow-up task. |
| **LOW** | Auto-create follow-up task. Don't block. |

### Task file format

Each task lives at `docs/caw/tasks/<task-id>/`:

| File | Owner | Purpose |
| --- | --- | --- |
| `overview.yaml` | all | State — status, lane, phase status, next phase |
| `plan.md` | planner | Spec + API contract + phases + challenge + revisions |
| `code.md` | coder | Files changed per phase |
| `tests.md` | tester | Tests written, coverage |
| `review.md` | reviewer | Findings by severity |

`plan.md` is a **living document** — the reviewer may amend it (with a `## Revisions` audit trail) when CRITICAL/HIGH findings require plan changes.

---

## Hook profiles

Hooks are gated by `CAW_HOOK_PROFILE`. Disable individual hooks with `CAW_DISABLED_HOOKS` (comma-separated).

| Profile | Behavior |
| --- | --- |
| `minimal` | No hooks |
| `standard` | All hooks except the dangerous-actions blocker |
| `strict` | All hooks, including the dangerous-actions blocker |

---

## Repository layout

```
caw-v2/
├── .claude-plugin/
│   └── marketplace.json        Marketplace manifest (ships the caw plugin)
├── plugins/
│   └── caw/               The plugin
│       ├── .claude-plugin/     plugin.json manifest
│       ├── agents/             5 agents (setup, planner, coder, tester, reviewer)
│       ├── commands/           6 commands (caw-setup, caw-plan, caw-code, ...)
│       ├── skills/             4 authored skills
│       ├── hooks/              Safety + workflow hooks (hooks.json) + dispatcher
│       ├── rules/              Non-overridable coding rules (common/ + typescript/ + react/)
│       ├── harness/            Durable layer — harness-cli (Python stdlib) + SQLite schema
│       └── templates/          Project + docs/caw seeds (incl. sample settings.json)
├── cli/
│   └── tests/                  pytest suite for the harness
├── docs/
│   └── CONCEPT.md              Architecture design doc
└── tools/
    └── backlog/                Optional companion Kanban UI (Astro + React + shadcn)
```

### Backlog viewer (optional companion UI)

`tools/backlog/` is an Astro + React + shadcn Kanban that renders `docs/caw/tasks/`:

```bash
cd tools/backlog
pnpm install
CAW_PROJECT_ROOT="<your-project>" pnpm dev
# open http://localhost:4321
```

---

## Security & production notes

- **Plugin hooks run shell with the member's user permissions.** `caw` is first-party, and the 3 companion plugins are official / vetted. **Vet any other plugin before enabling it** — enabling a plugin grants it the ability to run hooks as you.
- **Pin a commit SHA in the marketplace ref for production.** In `marketplace.json` / `extraKnownMarketplaces`, reference a commit SHA rather than a branch — a branch push can silently change what your team installs.
- **`harness.db` is per-project.** The CLI runs from `${CLAUDE_PLUGIN_ROOT}/harness/bin/harness-cli` but resolves its DB to the project (git root). It never writes into the plugin cache.

---

## Documentation

- [docs/CONCEPT.md](docs/CONCEPT.md) — architecture design doc
- [plugins/caw/README.md](plugins/caw/README.md) — plugin-level reference
- [CLAUDE.md](CLAUDE.md) — caw repo's own Claude Code context

---

## License

MIT
