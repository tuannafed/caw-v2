# Harness Benchmark Spec — URL Shortener

A single product spec run through **both** harnesses (repository-harness, the Rust
original, and CAW) on the same brownfield-style project, to compare workflow
discipline and output quality apple-to-apple.

- **Date:** 2026-06-14
- **App under test:** URL Shortener (TypeScript, API + SQLite, no UI)
- **Harness A:** repository-harness (Rust CLI, story model)
- **Harness B:** CAW (Python CLI, story→task model + 5-agent pipeline)
- **Rule:** identical spec, identical 3 lanes, identical scoring. Only the harness
  differs.

---

## 1. The product

A minimal URL shortener exposed as a small TS module (pure functions + an
in-memory/SQLite store seam — no HTTP server needed; tests drive it directly).

### Core entities

```
ShortLink { id, slug, target_url, created_at, hits, deleted_at }
```

### Behaviors (the product contract)

| ID | Behavior | Lane |
| --- | --- | --- |
| B1 | Create a short link: given a valid URL, generate a unique slug, store it. | normal |
| B2 | Resolve a slug → target URL, increment `hits`. Unknown slug → not found. | normal |
| B3 | Reject invalid input at the boundary: non-URL, empty, or unsafe scheme (`javascript:`, `data:`) → 400-style error, nothing stored. | normal |
| B4 | List links (most-recent first), capped, excluding soft-deleted. | tiny |
| B5 | Soft-delete a link (sets `deleted_at`); a deleted slug resolves to not-found; **bulk soft-delete** with a dry-run default + audit entry per link. | high-risk |

---

## 2. The three lane test cases

Run each as a separate work item through the harness's intake → plan → implement
→ verify → trace loop.

### Case TINY — B4 list links
- Input type: change request.
- Smallest slice; intake + direct patch, no full plan/story packet.
- Proof: 1–2 unit tests.

### Case NORMAL — B1 + B2 + B3 (create / resolve / validate)
- Input type: spec slice.
- A story/task with a real verify command (`run the unit tests`).
- Validation at the boundary (parse-first); reuse one schema for create + validate.
- Proof: unit tests cover valid + invalid + unknown-slug.

### Case HIGH-RISK — B5 bulk soft-delete + cascade audit
- Input type: change request.
- Risk flags expected: Data model (deletion), Audit/security (audit per delete),
  Existing behavior (resolve must skip deleted). → forced high-risk.
- Must produce a **durable decision record** (soft-delete vs hard, dry-run
  default, audit-per-link) and a high-risk plan/packet.
- Proof: unit + integration (the executor over injected store/audit ports);
  E2E/live deferred (documented, not faked).

---

## 3. What we measure (both harnesses, same rubric)

### A. Workflow discipline (does the harness enforce the loop?)
| Metric | How measured |
| --- | --- |
| Lane discrimination | Did each lane produce the right artifacts (tiny=intake only; normal=story/task + standard proof; high-risk=full packet + decision)? |
| Proof is mechanical | Did `verify` actually run the test command and record pass/fail (not a hand-set flag)? |
| Trace tier enforced | Did the trace meet the lane's required tier? |
| Drift measured | Did `audit` report + did the entropy score move to 0 after cleanup? |
| Friction captured | Were real harness frictions filed as backlog items? |
| Git footprint | How many non-source files added; is state (db/binary) gitignored? |

### B. Output quality (what did the agent actually build?)
| Metric | How measured |
| --- | --- |
| Correctness | All behavior tests pass. |
| Boundary safety | B3 rejects unsafe schemes; nothing stored on invalid input. |
| Reuse over rewrite | One validation schema reused for create + validate (not duplicated). |
| Test quality | Tier-1 tests hermetic; deletion test asserts state delta, not just no-throw. |
| Honest proof | Deferred proof (E2E/live) documented, not faked as done. |

### C. Friction log
Every real problem hit while driving each harness, with severity + root cause —
the most valuable output (mirrors the existing flow-test report).

---

## 4. Procedure (run identically for A and B)

1. Install/scaffold the harness into a fresh sandbox copy of the app.
2. TINY: intake → patch B4 → 1 test → verify → trace.
3. NORMAL: intake → plan/story → implement B1–B3 → unit tests → verify → trace.
4. HIGH-RISK: intake (expect high-risk) → full packet + decision → implement B5
   (plan + executor over ports) → unit+integration → verify → decision record →
   trace.
5. `audit` → drive entropy to 0; file friction as backlog.
6. Capture the final durable state + the rubric scores + the friction table.

Output: one report per harness, same section structure, plus a head-to-head
summary table.

## 5. Fairness rules

- Same app skeleton for both (copy, don't share state).
- Same behaviors, same lanes, same acceptance tests.
- Implement to the spec, not to the harness — don't tailor code to make one look
  better.
- Record friction honestly for both, including for CAW (the home team).
