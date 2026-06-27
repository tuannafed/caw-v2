---
model: claude-sonnet-4-6
---

Fold completed stories into a canonical capability spec: $ARGUMENTS

## Instructions

`/caw:spec` answers one question that the per-story plan files can't: **"what does
this capability do RIGHT NOW?"** caw accumulates `plan.md` files per story, but after
N stories the current behaviour of a capability is scattered across all of them (plus
the reviewer's amendments). This command folds the *implemented* stories of one
capability into a single **canonical spec** at `docs/caw/specs/<capability>.md` — a
queryable "current truth" for humans and agents (and a good input for `/caw:maintain`).

Markdown-native, owner-driven, **read + synthesize only** — it does not touch the DB
or code. (Pattern: OpenSpec propose→apply→archive, where archive folds the delta into
a living spec.)

`$ARGUMENTS`:
- `<capability>` — the capability slug to (re)generate, e.g. `auth`, `billing`,
  `ticket-trash`. Maps to `docs/caw/specs/<capability>.md`.
- (no args) → list existing capability specs + suggest capabilities inferred from
  story titles that have no spec yet. Writes nothing.

### Prerequisite

The durable layer must be operational (`scripts/caw/bin/harness-cli --version`). If it
fails, tell the user to run `/caw:setup` first.

### Step 1 — Gather the capability's stories

A "capability" is a **prose grouping the owner names** — there is no `capability`
column in the DB (state → DB, prose → markdown; ADR-0001). Resolve membership from
what's already on disk + in state:

```bash
scripts/caw/bin/harness-cli query story --json
```

A story belongs to `<capability>` when ANY of these hold:
- it lives under `docs/caw/stories/epics/<capability>/…`, OR
- its `plan.md` / `overview.yaml` carries `capability: <capability>`, OR
- the owner names it when prompted (ambiguous → ask, don't guess).

Consider only stories whose DB status is **`implemented`** or **`changed`** — those
reflect shipped behaviour. **Skip `planned` / `in_progress`** (not real yet) and treat
**`retired`** as *removed* behaviour (fold it as a deletion, not a feature).

If you can't confidently resolve membership, list the candidate stories and ask the
owner to confirm before writing — a wrong fold corrupts the "current truth".

### Step 2 — Read each member story's truth

For each member story, read `plan.md` (`## Spec`, `## API contract`, the `## Plan`
tasks, and any `## Revisions` the reviewer appended) and `overview.yaml`. The
**reviewer's revisions win** over the original spec — they're the corrected truth.

### Step 3 — Fold into the canonical spec

Write/overwrite `docs/caw/specs/<capability>.md`. Describe the capability **as it
behaves now**, not as a changelog of stories. Suggested shape (adapt to the domain):

```markdown
# Capability: <capability>

> Canonical spec — current behaviour, folded from implemented stories.
> Regenerate with `/caw:spec <capability>`. Do not hand-edit below the line;
> per-story detail lives in docs/caw/stories/.

_Last folded: <stories included, by id>_

## What it does
<2–4 sentences: the capability's purpose + current behaviour.>

## Behaviours / rules
- <each invariant or rule the implemented stories established, deduped>
- <a `retired` story's behaviour is REMOVED here, not listed>

## API surface (if applicable)
<endpoints / contracts that currently exist, from the stories' API contracts>

## Source stories
| Story | Status | What it added/changed |
|---|---|---|
| US-00X-… | implemented | … |
```

Rules for the fold:
- **Dedupe + reconcile**, don't concatenate. If story B changed a rule story A set,
  state the *current* rule (B's), not both.
- A `retired` story's behaviour is **removed**, with a one-line note in Source stories.
- Keep it the *current* truth — no "in US-003 we added…" narrative; that's what the
  per-story plan files are for.
- If `docs/caw/specs/<capability>.md` already exists, regenerate it from the full
  member set (idempotent) — don't append blindly.

### Step 4 — Report

```
📜 Capability spec folded: <capability>

Stories folded: US-002, US-006, US-007 (3 implemented, 1 retired excluded as removed)
Spec: docs/caw/specs/<capability>.md  (created | updated)

Current truth captured: <one line>
```

This command is **advisory + prose-only** — it never edits code or the DB. Run it after
a capability's stories close (or any time the per-story picture has drifted from a
single "what does this do now") to keep one queryable source of current truth.
