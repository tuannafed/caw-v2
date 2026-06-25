# 🚨 ADV-2026-001: Axios npm Hijack – Incident Response Guide

**Severity:** CRITICAL  
**Date:** 2026-03-31  
**Attack window:** 00:21–03:15 UTC, 2026-03-31  
**Status:** Active

## ⚡ Executive Summary

- Axios maintainer npm account compromised
- Malicious versions:
  - axios@1.14.1
  - axios@0.30.4
- Hidden dependency:
  - plain-crypto-js@4.2.1 (RAT)
- Attack window: March 31, 2026 (00:21–03:15 UTC)

👉 Immediate action: Scan lockfiles → isolate machines → rotate secrets

---

## 📌 Indicators of Compromise (IOC)

### Packages

- axios@1.14.1
- axios@0.30.4
- plain-crypto-js@4.2.1

### Network

- Domain: sfrclak.com
- IPs: 142.11.206.73, 23.254.167.216

### Filesystem

- macOS: /Library/Caches/com.apple.act.mond
- Linux: /tmp/ld.py
- Windows:
  - %PROGRAMDATA%wt.exe
  - %TEMP%6202033.vbs
- Node:
  - node_modules/plain-crypto-js/setup.js

---

## 🔍 Detection

### Lockfile check

Search:
axios@1.14.1
axios@0.30.4
plain-crypto-js@4.2.1

### Node modules

```bash
find node_modules -name plain-crypto-js -type d
```

### Network logs

Check for:

- sfrclak.com
- suspicious IPs

---

## ⚠️ Risks

- Credential theft (.env, tokens, SSH)
- Lateral movement
- Source code leakage
- Supply chain compromise
- Legal exposure

---

## 🛠️ Remediation

### Not infected

```bash
npm install axios@1.14.0 --ignore-scripts
rm -rf node_modules/plain-crypto-js
```

package.json:

```json
{
  "overrides": {
    "axios": "1.14.0"
  }
}
```

---

### Infected

- Isolate machine
- Re-image system
- Rotate ALL credentials
- Audit logs
- Notify legal if needed

---

## ✅ Safe Versions

Use any axios version **not** listed above. Latest safe: `1.8.4` (verify on npmjs.com).

---

## 🛡️ Prevention

### Short-term

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
```

.npmrc:
min-release-age=3d

### Mid-term

- OIDC / SLSA
- SBOM
- Short-lived tokens
- Consider pnpm

---

## 📊 CISO Summary

- Severity: HIGH
- Type: Supply chain attack
- Action: Scan → isolate → rotate → prevent

---

## 📦 Incident Response Template

```yaml
incident_response_plan:
  detection_status: 'affected | not_affected | investigating'
  affected_assets:
    - machine_1
  iocs_found:
    - axios@1.14.1
  remediation_steps_taken:
    - downgrade_axios
    - block_c2
  recommended_actions:
    - rotate_credentials
    - reimage_machines
  ciso_summary: 'High severity supply chain attack'
  prevention_controls:
    - oidc_provenance
    - ignore_scripts
```
