---
paths:
  - "**/stories/**/code.md"
  - "**/stories/**/review.md"
---
# Rule: Code Review Standards

**Layer:** rules — mandatory before marking any task complete
**Used by:** reviewer, and all agents before declaring work done.

---

## When to Review

**MANDATORY review triggers:**

- After writing or modifying code
- Before any commit to shared branches
- When security-sensitive code is changed (auth, payments, user data)
- When architectural changes are made

## Review Checklist

Before marking code complete:

- [ ] Code is readable and well-named
- [ ] Functions are focused (<50 lines)
- [ ] Files are cohesive (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Errors are handled explicitly
- [ ] No hardcoded secrets or credentials
- [ ] No console.log or debug statements
- [ ] Tests exist for new functionality

## Security Review Triggers

**STOP and flag immediately when touching:**

- Authentication or authorization code
- User input handling
- Database queries
- File system operations
- External API calls
- Cryptographic operations
- Payment or financial code

## Severity Levels

| Level    | Meaning                                  | Action                             |
| -------- | ---------------------------------------- | ---------------------------------- |
| CRITICAL | Security vulnerability or data loss risk | **BLOCK** — must fix before merge  |
| HIGH     | Bug or significant quality issue         | **WARN** — should fix before merge |
| MEDIUM   | Maintainability concern                  | **INFO** — consider fixing         |
| LOW      | Style or minor suggestion                | **NOTE** — optional                |

## Approval Criteria

- **Approve**: No CRITICAL or HIGH issues
- **Warning**: HIGH issues present (merge with caution)
- **Block**: Any CRITICAL issue found

## Common Issues

### Security

- Hardcoded credentials (API keys, passwords, tokens)
- SQL injection (string concatenation in queries)
- XSS vulnerabilities (unescaped user input)
- Path traversal (unsanitized file paths)

### Code Quality

- Large functions (>50 lines) — split into smaller
- Large files (>800 lines) — extract modules
- Deep nesting (>4 levels) — use early returns
- Missing error handling — handle explicitly
- Mutation patterns — prefer immutable operations

### Performance

- N+1 queries — use JOINs or batching
- Missing pagination — add LIMIT to queries
- Missing caching — cache expensive operations
