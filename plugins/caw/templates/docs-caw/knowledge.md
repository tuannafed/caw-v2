# Knowledge — {{PROJECT_NAME}}

<!--
PURPOSE
  This file is the project's **long-lived memory**. It records facts that
  are NOT obvious from the code itself: gotchas, domain rules, external
  integration quirks, and lessons learned across tasks.

  Conventions go in `docs/caw/conventions.md` (style/architecture).
  Rules go in `.claude/rules/` (non-overridable).
  This file is for **discovered knowledge** the next agent should remember.

WHO WRITES HERE
  - Agents (planner, coder, tester, reviewer) — append after a task surfaces
    something non-obvious.
  - Humans — add domain facts a fresh hire would need.

WHEN AN AGENT SHOULD UPDATE
  - A bug took >30 min to diagnose → record it under "Pitfalls".
  - A workaround was applied → record it under "Gotchas".
  - A domain term is used by stakeholders but not in code → record it under
    "Domain glossary".
  - An external system has surprising behavior → record it under "Integrations".

HOW TO ADD AN ENTRY
  - Always cite the story: `(US-NNN, YYYY-MM-DD)`
  - Keep it terse: one or two sentences.
  - Prefer "what + why" over "how"; the fix lives in code, the rationale lives here.

PRUNING
  - Each section caps at 15 entries. When adding the 16th, move the oldest
    to "Archive" at the bottom.
  - Entries older than 6 months → Archive.
-->

---

## 📖 Domain glossary

> Terms stakeholders use that don't map 1:1 to code names. Helps agents
> translate between business language and code.

<!-- Example:
- **"Active session"** — sessions table row where `revoked_at IS NULL` AND `last_heartbeat_at > now() - interval '5min'`. The DB column is just `revoked_at`; the freshness check is implicit. (US-001, 2025-03-12)
- **"Insurer"** — external party that pays out claims. In code: `companies.type = 'INSURER'`, no dedicated table. (US-003, 2025-03-20)
-->

---

## 🔌 External integrations

> Third-party services / APIs and how they actually behave (not how the docs say).

<!-- Example:
- **Stripe webhooks** retry up to 3 days with exponential backoff. Handler MUST be idempotent — we got duplicate `charge.succeeded` events 12 hours apart. (US-004, 2025-03-22)
- **Twilio SMS to VN numbers**: numbers must start with `+84`, not `84`; the dashboard accepts both but API rejects without `+`. (US-007, 2025-04-01)
-->

---

## ⚠️ Gotchas

> Project-specific traps that look fine at a glance.

<!-- Format:
- **What surprised us**: one line. **Why**: brief reason. (US-NNN, YYYY-MM-DD)
-->

<!-- Example:
- **`User.deletedAt` is soft-delete; queries must filter explicitly**. Prisma's `findMany` does NOT auto-filter — caller must add `where: { deletedAt: null }`. (US-002, 2025-03-15)
- **JWT refresh token is per-device, not per-user**. Revoking one device's token doesn't invalidate others. (US-001, 2025-03-12)
-->

---

## 🐛 Pitfalls (bugs we already paid for)

> Mistakes made + how they were fixed. Prevents repeats.

<!-- Format:
### <one-line title>
**Problem:** what broke
**Cause:** why
**Fix:** what made it pass
**Prevention:** rule / test added to keep it from coming back
(US-NNN, YYYY-MM-DD)
-->

<!-- Example:
### Concurrent `MAX_ACTIVE_SESSIONS` race
**Problem:** Logging in from 6 devices succeeded — limit was 5.
**Cause:** `count + 1 > 5` check ran outside a transaction; two requests passed simultaneously.
**Fix:** Wrap session insert + count in `SELECT FOR UPDATE`.
**Prevention:** integration test in `auth.service.spec.ts:concurrent-login`.
(US-001, 2025-04-05)
-->

---

## 🎓 Lessons learned

> Bigger-picture reflections after multi-task work. Higher level than gotchas.

<!-- Example:
- Frontend-first sequencing caused 2 backend reworks — finalize API contract before parallel work. (US-003, 2025-03-20)
- Integration tests caught 3 bugs unit tests missed; raise integration coverage target. (US-005, 2025-03-28)
-->

---

## 🗂️ Archive

> Entries pruned from the sections above. Kept for historical context only —
> agents do NOT need to read this section by default.
