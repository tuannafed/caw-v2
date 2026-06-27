---
name: observability
description: Instrument code so production behavior is visible and diagnosable. Load when a task ships a feature to production with retries/queues/external dependencies, adds services/endpoints/background jobs/integrations, or when an incident was slow to diagnose for lack of telemetry. Covers structured logging, metrics, tracing, alerting — written alongside the feature, not bolted on later.
---

# Observability & Instrumentation

> Adapted from `observability-and-instrumentation` in addyosmani/agent-skills (MIT, ©
> 2025 Addy Osmani). Caw companion skill — load from a task's `skills_hint` for
> production-facing work with I/O or cross-service calls.

## Start from the questions, not the tools
Write **2–4 questions an on-call engineer will ask** about this feature when it breaks
(e.g. "is the webhook consumer falling behind?", "which provider is erroring?"). Those
questions decide what you emit. Then map: **metrics** for "how often / how fast",
**logs** for "why", **traces** for "where the time went".

## The four signals
1. **Structured logging** — every log line is a machine-readable JSON object with a
   stable event name + bounded fields. Never string interpolation. Levels mean things:
   `error` (invariant broken), `warn` (degraded but handled), `info` (business event),
   `debug` (diagnostic). A **correlation/request id** propagates through every log, span,
   and outbound call. **Never log** secrets, tokens, passwords, or full PII — allowlist
   safe fields.
2. **Metrics** — RED for request services (Rate, Errors, Duration), USE for resources
   (Utilization, Saturation, Errors). Read **percentiles** (p50/p95/p99), never averages.
   **Bound your label sets** (route template, status class, provider) — never user ids,
   raw URLs, or error strings as labels (cardinality explosion).
3. **Tracing** — OpenTelemetry for vendor-neutral auto-instrumentation of HTTP/DB.
   Propagate context across async boundaries or the trace breaks. Manual spans only
   around meaningful business units.
4. **Alerting** — alert on **symptoms users feel** (error rate, latency), not causes
   (CPU, disk). Every alert is actionable: a linked runbook, a threshold justified by an
   SLO, and a severity (page = user-facing, ticket = degradation).

## Verify it actually works
In staging: force errors, send test traffic, follow a request end-to-end across logs +
trace, and test-fire an alert. Telemetry you never exercised is telemetry you can't trust.

> Not for live debugging (use systematic debugging) or perf profiling (use
> `caw:performance-optimization`).
