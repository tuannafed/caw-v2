# Harness

The project goal is to provide a reusable operating harness that lets humans and
agents turn a future product spec into safe, validated work.

The app is what users touch. The harness is what agents touch.

> This is the **concept / contract** doc (mental model, lifecycle, commands you run).
> For the harness *code* itself — package layout, how the CLI is built, the test
> suite — see the developer README that ships with the plugin (`harness/README.md`).
> See also `GLOSSARY.md` for the shared vocabulary used throughout.

## Mental Model

```text
------------------+
| Human intent    |
+------------------+
         |
         v
+------------------+
| Feature intake   |
+------------------+
         |
         v
+------------------+
| Task plan        |
+------------------+
         |
         v
+------------------+
| Agent work loop  |
+------------------+
         |
         v
+------------------+
| Product delta    |
+------------------+
         |
         v
+------------------+
| Validation proof |
+------------------+
         |
         v
+------------------+
| Harness delta    |
+------------------+
         |
         v
+------------------+
| Next intent      |
+------------------+
```

Every task has two possible outputs:

1. Product delta: app code, tests, API shape, data model, or product docs.
2. Harness delta: docs, templates, validation expectations, backlog items, or
   decision records that make the next task easier.

## CAW v2 Scope

CAW v2 includes:

- Agent entrypoint.
- Empty product documentation structure.
- Feature intake and risk lanes.
- Task templates (task plan at `docs/caw/stories/<story-id>/plan.md`).
- Decision log template.
- Validation report template.
- Test matrix (generated via `harness-cli matrix`).
- Harness growth backlog.
- Durable layer: SQLite database (`harness.db` at project root) and CLI for operational records.

CAW v2 deliberately excludes:

- A project-specific `SPEC.md`.
- Pre-sliced product domains.
- A locked application stack.
- App source scaffolding.
- Package scripts.
- Test runner config.
- CI workflows.

Those should arrive only when a selected task needs them.

## Durable Layer

Policy documents describe how to work. The durable layer stores what happened.

Operational data — intake classifications, task status, task progress, decision
outcomes, backlog items, and execution traces — lives in a SQLite database
(`harness.db`) at the project root, managed by the CAW CLI at `scripts/caw/bin/harness-cli`.
Agents and humans should use that tool for Harness work. The database is local
to each project instance and `.gitignore`d. The schema is version-controlled
under `scripts/caw/schema/`.

This separation keeps policy docs stable and human-readable while giving agents
a structured, queryable record of operational state. It also prepares the
harness for future observability and automated evolution without adding more
markdown files.

Initialize the database if it does not exist:

```bash
scripts/caw/bin/harness-cli init
```

Common commands:

```bash
scripts/caw/bin/harness-cli init
scripts/caw/bin/harness-cli intake  --type <type> --summary <text> --lane <lane>
scripts/caw/bin/harness-cli story add --id <id> --title <text> --lane <lane>
scripts/caw/bin/harness-cli story update --id <id> --status <status>
scripts/caw/bin/harness-cli story gate --story-id <id>
scripts/caw/bin/harness-cli story verify-all
scripts/caw/bin/harness-cli task   add --story-id <id> --task-key <name> [--verify "<cmd>"]
scripts/caw/bin/harness-cli task   update --story-id <id> --task-key <name> --status <status>
scripts/caw/bin/harness-cli task   verify --story-id <id> --task-key <name>
scripts/caw/bin/harness-cli decision add --id <id> --title <text> --doc-path docs/caw/decisions/<file>.md
scripts/caw/bin/harness-cli decision verify --id <id>
scripts/caw/bin/harness-cli trace   --summary <text> --outcome <outcome>
scripts/caw/bin/harness-cli score-trace
scripts/caw/bin/harness-cli audit
scripts/caw/bin/harness-cli propose
scripts/caw/bin/harness-cli matrix
scripts/caw/bin/harness-cli query   backlog
scripts/caw/bin/harness-cli query   tool --summary
scripts/caw/bin/harness-cli query   intervention
scripts/caw/bin/harness-cli query   trace
scripts/caw/bin/harness-cli backlog  add --title "<text>" --pain "<text>" --risk <lane>
scripts/caw/bin/harness-cli backlog  close --id <id> --outcome "<text>"
scripts/caw/bin/harness-cli tool     register --name <name> --command <cmd> --description <text> --responsibility Verification
scripts/caw/bin/harness-cli tool     remove --name <name>
scripts/caw/bin/harness-cli intervention add --source <human|reviewer|ci|agent> --summary <text> [--story-id <id>] [--trace-id <id>]
scripts/caw/bin/harness-cli lint
scripts/caw/bin/harness-cli maturity
scripts/caw/bin/harness-cli --version
```

## Source Hierarchy

