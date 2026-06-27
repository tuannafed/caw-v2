---
name: doubt-check
description: In-flight adversarial self-check for a non-trivial decision BEFORE it ships down the pipeline. Spawn a fresh-context reviewer biased to disprove the decision while course-correction is still cheap. Use on risk_lane=high_risk work when a decision introduces branching, crosses a module/service boundary, asserts a property the type system can't verify (idempotence, ordering, thread-safety, an invariant), or has irreversible blast radius (prod deploy, data migration, public API change). NOT for renames, formatting, one-line obvious changes, or reads.
---

# Doubt-Check — in-flight adversarial review

> Adapted from `doubt-driven-development` in addyosmani/agent-skills (MIT, © 2025
> Addy Osmani), reshaped for caw's orchestrator + harness model.

This is **not `/caw:review`.** Review is a verdict on a finished artifact (post-hoc).
Doubt-check is an **in-flight posture**: a non-trivial decision gets cross-examined
*while it's still cheap to change* — before the coder ships it and a reviewer/test gate
has to catch it. Catching a wrong direction here costs one fresh-context pass; catching
it at the reviewer gate costs a re-code loop.

## Architectural constraint (read first)

The DOUBT step spawns a **fresh-context reviewer subagent**. A subagent cannot spawn
another subagent, so **this skill runs in the MAIN session orchestrator only** — i.e.
inside `/caw:code` (the command), BEFORE it spawns the `coder` agent for a task. Do
**not** load it inside the `coder`/`planner`/`reviewer` agents themselves (they're
subagents — the DOUBT step would degrade to self-questioning, which is not real
fresh-context review and gives false confidence).

## When to run (gate hard)

Run ONLY when **both** hold:
1. The story's `risk_lane` is `high_risk` (read it from the DB via `harness-cli query story --json`, or the Plan), AND
2. The about-to-be-coded task carries a **non-trivial decision** — at least one of:
   - introduces or changes branching/control logic,
   - crosses a module/service/package boundary,
   - asserts a property the compiler can't verify (idempotence, ordering, thread/async
     safety, a data invariant, a security property),
   - depends on context a future reader won't see, or
   - has irreversible blast radius (prod deploy, data migration, public API/contract change).

**Do NOT run** for: renames, formatting, file moves, one-line obvious changes, pure
reads/summaries, tooling-only edits, `tiny`/`normal` lanes, or when the user asked
explicitly for speed. Over-running this is the failure mode — it turns into validation
theatre and slows the lane for no gain.

## The doubt cycle (bounded — max 3 cycles)

**1. CLAIM** — State the decision compactly (2–3 lines) and why it matters. (e.g.
"We dedupe webhook events by `(provider, event_id)` in the consumer, assuming the
provider never reuses an id across types — matters because a wrong assumption
double-charges.")

**2. EXTRACT** — Isolate the smallest reviewable **artifact** (the function / contract /
schema / migration) and its **contract** (what it must guarantee). Strip your own
reasoning — the reviewer must judge the artifact, not be led by your justification.

**3. DOUBT** — Spawn a **fresh-context reviewer** (Agent tool, a general/Explore-style
agent, NOT the caw `reviewer` persona) with an **adversarial** prompt: *"Find what is
wrong with this. Default to it being broken. Here is the artifact and the contract it
must satisfy — not the author's reasoning."* Give it ARTIFACT + CONTRACT only, never the
CLAIM. Ask it to attack the unverifiable property specifically.

**4. RECONCILE** — Classify each finding against the artifact text, in precedence order:
   1. **Contract misread** by the reviewer → fix the contract statement, re-loop.
   2. **Valid + actionable** → change the decision/artifact before coding, re-loop.
   3. **Valid trade-off** → keep, but document it explicitly (note it for the Plan/ADR).
   4. **Noise** → record one line, move on.

**5. STOP** — Exit when: findings are trivial-only, OR 3 cycles done, OR the user says
ship. Never exceed 3 cycles solo — escalate to the user instead.

## After the cycle

- If the decision changed, hand the **revised** decision to the coder (update the task
  description / Plan note so the coder builds the corrected version).
- If a valid trade-off surfaced, record it: a one-line Plan note, or an ADR via
  `harness-cli decision` when it's an architectural decision (per the harness contract).
- Keep it terse. The output is a go / revise verdict + any trade-off note — not an essay.

## Red flags (you're doing it wrong)

- Doubting a one-liner, a rename, or formatting → not a non-trivial decision; skip.
- Feeding the reviewer your CLAIM/reasoning instead of just ARTIFACT + CONTRACT.
- Asking "is this good?" instead of "find what's wrong."
- Treating the reviewer's output as gospel without re-reading the artifact yourself.
- Looping >3 cycles, or 2+ cycles with zero actionable findings (validation theatre).
- Running it on `tiny`/`normal` lanes or when speed was requested.
