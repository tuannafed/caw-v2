---
name: error-handling-patterns
description: caw's error envelope spec + full-stack error-handling CONVENTIONS — the standard error shape, the status→code mapping, toast-vs-inline rules, form-field error mapping, logging policy, and a review checklist. Use when designing error responses, consuming API errors on the client, or reviewing error flows. For framework HOW-TO (NestJS exception filters, FastAPI, React error boundaries, React Hook Form, TanStack Query), query Context7. Pairs with api-contract.
---

# Skill: Error Handling Patterns

**Used by:** coder (backend, frontend, and integrate phases), reviewer.

This skill defines **what caw standardizes** about errors — the envelope, the
codes, where errors surface, what gets logged. It deliberately does **not** teach
how to write a NestJS filter or a React error boundary; those are framework
mechanics — **query Context7** for the current syntax and plug caw's conventions
below into it.

---

## Error Envelope (the contract)

Every error response MUST follow this shape:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": [{ "field": "id", "message": "No user with this ID" }]
  }
}
```

- `code` — SCREAMING_SNAKE_CASE, from the table below (never a raw framework string).
- `message` — human-readable, safe to show; never leak stack traces or SQL.
- `details` — present only for field-level errors (validation); array of `{ field, message }`.

Success envelope (`{ success, data, meta }`) lives in **`api-contract`** — single source of truth.

---

## Status → Code Mapping (the contract)

```
VALIDATION_ERROR    → 400 (input failed schema validation)
UNAUTHORIZED        → 401 (no/invalid token)
FORBIDDEN           → 403 (valid token, wrong role/ownership)
NOT_FOUND           → 404 (resource doesn't exist)
ALREADY_EXISTS      → 409 (unique constraint violated)
UNPROCESSABLE       → 422 (valid input, business rule violated)
RATE_LIMIT_EXCEEDED → 429
INTERNAL_ERROR      → 500 (catch-all; never expose internals)
```

This mapping is the contract a global exception handler implements. The handler
**implementation** is framework mechanics — for NestJS, ask Context7 for an
`ExceptionFilter`; for FastAPI, an exception handler — then wire it to emit the
envelope above using this exact mapping. The 400-vs-422 distinction (malformed
input vs. valid-but-rejected) comes from **`api-contract`**.

---

## ApiError (the client contract)

The frontend wraps every failed response in a typed `ApiError` carrying
`status`, `code`, `message`, and optional `details`:

```typescript
class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,    // from the mapping above
    message: string,
    public readonly details?: { field?: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

Conventions for the fetch wrapper that throws it (the `fetch`/parsing boilerplate
itself → Context7):

- Parse the error envelope; fall back to `HTTP_<status>` if the body isn't our shape.
- On `401`, dispatch a global `auth:expired` event — **route guards** do the
  redirect, not the API layer (avoids redirect loops inside data code).
- Return `json.data` on success (unwrap the `{ success, data }` envelope).

---

## Toast vs Inline (the policy)

| Error type | Where to show |
|------------|---------------|
| Field validation (`VALIDATION_ERROR` with `details`) | **Inline** next to each field |
| Business rule (`UNPROCESSABLE`, `ALREADY_EXISTS`) | **Inline** form-level alert |
| Auth (`UNAUTHORIZED`, `FORBIDDEN`) | **Redirect** to login or show 403 page |
| Resource missing (`NOT_FOUND`) | **Empty state** in the route, not a toast |
| Server error (`INTERNAL_ERROR`, network) | **Toast** with retry action |
| Optimistic mutation rolled back | **Toast** explaining the rollback |

This table is caw policy — apply it regardless of the form/query library. The
mechanics of *how* to surface each (React Hook Form `setError`, TanStack Query
`onError`, an error boundary, Next.js `error.tsx`) → **query Context7** for the
library in use, then route each error type per this table.

**Form-field mapping rule:** when `code === 'VALIDATION_ERROR'` and `details` is
present, map each `{ field, message }` onto the form's field-error state; anything
else → fall through to a toast.

---

## Logging Policy

- **Log unexpected errors only** (5xx / uncaught) — server-side, with context.
- **Do NOT log expected errors** (4xx / thrown framework exceptions like
  "not found", "forbidden") — they are controlled application behavior, not bugs.
  Logging them is noise that hides real incidents.

This rule is language-agnostic; apply it in whatever logger the stack uses.

---

## Validation Error Format (the contract)

Validation failures use `code: VALIDATION_ERROR`, a summary `message`, and a
`details` array with one `{ field, message }` per failing field:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email must be an email",
    "details": [
      { "field": "email", "message": "email must be an email" },
      { "field": "name", "message": "name must be longer than 2 characters" }
    ]
  }
}
```

How a given validator (class-validator, Zod, Pydantic) produces this → Context7.
The **shape** above is the contract every validator must be normalized into.

---

## Code Review: Error Handling Checklist

```
[ ] All endpoints use the error envelope (success: false, error.code, error.message)
[ ] error.code is from the SCREAMING_SNAKE mapping — never a raw framework string
[ ] No raw exception messages / stack traces exposed to clients
[ ] Unexpected (5xx) errors logged server-side; expected (4xx) NOT logged as errors
[ ] Frontend handles 401 globally (auth:expired → route guard redirect)
[ ] Field-level validation errors include a details array
[ ] Business rule violations use 422, not 400
[ ] Errors surface per the toast-vs-inline policy table
```

---

**Pairs with:** `api-contract` (success envelope, status-code semantics, 400-vs-422 rule). For framework-specific implementations, query **Context7**.