```text
User-provided spec or prompt
  input material for first buildout or future changes

docs/product/*
  current product contract derived from accepted input

docs/caw/stories/<story-id>/plan.md
  story-sized work packets and execution plans

scripts/caw/bin/harness-cli matrix
  behavior-to-proof control panel backed by the durable layer

docs/caw/decisions/*
  why the contract changed

docs/caw/
  all conductor prose (stories, tasks, decisions, rules, traces)
```

Before implementation, product docs describe intent. After implementation,
product docs plus executable tests become the living contract.

## Spec Lifecycle

CAW v2 starts without a tracked project spec. When the human provides a
specification, treat it as input material, not as a permanent operating manual.
Use it to populate product docs, task plans, architecture decisions, and
validation expectations during the first buildout.

After the specification has been decomposed, do not keep extending it as the
living product plan. Ongoing work should update the smaller product docs,
task plans, durable proof records, and decision records.

Ongoing work should enter the harness as one of these input types:

- New spec: a project specification that needs to become product docs and
  initial task candidates.
- Spec slice: a selected behavior from the provided spec.
- Change request: a bounded behavior change, bug fix, or product refinement.
- New initiative: a larger product area that needs multiple tasks.
- Maintenance request: dependency, architecture, performance, security, or
  operational work.
- Harness improvement: a process, template, proof, or agent-instruction change.

The spec-to-work loop is:

```text
human intent or supplied spec
  -> classify input type
  -> update or create product contract
  -> create task plan or initiative notes when needed
  -> define validation proof
  -> implement or document the blocker
  -> update product docs, task plans, durable proof records, and decisions
  -> capture harness friction
```

Large product areas should use scoped initiative notes instead of a second
monolithic specification. An initiative should explain the goal, affected
product docs, candidate tasks, validation shape, open decisions, and exit
criteria. If initiative work becomes a repeated pattern, add a template or
record the proposal with `scripts/caw/bin/harness-cli backlog add`.

## Growth Rule

The harness grows from friction.

When an agent is confused, repeats manual reasoning, needs a new validation
command, discovers a missing rule, or sees a recurring failure pattern, it must
either improve the harness directly or record the friction:

```bash
scripts/caw/bin/harness-cli backlog add --title "<short name>" --pain "<what was hard>"
```

Use the backlog outcome loop for improvements that are expected to change agent
behavior or validation results:

1. When creating the backlog item, fill `--predicted` with the measurable
   impact expected from the improvement.
2. When closing the item, fill `--outcome` with the actual measured result or
   review evidence.
3. Use `scripts/caw/bin/harness-cli query backlog --open` to review proposed and accepted
   items, and `scripts/caw/bin/harness-cli query backlog --closed` to compare predictions
   with outcomes after implementation.

The `harness_friction` field on traces also captures per-task friction so
patterns can be queried later:

```bash
scripts/caw/bin/harness-cli query trace   # friction shows in trace rows
```

Backlog risk uses the same lane vocabulary as intake and tasks:
`tiny`, `normal`, or `high_risk`. Use `--risk tiny` for low-risk follow-up
items; `low` is not a valid lane.

## Task Loop

For every task:

1. Classify the request with `docs/caw/FEATURE_INTAKE.md`.
2. Record the classification with `scripts/caw/bin/harness-cli intake`.
3. Locate the affected product docs and task plan files.
4. Check proof status with `scripts/caw/bin/harness-cli matrix`.
5. Work only inside the selected lane: tiny, normal, or high_risk.
6. Before finishing, ask whether product truth, validation expectations,
   architecture rules, repeated failure patterns, or next-agent instructions
   changed.
7. Create or update tasks as work progresses with `scripts/caw/bin/harness-cli task add/update`.
8. Record a trace with `scripts/caw/bin/harness-cli trace`, using
   `docs/caw/TRACE_SPEC.md` for the expected trace tier and field depth.
9. Review the trace score printed by `scripts/caw/bin/harness-cli trace`; use
   `scripts/caw/bin/harness-cli score-trace --id <id>` only when re-checking a
   specific historical trace.
10. If harness friction was found, either fix it directly or record it with
    `scripts/caw/bin/harness-cli backlog add`.

## Task and Phase Verification

Tasks contain tasks, and tasks may carry a mechanical proof command:

```bash
scripts/caw/bin/harness-cli story add --id T-012 --title "Task with tasks" --lane normal
scripts/caw/bin/harness-cli task add --task T-012 --name implementation --verify "pytest tests/"
scripts/caw/bin/harness-cli task update --task T-012 --task implementation --status in_progress
scripts/caw/bin/harness-cli task verify --task T-012 --task implementation
```

