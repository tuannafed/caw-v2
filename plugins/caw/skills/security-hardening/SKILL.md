---
name: security-hardening
description: Harden code against vulnerabilities. Load when a task handles user input, authentication/authorization, secrets, data storage, file uploads, payments/PII, external integrations, webhooks, or LLM/AI features. Provides a threat-model-first checklist (STRIDE, OWASP, supply chain) the coder applies while writing and the reviewer audits against.
---

# Security Hardening

> Adapted from `security-and-hardening` in addyosmani/agent-skills (MIT, © 2025 Addy
> Osmani). Caw companion skill — load it from a task's `skills_hint` when the task
> touches a trust boundary.

## Threat-model first (2 minutes, before coding)

1. **Trust boundaries** — HTTP requests, form fields, file uploads, webhooks, external
   APIs, LLM output. Everything crossing one is hostile until validated.
2. **Assets at risk** — credentials, PII, payment data, admin actions.
3. **STRIDE** the boundary — Spoofing, Tampering, Repudiation, Info disclosure, DoS,
   Elevation of privilege. Write the abuse cases as tests next to the use cases.

## Always do (no exceptions)
- Validate all external input at the boundary (schema/Zod — strict types, sizes, enums).
- Parameterize DB queries; never concatenate user data into SQL.
- Rely on framework output-encoding for XSS (React default); DOMPurify only if you must render HTML.
- Hash passwords with bcrypt/scrypt/argon2 (≥12 rounds). Secrets from env only.
- Sessions: `httpOnly` + `secure` + `sameSite` cookies; never auth tokens in localStorage.
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options.
- Every protected endpoint verifies the authed user **owns** the resource (authz ≠ authn).
- Exclude secrets/hashes/tokens from API responses (sanitize serializers).

## Ask the user first (sensitive — don't silently ship)
New/changed auth flows · new PII/payment categories · external integrations · CORS
changes · file-upload handlers · rate-limit changes · permission/role elevation.

## Never do
Commit secrets · log passwords/tokens/card numbers · trust client-side validation as a
security boundary · `eval()`/`innerHTML` with user data · wildcard `*` CORS · expose
stack traces to users.

## High-value categories
- **Access control** — the #1 web vuln. Object-level ownership check on every resource.
- **SSRF** — allowlist schemes + hosts; reject private/reserved IPs; no redirects on user URLs.
- **File upload** — allowlist MIME + size; validate magic bytes; never trust extensions.
- **Rate limiting** — general APIs ~100/15min; auth endpoints ~10/15min.
- **LLM/AI** — treat model output as untrusted (never straight to SQL/eval/shell/innerHTML/paths);
  prompts are not a security boundary; keep secrets/PII out of the context window; scope tool perms.

## Secrets
`.env.example` committed (placeholders) · `.env`/`*.pem`/`*.key` gitignored · if a secret
was ever committed, **rotate it** — deleting the line or rewriting history is not enough.
(caw also installs a gitleaks pre-commit hook via `/caw:setup`.)

## Verification checklist
- [ ] external input validated at boundaries
- [ ] authz on every protected endpoint (ownership checked)
- [ ] no secrets in source/responses/logs
- [ ] security headers present
- [ ] rate limiting on auth endpoints
- [ ] server-side URL fetches allowlisted (no SSRF)
- [ ] LLM output validated before use
- [ ] no critical/high in dependency audit
