# Harness Contract — Pull-then-Push

The caw harness keeps living docs alive only if every agent both **reads** them
before acting and **updates** them after acting. Docs are input, not output of a
scan — an agent that finishes without pulling/pushing leaves the next agent blind.

> **How to invoke `harness-cli`.** Everywhere below, `harness-cli` means the stable
> project wrapper **`scripts/caw/bin/harness-cli`** (written by `/caw:setup`). ALWAYS
> call that path — never the version-specific cache binary
> (`…/plugins/cache/caw/caw/<version>/harness/bin/harness-cli`). The wrapper path is
> what the settings allowlist matches, so calling it runs without an approval prompt;
> the cache path changes every release and can't be allowlisted, so it prompts every
> time. Also use the documented flag form (`--story-id … --task-key … --status …`),
> not positional args.
>
> **Call it as a bare single command — NO pipes, NO redirects.** Write
> `scripts/caw/bin/harness-cli query story --json`, never
> `… query story --json 2>/dev/null | head -100`. A piped/redirected command is a
> *composite* the allowlist can't prefix-match, so it re-prompts every time even though
> the wrapper itself is allowlisted. The CLI already keeps output small and writes clean
> errors — you don't need `| head`, `| grep`, or `2>/dev/null`. To bound rows use the
> built-in `--limit N` (and `--json`/`--summary`) flags, not a pipe. If you truly must
> post-process, run the bare harness-cli call first, then process its output in a
> separate step.

## State vs prose — the ONE rule that prevents duplication

caw v2 splits every artifact by who reads it (ADR-0001):

- **STATE → `harness.db`** (read/write via `harness-cli`). Machine-queried, gated,
  audited data: story/task status, lane, proof results, backlog, intake, decision
  status, traces, interventions. **Never** record this in markdown.
- **PROSE → markdown** (read/write as files). Human-read rationale that does not
  change on every action: ADR *content*, `plan.md` approach, `code/tests/review.md`
  narrative, `.claude/rules/project.md`, `knowledge.md`, rules.

| Information | Where | Command / file |
| --- | --- | --- |
| Intake classification (type, lane) | DB | `harness-cli intake add` |
| Story + task status, proof | DB | `harness-cli story/task add\|update\|verify` |
| Test matrix (coverage index) | DB | `harness-cli query matrix` (generated, no markdown) |
| Backlog (friction → improvement) | DB | `harness-cli backlog add\|close` |
| Decision status + proof | DB | `harness-cli decision add\|verify` |
| Decision *content* (Context/Decision/Consequences) | markdown | `docs/caw/decisions/NNNN-<slug>.md` |
| Plan approach + `## Spec mandate` | markdown | `stories/<id>/plan.md` |
| Per-task narrative + smoke results | markdown | `stories/<id>/{code,tests,review}.md` |

A decision row's `doc_path` points at its markdown content; the markdown never
re-states the row's status. This is the single source-of-truth rule — if you find
yourself writing a status into markdown, stop and use `harness-cli`.

> **Migrating a v1 project** (markdown state already exists, e.g. dava2): run
> `harness-cli import --conductor docs/caw` once to load existing
> `overview.yaml` / `decisions/` / `harness-backlog.md` into the DB, then stop
> editing markdown state.

## Pull — read before working

State is pulled with `harness-cli query …`; prose is read from markdown.

