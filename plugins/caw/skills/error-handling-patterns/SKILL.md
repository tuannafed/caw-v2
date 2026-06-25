---
name: error-handling-patterns
description: caw error envelope spec + full-stack error handling — NestJS/FastAPI exception filters with status→code mapping, typed fetch wrapper with ApiError class, error boundary, React Query integration, toast vs inline rules, form field error mapping, and code review checklist. Use when implementing error responses, adding exception filters, consuming API errors on the client, or reviewing error flows. Pairs with api-contract.
---

# Skill: Error Handling Patterns

**Used by:** coder (backend, frontend, and integrate phases), reviewer.

---

## Error Hierarchy

Define a clear error taxonomy per domain:

```typescript
// NestJS — throw framework exceptions
import { NotFoundException, ConflictException, BadRequestException,
         ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

// When to throw what:
throw new NotFoundException('User not found');            // 404
throw new ConflictException('Email already registered'); // 409
throw new BadRequestException('Invalid input');          // 400
throw new ForbiddenException('Access denied');           // 403
throw new UnprocessableEntityException('Cannot cancel a shipped order'); // 422
```

```python
# FastAPI
from fastapi import HTTPException, status

raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cannot cancel shipped order")
```

---

## Consistent Error Envelope

Every error response must follow this shape (from api-contract.md):

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

**Error codes** (SCREAMING_SNAKE_CASE):
```
VALIDATION_ERROR   → 400 (input failed schema validation)
UNAUTHORIZED       → 401 (no/invalid token)
FORBIDDEN          → 403 (valid token, wrong role/ownership)
NOT_FOUND          → 404 (resource doesn't exist)
ALREADY_EXISTS     → 409 (unique constraint violated)
UNPROCESSABLE      → 422 (valid input, business rule violated)
RATE_LIMIT_EXCEEDED → 429
INTERNAL_ERROR     → 500 (catch-all)
```

---

## NestJS Global Exception Filter

```typescript
// src/common/filters/all-exceptions.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

const STATUS_TO_CODE: Record<number, string> = {
  400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
  404: 'NOT_FOUND', 409: 'ALREADY_EXISTS', 422: 'UNPROCESSABLE',
  429: 'RATE_LIMIT_EXCEEDED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message = typeof res === 'string' ? res : (res as any).message;

      response.status(status).json({
        success: false,
        error: {
          code: STATUS_TO_CODE[status] ?? 'ERROR',
          message: Array.isArray(message) ? message[0] : message,
          details: Array.isArray(message)
            ? message.map((m: string) => ({ message: m }))
            : undefined,
        },
      });
    } else {
      // Log unexpected errors (never expose details to client)
      console.error('[Unhandled Error]', exception);
      response.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  }
}
```

---

## Frontend: Typed Fetch Wrapper

```typescript
// src/lib/api/client.ts — vendor-neutral typed wrapper
import type { ErrorResponse, SuccessResponse } from '@/types/api';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorResponse['error']['details'],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorResponse | null;
    const code = body?.error?.code ?? `HTTP_${res.status}`;
    const message = body?.error?.message ?? res.statusText;

    if (res.status === 401) {
      // Soft-handled here; route guards do the redirect (avoids loops in API code)
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new ApiError(res.status, code, message, body?.error?.details);
  }

  const json = (await res.json()) as SuccessResponse<T>;
  return json.data;
}
```

---

## Frontend: Error Boundary (route-level)

```tsx
// src/components/error-boundary.tsx
'use client';
import { Component, ReactNode } from 'react';

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Send to monitoring (Sentry, Datadog) — never to console.error in prod
    reportError(error, info);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

In Next.js App Router, prefer `error.tsx` per-segment over class component:

```tsx
// app/(app)/users/error.tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Could not load users</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## Frontend: Form Errors (field-level)

Map API `error.details` (array of `{ field, message }`) into form library state:

```tsx
// React Hook Form + Zod
const onSubmit = async (data: FormValues) => {
  try {
    await apiFetch('/api/v1/users', { method: 'POST', body: JSON.stringify(data) });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'VALIDATION_ERROR' && e.details) {
      e.details.forEach(({ field, message }) => {
        if (field) form.setError(field as any, { type: 'server', message });
      });
      return;
    }
    toast.error(getErrorMessage(e));
  }
};
```

---

## Frontend: Toast vs Inline (when to use which)

| Error type | Where to show |
|------------|---------------|
| Field validation (`VALIDATION_ERROR` with `details`) | **Inline** next to each field |
| Business rule (`UNPROCESSABLE`, `ALREADY_EXISTS`) | **Inline** form-level alert |
| Auth (`UNAUTHORIZED`, `FORBIDDEN`) | **Redirect** to login or show 403 page |
| Resource missing (`NOT_FOUND`) | **Empty state** in the route, not toast |
| Server error (`INTERNAL_ERROR`, network) | **Toast** with retry action |
| Optimistic mutation rolled back | **Toast** explaining the rollback |

---

## React Query / TanStack Query Integration

```typescript
const { data, error } = useQuery({
  queryKey: ['user', id],
  queryFn: () => apiFetch<User>(`/api/v1/users/${id}`),
});

if (error instanceof ApiError) {
  if (error.code === 'NOT_FOUND') return <NotFound />;
  if (error.code === 'FORBIDDEN') return <NoAccess />;
  return <ErrorMessage message={error.message} />;
}

// Mutations
const createUser = useMutation({
  mutationFn: (input: CreateUserInput) =>
    apiFetch<User>('/api/v1/users', { method: 'POST', body: JSON.stringify(input) }),
  onError: (error) => {
    if (error instanceof ApiError && error.code === 'ALREADY_EXISTS') {
      // Inline form error — don't toast
      return;
    }
    toast.error(getErrorMessage(error));
  },
});
```

---

## Helper: extract error message

```typescript
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
```

---

## Error Logging

```typescript
// NestJS — log unexpected errors only (not HttpExceptions)
// HttpExceptions are expected application behavior, not bugs

// ✅ Log this (unexpected)
console.error('[Unhandled Error]', exception);

// ❌ Don't log this (expected, controlled)
throw new NotFoundException('User not found');

// Python equivalent
import logging
logger = logging.getLogger(__name__)

# ✅ Log unexpected errors
except Exception as e:
    logger.exception("Unexpected error in create_user: %s", str(e))
    raise HTTPException(status_code=500, detail="Internal server error")

# ❌ Don't log HTTPException (expected)
raise HTTPException(status_code=404, detail="User not found")
```

---

## Validation Error Format

```typescript
// NestJS — class-validator produces array of messages
// Global ValidationPipe transforms them to our envelope format:
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

---

## Code Review: Error Handling Checklist

```
[ ] All endpoints have consistent error envelope (success: false, error.code, error.message)
[ ] No raw exception messages exposed to clients in production
[ ] Unexpected errors logged server-side (not just client-visible)
[ ] 4xx errors (expected) NOT logged as errors — only 5xx
[ ] Frontend handles 401 globally (token expiry redirect)
[ ] Field-level validation errors include details array
[ ] Business rule violations use 422, not 400
```