`task verify` runs the command from the repository root, records
`last_verified_at` and `last_verified_result`, and exits 0 on pass or 1 on fail.
When `trace --task <id>` links to a task whose task verification commands have
never passed, the trace still records but prints an advisory warning before close.

Use `story verify-all` before merges, maturity claims, and benchmark runs. It
runs every configured task verification command, prints one result per task,
skips tasks without `verify_command`, and exits 1 if any configured task
fails.

Proof is mechanical, not a hand-set flag: a task carries a `verify_command`
(set with `task add --verify` or `task update --verify`), and `task verify`
runs it and records `pass`/`fail`. The coverage matrix is the generated view
`scripts/caw/bin/harness-cli matrix` — derived from task + task state, never
hand-edited.

## Observability and Evolution Commands

Tool discovery:

```bash
scripts/caw/bin/harness-cli query tool --summary
scripts/caw/bin/harness-cli query tool --json
scripts/caw/bin/harness-cli tool register --name <name> --command <cmd> --description <text> --responsibility Verification
scripts/caw/bin/harness-cli tool remove --name <name>
```

Drift and quality checks:

```bash
scripts/caw/bin/harness-cli audit
scripts/caw/bin/harness-cli lint
scripts/caw/bin/harness-cli maturity
```

`audit` reports drift categories and an entropy score documented in
`docs/caw/AUDIT.md`. `lint` checks for common harness inconsistencies.
`maturity` assesses proof readiness and trace quality.

> **Run these via `/caw:maintain`.** Rather than remembering to run audit /
> maturity / propose by hand, use the `/caw:maintain` command — it runs all three
> as one discoverable step (report-only, or `--commit` to file proposals). The raw
> commands above remain available for scripting / CI.

Interventions are separate from traces:

```bash
scripts/caw/bin/harness-cli intervention add --source human --summary "<what was overridden>" --story-id <id> [--trace-id <id>] [--rationale <text>]
scripts/caw/bin/harness-cli query intervention
```

Record an intervention when a human, reviewer, CI system, or another agent
corrects, overrides, escalates, or approves work.

Improvement proposals:

```bash
scripts/caw/bin/harness-cli propose
scripts/caw/bin/harness-cli propose --commit
```

`propose` prints deterministic proposals from repeated friction, interventions,
and audit drift. `--commit` creates proposed backlog items only; it does not
edit policy docs or approve the proposal.

## Decision Records

High-risk work needs durable decisions when it changes behavior or architecture.
For auth, authorization, data ownership, API shape, audit/security, or
validation changes, record the decision in both places:

1. Add a markdown file under `docs/caw/decisions/` from
   `docs/caw/templates/adr.md` template.
2. Add or refresh the durable record:

```bash
scripts/caw/bin/harness-cli decision add \
  --id 0008-auth-boundary \
  --title "Auth Boundary" \
  --doc docs/caw/decisions/0008-auth-boundary.md \
  --notes "Accepted during task T4 authentication work."

scripts/caw/bin/harness-cli decision verify 0008-auth-boundary
```

The trace `--decisions` field is useful evidence, but it is not the decision
log. Do not treat decision text in a trace as satisfying the durable decision
record requirement.

## Harness Change Policy

Agents may update directly:

- Task and task status and evidence via `scripts/caw/bin/harness-cli story update` and
  `scripts/caw/bin/harness-cli task update`.
- Test matrix rows via `scripts/caw/bin/harness-cli story add`, `scripts/caw/bin/harness-cli task add/update`.
- Links from task plans to product docs.
- Validation notes and reports.
- Small clarifications tied to the current task.
- Intake records, traces, and backlog items via `scripts/caw/bin/harness-cli`.

Agents should ask for human confirmation before:

- Changing architecture direction.
- Removing validation requirements.
- Changing the source-of-truth hierarchy.
- Changing risk classification rules.
- Replacing the feature workflow.

## Done Definition

A task is done only when:

- The requested change is completed or the blocker is documented.
- Relevant docs, task plans, and test matrix entries remain current.
- Validation commands were run when they exist.
- A trace has been recorded with `scripts/caw/bin/harness-cli trace`.
- Missing harness capabilities were recorded with
  `scripts/caw/bin/harness-cli backlog add`.
- All tasks have been created or updated via `scripts/caw/bin/harness-cli task add/update`.
- The final response says what changed and what was not attempted.

## Future Validation Ladder

No validation scripts exist yet. When implementation begins, the expected ladder
is:

```text
validate:quick
  format, lint, typecheck, unit tests, architecture check

test:integration
  backend, database, provider, or service checks as the stack requires

test:e2e
  user-visible end-to-end flows

test:platform
  shell, mobile, desktop, or deployment smoke checks as the stack requires

test:release
  full suite, log checks, and performance smoke
```

Agents must not claim these commands pass until they exist and have been run.
