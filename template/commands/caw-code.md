---
model: claude-sonnet-4-6
---

Run the coding workflow: $ARGUMENTS

## Instructions

`$ARGUMENTS` formats:
- `<story-id>` → coder runs the next pending task (status from `harness-cli query task`)
- `<story-id> <task>` → coder runs the specified task
- `<story-id> --all` → run **all** tasks, parallel where the Plan allows

### Prerequisites

1. Verify `docs/caw/stories/<story-id>/plan.md` exists.
   If not: `❌ Task not found. Run /caw-plan first.`
2. Verify each target task's `depends_on` tasks all have status `done`.
3. Verify the target tasks' `skills_hint` are all in `.claude/skill-map.yaml`.
   If not: `❌ Skill <name> not installed. Run /caw-setup --add <name>.`

### Single-task mode (`<story-id>` or `<story-id> <task>`)

Spawn the **coder** agent: `"Run the coder flow for task <story-id>, task <task-or-auto>"`

Coder agent will:
1. Resolve target task from arguments or `harness-cli query task`
2. Load skills via the Skill tool (from `skills_hint`)
3. Implement code per task description + test_scenarios + API contract
4. **Self-verify gate (mandatory):** run the project type checker and linter on
   the changed files. This gate **blocks** the task from being marked `done` —
   `/caw-verify` does not re-run type-check.
5. Append to `code.md` and set the task status: `done` if the gate passed,
   `blocked` if it did not.

After the task completes (next step depends on `lane` — read it from the DB,
`harness-cli query story --json`, find the row for `<story-id>`):
- Gate passed, more pending tasks → `/caw-code <story-id>` (next task)
- Gate passed, all tasks done, `lane: tiny` → **done.** Skip test + review (the
  self-verify gate is the proof for tiny). Proceed to commit.
- Gate passed, all tasks done, `lane: standard` or `risky` → `/caw-verify
  <story-id>` (test + review parallel).
- Gate failed (task `blocked`) → fix the reported type-check/lint errors, then
  re-run `/caw-code <story-id> <task>`. Do NOT proceed to `/caw-verify`.

### All-tasks mode (`<story-id> --all`)

Read `parallelization_groups` from `plan.md`. For each group, in order:

1. Group of 1 task → spawn one coder agent.
2. Group of 2+ tasks → spawn coder agents **in parallel** (Agent tool, multiple
   tool_use blocks in one message).
3. Wait for all agents in the current group before starting the next group.

Example:

```yaml
parallelization_groups:
  - [db]                          # Group 1: just db
  - [backend, frontend-skeleton]  # Group 2: parallel
  - [frontend-impl]               # Group 3: solo
  - [integrate]                   # Group 4: solo
```

Run db → wait → run [backend + frontend-skeleton in parallel] → wait →
run frontend-impl → wait → run integrate.

Each spawned coder: `"Run the coder flow for task <story-id>, task <task>"`.

If any coder agent reports its task `blocked` (self-verify gate failed), **stop
the run** — do not start later groups, and do not set status `code-done`. Report
the blocked task and its type-check/lint errors so the user can fix and re-run.

When all groups complete with every task `done` in the DB (`harness-cli query
matrix` shows all tasks passed), report:

```
✅ All tasks complete

Phases run: db, backend, frontend, integrate
Parallel groups: [db] → [backend|frontend-skel] → [frontend-impl] → [integrate]
Self-verify gate: all tasks type-check ✓ + lint ✓

Next: /caw-verify <story-id>   (lane: standard|risky)
      — or commit directly if lane: tiny (test + review skipped)
```
