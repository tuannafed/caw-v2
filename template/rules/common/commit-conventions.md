---
paths:
  - "**/COMMIT_EDITMSG"
---
# Rule: Commit Conventions

**Layer:** rules — non-negotiable project-wide conventions
**Used by:** coder (all tasks), plus IDE AI commit-message generators (Cursor AI, GitHub Copilot).

---

## Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type       | When                                                    |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature or behavior                                 |
| `fix`      | Bug fix                                                 |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or updating tests                                |
| `docs`     | Documentation only                                      |
| `style`    | Formatting, whitespace — no code change                 |
| `chore`    | Build, tooling, config, dependencies                    |
| `perf`     | Performance improvement                                 |
| `ci`       | CI/CD pipeline changes                                  |
| `build`    | Build system or external dependency changes             |
| `revert`   | Reverting a previous commit                             |

### Scope (optional)

- Must be **kebab-case** (lowercase, hyphen-separated).
- Use the feature module or domain: `feat(users): ...`, `fix(auth-token): ...`, `chore(api-client): ...`.
- ❌ Wrong: `feat(UserProfile):` (PascalCase), `feat(user_profile):` (snake_case), `feat(API):` (uppercase).

### Subject (description) rules

- **Lowercase** — no `Sentence case`, `Start Case`, `PascalCase`, or `UPPER CASE`.
- **Imperative mood**: "add validation" — NOT "added", "adds", or "adding".
- **No trailing period** `.`.
- **Never empty.**
- Describe **what** and **why**, not how.

### Header rules

- The header line (`type(scope): subject`) — **maximum 72 characters total**.
- Must follow `type(scope): subject` shape; `scope` may be omitted (`type: subject`).

### Body rules (optional)

- Separated from subject by **one blank line**.
- Each line **maximum 100 characters** (wrap manually).
- Explain **what changed and why** — the diff already shows how.

### Footer rules (optional)

- Separated from body by **one blank line**.
- Each line **maximum 100 characters**.
- Use for:
  - `BREAKING CHANGE: <description>`
  - Issue refs: `Closes #123`, `Refs #456`, `Fixes JIRA-789`

### Good Examples

```
feat(planner): add self-challenge step with risks and ADR triggers
```

```
fix(auth): prevent token refresh on expired session

The previous implementation kept retrying refresh on a fully expired
session, causing infinite redirect loops on the login page.

Closes #142
```

```
refactor(users): extract UserRepository to reduce service complexity
```

```
chore: upgrade nestjs to v11
```

### Bad Examples (REJECTED by commitlint)

| Bad                                                                                | Why                                                       |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `Feat: Add login page.`                                                            | Type capitalized; subject Start Case; trailing period.    |
| `feat: Add profile settings page with forms for password and notifications.`       | Header > 72 chars; sentence case; trailing period.        |
| `feat(UserProfile): add stuff`                                                     | Scope not kebab-case.                                     |
| `feat: added login`                                                                | Past tense; use imperative ("add").                       |
| `feat:`                                                                            | Empty subject.                                            |

---

## Atomic Commits

Each commit = one logical change. Do not batch unrelated changes.

```
# ❌ WRONG — one commit for everything
git commit -m "feat: add users module, fix auth bug, update deps"

# ✅ CORRECT — three separate commits
git commit -m "feat(users): add CRUD endpoints"
git commit -m "fix(auth): fix token expiry comparison"
git commit -m "chore: bump nestjs to 10.4.1"
```

When staged changes span unrelated areas, propose splitting into multiple atomic commits rather than producing one mega-commit.

---

## Enforcement

This project enforces these rules at commit time via:

- **commitlint** with `@commitlint/config-conventional`, configured at `commitlint.config.cjs` (project root).
- **Husky** `commit-msg` hook that runs commitlint and rejects malformed messages.

### IDE AI commit-message generators

To make AI tools generate compliant messages on first try, the same rules are mirrored into tool-specific files (all installed by `caw init`):

| Tool                       | File path                                       | Notes                                              |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| **OpenAI Codex CLI**       | `AGENTS.md` (project root)                      | Codex CLI walks repo → CWD looking for AGENTS.md   |
| **Google Antigravity**     | `AGENTS.md` (project root)                      | Antigravity 1.20.3+ reads AGENTS.md natively       |
| **VS Code GitHub Copilot** | `.github/copilot-instructions.md` + `.vscode/settings.json` | `github.copilot.chat.commitMessageGeneration.instructions` setting |
| **Cursor AI**              | `.cursorrules` (legacy) or `.cursor/rules/*.mdc` | Cursor reads both; legacy works best for commit gen |
| **Claude Code**            | `CLAUDE.md` + `.claude/rules/`                  | This file is the source of truth                   |

`AGENTS.md` is the **canonical cross-tool file**. The per-tool overlays exist because each tool's loader looks in a different path; their content is intentionally redundant with `AGENTS.md` so any single tool works standalone.

If the commit-msg hook fails, fix the message and re-stage — do **not** bypass with `--no-verify`.

---

## Never Commit

- Secrets, API keys, tokens (even test values).
- `node_modules/`, `__pycache__/`, `.env` files with real values.
- Build artifacts (`dist/`, `.next/`, `*.pyc`).
- Editor files (`.DS_Store`, `.vscode/settings.json` with personal settings).
