# 🚨 ADV-2026-003: TanStack "Mini Shai-Hulud" Supply Chain Attack – Incident Response Guide

**Severity:** CRITICAL
**Date:** 2026-05-12
**Attack window:** 2026-05-11 19:20–19:26 UTC
**Status:** Active

## ⚡ Executive Summary

- 80+ npm packages in the **TanStack** ecosystem (e.g. `@tanstack/react-router`, `router-core`) were trojanized with credential-stealing code.
- Any machine that ran `npm install` or a CI/CD pipeline during the attack window is highly likely to have leaked every Secret on disk: GitHub, AWS, NPM, Kubernetes, Vault, `.env` files.
- The malware installs **persistent backdoors** into the configuration directories of **VS Code** (`.vscode/`) and **Claude Code** (`.claude/`) — not only inside `node_modules`. Removing `node_modules` alone does NOT clean the infection.
- The attacker may push impersonated commits to repositories under the identity of the Claude bot.

👉 Immediate action: Scan repos and machines → rotate every token/key → delete infected `.claude/` and `.vscode/` → reinstall patched versions.

---

## 📌 Indicators of Compromise (IOC)

### Affected packages (non-exhaustive)

- `@tanstack/react-router` (versions published during the attack window)
- `router-core`
- 80+ other packages in the TanStack ecosystem — refer to TanStack's official advisory on X/Twitter and GitHub Security Advisories for the full list.

### Filesystem — IOC filenames

Search the entire machine and every project for:

- `router_init.js`
- `router_runtime.js`
- `setup.mjs`

Pay special attention to:

- `.claude/` (every project, including global `~/.claude/`)
- `.vscode/` (every project, including global VS Code config)
- `node_modules/@tanstack/**`
- `node_modules/router-core/**`

### File hash verification

If a `router_init.js` file is found, compute its SHA-256:

```bash
shasum -a 256 router_init.js
```

If the hash **starts with `ab4fcadaec`** and **ends with `66c`** → the machine is confirmed compromised.

### Git history

Check repositories for impersonated commits authored by the Claude bot identity:

```bash
git log --all --author=claude@users.noreply.github.com
```

Any commit not intentionally produced by the user or team is an IOC.

---

## 🔍 Detection

### 1. Scan filesystem for malicious files

```bash
# Scan the entire user home (may take time)
find "$HOME" -type f \( -name "router_init.js" -o -name "router_runtime.js" -o -name "setup.mjs" \) 2>/dev/null

# Focused scan on persistence locations
find "$HOME/.claude" "$HOME/.vscode" -type f 2>/dev/null \
  | grep -E "(router_init|router_runtime|setup\.mjs)"

# Scan the current project
find . -type f \( -name "router_init.js" -o -name "router_runtime.js" -o -name "setup.mjs" \) \
  -not -path "*/node_modules/.cache/*" 2>/dev/null
```

### 2. Lockfile check

Search `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` for TanStack-family packages whose resolved version was published during the attack window (releases between 2026-05-11 and 2026-05-12 UTC).

```bash
grep -E "@tanstack/|router-core" pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null
```

### 3. Git history audit

```bash
git log --all --author=claude@users.noreply.github.com --format="%h %an <%ae> %s"
git log --all --since="2026-05-11" --format="%h %an <%ae> %s" | grep -i claude
```

### 4. Verify hash of suspicious files

```bash
shasum -a 256 path/to/router_init.js
# If the result matches pattern: ab4fcadaec…66c → INFECTED
```

---

## ⚠️ Risks

- Leak of every secret on disk: GitHub PATs, AWS Access Keys, NPM tokens, kubeconfig, Vault tokens, `.env` values.
- Persistent re-infection via IDE/AI configuration directories (`.vscode/`, `.claude/`) — survives `rm -rf node_modules`.
- Lateral movement to other repositories via stolen GitHub PATs.
- Impersonated commits to repositories under the Claude bot identity.
- Legal and compliance exposure if customer data was accessible from a compromised host.

---

## 🛠️ Remediation

### Not infected (no IOC matched)

1. Pin TanStack packages to the patched versions published in TanStack's official advisory.
2. Add `overrides` in `package.json` to block the malicious versions:
   ```json
   {
     "overrides": {
       "@tanstack/react-router": "<safe-version>",
       "router-core": "<safe-version>"
     }
   }
   ```
3. Reinstall safely:
   ```bash
   rm -rf node_modules
   pnpm install --ignore-scripts
   ```

### Infected (any IOC matched)

**Treat all credentials as compromised — there is no middle ground.**

1. **Isolate the machine:** disconnect from the network, pause every CI/CD pipeline that uses this user's or host's credentials.
2. **Remove persistence:**
   ```bash
   # Back up personal settings first, then remove .claude/ and .vscode/
   # in every project that used TanStack
   rm -rf <project>/.claude
   rm -rf <project>/.vscode
   # Inspect global config too
   ls -la ~/.claude ~/.vscode
   # Remove infected node_modules and lockfiles
   rm -rf node_modules pnpm-lock.yaml package-lock.json yarn.lock
   ```
