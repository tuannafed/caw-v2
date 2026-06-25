---
paths:
  - "**/stories/**/plan.md"
---
# Rule: Feedback Traceability — Quote-Back Before Interpreting Client Feedback

**Layer:** rules — non-negotiable project-wide convention
**Used by:** planner (writing the plan from feedback), reviewer (rejecting an
unconfirmed interpretation), any agent that turns a client/stakeholder message
into scope.
**Why this exists:** `spec-traceability.md` protects the **spec → plan** layer.
But the real input above the spec is **client replies** (Slack, feedback docs,
meeting notes) — natural language, often ambiguous. When an agent silently picks
one reading of an ambiguous sentence and runs with it, a single mis-digested line
overrides the client's actual words for every downstream agent. This rule forces
the interpretation to be quote-backed and confirmed before it becomes scope.

> **Provenance:** ported into caw from a real project (dava2). Friction log:
> *"Client-feedback digests need a quote-back gate — Q#4 misread cost a full
> day."* A single mis-digested sentence overrode the client's verbatim words for
> every downstream agent. This is the same fabrication class `spec-traceability`
> prevents, one layer earlier — at the feedback, not the spec.

---

## The rule

When a plan is driven by client/stakeholder feedback (not a written spec),
**every interpretation of an ambiguous statement MUST be quote-backed before it
becomes a task or a decision.**

Two obligations:

1. **Adjacent quote.** Every digest line ("client CONFIRMED / REJECTED / WANTS
   X") MUST sit next to the **verbatim quote** it interprets, with a source
   (`feedbacks/<file>:<line>`, Slack permalink, or date+author). A digest with no
   adjacent quote is rejected.

2. **Quote-back before commit.** Before an interpretation of an **ambiguous**
   statement becomes a task/ADR/decision, it must be quote-backed to the client
   with a concrete example, and the client's reply pasted verbatim. Until then the
   task is marked `ambiguous` and **cannot enter `in_progress`**.

A statement is **ambiguous** when it has more than one defensible reading that
would lead to different implementations. When in doubt, treat it as ambiguous —
the cost of one clarifying question is minutes; the cost of a wrong reading was a
full day (Q#4).

---

## Required `## Feedback mandate` template

When a task originates from feedback, `plan.md` opens with this **in addition to**
`## Spec mandate` (or instead of it, if there is no written spec):

```markdown
## Feedback mandate

**Source:** <feedbacks/2026-06-11-dan.md / Slack permalink / meeting note>

### Interpretation: <short label>
Verbatim quote:
> "<exact client words>"
Source: <feedbacks/2026-06-11-dan.md:42>
Reading chosen: <the one interpretation this plan implements>
Ambiguity: NONE | AMBIGUOUS
[if AMBIGUOUS:]
Quote-back: "<the concrete example put back to the client>"
  e.g. "Visitor clicks X, lands on Y — does that count as an entry?"
Client reply (verbatim): "<pasted reply>"
Confirmed: ✅ <date> | ⏳ AWAITING — task blocked until reply
```

If an interpretation is `AMBIGUOUS` and not yet `Confirmed`, the corresponding
task stays `status: blocked` (caw v2: `harness-cli task update --status blocked`)
with a note pointing at the awaited reply. Do **not** start it on a guess.

---

## Anti-patterns this rule blocks

1. **Digest without quote.** "Dan wants goals to be workspace-wide" with no quote.
   The reading might be wrong — show the words.
2. **Resolving ambiguity by assumption.** Picking a reading because it's the
   convenient one, without asking. (Q#4: the sentence stressed one thing; the
   agent read it as another and shipped a day of wrong work.)
3. **Digest that contradicts an earlier quote.** A later digest line that
   conflicts with a verbatim quote already on record — the quote wins.
4. **Inheriting a sibling's mental model.** "Mode B works like Mode C" without
   confirming the analogy holds for this feedback. Cite the client, not the
   precedent.
5. **Quote-back skipped because 'it's probably fine'.** Probably-fine on an
   ambiguous statement is exactly the failure mode. The gate is cheap.

---

## Reviewer enforcement

`reviewer` rejects the task with verdict `needs-rework` if any of:

| Issue | Severity |
|---|---|
| A digest line ("client CONFIRMED/WANTS X") with no adjacent verbatim quote | `CRITICAL` |
| An `AMBIGUOUS` interpretation implemented without a `Confirmed` client reply | `CRITICAL` |
| A digest that contradicts an earlier verbatim quote on record | `HIGH` |
| Quote present but source citation missing/unverifiable | `HIGH` |
| Ambiguity marked `NONE` on a statement that plainly has two readings | `MEDIUM` |

Reviewer **MAY** require the planner to quote-back and wait. Reviewer **MUST NOT**
resolve the ambiguity itself — that just moves the guess to a second agent.

---

## When the rule does not apply

- **Tasks driven by a written spec**, not feedback — use `spec-traceability.md`
  instead. (A task can use both: spec for what, feedback for a clarification.)
- **Unambiguous instructions.** A clear, single-reading request ("rename the
  button to 'Save'") needs the quote but not the quote-back round-trip.
- **Bug fixes from runtime errors.** Cite the incident, not feedback.

---

## Relationship to spec-traceability

Same discipline, one layer up:

```
client feedback  → feedback-traceability (this rule: quote-back ambiguous reading)
      ↓
  written spec   → spec-traceability (quote spec verbatim per task)
      ↓
     plan        → coder implements
```

Both share one principle: **an interpretation is not a fact until it is traced to
the source's verbatim words.** Feedback-traceability catches the misread before it
hardens into a spec or a plan.
