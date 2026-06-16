# Harness Audit

`scripts/caw/bin/harness-cli audit` detects drift in durable harness state (the DB)
plus the conductor markdown files, and prints an entropy score. Lower is better.

```bash
scripts/caw/bin/harness-cli audit                     # auto-detects docs/caw
scripts/caw/bin/harness-cli audit --conductor docs/caw
scripts/caw/bin/harness-cli audit --json
```

## Checks

DB-level (always run):

| Category | Meaning | Weight |
| --- | --- | --- |
| Orphaned tasks | `in_progress` tasks with no linked trace. | 10 |
| Unverified tasks | Tasks with a `verify_command` but no recorded result. | 5 |
| Unverified decisions | Decisions with a `verify_command` but no recorded result. | 5 |
| Backlog without outcome | Implemented backlog items with no `actual_outcome`. | 2 |
| Stale tasks | Unimplemented tasks whose latest linked trace is > 30 days old. | 3 |
| Open proposals | Backlog items stuck in `proposed` (never triaged). | 1 |

Conductor file-level (run when `docs/caw/` is present):

| Category | Meaning | Weight |
| --- | --- | --- |
| plan-done, no plan | A conductor task marked `*-done` but `plan.md` is absent. | 10 |
| plan, no spec mandate | A `plan.md` exists but has no `## Spec mandate` section. | 8 |
| Backlog unbounded | Legacy markdown backlog exceeds the bounded-growth line limit. | 4 |

## Score

```text
score = sum(count * weight) for every check, capped at 100
```

| Range | Interpretation |
| --- | --- |
| 0 | Perfect — records are traced, verified, and healthy. |
| 1-25 | Healthy — minor housekeeping remains. |
| 26-50 | Attention needed — drift is accumulating. |
| 51-100 | Action required — stale state undermines harness value. |

Audit findings feed `scripts/caw/bin/harness-cli propose`, which turns repeated drift
(and recurring trace friction) into proposed backlog items.
