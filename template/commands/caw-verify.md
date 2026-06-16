---
model: claude-sonnet-4-6
---

Run test + review in parallel: $ARGUMENTS

## Instructions

`$ARGUMENTS` is `<story-id>`.

### Prerequisites

Verify every task has status `done` in the DB (`harness-cli query task --json`). If any task is
`pending`, `in_progress`, or `blocked`, abort:

- A `blocked` task means the coder's self-verify gate (type-check / lint) failed.
  Tell the user to fix the reported errors and re-run `/caw-code <story-id> <task>`
  before verifying.
- `/caw-verify` assumes the code already type-checks — it does not re-run the
  type checker. It only runs tests + multi-dim review.

### Spawn tester + reviewer in parallel

Use the Agent tool with two tool_use blocks in one message (true parallel execution):

1. **Tester**: `"Run the tester flow for task <story-id>"` (tester derives its test mode from the task `lane`)
2. **Reviewer**: `"Run the review flow for task <story-id>"`

Wait for both to complete.

### Durable verification gate (mechanical — runs BEFORE the verdict)

A green test suite + an approved review is **not sufficient** to declare
ready-to-commit. dava2 shipped DB leaks past `/caw-verify` because the gate was a
human reading code. The durable layer makes the gate mechanical: every task that
carries a `verify_command` must have recorded a `pass`.

If the durable CLI is present (`scripts/caw/bin/harness-cli`):

1. For any task whose work touches real I/O (a DB/integration test, a smoke
   step), ensure it has a `verify_command` recorded:
   `harness-cli task update --story-id <id> --task-key <key> --verify "<cmd>"`.
2. Run the gate: `harness-cli story gate --story-id <id>`.
   - **Exit 0** → all verifiable tasks pass → the gate is satisfied.
   - **Exit 2** → one or more tasks are not verified `pass`. Run
     `harness-cli task verify --story-id <id> --task-key <key>` for each, fix any
     `fail`, and re-run the gate.
3. The verdict CANNOT be `ready-to-commit` while the gate exits non-zero. If a
   task touches real I/O but carries no `verify_command`, the verdict is
   `blocked` with reason "proof-unverified" — do not approve on reading alone.

If the durable CLI is absent (pre-v2 project), fall back to the reviewer's
harness-compliance dimension and require the tester to attach the delta-count
evidence per `rules/common/test-tiers.md` check #8.

### Aggregate results

Read both `tests.md` and `review.md`. The combined verdict goes in the report
(prose); task state is already in the DB (tester/reviewer recorded it). Summarize:

```markdown
## Verify

**Tests:** <pass/fail counts, coverage %>
**Review:** <severity counts>
**Gate:** <harness-cli story gate result: passes | blocked (tasks) | vacuous>
**Verdict:** ready-to-commit | blocked | proof-unverified
```

`ready-to-commit` requires ALL of: tests green, no CRITICAL/HIGH review findings,
**and** the durable gate (`harness-cli story gate`) exits 0.

### Report

```
✅ Verify complete

Tests:
  - Backend: 18/18 passing (92% coverage)
  - Frontend: 12/12 passing (78% coverage)

Review:
  - 0 CRITICAL, 0 HIGH, 2 MEDIUM, 4 LOW
  - Plan amended: no
  - Follow-ups created: 6

Verdict: ✅ Ready to commit

Next: git commit (or address MEDIUM findings first)
```

If reviewer found CRITICAL/HIGH, output:

```
❌ Verify FAILED

Tests: 18/18 passing
Review: 1 HIGH (webhook signature not verified)

Plan amended: yes (added webhook-security task)
Action: /caw-code <story-id> webhook-security
Then: /caw-verify <story-id> (re-run)
```
