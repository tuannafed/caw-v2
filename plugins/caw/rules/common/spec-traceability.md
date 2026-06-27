# Rule: Spec Traceability — Every Plan Must Cite Spec Verbatim

**Layer:** rules — non-negotiable project-wide convention
**Used by:** planner (writing plan), reviewer (rejecting plan), coder (sanity check before
implementing), any agent proposing new scope.
**Why this exists:** Without spec traceability, the planner→coder→reviewer chain becomes a
closed loop: planner invents scope, coder implements it, reviewer rubber-stamps because "the
plan said to". The spec — the only durable source of truth shared with stakeholders — drops
out of the loop, and fabrications ship under epic labels that look legitimate. This rule forces
every plan back to the spec at write-time and gives the reviewer one objective rejection
criterion.

> **Provenance:** ported into caw from a real project (dava2) where a 2026-05-27 audit found
> 3 of 17 task plans had invented scope outside the spec. Root cause: epic number assigned
> first, scope built around it, no spec-citation requirement. This rule was the single change
> that would have prevented all three.

---

## The rule

Every `plan.md` for a feature/bug task **MUST** open with a `## Spec mandate` section
containing, for each major task, a **verbatim quote** from the source spec with
`file:line` citation. No quote → no plan approval.

**Lookup helper (if the project has a spec index):** Many projects keep a spec *index*
(one line per section + line range) so the planner reads ~150 cheap lines to find which
section backs a task, then reads only that range from the full spec to copy the verbatim
quote. If your project has one, cite the index path in `conventions.md` and use it; don't
load the whole spec to write one plan.

Each item in `## Spec mandate` falls into exactly one of three classifications:

- ✅ **SPEC-BACKED** — a quotable spec sentence justifies the item. Quote it.
- ⚠️ **INFRA-CHOICE** — not in spec, but a defensible implementation detail
  (build strategy, auth mechanism, retention policy, deploy target, test framework).
  Must explain *why this is implementation and not feature*.
- ❌ **FABRICATED** — neither spec-backed nor a defensible infra choice. **Disallowed.**
  Either find spec backing, reclassify as infra (with justification), or remove from plan.

A plan that mixes ✅ and ⚠️ items is normal. A plan with even one ❌ item is rejected.

---

## Required `## Spec mandate` template

```markdown
## Spec mandate

**Source spec:** <path/to/spec.md> (and any cross-referenced specs)

### Phase: <task-id>
Classification: ✅ SPEC-BACKED | ⚠️ INFRA-CHOICE
Spec section: §<N.N>
Verbatim quote:
> "<exact spec text>"
File:line: <path/to/spec.md>:<line>

[OR for INFRA-CHOICE:]

Classification: ⚠️ INFRA-CHOICE
Why infra (not feature): <one-sentence justification>
Example: "Auth mechanism for service↔service calls. Spec §X mandates the call exists but
doesn't specify auth shape. Standard internal-service auth is implementation detail."

[Repeat for every task]
```

If multiple tasks are backed by the same spec section, list each task under the same
section heading rather than duplicating the quote.

---

## Anti-patterns this rule blocks

1. **"Plan addresses §X"** — too vague, no quote. The spec might not say what you think.
2. **"Per ADR-NNNN" alone** — the ADR itself must trace to spec or be infra-choice. An ADR
   chain doesn't substitute for a spec quote.
3. **Defer a spec mandate without escalation.** If a spec mandate is deferred, `## Spec mandate`
   must show the verbatim quote AND an explicit deferral line:
   `**Deferred per:** <user-quote or follow-up-story-id>` — a **user-provided** line, not an
   agent decision.
4. **Epic number first, scope second.** If the task title is `task-vX.Y-NNN-eN-foo` and there's
   no spec section for "eN foo", the task is fabricated. Rename or cancel.
5. **Out-of-scope spec section cited as in-scope.** If the section is titled "Out of scope (v1)"
   or marks the item as a later version, citing it as backing for the current task is
   fabrication, not citation.

---

## Reviewer enforcement

`reviewer` rejects the task with verdict `needs-rework` if any of:

| Issue | Severity |
|---|---|
| `## Spec mandate` section missing entirely | `CRITICAL` |
| Any task has no entry in `## Spec mandate` | `CRITICAL` |
| Quote present but `file:line` citation missing or unverifiable | `HIGH` |
| Citation points to a spec section that contradicts the plan | `HIGH` |
| Item classified ⚠️ INFRA-CHOICE without "Why infra" line | `MEDIUM` |
| Item classified ⚠️ INFRA-CHOICE but is clearly a business feature | `HIGH` |
| Deferral of a spec mandate without user-quote justification | `HIGH` |

Reviewer **MAY** quote the spec back and require the planner to revise. Reviewer **MUST NOT**
invent spec backing on the planner's behalf — that turns the reviewer into a second
fabrication source.

---

## When the rule does not apply

- **Pure infra tasks** (devops scripts, CI workflows). If the *entire* task is INFRA-CHOICE,
  `## Spec mandate` can be a single block:
  `Classification: ⚠️ INFRA-CHOICE (entire task)` + justification. Just don't pretend it's
  spec-driven.
- **Tasks of `type: chore`** (refactors, lint fixes, dep bumps). These need a "why now"
  reason, not a spec mandate.
- **Bug fixes triggered by runtime errors**, not new feature work. Cite the bug report or
  runtime smoke incident instead of spec.

---

## Note for projects without a written spec

This rule assumes a durable product spec exists. If a project has no spec yet, the keystone
discipline still applies in a degraded form: every task must cite **some** durable source of
truth — a user-approved intake record, an accepted ADR, or an explicit user instruction quoted
verbatim. "The agent decided it would be good" is never sufficient backing. Stand up a spec (or
at least an intake doc) as soon as the project has real product scope.