3. **Rotate ALL credentials — mandatory, not optional:**
   - AWS: revoke and re-issue every Access Key.
   - GitHub: revoke and re-issue Personal Access Tokens, SSH keys, deploy keys.
   - NPM: revoke and re-issue publish tokens.
   - Stripe / payment providers: rotate API keys.
   - Kubernetes kubeconfig, Vault tokens, database passwords.
   - Every value present in `.env` files on the host.
4. **Audit GitHub activity:** review org/repo audit logs, push activity, unusual branches or forks.
5. **Re-image the machine** (strongly recommended) — persistence may live outside the known paths.
6. **Notify** the legal and security teams per internal policy.

---

## ✅ Safe Versions

Only reinstall TanStack packages after:
- TanStack officially announces patched versions through verified channels (X/Twitter, GitHub Security Advisories).
- The patched version was published **after** the attack window closed (2026-05-11 19:26 UTC).

Always verify on npmjs.com before pinning.

---

## 🛡️ Prevention

### Short-term

```bash
# Skip install scripts when installing dependencies
pnpm install --ignore-scripts
npm ci --ignore-scripts
```

`.npmrc` (every project):
```
ignore-scripts=true
min-release-age=3d
```

`min-release-age=3d` refuses installation of any package published less than 3 days ago — this closes most active supply-chain attack windows before they reach the machine.

### Use pnpm 11+ (defense-in-depth)

pnpm 11 ships two security defaults that directly mitigate this advisory. See [`rules/common/package-manager.md`](../../rules/common/package-manager.md) for the full policy.

1. **Lifecycle scripts are blocked by default.** When a package wants to run a build/postinstall script, pnpm pauses install and asks for approval. Reject by default; only approve native-binding builds you actually need (e.g. `node-gyp`, `esbuild`, `sharp`, `dtrace-provider`).
2. **`packageManager` pin enforcement.** Combined with corepack, the project's `packageManager` field locks every dev and CI to the exact pnpm version — no silent upgrade into a malicious release.

```bash
# Install / upgrade pnpm via corepack (recommended over npm i -g):
corepack enable
corepack prepare pnpm@latest --activate
```

Pin in every project `package.json`:
```json
{ "packageManager": "pnpm@11.1.1" }
```

When pnpm prompts to approve a lifecycle script during install, default answer is **N (reject)**. Use `pnpm approve-builds -g` to revisit approvals later.

### Mid-term

- Enable **OIDC / SLSA provenance** for every pipeline that publishes packages.
- Use short-lived tokens (GitHub fine-grained PATs, AWS STS) instead of long-lived keys.
- Generate SBOMs for every build artifact.
- Separate CI credentials from developer machines — dev machines must never hold production credentials.
- Enforce 2FA with hardware keys for every maintainer of an internal package.

---

## 📊 CISO Summary

- **Severity:** CRITICAL
- **Type:** Supply chain attack with persistence into IDE/AI configuration directories.
- **Blast radius:** Any developer or CI host that installed TanStack during the attack window.
- **Action:** Scan → isolate → delete `.claude/` and `.vscode/` → rotate ALL credentials → re-image.

---

## 📦 Incident Response Template

```yaml
incident_response_plan:
  detection_status: 'affected | not_affected | investigating'
  attack_window_exposure:
    installed_between_2026_05_11_19_20_and_19_26_utc: true | false
  affected_assets:
    - machine_1
    - repo_1
  iocs_found:
    - router_init.js@<path>
    - sha256:ab4fcadaec…66c
    - git_commit:<hash>@claude@users.noreply.github.com
  remediation_steps_taken:
    - removed_dot_claude_and_dot_vscode
    - rotated_aws_keys
    - rotated_github_pat
    - rotated_npm_tokens
    - reimaged_machines
  recommended_actions:
    - audit_github_org_logs
    - audit_aws_cloudtrail
    - notify_legal
  ciso_summary: 'Critical supply chain attack via TanStack npm; credentials assumed compromised on affected hosts'
  prevention_controls:
    - ignore_scripts
    - min_release_age_3d
    - oidc_provenance
    - hardware_2fa
```

---

## 🧠 Key Takeaways

- **Supply chain attack with IDE persistence** — `node_modules` removal alone is NOT sufficient cleanup.
- Always check `.claude/` and `.vscode/` for IOC files when investigating npm supply-chain compromises.
- Pinning `packageManager` + `min-release-age=3d` + rejecting lifecycle scripts by default is the strongest first line of defense.
- Critical for any project using `@tanstack/react-router`, `@tanstack/react-start`, or `router-core`.
