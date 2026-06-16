# Project Docs

Harness policy and project documentation for a CAW project. Policy docs describe
*how to work*; durable state (story/task status, proof, decisions, traces) lives
in the DB and is queried with `scripts/caw/bin/harness-cli`.

## Policy docs (this folder)

| File | What it covers |
| --- | --- |
| `HARNESS.md` | The human–agent operating model: task loop, durable layer, growth-from-friction, done definition. |
| `FEATURE_INTAKE.md` | The intake gate — input types, risk checklist, and lane selection (tiny / normal / high_risk). |
| `ARCHITECTURE.md` | Architecture discovery questions and boundary rules (layering, parse-first, command/query). |
| `HARNESS_AUDIT.md` | What `harness-cli audit` checks and how the entropy score is computed. |
| `TOOL_REGISTRY.md` | Registering external project tools so agents can discover them. |

## Layout of a CAW project

```text
project/
  .claude/            # what Claude Code natively loads
    agents/  commands/  rules/  hooks/  settings.json
  docs/
    HARNESS.md  FEATURE_INTAKE.md  ARCHITECTURE.md  ...   # policy (this folder)
    conductor/        # prose the agents read/write
      conventions.md  knowledge.md  intake.md  adr.md
      harness-backlog.md
      decisions/      # ADR markdown (NNNN-*.md)
      stories/<story-id>/  plan.md  code.md  tests.md  review.md
    advisories/       # security advisories
  scripts/
    bin/harness-cli   schema/   harness/   # durable layer (CLI + SQLite)
  harness.db          # operational state (gitignored)
```

## Source of truth

- **State** (story/task status, lane, proof, decision status, traces, backlog) →
  the DB. Query it: `harness-cli query <table>`, `harness-cli matrix`.
- **Prose** (plan rationale, ADR content, narrative, conventions) → markdown
  under `docs/`.

One fact lives in exactly one place. Never restate task status in prose — the
`harness-cli lint` state-drift gate rejects it.
