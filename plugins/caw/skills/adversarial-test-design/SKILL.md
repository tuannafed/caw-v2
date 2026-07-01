---
name: adversarial-test-design
description: Senior-QA test-design checklist for filling gaps a plan's test_scenarios left out — boundary values, malformed input, state/sequence abuse, authorization/IDOR, negative paths, UI edge cases, idempotency. Use AFTER reading a task's test_scenarios, specifically to check whether they already cover these classes for the task's forms/endpoints — load alongside test_scenarios, never as a replacement. Skip for pure internal utils/schemas with no external input, and skip re-loading if test_scenarios already enumerate these classes explicitly.
---

# Adversarial Test Design

`test_scenarios` in a Plan describes the **happy path and the cases the planner
thought of**. A senior tester's value is in the cases nobody thought to write down.
This skill is that missing layer — apply it to every field/endpoint/flow the task
touches, in addition to (never instead of) the Plan's `test_scenarios`.

**Budget.** Don't generate a case for every cell blindly. Pick the groups that apply to
this task's actual surface (a pure GET list endpoint has no idempotency concern; a
read-only display field has no authz/IDOR concern). Cap at ~2-4 cases per group per
field/endpoint — breadth across groups beats depth in one group. **Hard cap: if the
task's surface is large (10+ fields, or 3+ endpoints), do not scale linearly — prioritize
the 2-3 highest-risk groups for that surface (usually authz/IDOR + boundary/equivalence)
and keep the task's total added case count to roughly 20-30.** Note in `tests.md` which
groups you deprioritized and why, rather than silently generating fewer cases per group.

## 1. Boundary value + equivalence class (every input field)

For every field the user or client controls (form field, API payload field, query param):

| Class | Cases to try |
|---|---|
| Boundary | min-1, min, min+1, max-1, max, max+1 (length, numeric range, date range) |
| Empty/absent | `null`, `undefined`, `""`, whitespace-only (`"   "`), field omitted entirely |
| Wrong type | string where number expected, number where string expected, array where object expected |
| Encoding/charset | unicode, emoji, RTL text, very long string (~10k chars), `<script>`/HTML, SQL-like string, null byte `\0` |
| Format-specific | malformed-but-plausible email, phone with letters, impossible date (Feb 31), timezone offset edge |
| Payload shape | missing a required field, an extra undeclared field (mass-assignment check) |

## 2. State & sequence abuse (any multi-step flow)

- **Double-submit** — trigger the same submit/mutation twice back-to-back (race condition, duplicate side-effect).
- **Out-of-order steps** — call a later step's API before an earlier required step completed.
- **Stale state** — go back/refresh mid-flow, then resume; submit with an expired session/token acquired earlier.
- **Concurrent mutation** — two actors (or two tabs) modify the same resource near-simultaneously.

## 3. Authorization / IDOR (any endpoint touching a scoped resource)

- **IDOR** — swap the resource id in the URL/payload for one owned by a different actor/tenant; expect a reject, not a leak.
- **Role downgrade** — call the endpoint with a lower-privilege token/role than it requires.
- **Horizontal privilege** — same-tier actor (peer user) reaching another peer's resource.
- **Tenant/scope leak** — a scoped id (tenant, clinic, org) defaulting to 0/empty/unset must not widen access — this is the exact class of bug behind a `clinicId=0` full-access leak.

## 4. Negative / error path (every endpoint, not just its 200)

- Exercise every status code the contract defines (400/401/403/404/409/422/429/5xx), not only the success path.
- Malformed/truncated response from a dependency — does the caller handle it or crash?
- Network-level: timeout, connection dropped mid-request.

## 5. UI/UX edge cases (any form or interactive flow)

This group is about **behavior**, not markup/rendering — it does not require a
component test. Cover it with a hook/store test (submit-disabled state, whitespace
trimming logic) or Playwright E2E where one already exists; it does not override the
tester's default to skip component tests for `normal`-lane frontend tasks.

- Leading/trailing whitespace from copy-paste.
- Browser autofill populating the wrong field.
- Submit button not disabled during in-flight request (enables double-submit via UI).
- Viewport resize / mobile breakpoint mid-interaction.
- Keyboard-only navigation through the form (tab order, no dead-ends).

## 6. Idempotency & retry (any mutation that a client might retry)

- Re-send the identical request (simulating a client retry after a timeout) — must not create a duplicate side-effect (see `caw:error-handling-patterns` for the idempotency-key convention).
- Re-deliver the same webhook event — must not double-process.

## How to apply

1. After reading the task's `test_scenarios`, list the fields/endpoints/flows this task
   touches.
2. For each, pick the groups above that actually apply to its surface (skip groups with
   no applicable surface — say so, don't force a case that doesn't fit).
3. Write these as additional test cases alongside the Plan's own scenarios — same test
   file, same `it()` style, not a separate ad-hoc pass.
4. In `tests.md`, note which groups you applied per task (e.g. "boundary + authz applied
   to POST /tickets; idempotency n/a — endpoint is a pure read").
