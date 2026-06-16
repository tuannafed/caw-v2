---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---
# Rule: TypeScript/JavaScript Coding Style

**Layer:** rules — auto-loaded for TS/JS files based on paths frontmatter
**Used by:** coder (all tasks), reviewer.

---

## Types and Interfaces

### Public APIs

Add parameter and return types to exported functions and public class methods. Let TypeScript infer obvious local variable types.

```typescript
// WRONG
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}

// CORRECT
interface User { firstName: string; lastName: string }
export function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`
}
```

### Interfaces vs Type Aliases

- Use `interface` for object shapes that may be extended or implemented
- Use `type` for unions, intersections, tuples, mapped types, utility types
- Prefer string literal unions over `enum`

```typescript
interface User { id: string; email: string }
type UserRole = 'admin' | 'member'
type UserWithRole = User & { role: UserRole }
```

### Avoid `any`

Use `unknown` for external/untrusted input, then narrow safely. Use generics when type depends on the caller.

```typescript
// WRONG
function getErrorMessage(error: any) { return error.message }

// CORRECT
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unexpected error'
}
```

### React Props

Define props with a named `interface` or `type`. Type callback props explicitly. Do not use `React.FC`.

```typescript
interface UserCardProps {
  user: User
  onSelect: (id: string) => void
}
function UserCard({ user, onSelect }: UserCardProps) {
  return <button onClick={() => onSelect(user.id)}>{user.email}</button>
}
```

## Immutability

Use spread operator for immutable updates. Never mutate existing objects.

```typescript
// WRONG
function updateUser(user: User, name: string): User {
  user.name = name  // MUTATION
  return user
}

// CORRECT
function updateUser(user: Readonly<User>, name: string): User {
  return { ...user, name }
}
```

## Error Handling

Use async/await with try-catch. Narrow `unknown` errors safely.

```typescript
async function loadUser(userId: string): Promise<User> {
  try {
    return await riskyOperation(userId)
  } catch (error: unknown) {
    logger.error('Operation failed', error)
    throw new Error(getErrorMessage(error))
  }
}
```

## Input Validation

Use Zod for schema-based validation. Infer types from the schema.

```typescript
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})
type UserInput = z.infer<typeof userSchema>
const validated: UserInput = userSchema.parse(input)
```

## Console.log

No `console.log` in production code. Use proper logging libraries.
