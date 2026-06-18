# Glossary

Shared vocabulary for caw v2. Terms agents and humans should use consistently.

| Term | Meaning |
| --- | --- |
| **Harness** | The operating layer agents touch: rules (policy) + durable DB (state) + CLI. "The app is what users touch; the harness is what agents touch." |
| **Durable layer** | `harness.db` (SQLite) + `harness-cli`. Holds operational **state** agents produce/query. Per-project, gitignored. |
| **State vs prose** | State = machine-queried/gated data (status, lane, proof, backlog) → DB. Prose = human-read rationale (ADR content, plan, narrative) → markdown. Each fact has one source. |
| **Intake** | The gate every request passes before code: classify `input_type` + `risk_lane`. The human doesn't classify risk; the harness does. |
| **Lane** | Task size/risk: `tiny` \| `normal` \| `high_risk`. Drives pull depth, test tier, and required trace tier. |
| **Task → phase** | caw's work unit. A task owns many phases (db, backend, frontend, smoke…). Finer than repository-harness's story-centric model; proof attaches per phase. |
| **Phase verify_command** | A mechanical proof command on a phase. `phase verify` runs it and records pass/fail. |
| **Gate** | `task gate` exits non-zero unless every phase with a verify_command recorded `pass`. The pre-close check that blocks approval without proof. |
| **Trace** | A durable record of an agent's execution (actions, files, errors, friction, outcome). Auto-scored against the lane's required tier. |
| **Trace tier** | minimal (1) / standard (2) / detailed (3). Lane sets the minimum: tiny→1, normal→2, high_risk→3. |
| **Backlog outcome loop** | A backlog item records `predicted_impact` at creation and `actual_outcome` at close — so the harness can tell whether a change helped. |
| **Entropy / audit** | `audit` sums weighted drift (orphaned tasks, unverified phases, missing outcomes, stale state) into a 0–100 score. Lower is better. |
| **Propose** | `propose` turns recurring friction + audit drift into `proposed` backlog items with a predicted impact. The self-improvement loop. |
| **Intervention** | A durable record of a human/reviewer/CI override of agent work. Kept separate from traces so "where did a human step in?" is queryable. |
| **Maturity (H0–H5)** | How far the harness has evolved, from bare environment (H0) to evolution infrastructure (H5). Measured, not self-claimed. |
| **Spec mandate** | The `## Spec mandate` block every plan opens with: verbatim spec quotes + file:line per phase. caw-specific; blocks fabricated scope. |
| **Product delta vs harness delta** | Every task outputs both: product delta (code/tests/API) and harness delta (docs/backlog/decision/trace that make the next task easier). |
