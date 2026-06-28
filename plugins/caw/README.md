# caw

Claude Agent Workflow — a 5-agent pipeline (plan → code → test → review) with a
durable SQLite harness, safety hooks, and 9 authored skills, packaged as a Claude
Code plugin.

## Quickstart (5 minutes)

From zero to a verified story. Run these in Claude Code, in your project repo:

```text
# 1. Add the marketplace + install caw and its 3 companions (all official)
/plugin marketplace add tuannafed/caw-v2
/plugin install caw@caw
/plugin install superpowers@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install context7@claude-plugins-official

# 2. One-time project setup — detect stack, verify the harness, scaffold docs/caw
/caw:setup

# 3. Plan → implement → verify a feature
/caw:plan "add a soft-delete flag to the tickets table"
/caw:code  US-001-soft-delete-tickets --all
/caw:verify US-001-soft-delete-tickets
```

That's the whole loop. `/caw:plan` writes the spec + tasks (state in `harness.db`,
prose in `docs/caw/stories/`), `/caw:code --all` implements every task (parallel tasks
each run in their own git worktree), and `/caw:verify` runs tests + a multi-dimension
review with a mechanical proof gate. The status bar shows the active story · lane ·
progress the whole time.

> **Team install (no manual commands):** commit a `.claude/settings.json` whose
> `enabledPlugins` lists caw + the 3 companions (template:
> [`templates/project/settings.json`](./templates/project/settings.json)). A member who
> trusts the file installs the whole stack on open. See [Install](#install) for details.

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

> **Context7 API key (optional).** Context7 is an MCP server; without a key it uses a
> shared anonymous rate-limit tier — fine for normal use (you'd only ever hit a *rate
> limit*, never an auth error). To use your own quota:
>
> 1. Free key at [context7.com/dashboard](https://context7.com/dashboard).
> 2. Paste it into the scaffolded `.mcp.json` → `mcpServers.context7.env.CONTEXT7_API_KEY`.
> 3. **Restart Claude Code.**
>
> A **literal key in `.mcp.json`** is the only place that reliably reaches the server, so
> `/caw:setup` **gitignores `.mcp.json`** (it holds your key). Two things that look right
> but **don't** work (verified): a key in `settings.json`/`settings.local.json` `env` — a
> settings env is **not** passed to MCP subprocesses; and `${CONTEXT7_API_KEY}` expansion
> in `.mcp.json` — a GUI/VSCode launch doesn't load `~/.zshrc`, so the var is empty. Never
> commit the key.

## What's inside

| Component | What |
|---|---|
| **agents/** | 5 agents: `setup`, `planner`, `coder`, `tester`, `reviewer` |
| **commands/** | 8 commands: `/caw:setup`, `/caw:plan`, `/caw:code`, `/caw:test`, `/caw:review`, `/caw:verify`, `/caw:maintain`, `/caw:spec` |
| **skills/** | 9 authored skills (namespaced `caw:<name>`): archetype/workflow — `api-contract`, `error-handling-patterns`, `nextjs-feature`, `react-component-testing`, `doubt-check`; quality/gap — `security-hardening`, `performance-optimization`, `observability`, `context-engineering` |
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
/caw:setup                 # detect stack, verify harness, write conventions.md + project rule file(s)
/caw:plan "<description>"   # generate a Plan
/caw:code <id> --all       # implement all tasks
/caw:verify <id>           # test + review in parallel
```

## Hook profiles

Hooks are gated by `CAW_HOOK_PROFILE`:

- `minimal` — no hooks run
- `standard` — the standard set (record-trace, session-summary, stop-format-typecheck, post-edit-accumulator)
- `strict` — the standard set **plus** the strict-only hooks (task-read-gate, prompt-injection-detector)

Disable individual hooks with `CAW_DISABLED_HOOKS` (comma-separated).

(Destructive-command blocking moved to native `permissions.deny` in the settings
template; secret scanning is a gitleaks `pre-commit` hook `/caw:setup` installs — neither
is a `CAW_HOOK_PROFILE` hook anymore.)

## Notes

- **harness.db is per-project.** The CLI binary runs from
  `${CLAUDE_PLUGIN_ROOT}/harness/bin/harness-cli` but resolves its DB to the
  project CWD (git root). It never writes into the plugin cache.
- **Marketplace ref tracks `main`.** The scaffolded settings set
  `extraKnownMarketplaces.caw.source.ref` to `"main"`, so `/plugin marketplace update`
  pulls the latest with no settings edit. Pin `ref` to a tag/SHA for a frozen install.
