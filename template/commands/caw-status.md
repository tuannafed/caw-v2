---
model: claude-haiku-4-5
---

Show task status: $ARGUMENTS

## Instructions

`$ARGUMENTS` is `<story-id>` (optional — if omitted, list all tasks).

### Single task mode

If `<story-id>` provided:

1. Read task + task state from the DB:
   `harness-cli query story --json` and `harness-cli query task --json`
2. Read `tests.md` `## Coverage` for behavior-level coverage (prose; may not exist
   yet if the tester has not run)
3. Display:
   - Title, type, lane (from `query story`)
   - Phase table with status per task (pending/in_progress/blocked/done) — from `query task`
   - Coverage lines for this task from `tests.md`
   - Files generated so far (the `stories/<id>/` prose files)
   - Next recommended command

Example output:

```
Task: task-042-stripe-subscription
Type: feature | Lane: standard

Phases:
| Phase     | Status       | Files |
|-----------|--------------|-------|
| db        | done         | apps/api/prisma/schema.prisma + migration |
| backend   | blocked      | apps/api/src/subscriptions/* — type-check failed |
| frontend  | needs-rework | apps/web/src/features/subscription/* |
| integrate | pending      | - |

Coverage (tests.md ## Coverage):
| Behavior                          | Layer | Result | Evidence            |
|-----------------------------------|-------|--------|---------------------|
| Creates Stripe checkout session   | e2e   | green  | checkout.spec.ts    |
| Webhook updates status atomically | unit  | red    | (pending green)     |

Plan revisions:
  - reviewer @ 2026-05-10T16:30 — added security-hardening task

Next: /caw-code task-042-stripe-subscription frontend
```

### List mode (no story-id)

Show all tasks with summary status from the generated matrix:
`harness-cli query matrix` (one row per task: lane, status, tasks, verified) and
`harness-cli query story` for titles. Do not read per-task files for the list view.

```
Active tasks:
  task-040-add-2fa             | risky    | code-done   | next: /caw-verify
  task-041-fix-checkout-redirect | tiny    | review-done | ready to commit
  task-042-stripe-subscription | standard | needs-rework | next: /caw-code task-042 frontend

Recently completed:
  task-039-update-deps         | tiny     | committed   | merged 2 days ago
```
