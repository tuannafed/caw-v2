# AGENTS.md — {{PROJECT_NAME}}

Cross-tool agent instructions. Read by **OpenAI Codex CLI**, **Google Antigravity**, and any other AI coding tool that supports the `AGENTS.md` convention. This file mirrors `.claude/rules/common/commit-conventions.md` and `.claude/rules/common/coding-standards.md` so all tools follow the same rules.

> Tool-specific overlays:
> - **Cursor AI** → `.cursorrules`
> - **GitHub Copilot** → `.github/copilot-instructions.md`
> - **Claude Code** → `CLAUDE.md` + `.claude/`

---

## Commit Message Generation

When generating git commit messages, you MUST follow Conventional Commits as enforced by `commitlint.config.cjs`. The Husky `commit-msg` hook rejects violations.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Hard Rules

1. **Type** — lowercase, exactly one of:
   `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
2. **Scope** — optional, **kebab-case** (lowercase, hyphens). Examples: `auth`, `user-profile`, `api-client`.
3. **Subject**:
   - lowercase (NO `Sentence case`, `Start Case`, `PascalCase`, `UPPER CASE`)
   - imperative mood: "add", "fix", "update" — NOT "added", "adds", "adding"
   - no trailing period
   - never empty
4. **Header** (`type(scope): subject`) — max **72 characters total**.
5. **Body** (optional): blank line after subject, max **100 chars/line**, explain what + why.
6. **Footer** (optional): blank line before footer, max **100 chars/line**. For `BREAKING CHANGE:` or `Closes #123`.

### Good

```
feat(profile): add settings page with password and notification forms
fix(auth): prevent token refresh on expired session
refactor(api-client): extract zod validation into helper
chore(commitlint): tighten header length and subject case rules
```

### Bad — REJECTED

| Bad                                                                                | Why                                                       |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `Feat: Add login page.`                                                            | Type capitalized; subject Start Case; trailing period.    |
| `feat: Add profile settings page with forms for password and notifications.`       | Header > 72 chars; sentence case; trailing period.        |
| `feat(UserProfile): add stuff`                                                     | Scope not kebab-case.                                     |
| `feat: added login`                                                                | Past tense; use imperative ("add").                       |

### Multi-Concern Changes

If staged diff spans unrelated areas, **propose splitting into multiple atomic commits** instead of one mega-commit. Each commit = one logical change.

### Output Format

When asked specifically for a commit message, return ONLY the commit message — no explanations, no markdown code fences, no preamble.

---

## Code Generation & Review

Follow `.claude/rules/common/coding-standards.md`. Highlights:

- **No `any`** — use `unknown` and narrow.
- **No mutations** — always create new objects (spread).
- **File limits**: ~200–400 lines typical, 800 max. Functions ≤50 lines. Nesting ≤4 levels.
- **No hardcoded secrets, URLs, magic strings** — config from env or config service.
- **No silent catch** — every `catch` either handles or rethrows with context.
- **No `console.log`** in production code (auto-stripped, but should not be checked in).
- **Validate at boundaries only** — controllers, fetchers, form resolvers. Not inside service methods.

Match the existing project style. Use the project's typed API client, state factory, and routing constants — do not introduce raw `fetch`, raw `create()` from zustand, or hardcoded URL strings.

---

## Workflow

The project follows the **caw** (Claude Agent Workflow) pipeline:

1. `/caw-plan "<feature>"` — produce a plan with phases, test scenarios, ADR triggers.
2. `/caw-code` — implement one phase at a time per the plan.
3. `/caw-test` — write/run tests based on plan's test_scenarios.
4. `/caw-review` — multi-dimensional review (security, performance, architecture, testing).
5. `/caw-verify` — parallel test + review.

For Codex CLI / Antigravity users without these slash commands: do the equivalent steps manually — plan in writing first, then code, test, review.

---

## Never Commit

- Secrets, API keys, tokens (even test values).
- `node_modules/`, `__pycache__/`, `.env` files with real values.
- Build artifacts (`dist/`, `.next/`, `*.pyc`).
- Personal editor settings.
