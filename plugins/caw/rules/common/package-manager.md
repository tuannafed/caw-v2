---
paths:
  - "**/package.json"
  - "**/.npmrc"
  - "**/pnpm-workspace.yaml"
---
# Rule: Package Manager (Node.js projects)

**Layer:** rules — non-negotiable project-wide conventions
**Used by:** Setup agent, Coder, Tester, Reviewer — every agent that installs, updates, or reviews Node.js dependencies.
**Note:** These are *rules*, not patterns. They cannot be overridden by `.claude/rules/project.md`.

---

## pnpm 11+ is required

**Do not propose `npm`, `yarn`, or `bun`** as alternatives unless the user explicitly asks. Do not propose `pnpm@10` or earlier — they lack the lifecycle-script gate added in pnpm 11.

### Why pnpm 11+

Two security defaults directly mitigate active supply-chain advisories (see [`templates/advisories/`](../../templates/advisories/)):

1. **Lifecycle scripts are blocked by default.** Install pauses and asks for explicit approval before running any `preinstall` / `install` / `postinstall` script. This is the primary persistence vector for npm supply-chain malware.
2. **`packageManager` pin + corepack.** Locks every dev and CI to the exact pnpm version. Prevents silent upgrade into a malicious release.

---

## Install pnpm via corepack

Always use corepack — never `npm install -g pnpm`.

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

corepack ships with Node.js 16.10+ and is the official Node-recommended way to manage package-manager versions.

---

## Every Node.js project MUST

### 1. Pin the package manager in `package.json`

```json
{
  "packageManager": "pnpm@11.1.1"
}
```

This field is enforced by corepack — running `pnpm` inside the project will fail if the installed version doesn't match. CI gets the same version automatically.

### 2. Ship an `.npmrc` at project root

```
ignore-scripts=true
min-release-age=3d
```

- `ignore-scripts=true` — global lifecycle-script block. Combined with pnpm 11's per-install approval prompt, this is defense in depth.
- `min-release-age=3d` — refuses installation of any package published less than 3 days ago, closing most active supply-chain attack windows before they reach the machine.

### 3. Use `--frozen-lockfile` in CI

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

Never let CI re-resolve the lockfile on its own.

---

## Lifecycle script approval policy

When pnpm prompts to approve a build script during install, the default answer is **N (reject)**.

```
✔ Choose which packages to build (Press <space> to select, <a> to toggle all, <i> to invert selection) · dtrace-provider
? The next packages will now be built: dtrace-provider.
Do you approve? (y/N) › N
```

**Only approve when ALL of these are true:**

- The script belongs to a known legit native binding — e.g. `node-gyp`, `esbuild`, `sharp`, `dtrace-provider`, `@swc/core`, `better-sqlite3`.
- The package is widely used and the script is documented (not a transitive dep nobody recognizes).
- The user has explicitly authorized it for this project.

Use `pnpm approve-builds -g` to revisit approvals later. **Never approve a script just to silence the prompt** — that is the exact behavior the attackers rely on.

---

## When upgrading pnpm

pnpm 11 changed the global bin location to `$PNPM_HOME/bin/` (was `$PNPM_HOME/` in pnpm 10). After upgrading:

1. Update shell PATH to point to `$PNPM_HOME/bin`:
   ```bash
   # ~/.zshrc — the guard must match $PNPM_HOME/bin
   export PNPM_HOME="$HOME/Library/pnpm"
   case ":$PATH:" in
     *":$PNPM_HOME/bin:"*) ;;
     *) export PATH="$PNPM_HOME/bin:$PATH" ;;
   esac
   ```
2. If you hit `ERR_PNPM_UNEXPECTED_STORE`, wipe the stale global slot and reinstall:
   ```bash
   rm -rf ~/Library/pnpm/global/5
   pnpm install -g <your-global-tools>
   ```
3. Verify after reload:
   ```bash
   exec zsh
   pnpm --version       # → 11.x
   pnpm store path      # → ~/Library/pnpm/store/v3 (pnpm 11 store layout)
   ```

---

## Forbidden patterns

These are blocking issues in code review:

- ❌ `npm install -g pnpm` — bypasses corepack version pinning.
- ❌ Project missing `packageManager` field in `package.json`.
- ❌ Project missing `.npmrc` with `ignore-scripts` + `min-release-age`.
- ❌ CI running `pnpm install` without `--frozen-lockfile`.
- ❌ Approving lifecycle scripts blindly to "make install work."
- ❌ Mixing package managers in the same project (multiple lockfiles: `pnpm-lock.yaml` + `package-lock.json` + `yarn.lock`).

---

## When the rule does not apply

- **Non-Node.js projects** — Python (uv), Go (go mod), Rust (cargo), etc. follow their own ecosystem rules.
- **One-off scripts** outside a project root — `npx` or `pnpm dlx` is fine for transient tooling that won't be committed.
- **Existing projects in maintenance-only mode** — propose a migration plan rather than forcing immediate change; coordinate with the user before changing CI.
