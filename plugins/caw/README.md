# caw

Claude Agent Workflow — a 5-agent pipeline (plan → code → test → review) with a
durable SQLite harness, safety hooks, and 4 authored skills, packaged as a Claude
Code plugin.

## Install

```
/plugin marketplace add tuannafed/caw-v2
/plugin install caw@caw
```

`caw` depends on 3 official companion plugins (workflow skills, framework docs,
UI quality). Install them too — `claude-plugins-official` is built in, no
`marketplace add` needed:

```
/plugin install superpowers@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install context7@claude-plugins-official
```

If you skip these, agents fail mid-task when they try to load a Superpowers skill
or query Context7. `/caw:setup` preflights and warns if any are missing.

Or commit a `.claude/settings.json` into your repo (see
[`templates/project/settings.json`](./templates/project/settings.json)) whose
`enabledPlugins` lists `caw` **and** all 3 companions — then a member who trusts the
file is prompted to install the whole stack and does **not** need the manual commands
above. Installing `caw` alone does not pull the companions.

> **Context7 API key (teams).** Context7 is an MCP server; without a key it uses a
> shared anonymous rate-limit tier. Set `CONTEXT7_API_KEY` (free at
> [context7.com/dashboard](https://context7.com/dashboard)) for your own quota. The
> settings template has an empty `CONTEXT7_API_KEY` env slot — fill it locally, never
> commit a real key.

## What's inside

| Component | What |
|---|---|
| **agents/** | 5 agents: `setup`, `planner`, `coder`, `tester`, `reviewer` |
| **commands/** | 7 commands: `/caw:setup`, `/caw:plan`, `/caw:code`, `/caw:test`, `/caw:review`, `/caw:verify`, `/caw:maintain` |
| **skills/** | 4 authored skills: `api-contract`, `error-handling-patterns`, `nextjs-feature`, `react-component-testing` (namespaced `caw:<name>`) |
| **hooks/** | Safety + workflow hooks (`hooks.json`), profile-gated by `CAW_HOOK_PROFILE` |
| **harness/** | Durable layer — `harness-cli` (Python stdlib) + SQLite schema. State lives in `harness.db` at the **project root**, not the plugin cache. |
| **rules/** | Non-overridable rules. Coding rules (`paths:` frontmatter) are scaffolded to the project's `.claude/rules/` and auto-load on matching file touch; state/spec rules stay in the plugin and agents `Read` them explicitly |

## What moved out (and where)

caw no longer vendors framework/library skills. Use these alongside `caw`:

| Old caw piece | Now |
|---|---|
| Workflow skills (TDD, debug, verify, review) | **Superpowers** (official) |
| Framework docs (Next.js, Prisma, Stripe, TanStack, Supabase, …) | **Context7** (live docs) |
| Frontend UI quality | **Frontend Design** (official) |
| 65 vendored skills, `skills-lock.json`, catalog, symlink machinery | removed — the plugin handles distribution |

## Usage

```
/caw:setup                 # detect stack, verify harness, write conventions.md + project.yaml
/caw:plan "<description>"   # generate a Plan
/caw:code <id> --all       # implement all tasks
/caw:verify <id>           # test + review in parallel
```

## Hook profiles

Hooks are gated by `CAW_HOOK_PROFILE`:

- `minimal` — no hooks
- `standard` — all hooks except the dangerous-actions blocker
- `strict` — all hooks, including the dangerous-actions blocker

Disable individual hooks with `CAW_DISABLED_HOOKS` (comma-separated).

## Notes

- **harness.db is per-project.** The CLI binary runs from
  `${CLAUDE_PLUGIN_ROOT}/harness/bin/harness-cli` but resolves its DB to the
  project CWD (git root). It never writes into the plugin cache.
- **Marketplace ref tracks `main`.** The scaffolded settings set
  `extraKnownMarketplaces.caw.source.ref` to `"main"`, so `/plugin marketplace update`
  pulls the latest with no settings edit. Pin `ref` to a tag/SHA for a frozen install.
