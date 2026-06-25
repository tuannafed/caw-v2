# Harness Backlog

The caw harness grows from friction. When an agent hits a missing rule, an
ambiguous template, repeated manual reasoning, or a recurring failure, it appends
an item here instead of silently working around it.

This file is the project's feedback loop into caw itself. The maintainer reviews
it periodically and ports accepted items back into the caw source repo.

## When to append an item

Any agent (`planner`, `coder`, `tester`, `reviewer`, `setup`) appends an item when
it notices:

- A rule or convention that should exist but doesn't.
- A template field that was missing, so the agent had to improvise.
- The same manual reasoning repeated across tasks.
- A failure pattern that recurs (same class of bug, same broken assumption).
- An instruction another agent will need but the harness never states.

Do not append for one-off task issues — only for friction the **next** task will
also hit.

## Item template

```md
### <short title>

- **Discovered while:** <story-id / task that exposed the gap>
- **Pain:** <what was hard, repeated, ambiguous, or unsafe>
- **Suggested improvement:** <what should be added or changed in caw>
- **Risk:** tiny | standard | risky
- **Status:** proposed | accepted | implemented | rejected
```

## Keeping this file bounded

This file is a **queue**, not a log. Only open items belong under `## Items`.

- New items are appended under `## Items` with status `proposed` or `accepted`.
- When an item reaches `implemented` or `rejected`, **move it** to `## Resolved`
  — collapse it to a single line: `- <title> — <status> (<story-id>)`. The full
  detail has served its purpose once the item is closed.
- `## Items` therefore only ever holds work still in flight, so the section an
  agent scans on each run stays short.

## Items

_No open backlog items._

## Resolved

_No resolved items yet._
