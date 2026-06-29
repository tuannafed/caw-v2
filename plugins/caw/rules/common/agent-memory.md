# Agent Memory Contract

Every caw agent runs with `memory: project` — a native Claude Code project-scoped
memory at `.claude/agent-memory/<agent>/`. This rule defines, once, **what belongs in
memory and what does not**, so the agent prompts don't each re-derive it (and drift).

Memory is the third durability layer, distinct from the other two:

| Layer | Lives in | Holds |
|---|---|---|
| **State** | `harness.db` (via `harness-cli`) | story/task status, proof, decisions, traces |
| **Prose** | `docs/caw/.../{plan,code,tests,review}.md`, ADRs | the narrative of **one** story/task |
| **Memory** | `.claude/agent-memory/<agent>/` | **reusable lessons that outlive any one story** |

## Read before acting

Each agent **reads its memory first** — past gotchas, conventions discovered, pitfalls
already paid for. A recalled note reflects what was true when written: if it names a
file, flag, or API, verify that still holds before relying on it.

## Write only durable, cross-story lessons

Write a note **only** when you learn something a *future* session would reuse — a
recurring bug pattern + its fix, a non-obvious project convention, a stack quirk, a
confirmed false-positive to stop flagging. One terse fact per note.

**Do NOT write:**

- **Per-story / per-task content.** Token strategy for US-001, this story's scope
  decisions, this task's coverage — that is `plan.md` / `code.md` / `tests.md` /
  `review.md` and the ADR. The test: *"would the next planner reuse this on a
  DIFFERENT story?"* If no, it's prose, not memory. (A single cross-cutting invariant
  that the story happened to establish — e.g. "auth is owned by the external API, not
  this app" — IS memory; the story's token names and route choices are NOT.)
- **State.** Task status, done/blocked — that is the DB.

## Memory is team-shared — keep it portable

`.claude/agent-memory/` is **committed and shared with the whole team** (it is not
machine-local). So a note must make sense on someone else's machine:

- **No absolute paths.** Never write `/Users/<you>/.claude/plugins/cache/...` or any
  home-relative path. Refer to things by their stable identity (a subcommand name, a
  project-relative path like `src/lib/api-client/`), not where they happen to sit in
  the plugin cache on your box.
- **No secrets / tokens / credentials**, and nothing machine-local (ports you picked,
  your shell rc, your OS specifics) unless it's a genuine project-wide fact.

## Format: one index + one file per fact

Mirror the index pattern. `MEMORY.md` is the index — one line per note,
`- [Title](slug.md) — hook`. Each fact is its own `slug.md` with frontmatter
(`name`, `description`, `metadata.type`). Before adding a note, check whether an
existing file already covers it and update that instead of duplicating; delete a note
that turns out wrong.
