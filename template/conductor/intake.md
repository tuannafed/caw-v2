# Feature Intake

Date: YYYY-MM-DD
Requested by: human prompt

## 1. Restate the Request

One sentence summary of what the human asked for.

## 2. Input Type

Pick one:

- [ ] Spec slice — implementing selected behavior from accepted product
- [ ] Change request — bounded behavior change, bug fix, or refinement
- [ ] New initiative — larger product area needing multiple Tasks
- [ ] Maintenance request — dependency, performance, security, ops work
- [ ] Harness improvement — process, template, or agent rule change

## 3. Risk Checklist

Mark each flag that applies:

| Flag                                                                     | Applies | Note |
| ------------------------------------------------------------------------ | ------- | ---- |
| Auth (login, session, JWT, password, refresh token)                      | [ ]     |      |
| Authorization (roles, permissions, tenancy)                              | [ ]     |      |
| Data model (schema, migrations, uniqueness, deletion)                    | [ ]     |      |
| Audit/security (audit logs, privacy, sensitive data)                     | [ ]     |      |
| External systems (email, payments, providers, queues, webhooks)          | [ ]     |      |
| Public contracts (API shape, response envelope, client-visible behavior) | [ ]     |      |
| Cross-platform (browser/mobile/desktop split, deep links)                | [ ]     |      |
| Existing behavior (already implemented or test-covered area changes)     | [ ]     |      |
| Weak proof (unclear or missing tests around the affected area)           | [ ]     |      |
| Multi-domain (more than one product domain changes at once)              | [ ]     |      |

## 4. Hard Gates

Hard gates auto-promote to risky lane unless human explicitly narrows scope:

- [ ] Auth
- [ ] Authorization
- [ ] Data loss or migration
- [ ] Audit/security
- [ ] External provider behavior
- [ ] Removing or weakening validation requirements

## 5. Lane

Apply classification:

- 0-1 flags + no hard gate → **tiny** or **standard** based on code impact
- 2-3 flags → **standard** with stronger validation
- 4+ flags → **risky**
- Any hard gate → **risky** unless human explicitly narrows scope

Selected lane: `tiny` | `standard` | `risky`

Reason: [short explanation tying flags to lane]

## 6. Task Plan

- Task ID to create: `task-NNN-<slug>`
- Affected docs: [list]
- Validation expected: unit | integration | e2e
- ADR needed: yes | no — [reason]

## 7. Human Confirmation

- [ ] Human confirmed lane (only required if the planner classified it as `risky` or scope is ambiguous)
