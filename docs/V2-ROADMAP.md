# CAW v2 — Roadmap

Evidence-based plan for improving CAW from v1 (applied to Dava2, 80 tasks) into a
team-ready v2. Priorities are derived from the real Dava2 friction log, the
spec-backing audit (2026-05-27), performance measurements, and a full read of the
CAW source — not speculation.

## Diagnosis (what the evidence actually says)

The biggest v1 pain is **NOT** agents fabricating spec. The 2026-05-27
spec-backing audit shows 17 task plans = 15 ✅ spec-backed / 2 ⚠️ infra-choice /
**0 ❌ fabricated**. The `## Spec mandate` mechanism (`rules/common/spec-traceability.md`)
is working.

The real pain is **misinterpreting ambiguous client feedback**. Friction log
evidence:

> "Client-feedback digests need a quote-back gate (Q#4 misread cost a full day)" —
> a single mis-digested sentence overrode the client's verbatim words for every
> downstream agent.

Root cause: `spec-traceability` protects the **spec → plan** layer, but the real
input is **client replies (Slack, feedback docs)** — a layer *above* spec, often
ambiguous, with **no gate forcing the agent to confirm its interpretation before
turning it into a decision**.

Conclusion: v2 adds a gate at the **input** (feedback → interpretation), not in
the middle (spec → code). Every item below is patchable — nothing requires a
rewrite. Run each through CAW's own harness loop (intake → task → trace).

**State model (decided — see `docs/V2-REFACTOR-DESIGN.md`):** v2 uses the durable
layer (SQLite DB + `harness-cli`, the Python port) as the single source of truth
for state; `overview.yaml` is retired; markdown holds prose only. This is the
foundation the rest of the work builds on, so it leads as Wave 0.

## Progress

| Phase | Waves | Status |
| --- | --- | --- |
| P0 — foundation, pain, shipping | 0, 1, 2 | ✅ done |
| P1 — reliability & integrity | 3, 4 | ✅ done |
| P2 — technical debt | 5, 6 | ⏳ not started |

100 pytest tests pass. Work lives on branch `feat/v2-p0-durable-state` (not yet
merged). Wave 5/6 are deliberately deferred — see P2.

---

## P0 — Foundation, pain, and shipping

### Wave 0 — State Model Adoption (foundation for everything else)

Adopt the durable layer that already exists (Python port, 83 tests) but was never
wired into the agents. Dava's agents reference `harness-cli` zero times; state
lives in hand-edited `overview.yaml`. v2 closes that gap.

| Work | Lane | Status |
| --- | --- | --- |
| Teach all 5 agents to read/write state via `harness-cli` (replace `overview.yaml` references) | high-risk | ✅ done |
| Retire `overview.yaml` from planner output (demoted to legacy v1 fallback) | normal | ✅ done |
| Project test-matrix becomes a generated view (`harness-cli query matrix`) | normal | ✅ done (agent instruction) |
| Strip restated status from code.md/tests.md/review.md (prose points to DB) | normal | ✅ enforced by gate below |
| Anti-drift enforcement: `harness-cli lint` state-drift gate rejects status restated in prose ("one fact, one store") | high-risk | ✅ done (`scripts/harness/state_drift.py`, 8 tests) |

**Why first:** Wave 1's feedback gate and Wave 3's audit machinery both assume
queryable state in the DB. Without Wave 0 they have nothing to gate against.

**Status:** Wave 0 complete. The anti-drift gate (`harness-cli lint`) makes the
"one fact, one store" invariant mechanical so Option A cannot rot like v1.

### Wave 1 — Feedback Quote-Back Gate ⭐ (treats the most expensive pain)

`spec-traceability` for the feedback layer.

