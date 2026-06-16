---
model: claude-sonnet-4-6
---

Run the testing workflow: $ARGUMENTS

## Instructions

`$ARGUMENTS` is `<story-id>` (optional flags: `--red`, `--verify`).

### Prerequisites

Verify `plan.md` exists. Read `lane` from the DB (`harness-cli query story --json`).

### Delegate to tester agent

Spawn the **tester** agent: `"Run the tester flow for task <story-id>"`. The tester
derives its test mode from the task `lane` — there is no separate `tdd_mode`.

| `lane` | What tester does |
|---|---|
| `tiny` | No-op. Append "skipped per plan" to tests.md. |
| `standard` | Write E2E + unit tests for backend tasks (post-implementation). Verify pass. Mobile = unit only. |
| `risky` (red mode) | Write FAILING tests for all tasks BEFORE coder runs. Confirm all fail. |
| `risky` (green mode) | After coder completes, run all tests. Verify pass. Coverage report. |

For mobile tasks: unit tests only (Jest + @testing-library/react-native). No Playwright/Detox/Maestro.

### After tester completes

Tester writes `tests.md` with:
- Tests written
- Coverage per task
- Pass/fail counts
- Source fixes by tester (if it fixed localized bugs during the in-agent fix loop)

The tester runs only this task's spec files and fixes localized failures itself
— it loops back to the coder only for structural bugs (new file, API-contract
change, out-of-scope code).

Next step depends on flow:
- After `--red` (lane=risky) → `/caw-code <story-id>` to make tests pass
- After post-impl test, all green → `/caw-review <story-id>` (or `/caw-verify` for parallel)
- Tester reports a structural bug it could not fix → `/caw-code <story-id> <task>`
