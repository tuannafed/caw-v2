---
model: claude-sonnet-4-6
---

Run the harness self-maintenance pass: $ARGUMENTS

## Instructions

`/caw:maintain` surfaces the harness **evolution layer** as a single discoverable
step, so audit / maturity / proposal generation actually run instead of waiting for
someone to remember the manual commands in `docs/caw/HARNESS.md`.

`$ARGUMENTS` (optional):
- (no args) → report-only: run audit + maturity + proposal preview. Writes nothing.
- `--commit` → also file the generated improvement proposals as `proposed` backlog
  items (`harness-cli propose --commit`).

### Prerequisite

The durable layer must be operational. The wrapper is at `scripts/caw/bin/harness-cli`
(or the plugin binary). If `harness-cli --version` fails, tell the user to run
`/caw:setup` first.

### Step 1 — Audit (entropy / drift)

```bash
scripts/caw/bin/harness-cli audit
```

Reports a 0–100 entropy score (lower is better) over the durable state: orphaned
tasks, unverified phases, missing backlog outcomes, stale state. Summarize the score
and the top drivers if the score is non-zero.

### Step 2 — Maturity (H0–H5)

```bash
scripts/caw/bin/harness-cli maturity
```

Reports which maturity level the harness has reached (measured from observable
criteria, not self-assessed) and what's missing for the next level.

### Step 3 — Proposals (self-improvement loop)

```bash
# preview (default):
scripts/caw/bin/harness-cli propose
# or, with --commit, file them as backlog items:
scripts/caw/bin/harness-cli propose --commit
```

`propose` turns recurring friction + audit drift into improvement proposals (rule-
based, no model call), each with a predicted impact. With `--commit` they become
`proposed` backlog items so the predicted→actual outcome loop can close later.

### Step 4 — Report

Summarize for the user:

```
🔧 Harness maintenance

Audit:     <score>/100 — <one-line health>
Maturity:  <H-level> — <name>; next: <what's missing>
Proposals: <n> (previewed | filed as backlog items with --commit)

Next: address high-entropy drivers, or run /caw:maintain --commit to file proposals.
```

This command is **advisory** — it never edits code. It reads durable state and (only
with `--commit`) appends backlog proposals. Safe to run any time; run it periodically
(e.g. end of a milestone) to keep the harness healthy and capture improvement ideas.