| Work | Lane |
| --- | --- |
| New rule `feedback-traceability.md`: every digest line ("client CONFIRMED/REJECTED X") must sit next to the verbatim quote it interprets | normal |
| planner adds an "Interpretation to confirm" section + quote-backs to the client with a concrete example before planning | normal |
| Gate: a phase marked `ambiguous` cannot enter `in_progress` until a client reply (pasted verbatim) resolves it | high-risk |
| reviewer (clean-context subagent) rejects any digest with no adjacent quote or one that contradicts an earlier quote | normal |

**Success:** an ambiguous sentence cannot silently become a decision — it must be
quote-backed and confirmed first.

### Wave 2 — Versioning + context safety (blocks shipping to the team)

| Work | Lane |
| --- | --- |
| `VERSION` file + `harness-cli --version` + `caw --version` | tiny |
| `--limit N` + default `LIMIT 20` on `query` (matches the Rust upstream behavior) | normal |
| `requirements-dev.txt` (pytest) + document how to run tests (venv) in README | tiny |

Why: CAW has no version → cannot answer "which build are you on?" during support.
`query` has no `LIMIT` → floods context on large repos (`query task --json` ≈ 18K
tokens on Dava-scale).

---

## P1 — Reliability & integrity

### Wave 3 — Close enforcement gaps

| Work | Lane | Gap |
| --- | --- | --- |
| Extract the 24 mandatory default skills to a **canonical YAML** + pre-flight check (≥24 installed) | normal | hardcoded in `setup.md` prompt → silent drift |
| Setup **ensures harness-cli** is installed + initialized (`harness-cli init`) | high-risk | agents depend on the CLI (Wave 0); setup must guarantee it |
| Make verify-commands **deterministic** (detect each run, not cached at setup) | normal | stale when tooling config changes |

Note: "v1/v2 state divergence detection" is gone — Wave 0 makes the DB the only
state store, so there is no `overview.yaml` to diverge from.

### Wave 4 — Distribution discipline (team stays in sync)

| Work | Lane |
| --- | --- |
| Release/tag instead of "git pull main"; `caw sync` pulls a tag | normal |
| CI runs pytest | normal |

---

## P2 — Technical debt (do NOT do early)

### Wave 5 — Skill-loading optimization

Deferred because it is **verified not to be the source of the pain**. Fixing it
now is fixing the wrong thing.

| Work | Lane |
| --- | --- |
| Move `triggers` into each SKILL.md frontmatter (kills the centralized META drift) | normal |
| Split stack-wide skills (copied at init) vs task-scoped skills (loaded on demand) → less over-copying | normal |

### Wave 6 — Clarify agent/command boundary

Architectural decision settled during v2 design. Do **not** convert all 5 agents
into commands — role separation is a quality lever, keep it.

| Role | v2 form | Why |
| --- | --- | --- |
| setup | Command | procedural, one-shot |
| planner | Command (main context) | needs quote-back dialogue — ties directly to Wave 1 |
| coder / tester | Subagent | isolated, parallelizable |
| reviewer | Subagent (keep firmly) | clean context = objective gate |

---

## Execution order

```
P0  Wave 0: State model adoption (DB)     ← foundation; agents use harness-cli
    Wave 1: Feedback quote-back gate      ← treats the Dava pain (priority #1)
    Wave 2: Version + query --limit       ← unblocks shipping
P1  Wave 3: Close enforcement gaps
    Wave 4: Release/tag + CI
P2  Wave 5: Skill-loading optimization    ← tech debt, do not do early
    Wave 6: Clarify agent/command boundary
```

Wave 0 leads because Wave 1 (feedback gate) and Wave 3 (audit machinery) both need
queryable state in the DB to gate against.

## Three things to remember throughout v2

1. **State lives in the DB, prose in markdown** (Option A, decided) — one fact,
   one store. `overview.yaml` is retired. This is the v1→v2 structural change.
2. The real pain is **misinterpreting ambiguous feedback**, not fabricating spec —
   v1 already prevents fabrication (0 fabricated in the audit). v2 gates the
   **input** layer, not the middle.
3. Everything is patchable; nothing requires a rewrite. Run each wave through
   CAW's own harness loop so CAW dogfoods itself.
