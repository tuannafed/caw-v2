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
   If not: `❌ Task not found. Run /caw:plan first.`
2. Verify each target task's `depends_on` tasks all have status `done`.

> A task's `skills_hint` is a hint, not a gate — there is no installed-skill
> manifest to verify against. The coder loads each hint directly via the `Skill`
> tool (authored `caw:*` skills are always present; framework topics →
> Context7; workflow skills → Superpowers).

### Doubt-check gate (`risk_lane: high_risk` + non-trivial task — runs in THIS session)

Before spawning the coder, check the story's `lane` (`harness-cli query story --json`).
If `risk_lane: high_risk` **and** the target task carries a non-trivial decision (branching,
crosses a module/service boundary, asserts a property the type system can't verify —
idempotence/ordering/thread-safety/an invariant — or has irreversible blast radius):

**Invoke `Skill({skill: "caw:doubt-check"})` HERE, in the command's main session**, and
run its bounded doubt cycle on that decision *before* the coder builds it. This is
in-flight (cheap to course-correct) vs the post-hoc reviewer gate (expensive re-code).
It MUST run here, not inside the coder — the coder is a subagent and can't spawn the
fresh-context reviewer the skill needs. If the cycle revises the decision, pass the
revised version into the coder's task description. Skip entirely for `tiny`/`normal`
lanes, trivial tasks, or when the user asked for speed.

### Single-task mode (`<story-id>` or `<story-id> <task>`)

Spawn the **coder** agent: `"Run the coder flow for story <story-id>, task <task-key-or-auto>"`

Coder agent will:
1. Resolve target task from arguments or `harness-cli query task`
2. Load skills via the Skill tool (from `skills_hint`)
3. Implement code per task description + test_scenarios + API contract
4. **Self-verify gate (mandatory):** run the project type checker and linter on
   the changed files. This gate **blocks** the task from being marked `done` —
   `/caw:verify` does not re-run type-check.
5. Append to `code.md` and set the task status: `done` if the gate passed,
   `blocked` if it did not.

After the task completes (next step depends on `lane` — read it from the DB,
`harness-cli query story --json`, find the row for `<story-id>`):
- Gate passed, more pending tasks → `/caw:code <story-id>` (next task)
- Gate passed, all tasks done, `lane: tiny` → **done.** Skip test + review (the
  self-verify gate is the proof for tiny). Proceed to commit.
- Gate passed, all tasks done, `risk_lane: normal` or `high_risk` → `/caw:verify
  <story-id>` (test + review parallel).
- Gate failed (task `blocked`) → fix the reported type-check/lint errors, then
  re-run `/caw:code <story-id> <task>`. Do NOT proceed to `/caw:verify`.

### All-tasks mode (`<story-id> --all`)

Read `parallelization_groups` from `plan.md`. For each group, in order:

1. **Group of 1 task → spawn one coder agent, NO isolation** (it has the working
   tree to itself; a worktree would just add merge overhead).
2. **Group of 2+ tasks → spawn ALL of them in parallel, EACH in its own git
   worktree.** This is a HARD requirement, not a preference: emit **one assistant
   message containing one `Agent` tool_use block per task in the group** (N tasks →
   N tool_use blocks in the SAME message), every call with `isolation: "worktree"`.
   Do NOT spawn them one message at a time and wait between — that runs the group
   serially and is the #1 cause of `--all` taking hours instead of minutes (each
   serial coder re-reads the 24KB plan, re-loads rules + skills from a cold start).
   Parallel coders editing the same working tree would clobber each other; a
   per-agent worktree gives each an isolated checkout, which is the whole reason the
   planner made the group file-disjoint.
3. Wait for all agents in the current group, then **integrate AND clean up the
   worktree results** (below) before the next group runs — later groups (e.g.
   `integrate`) depend on the parallel group's files being merged in, and leftover
   worktrees accumulate as full repo checkouts that slow every later git op.

Example:

```yaml
parallelization_groups:
  - [db]                          # Group 1: solo — no worktree
  - [backend, frontend-skeleton]  # Group 2: parallel — one worktree each
  - [frontend-impl]               # Group 3: solo
  - [integrate]                   # Group 4: solo
```

Run db → wait → run [backend + frontend-skeleton, each in a worktree] → wait,
merge both back → run frontend-impl → wait → run integrate.

Each spawned coder: `"Run the coder flow for story <story-id>, task <task-key>"`.
For parallel tasks add `isolation: "worktree"` to the Agent call.

> **Worktree base + merge + cleanup.** Each `isolation: "worktree"` checkout branches
> from the repo's default branch unless `worktree.baseRef` is set to `"head"` in settings
> (the caw settings template sets it, so worktrees fork from the CURRENT branch — what
> you actually want). After a parallel group finishes:
>
> 1. **Merge** each worktree's changes back into the working branch.
> 2. **Remove** each worktree and delete its branch — ALWAYS, whether or not it had
>    changes. The Agent tool auto-cleans a worktree only when it ends *unchanged*; a
>    worktree that produced commits (the normal case) is NOT auto-removed, so you must
>    remove it explicitly or it leaks. Run, per agent worktree:
>    ```bash
>    git worktree remove --force .claude/worktrees/<agent-dir>
>    git branch -D worktree-<agent-dir> 2>/dev/null || true
>    ```
>    Then `git worktree prune` once at the end of the group. Verify with
>    `git worktree list` — only the main checkout should remain before the next group.
>
> If two parallel tasks turn out to touch the same files (they shouldn't — the
> planner's `parallelization_groups` are meant to be file-disjoint), the merge will
> conflict: stop and report it, the plan's grouping was wrong. **Even when you stop
> on a conflict or a blocked task, still remove the worktrees you created** so a
> failed run doesn't leave orphaned checkouts behind.

If any coder agent reports its task `blocked` (self-verify gate failed), **stop
the run** — do not start later groups, and do not set status `code-done`. Report
the blocked task and its type-check/lint errors so the user can fix and re-run.

When all groups complete with every task `done` in the DB (`harness-cli query
matrix` shows all tasks passed), report:

```
✅ All tasks complete

Tasks run: db, backend, frontend, integrate
Parallel groups: [db] → [backend|frontend-skel] → [frontend-impl] → [integrate]
Self-verify gate: all tasks type-check ✓ + lint ✓

Next: /caw:verify <story-id>   (risk_lane: normal|high_risk)
      — or commit directly if lane: tiny (test + review skipped)
```
