# Security Advisories

**ALL agents must read this index before:**
- Installing or updating dependencies
- Reviewing code that imports external packages
- Generating lockfile changes

If any advisory matches a package in the current task → **STOP and report to user before proceeding.**

---

## Active Advisories

| ID | Package | Severity | Date | Status |
|----|---------|----------|------|--------|
| [ADV-2026-001](axios-incident-response.md) | axios | CRITICAL | 2026-03-31 | Active |
| [ADV-2026-002](react-rce-incident-response.md) | react / react-server-dom-* | CRITICAL | 2026-02 | Active |
| [ADV-2026-003](tanstack-mini-shai-hulud-incident-response.md) | @tanstack/* (react-router, router-core, +80 packages) | CRITICAL | 2026-05-12 | Active |

---

## How to Check

For each advisory marked **Active**:
1. Read the advisory file for affected versions
2. Search the project lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`) for those exact versions
3. If found → halt, report finding with file:line, do not proceed
