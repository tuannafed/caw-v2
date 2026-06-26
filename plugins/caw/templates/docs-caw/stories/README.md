# Stories

A **story** is a cohesive unit of work — one feature, bug, chore, or refactor.
The `planner` creates one folder per story here; the `coder`/`tester`/`reviewer`
fill it in. Execution **state** (status, lane, per-task proof) lives in
`harness.db`, not in these files — query it with `harness-cli query matrix`.

## Layout

```
docs/caw/stories/
├── US-001-short-title/          ← a standalone story (flat)
│   ├── plan.md                  planner: spec + API contract + tasks + challenge
│   ├── code.md                  coder: files changed per task
│   ├── tests.md                 tester
│   └── review.md                reviewer
├── US-002-another-story/
└── epics/                       ← OPTIONAL grouping (see below)
    └── E01-domain-theme/
        ├── US-010-story-in-epic/
        └── US-011-another/
```

- **Story id**: `US-<NNN>-<slug>` (US = user story), NNN sequential.
- **Tasks**: the breakdown inside a story (db, backend, frontend, smoke…). They
  live in `plan.md`'s `## Plan` section and in the DB `task` table — there is no
  per-task folder.

## Epics (optional)

Create an epic folder **only when work genuinely spans several stories** and they
deserve a shared home:

```
docs/caw/stories/epics/E<NN>-<theme>/<US-NNN-slug>/
```

Epics are a **folder convention only** — the harness DB has no `epic` table, and a
`story` row is identical whether it sits flat or under an epic. Don't pre-create
empty epics; group lazily, from the real spec, when the need appears. A simple
one-off story stays flat at `docs/caw/stories/<story-id>/`.
