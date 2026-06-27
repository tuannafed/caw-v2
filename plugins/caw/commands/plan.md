---
model: claude-sonnet-4-6
---

Run the planning workflow: $ARGUMENTS

## Instructions

`$ARGUMENTS` is a free-text description of the feature/bug/chore/refactor.

### Prerequisite check

Verify `docs/caw/conventions.md` exists (written by `/caw:setup`). If not:

```
❌ Project not set up. Run /caw:setup first.
```

### Delegate to planner agent

Spawn the **planner** agent: `"Run the planning flow for: <description>"`

Planner agent will:
1. Load the project **constitution** (`.claude/rules/project.md` lock-ins, conventions, CLAUDE.md) — every task must comply
2. **Clarify gate** — if a *plan-breaking* ambiguity exists (wrong guess derails the story), STOP and return a `🛑 CLARIFY` block of questions instead of a plan
3. Detect story type (feature/bug/chore/refactor)
4. Determine the task `lane` (tiny/standard/risky) — drives test behavior + pull depth
5. Write spec, API contract, tasks (with test_scenarios + skills_hint), challenge section (incl. constitution-compliance check)
   — `skills_hint` names authored `caw:*` skills, Superpowers workflow skills, or Context7 framework libraries (a hint, not a verified manifest)
6. Output `docs/caw/stories/<story-id>/plan.md` + task state in the DB (`harness-cli intake/story/task add`)

> **If the planner returns a `🛑 CLARIFY` block** (instead of a plan): relay its
> questions to the user verbatim, get answers, then re-run `/caw:plan` with the
> refined description. No `plan.md` / DB rows were written — nothing to clean up.

After planning, the next step follows the lane's **Pipeline stages** (see the
planner's lane table — lane gates which agents run, this is the speed contract):
- `lane: risky` → `/caw:test <story-id>` (red mode, write failing tests first)
- `lane: standard` → `/caw:code <story-id>` (code → then `/caw:verify`)
- `lane: tiny` → `/caw:code <story-id>` (code only — the coder's self-verify gate
  is the proof; **skip `/caw:test` and `/caw:review`**, go straight to commit)
