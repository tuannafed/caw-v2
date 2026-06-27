---
name: context-engineering
description: Keep agent output quality high on long sessions and large/monorepo codebases by managing the context budget. Load when a session is getting long and quality is degrading, when switching between major features, when the agent starts ignoring conventions or hallucinating APIs, or when working in a big monorepo where you must choose what to load. Complements caw's per-lane CONTEXT_RULES pull discipline with a budget layer.
---

# Context Engineering

> Adapted from `context-engineering` in addyosmani/agent-skills (MIT, © 2025 Addy
> Osmani). Caw companion skill — the *budget* discipline on top of caw's per-lane
> `CONTEXT_RULES` pull (which already says WHICH docs to read per lane; this says HOW
> MUCH, and when to refresh).

## The context hierarchy (persistent → transient)
1. **Rules** (CLAUDE.md, `.claude/rules/`) — project conventions; persist across sessions.
2. **Specs & architecture** — load only the section relevant to the current task.
3. **Source files** — the files you'll modify + their tests + one pattern example. Not the tree.
4. **Error output** — feed the specific failure back, not the whole log.
5. **Conversation history** — accumulates and drifts; start fresh when it stops helping.

## Budget discipline (what caw's lane-pull doesn't cover)
- **Target < ~2,000 lines of focused context per task.** More files ≠ better output.
- Above ~5,000 lines of non-task material the agent **loses focus** — prune before adding.
- **Start a fresh session** when switching major features or when quality degrades —
  don't drag a stale conversation into new work.
- **Summarize progress explicitly** before a critical step (the harness already persists
  task *state* in the DB; this is about the live conversation).

## Disciplines
- **Selective include** — reference only what the current task needs. caw's `CONTEXT_RULES`
  per-lane matrix is exactly this; honor it, don't over-pull "just in case".
- **Hierarchical summary** — in a large/monorepo codebase, keep a project map and load
  only the relevant slice (pairs with monorepo skill scoping).
- **Confusion management** — surface ambiguity explicitly instead of guessing (caw's
  planner clarify gate is this at plan time; apply the same posture mid-task).

## When NOT to bother
Short, single-feature sessions in a small repo — the budget isn't the constraint. This
earns its keep on long sessions, monorepos, and when output has visibly drifted.
