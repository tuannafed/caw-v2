---
name: api-contract
description: REST conventions, URL structure, HTTP methods/status codes, headers, pagination, and the API Contract template that the Plan's backend and frontend phases both follow. Use when designing or reviewing API endpoints, writing the API Contract section of a Plan, or implementing request/response shapes. For error envelope and error codes see `error-handling-patterns`.
---

# Skill: API Contract Design

**Used by:** planner (when writing the Plan's API Contract section), coder (backend phase implementing endpoints, frontend phase consuming them).

> **Error envelope, error codes, exception filters, frontend error handling** → see `error-handling-patterns` skill (single source of truth).

---

## REST Conventions

### URL Structure

```
GET    /resources              # list (paginated)
GET    /resources/:id          # single item
POST   /resources              # create
PATCH  /resources/:id          # partial update
PUT    /resources/:id          # full replace (rare)
DELETE /resources/:id          # delete

# Nested resources (max 2 levels deep)
GET    /resources/:id/children
POST   /resources/:id/children
```

### Naming Rules

- Plural nouns: `/users`, `/orders`, `/products`
- Kebab-case for multi-word: `/order-items`, `/user-profiles`
- No verbs in URLs — use HTTP method instead
- Version prefix: `/api/v1/...`

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

## HTTP Status Codes

| Status                    | When to use                                 |
| ------------------------- | ------------------------------------------- |
| 200 OK                    | Successful GET, PATCH, DELETE               |
| 201 Created               | Successful POST (include `Location` header) |
| 204 No Content            | DELETE with no body                         |
| 400 Bad Request           | Validation error, malformed body            |
| 401 Unauthorized          | Missing or invalid auth token               |
| 403 Forbidden             | Valid token, insufficient permissions       |
| 404 Not Found             | Resource doesn't exist                      |
| 409 Conflict              | Duplicate resource (unique constraint)      |
| 422 Unprocessable         | Business logic violation (not validation)   |
| 429 Too Many Requests     | Rate limit exceeded                         |
| 500 Internal Server Error | Unexpected server error                     |

**Rule of thumb:** 400 = client sent malformed/invalid input. 422 = input is valid but business rule rejects it (e.g., "cannot cancel a shipped order").

---

## Headers

### Request

```
Content-Type: application/json
Authorization: Bearer <token>     # on protected routes
X-Request-ID: <uuid>              # optional, for tracing
```

### Response (success)

```
Content-Type: application/json
Location: /api/v1/users/abc123    # on 201 Created
```

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
- 409 `ALREADY_EXISTS` — email already registered
````

---

## Forbidden Patterns

- ❌ Verbs in URLs: `/getUsers`, `/createOrder` — use HTTP methods
- ❌ Returning raw arrays without envelope: `[{...}, {...}]` — wrap in `{ success, data }`
- ❌ Mixed status codes for the same condition (some 400, some 422)
- ❌ Inconsistent naming (`user_id` in one endpoint, `userId` in another)
- ❌ Pagination without `limit` cap — DoS risk
- ❌ Defining custom error envelope shape (use the one in `error-handling-patterns`)
