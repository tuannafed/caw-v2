# Harness Maturity Ladder

How caw progresses from static agent instructions to a measurable, self-improving
harness. Levels are verifiable — a level is achieved only when its criteria can be
inspected in repository files, durable records, or `harness-cli` output. Adapted
from repository-harness for caw's task→phase model.

`harness-cli maturity` estimates the current level from the durable layer + rules.

## Levels

### H0 — Bare environment
No harness. A prompt in, a patch out; the repo doesn't tell the agent how to
classify, validate, or record work.
- Criteria: no agent rules, no intake policy, no durable records.

### H1 — Scaffolding & policy
Static operating instructions, templates, risk lanes, source-of-truth rules.
Agents follow a documented workflow; durable state may still be manual.
- Criteria: `rules/common/harness-contract.md`, the 5 agents, `conventions.md`,
  task templates exist. (caw v1 lives here.)

### H2 — Specification layer
Plans cite spec verbatim; tests declare their tier; runtime smoke is mandated.
The harness says *what good looks like*.
- Criteria: `spec-traceability.md`, `test-tiers.md`, `runtime-smoke-test.md`
  present and wired into planner/reviewer. (caw v2 M0 reaches here.)

### H3 — Active observability
A durable layer agents write to and query. The harness can *score* a trace and
*show* friction in context, not just store it.
- Criteria: `harness.db` exists; `trace`, `score-trace`, `query` work;
  `TRACE_SPEC.md` defines tiers. (caw v2 M1+M4.)

### H4 — Mechanical verification
The harness *verifies* work, not just observes it. A phase carries a proof
command; a pre-close gate blocks approval without it.
- Criteria: `phase verify` + `task gate` exist and are wired into
  `caw-verify`/`reviewer`. (caw v2 M3.)

### H5 — Evolution infrastructure
The harness proposes safe improvements to itself from its own friction + drift,
and measures whether they helped.
- Criteria: `audit` (entropy) + `propose` (friction→backlog) +
  predicted→actual loop work; `lint` guards bounded growth. (caw v2 M2+M5+M6.)

## Where caw v2 lands

After v2 (M0–M6), caw satisfies the criteria through **H5**. The remaining
maturity work is operational: agents actually recording traces every task, the
`propose` loop being run and its proposals closed with measured outcomes, and the
entropy score trending toward 0 over time. Maturity is not just having the
machinery — it's the machinery being *used*, which `harness-cli audit` measures.
