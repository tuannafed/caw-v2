---
paths:
  - "**/stories/**/plan.md"
  - "**/stories/**/code.md"
---
# Rule: Runtime Smoke Test (mandatory checklist after verify)

**Layer:** rules — non-negotiable, project-wide
**Used by:** planner (must include the task), coder (must execute), reviewer (must check it
exists), tester (must reference).
**Why this exists:** a task can ship with 100% of unit tests passing **and** reviewer-approved,
then surface a dozen runtime bugs in a single local smoke session — all from bug classes that
mock-heavy unit tests structurally cannot catch. Passing tests prove the layers each work; they
do not prove the layers **connect**. Reviewer reads code statically; it does not execute a
request. This rule inserts one cheap manual gate that catches contract drift before it reaches
users.

> **Provenance:** ported into caw from a real project (dava2) where a task shipped 614/614 unit
> tests green + approved, then a single smoke session found 14 runtime bugs. The stack-specific
> commands below (a particular web framework, an edge worker, an object store) are that project's
> shape — **replace them during `caw setup` with your stack's boot/curl/inspect commands**; the
> *gate and the bug-class library* are universal.

---

## ⚠ Smoke runs LOCAL ONLY — never against dev / staging / prod

Run this checklist on a developer machine against **local** services only.

- ❌ Never reset / wipe / truncate / drop a **shared** database — it destroys data other testers
  are exercising.
- ❌ Never restart a shared service to "boot it clean" — read logs instead.
- ❌ Never point a test domain at a shared environment via hosts/DNS edits.

A read-only **post-deploy spot-check** for shared environments is at the bottom of this file.

---

## The rule

Every task whose lane is `normal` or `high_risk` **MUST include a final task named
`runtime-smoke-test`** in its plan/overview. It runs *after* verify approves, is the last gate
before declaring done, and is owned by a human or an agent that actually executes the code (not
one that only mocks).

Tiny tasks may skip the task if they touch **none** of: HTTP routes, DB schema, edge/worker
code, env config, response schemas. Document the skip in `code.md`.

A bug found during smoke is a `BLOCKER`: fix and re-smoke before commit.

---

## The smoke checklist (≈5 minutes after verify approves)

Run each step explicitly. Any failure → STOP, treat as BLOCKER. Adapt the commands to your stack
(your project's `conventions.md` should record the exact ones).

### 1. Database — migrations + seed apply clean (LOCAL only)
Reset the local DB only when the task touched a migration, a schema column, or the seed file.
Otherwise use an idempotent insert. Verify: all migrations apply with no constraint violation;
every seed row commits.

### 2. Backend — boots without throwing
Start the app, watch for ~20s. Verify: it reaches "listening"; no env-validation error at
startup; no plugin/registration error.

### 3. Edge / worker (if the task touches it) — boots without warning
Verify: it reaches ready; no "config fetch failed / invalid URL undefined" in logs; required
secrets/vars are loaded.

### 4. Service↔service contract — happy-path request
For each surface the task touches, send at least one real request with realistic headers.
Verify: expected status + headers. A serialization error here usually means response shape vs
schema mismatch (commonly a date object vs string, or a nullable field not declared).

### 5. Fire-and-forget side effects
If the task adds any async write (visit log, analytics, audit), trigger it then inspect the
store. Verify: the row lands within a couple seconds and **records the same value the user
received** (don't re-derive it on the write path).

### 6. Dashboard / UI surface — loads, no 500
If the task touches a dashboard page, open it logged in. Verify: renders with data, no error
toast, no 500 on the underlying API call.

### 7. Frontend form (if the task adds/changes a form)
Verify: valid submit succeeds and the list updates; switching tabs/modes preserves fields the
user filled; validation errors render inline. A 400 on submit usually means the client sends `""`
where the backend expects `null` (or vice-versa).

---

## What to do when the checklist fails

1. **Stop.** Do not commit, do not declare done.
2. **Document the bug** in `code.md` under a "post-verify hotfix" section: symptom, root cause,
   file changed, the failing step number.
3. **Add a contract test** that would have caught it — load the *real* app chain (no
   middleware/handler mocks), mock only the persistence layer, drive it with a realistic payload,
   name the test after the bug.
4. **Re-run the full smoke checklist** end to end.
5. **Append to the harness backlog** if the bug class is new.

---

## Bug class library — runtime failures mock-heavy tests cannot catch

When you change anything in these areas, smoke-test the matching scenarios. These classes are
universal; the parenthetical examples are illustrative.

### A. Schema nullability / shape drift
When a column's nullability or type changes, update **all** layers in the same change: DB schema,
migration, backend request **and** response schemas, service input types, frontend submit payload
(`""` vs `null`), frontend display (handle null without crashing). Smoke: reset DB, GET the
resource, confirm no serialization 500.

### B. Framework lifecycle violations
Web frameworks are strict about hook/middleware lifecycle. Avoid mixing callback + promise
signatures, sending a response after the body parser is still running, or sending inside an
error hook. Smoke: POST a body, watch for a content-length / lifecycle error or a process crash.

### C. Service↔service HTTP contract
A separate runtime (edge worker, microservice) is a different process. Verify: the request URL
includes all required query params; the body uses the absent-field convention the schema expects
(`undefined` vs `null`); the response is serialized to the types the caller expects (dates →
ISO strings); shared secrets match exactly; **log/audit payloads match what the user actually
received**, not a re-derived value. Smoke: curl caller → curl callee with the same payload; then
read the persisted row and confirm it equals what was returned to the user.

### D. Env loading order
Know which config source loads when: app config at module import, test env under the test runner
only, edge-runtime top-level vars vs scoped vars (the latter often needs an explicit flag),
secret files auto-loaded by the dev runner. Empty strings frequently fail `url().optional()` —
preprocess `"" → undefined`. Smoke: boot clean, no validation error at startup.

### E. ORM/return-type vs response schema
ORMs return rich types (Date objects, BigInt) that string-typed response schemas reject. Cast in
the handler or use a serializer. Mock fixtures using pre-stringified values never trip this — only
a real handler return does. Smoke: GET any endpoint returning a row with a timestamp; confirm the
body parses.

### F. Frontend form-state desync
Form libraries don't always sync programmatic `setValue("", "")` to the input; tab/mode switches
can reset fields the user filled. Keep state across switches; coerce to null only at submit. Smoke:
switch tabs, fill both sides, switch back — data persists.

### G. File-watcher new-file discovery
A watch process builds its dependency graph at startup; a brand-new file may not be watched until
imported. After creating a new file an existing module will import, restart the dev process. Smoke:
restart before testing a route that uses a newly created file.

---

## Anti-patterns this rule blocks

- ❌ "All tests pass, ship it" — passing tests prove layers work, not that they connect.
- ❌ "Reviewer approved, ship it" — reviewer reads code; it doesn't run it.
- ❌ "Tester wrote an integration test" — verify it loads the real chain, not just route wiring.
- ❌ "Local smoke is manual QA, not engineering" — it is engineering; budget for it and record
  bugs found in `code.md`.
- ❌ "Reset the dev DB to retest" — dev is shared. See the LOCAL-ONLY notice.

---

## Post-deploy spot-check (shared environments — READ-ONLY)

After deploying, verify in the shared env with **non-destructive** checks only: confirm the build
version/commit matches; curl the affected route with realistic headers; **read logs, don't
restart**; inspect writes with `SELECT … LIMIT … ORDER BY created_at DESC` only (no
DELETE/UPDATE/TRUNCATE/DROP). If a real issue is found, reproduce on **local** first (using a
read-only snapshot of shared data), fix on a branch, ship via CI, re-verify read-only.
