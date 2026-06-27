---
model: claude-sonnet-4-6
---

Run the review workflow: $ARGUMENTS

## Instructions

`$ARGUMENTS` is `<story-id>`.

### Prerequisites

Verify all coder tasks are complete (`harness-cli query task --json` shows each `done`). If not:

```
❌ Coding incomplete. Run /caw:code <story-id> --all first.
```

### Delegate to reviewer agent

Spawn the **reviewer** agent: `"Run the review flow for task <story-id>"`

Reviewer agent will:
1. Read the story `risk_lane` (it scopes the review — `normal` reviews security +
   architecture + harness-compliance, adding perf/a11y only for hot-path/UI
   changes; `high_risk` reviews all 7 dimensions). `tiny` never reaches review.
2. Read `code.md` to identify changed files
3. Multi-dim review (dimensions in scope for the lane): security, architecture,
   harness-compliance always; performance, accessibility, refactor per lane
4. Tag findings by severity (CRITICAL / HIGH / MEDIUM / LOW)
5. CRITICAL/HIGH → block commit + fix loop
6. MEDIUM/LOW → create follow-up tasks
7. May amend `plan.md` if plan needs changes (with `## Revisions` entry)
8. Write `review.md`

### Verdict outcomes

| Outcome | Action |
|---|---|
| All findings ≤ MEDIUM | ✅ Ready to commit. Follow-ups created for MEDIUM/LOW. |
| 1+ HIGH/CRITICAL | ❌ Block. Fix loop required. |

### After review completes

If verdict is block:
- Reviewer amended Plan (if needed) and added new task
- Re-run `/caw:code <story-id> <task>` to fix
- Then `/caw:verify <story-id>` to re-validate

If verdict is ready:
- Proceed to commit/PR (handled outside caw workflow)
