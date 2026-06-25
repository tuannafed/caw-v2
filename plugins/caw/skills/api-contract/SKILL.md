---
name: api-contract
description: REST conventions, URL structure, HTTP methods/status codes, headers, pagination (page + cursor), idempotency keys, rate-limit and deprecation headers, and the API Contract template that the Plan's backend and frontend phases both follow. Use when designing or reviewing API endpoints, writing the API Contract section of a Plan, or implementing request/response shapes. For error envelope and error codes see `error-handling-patterns`.
---

# Skill: API Contract Design

**Used by:** planner (when writing the Plan's API Contract section), coder (backend phase implementing endpoints, frontend phase consuming them).

> **Error envelope, error codes, exception filters, frontend error handling** → see `error-handling-patterns` skill (single source of truth).

---

> Standard REST/HTTP mechanics (method semantics, status-code meanings, header
> definitions) are spec — **query Context7** or MDN for those. This skill records
> only the **choices caw makes** among valid options.

## URL & Naming Conventions (caw's choices)

- **Version prefix:** all routes under `/api/v1/...`
- **Kebab-case** for multi-word resources: `/order-items`, `/user-profiles`
- **Plural nouns**, no verbs in URLs (use the HTTP method)
- **Nesting capped at 2 levels** — deeper relations get their own top-level resource

---

## Standard Success Envelope

```json
{
  "success": true,
  "data": { ... }
}
```

For paginated lists, include `meta`:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "hasNext": true
  }
}
```

> Error envelope shape, error codes (SCREAMING_SNAKE_CASE), and global exception handling are defined in **`error-handling-patterns`**. Do not duplicate them here.

---

## Status Codes: caw's disambiguation rules

The full status-code list is spec (Context7/MDN). caw only pins down the cases
where teams commonly diverge:

- **400 vs 422** — 400 = client sent **malformed/invalid input** (failed schema).
  422 = input is **valid but a business rule rejects it** (e.g. "cannot cancel a
  shipped order"). Pick one consistently; never mix them for the same condition.
- **409** — duplicate resource (unique constraint) **or** version/optimistic-lock
  conflict. Both map to `ALREADY_EXISTS` / a conflict code per `error-handling-patterns`.
- **201** — successful create; always include a `Location` header.
- **429** — rate limited; always include `Retry-After`.

Error codes (SCREAMING_SNAKE) for each status → **`error-handling-patterns`**.

---

## Headers caw requires (beyond the spec defaults)

The standard set (`Content-Type`, `Authorization: Bearer`, `Location`) is assumed.
caw additionally standardizes:

- **`X-Request-ID`** (request, optional) — correlation id for tracing.
- **`Idempotency-Key`** (request) — on retriable POSTs; see Idempotency below.
- **Rate-limit response headers** on 429: `Retry-After`, plus `X-RateLimit-Limit` /
  `X-RateLimit-Remaining` / `X-RateLimit-Reset`.
- **Deprecation signalling** before removing an endpoint/version: `Deprecation: true`,
  `Sunset: <HTTP-date>`, and `Link: <successor-url>; rel="successor-version"`.

---

## Idempotency

POST is **not** idempotent by default — a client retry after a 429 or a dropped
connection can create a duplicate resource. For create endpoints that may be
retried, accept an `Idempotency-Key` header (client-generated UUID):

- First request with a given key → process normally, **store the response** keyed
  by `(key, route)`.
- Repeat request with the same key → return the **stored response** (same status,
  same body) without re-executing the side effect.
- Keys expire after a bounded window (e.g. 24h).

`PUT`, `PATCH`, `DELETE`, and all reads are already idempotent — no key needed.

---

## Pagination

Query parameters:

```
GET /api/v1/users?page=1&limit=20&sort=createdAt&order=desc
```

| Param   | Default     | Notes                                   |
| ------- | ----------- | --------------------------------------- |
| `page`  | 1           | 1-indexed                               |
| `limit` | 20          | Max 100. Reject larger to prevent abuse |
| `sort`  | `createdAt` | Whitelist allowed columns               |
| `order` | `desc`      | `asc` or `desc` only                    |

For large tables (> 100k rows), prefer **cursor pagination** instead of `page` (avoids slow `OFFSET` scans):

```
GET /api/v1/users?cursor=2025-04-28T10:00:00Z&limit=20
```

The cursor response carries `nextCursor` in `meta` instead of `page`/`total`
(an unbounded scan can't cheaply count total rows):

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "limit": 20,
    "nextCursor": "2025-04-28T09:58:12Z",
    "hasNext": true
  }
}
```

`nextCursor` is `null` (and `hasNext` is `false`) on the last page. Treat the
cursor as **opaque** on the client — don't parse or construct it.

---

## API Contract Template (for the Plan)

Use this template inside the Plan's `## API Contract` section (`plan.md`):

````markdown
### POST /api/v1/{resource}

**Auth:** Required (Bearer token)
**Permissions:** {role}

**Request Body:**

| Field | Type   | Required | Description       |
| ----- | ------ | -------- | ----------------- |
| name  | string | Yes      | Max 100 chars     |
| email | string | Yes      | Valid email format |

**Response 201:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "createdAt": "ISO-8601"
  }
}
```

**Errors:**

- 400 `VALIDATION_ERROR` — missing/invalid fields
- 401 `UNAUTHORIZED` — missing/invalid token
- 403 `FORBIDDEN` — token valid, wrong role/ownership
- 409 `ALREADY_EXISTS` — email already registered
- 422 `UNPROCESSABLE` — business rule violated (valid input)
- 429 `RATE_LIMIT_EXCEEDED` — too many requests
````

> List **every** status the endpoint can return, not just the happy-path
> validation error. The error codes (SCREAMING_SNAKE_CASE) and envelope shape are
> defined in **`error-handling-patterns`** — reference them, don't redefine.

---

## Forbidden Patterns

- ❌ Verbs in URLs: `/getUsers`, `/createOrder` — use HTTP methods
- ❌ Returning raw arrays without envelope: `[{...}, {...}]` — wrap in `{ success, data }`
- ❌ Mixed status codes for the same condition (some 400, some 422) — apply the 400-vs-422 rule of thumb above consistently
- ❌ Inconsistent naming (`user_id` in one endpoint, `userId` in another)
- ❌ Pagination without `limit` cap — DoS risk
- ❌ Retriable create POST without `Idempotency-Key` support — duplicate-resource risk
- ❌ Client parsing/constructing a cursor — treat it as opaque
- ❌ Defining custom error envelope shape (use the one in `error-handling-patterns`)
