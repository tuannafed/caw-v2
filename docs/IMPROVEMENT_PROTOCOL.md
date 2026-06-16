# Improvement Protocol

The self-improvement loop that closes caw's feedback gap: friction and drift the
agents recorded become structured backlog proposals with a predicted impact, a
human reviews them, and the outcome is measured when they're closed. Ported from
repository-harness (Phase 5).

```
recorded friction (trace.harness_friction) + audit drift
  → harness-cli propose
  → proposed backlog item (with predicted_impact)
  → human review (query backlog --open)
  → implementation
  → harness-cli backlog close --outcome "<measured result>"
```

This is what caw v1 lacked: friction was written into a markdown backlog and then
"planner-side fix pending" forever, because nothing turned a repeated pain into a
tracked item with an owner and a prediction.

## Generate proposals

```bash
harness-cli propose
```

Rule-based, no model call. It looks for:
- **Recurring friction** — frictions clustered by token-overlap that appear in
  ≥2 traces (a one-off is not a proposal).
- **Audit drift** — every non-zero entropy category from `harness-cli audit`.

Each proposal carries: title, source, evidence, predicted impact, risk.

## File proposals

```bash
harness-cli propose --commit
```

Committed proposals become `proposed` backlog rows (exact-title duplicates are
skipped, so re-running is safe). Review them:

```bash
harness-cli query backlog --open      # proposed + accepted
harness-cli query backlog --closed    # implemented + rejected
```

## Review rules

- **Tiny** proposals (doc clarifications, small drift) may be implemented directly.
- **Normal** proposals need a task/plan or clear backlog acceptance.
- **High-risk** proposals (auth, data integrity, validation policy, source
  hierarchy) need a durable decision record (`harness-cli decision add`) before
  changing anything.
- Completed work MUST close the item with measured outcome evidence:
  ```bash
  harness-cli backlog close --id <n> --outcome "<what actually changed, measured>"
  ```

## Validate (close the predicted→actual loop)

After implementing, compare the prediction to reality:
- `harness-cli audit` — did entropy drop by what the proposal predicted?
- `harness-cli query friction`-equivalent (re-run `propose`) — did the friction
  stop recurring?

The `predicted_impact` (set at creation) and `actual_outcome` (set at close) sit
side by side in the backlog row. An implemented item with no `actual_outcome` is
itself flagged by `audit` — the loop polices its own closure.
