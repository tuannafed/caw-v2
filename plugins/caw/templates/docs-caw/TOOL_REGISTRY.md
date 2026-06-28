# Tool Registry

The tool registry records **external project tools** an agent may use — project
scripts, custom CLIs, generators — so they are discoverable and documented in one
place. The compiled `harness-cli` commands themselves are not stored here; this is
for tools the project adds on top.

State lives in the DB (the `tool` table). Register, list, and remove with
`harness-cli`.

## Register a tool

```bash
scripts/caw/bin/harness-cli tool register \
  --name "db:generate" \
  --command "pnpm --filter @app/api db:generate" \
  --responsibility "Verification" \
  --description "Regenerate the Drizzle migration from schema.ts"
```

- `--name` — unique handle agents refer to.
- `--command` — how to invoke it (shell command).
- `--responsibility` — which harness area it serves (e.g. Verification,
  Observability, Task state). Use a consistent vocabulary so `query tool` groups
  cleanly.
- `--description` — one line on what it does and when to use it.

## List the registry

```bash
scripts/caw/bin/harness-cli query tool             # table (capped; --all for full)
scripts/caw/bin/harness-cli query tool --summary   # one compact line per tool
scripts/caw/bin/harness-cli query tool --json      # machine-readable
```

## Remove a tool

```bash
scripts/caw/bin/harness-cli tool remove --name "db:generate"
```

## When to register

Register a tool when:

- An agent will need to invoke a project-specific command it can't infer from
  `.claude/rules/project.md` (a non-obvious generator, a custom verifier, a data seeder).
- A `verify_command` on a task points at a project tool — register the tool
  so the command is documented, not just inlined.
- The same manual command is typed across tasks — register it once.

Do not register the built-in `harness-cli` verbs (init, story, task, trace,
audit, …) — those are the harness itself, not project tools.

## Relationship to task verification

A task carries its own `verify_command` (`harness-cli task add --verify
"<cmd>"`). The registry is the broader catalog of project tools; a task's
`verify_command` is the one mechanical proof bound to that task. They overlap
when a registered tool is also used as a task's proof — that's fine; register it
for discoverability and reference it in the task.
