# Trace Specification

The `trace` table records what happened during a caw task. This document defines
the expected depth per field and the quality **tiers** that `harness-cli
score-trace` enforces mechanically. Ported from repository-harness (Phase 2/3).

A trace is the evidence the next agent (and the audit/propose loop) reads. Record
one at the end of any non-trivial task with `harness-cli trace`.

## Field reference

| Field | Required | Notes |
| --- | --- | --- |
| `task_summary` | Yes | One sentence, ≥10 chars, names the outcome. |
| `outcome` | Yes | One of `completed`, `blocked`, `partial`, `failed`. |
| `task_id` | Standard+ when work maps to a task | Links to `task.id`; lets scoring know the lane. |
| `intake_id` | Standard+ when an intake was recorded | Links to `intake.id`. |
| `agent` | Standard+ | Short agent/tool name (`coder`, `reviewer`, …). |
| `actions_taken` | Standard+ | Comma list → stored as JSON array. |
| `files_read` | Standard+ | Comma list of paths/commands. |
| `files_changed` | Standard+ | Comma list of changed paths; omit only if nothing changed. |
| `decisions_made` | Detailed | Scope decisions, validation choices, explicit non-goals. |
| `errors` | Standard+ if errors occurred; Detailed always | Use `none` for explicit no-error evidence. |
| `harness_friction` | Standard+ when friction exists; Detailed always | What was hard/missing/ambiguous; `none` if actively checked. |
| `duration_seconds` | Detailed when available | Estimate or measured. |
| `token_estimate` | Detailed when available | Estimate. |
| `notes` | Optional | Anything that doesn't fit above. |

## Quality tiers (what `score-trace` checks)

### Minimal (tier 1)
- `task_summary` filled, ≥10 chars.
- `outcome` filled.

Acceptable for tiny-lane tasks with no/low-risk changes. **Not** acceptable for
normal/high-risk work or any task that hit friction or errors.

### Standard (tier 2) — Minimal plus:
- `agent`.
- `actions_taken`, `files_read`, `files_changed` (as comma lists).
- at least one of `errors` / `harness_friction`.

Required for normal-lane tasks, and for tiny tasks that changed harness rules,
validation expectations, or durable records.

### Detailed (tier 3) — Standard plus:
- `decisions_made`.
- `errors` always present (use `none` if clean).
- `duration_seconds` and `token_estimate` when available.

## Lane → required tier

| Lane | Required tier |
| --- | --- |
| `tiny` | minimal (1) |
| `normal` | standard (2) |
| `high_risk` | detailed (3) |

`harness-cli trace` auto-scores on write and prints whether the trace meets its
lane requirement, listing the exact missing fields. Re-check any trace with
`harness-cli score-trace [--id N]`. A high-risk task whose trace is only standard
is flagged ❌ — the agent had no way to know it fell short before; now it does.
