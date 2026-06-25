# 🚨 ADV-2026-002: React RCE (React2Shell) – Incident Response Guide

**Severity:** CRITICAL  
**Date:** 2026-02 (disclosed)  
**Attack Type:** Remote Code Execution (RCE)  
**Status:** Active / Exploitable  

---

## ⚡ Executive Summary

- Critical RCE vulnerability in React Server Components (RSC)
- Affects React 19.x ecosystem
- Exploitable via crafted server payload (no auth required)
- Impacts:
  - Next.js (App Router / RSC)
  - React Server DOM
  - Vite / Parcel RSC integrations

👉 Immediate action: Upgrade React → audit RSC usage → restrict attack surface

---

## 📌 Affected Components

### Packages

- react-server-dom-webpack
- react-server-dom-parcel
- react-server-dom-turbopack

### Vulnerable Versions

- react 19.0.0
- react 19.1.0
- react 19.1.1
- react 19.2.0

---

## ✅ Safe Versions

- react 19.0.1
- react 19.1.2
- react 19.2.1+
- latest stable (recommended)

---

## 🔍 Detection

### Check installed version

```bash
npm ls react react-dom react-server-dom-webpack
```

---

### Check usage (RSC enabled)

Look for:

- app/ directory (Next.js App Router)
- "use server" directive
- server actions / server components

---

### Runtime indicators

- Unexpected server execution
- Suspicious payload handling
- Abnormal SSR responses

---

## ⚠️ Risks

- Full Remote Code Execution (RCE)
- Server takeover (production impact)
- Data exfiltration (DB, secrets, APIs)
- Lateral movement inside infra
- Persistence via injected code

---

## 🧠 Root Cause (Technical)

- Unsafe deserialization in React Server Components
- Trust boundary violated during payload parsing
- Attacker-controlled input executed in server context

---

## 🛠️ Remediation

### Immediate fix (REQUIRED)

```bash
npm install react@latest react-dom@latest
```

---

### If cannot upgrade immediately

- Disable RSC features (temporary)
- Avoid "use server" exposure
- Restrict external input to server components
- Add strict input validation

---

### Infra mitigation

- Add WAF rules for abnormal payloads
- Rate limit suspicious endpoints
- Monitor SSR execution patterns
- Log unexpected server behavior

---

## 🔐 Recommended Hardening

- Run server with least privilege
- Isolate execution environment (container / sandbox)
- Disable dynamic code execution patterns
- Apply strict CSP / request validation

---

## 📊 CISO Summary

- Severity: CRITICAL (10.0 CVSS)
- Type: Runtime RCE vulnerability
- Impact: Production server compromise
- Action:
  - Upgrade immediately
  - Audit RSC usage
  - Apply runtime protections

---

## 📦 Incident Response Template

```yaml
incident_response_plan:
  detection_status: "affected | not_affected | investigating"
  affected_assets:
    - web_server_1
  iocs_found:
    - react@19.1.0
  remediation_steps_taken:
    - upgrade_react
    - restrict_rsc
  recommended_actions:
    - patch_systems
    - monitor_runtime
  ciso_summary: "Critical RCE in React Server Components"
  prevention_controls:
    - input_validation
    - least_privilege
    - runtime_monitoring
```

---

## 🧠 Key Takeaways

- Runtime exploit (NOT supply chain)
- Direct production impact
- Critical for Next.js App Router users