| Agent      | Pull STATE (harness-cli) | Pull PROSE (markdown) |
| ---------- | --- | --- |
| `setup`    | — | `CLAUDE.md` |
| `planner`  | `query intake`, `query matrix`, `query decision` | `CLAUDE.md`, `.claude/rules/project.md`, `decisions/*.md` (ADR content), [`spec-traceability.md`](./spec-traceability.md) |
| `coder`    | `query story`/`query task` (status), `query decision` | `.claude/rules/project.md`, `plan.md`, relevant `decisions/*.md`; tests touch I/O → [`test-tiers.md`](./test-tiers.md); React UI → [`react-state-deps.md`](../react/react-state-deps.md) |
| `tester`   | `query task` (this task's proof state), `query matrix` | `plan.md` (test_scenarios), [`test-tiers.md`](./test-tiers.md) |
| `reviewer` | `query story`/`query task`, `story gate`, `query decision` | `plan.md`, `code.md`, `tests.md`, `decisions/*.md`, [`spec-traceability.md`](./spec-traceability.md), [`test-tiers.md`](./test-tiers.md), [`runtime-smoke-test.md`](./runtime-smoke-test.md); React UI → [`react-state-deps.md`](../react/react-state-deps.md) |

## Push — update before declaring done

State is pushed with `harness-cli …`; prose is written to markdown.

| Agent      | Push STATE (harness-cli) | Push PROSE (markdown) |
| ---------- | --- | --- |
| `planner`  | `intake add` (type+lane), `story add`, `task add` (one per task, with `--verify` where the task has mechanical proof) | `plan.md` opening with `## Spec mandate` ([`spec-traceability.md`](./spec-traceability.md)); `decisions/NNNN-*.md` content for any arch choice; for `normal`/`high_risk` a final `runtime-smoke-test` task ([`runtime-smoke-test.md`](./runtime-smoke-test.md)) |
| `coder`    | `task update --status` per task; **`story update --status in_progress` before the FIRST task of a `planned` story** (unlocks `record-trace`, which no-ops while the story is `planned`); **`story update --status implemented` once every task is `done`**; `task verify` for the smoke task; `decision add` for a mid-task cross-cutting choice | `code.md` per-task narrative + smoke results |
| `tester`   | `task verify` / proof results; (matrix is generated, nothing to write) | `tests.md` |
| `reviewer` | `story gate` (must pass to approve); advance `decision` status; `intervention add` when overriding the coder | `review.md`; may amend `plan.md` (`## Revisions`) |
| any agent  | `backlog add` on hitting friction; `backlog close --outcome` when resolved | — |

**No state in markdown.** Do not write story/task status, lane, proof results, or
decision status into any `.md`/`.yaml` file. Those live in the DB; markdown holds
prose only. There is **no `overview.yaml`** and **no hand-edited test-matrix** in
caw v2 — the per-task plan (skills_hint/depends_on/files) lives in `plan.md`
`## Plan`, and the coverage matrix is the generated `harness-cli query matrix`
view. (`harness-backlog.md` stays — it is the prose friction log, not state.) The
`harness-cli lint` state-drift gate enforces this. For a v1 project, `import`
migrates existing markdown state once.

## ADR triggers

Create an ADR when ANY of these is true:

- The Plan's `## Challenge` raises a HIGH-severity item requiring a choice
  between architecture options.
- An agent rejects an apparent default for a non-obvious option (hard-delete vs
  soft-delete, RTK Query vs TanStack Query).
- A choice will outlive the current task and constrain future tasks.
- Validation requirements are weakened or removed.
- A stack, framework, library, or external provider is selected.

Do NOT create an ADR for: cosmetic naming, routine within-task decisions (which
file a helper goes in), or choices fully derived from `.claude/rules/project.md`.

## Lane-gated pull depth

The pull list is filtered by the task's `lane` (set by planner via `harness-cli
story add`, read with `query story`) so a tiny task isn't forced to read every doc:

| Lane       | Pull depth |
| ---------- | ---------- |
| `tiny`     | `query story`/`query task` + `plan.md` + ADRs matching the affected file area only. |
| `normal`   | Full pull list above. |
| `high_risk`| Full pull list + scan `decisions/` for ADRs marked `Status: Proposed` (may still be in flight). |

## Conditional rules — load when the trigger applies

Beyond the baseline pull/push above, these rules load **only** when the task hits their
trigger. They encode hard-won failure modes; skipping a triggered rule is a reviewer finding.

| Rule | Load when | Owner agents |
| --- | --- | --- |
| [`spec-traceability.md`](./spec-traceability.md) | Always, for any feature/bug task with a `plan.md`. | planner (write `## Spec mandate`), reviewer (reject if missing/wrong) |
| [`test-tiers.md`](./test-tiers.md) | The task adds/edits any test that touches a DB or external I/O. | coder, tester, reviewer |
| [`runtime-smoke-test.md`](./runtime-smoke-test.md) | Lane is `normal`/`high_risk` **and** the task touches HTTP routes, DB schema, edge/worker code, env config, or response schemas. | planner (add task), coder (execute), reviewer (verify it ran) |
| [`react-state-deps.md`](../react/react-state-deps.md) | The project uses React **and** the task changes a component with `useEffect`/`useMemo`/`useCallback`. | coder, reviewer |

A project's `.claude/rules/project.md` records the stack-specific specifics each rule needs (the
smoke boot/curl commands, the test-tier file-suffix convention, the spec-index path). The
generic rules carry the universal discipline; `.claude/rules/project.md` carries the project shape.

## ADR numbering

- Filename `NNNN-<kebab-slug>.md`, where `NNNN` = highest existing number + 1.
- A second agent that needs a number while one is in flight must re-read
  `decisions/` before writing — do not cache.
- caw projects have only product ADRs. There is no separate "meta" ADR series.

## Failure mode

If an agent finishes without performing its pull or push, the reviewer raises a
finding:

| Missing | Severity | Effect |
| --- | --- | --- |
| `## Spec mandate` section missing from `plan.md` (feature/bug tasks) | `CRITICAL` | Task does not approve. Planner adds verbatim spec quotes per [`spec-traceability.md`](./spec-traceability.md). |
| Any task in `plan.md` not listed in `## Spec mandate` | `CRITICAL` | Task does not approve. Cite spec, classify as INFRA-CHOICE with justification, or drop the task. |
| `## Spec mandate` item classified ❌ FABRICATED | `CRITICAL` | Disallowed. Re-scope or remove the task. |
| `runtime-smoke-test` task missing on a `normal`/`high_risk` task that touches routes/schema/edge/env | `HIGH` | Add the task and run it before declaring done. |
| Tier-1 test reaches a real DB/service (partial mock), or a TDD-RED test was greened | `CRITICAL` | Reject per [`test-tiers.md`](./test-tiers.md); fix the mock / leave RED. |
| `useEffect`/`useMemo` keyed on an unstable object reference (React) | `HIGH` | Reject per [`react-state-deps.md`](../react/react-state-deps.md). |
| ADR for an arch change in **auth, data integrity, external contracts, or public API** | `CRITICAL` | Task does not approve. Add the ADR, re-review. |
| ADR for any other arch change | `HIGH` | Task does not approve until the ADR is added. |
| Feedback digest with no adjacent verbatim quote, or an AMBIGUOUS interpretation implemented without a confirmed client reply | `CRITICAL` | Reject per [`feedback-traceability.md`](./feedback-traceability.md); planner quote-backs and waits. |
| Phase/task status restated in prose (`code.md`/`tests.md`/`review.md`) | `MEDIUM` | `harness-cli lint` flags it; delete the restated status (prose references the DB, never copies it). |
| `tests.md` `## Coverage` line missing for a tested behavior | `MEDIUM` | Tester adds it before approval. |
| `harness-backlog.md` entry missing despite obvious friction | `LOW` | Suggested cleanup, non-blocking. |

Genuine governance is `CRITICAL` / `HIGH`. Hygiene is `MEDIUM` / `LOW`. The intent
is to keep the harness alive without turning it into a bureaucracy gate.
