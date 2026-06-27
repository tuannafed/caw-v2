---
name: performance-optimization
description: Optimize performance with a measure-first discipline. Load when a task has explicit performance requirements, a suspected regression, Core Web Vitals/load-time goals, or handles large datasets / high traffic. Enforces MEASURE → IDENTIFY → FIX → VERIFY → GUARD so you fix the proven bottleneck, not a guessed one.
---

# Performance Optimization

> Adapted from `performance-optimization` in addyosmani/agent-skills (MIT, © 2025 Addy
> Osmani). Caw companion skill — load from a task's `skills_hint` when perf is in scope.

**Performance work without measurement is guessing.** Premature optimization adds
complexity with no proven benefit. Follow the loop:

1. **MEASURE** — establish a baseline. Synthetic (Lighthouse, DevTools) + real-user
   (web-vitals, CrUX) for frontend; profiler / query logs / APM for backend. Write the
   number down.
2. **IDENTIFY** — profile to find the **actual** bottleneck. Do not assume — the slow
   thing is rarely the thing you'd guess.
3. **FIX** — address that one constraint. Nothing speculative.
4. **VERIFY** — re-measure. Confirm the number moved. If it didn't, revert and re-identify.
5. **GUARD** — add a test/budget/monitor so the regression can't silently come back.

## Where bottlenecks live
**Frontend:** oversized bundles, render-blocking resources, CWV (LCP > 2.5s, INP > 200ms,
CLS > 0.1), unnecessary re-renders, unoptimized images.
**Backend:** N+1 queries, missing indexes, unbounded fetches, missing/weak caching,
memory leaks, synchronous heavy compute on the request path.

## Common, evidence-backed fixes
Query batching / `include` to kill N+1 · pagination + bounded fetches · DB indexes on
hot filters · image optimization (`srcset`/`<picture>`/lazy) · code splitting · memoize
genuinely expensive components · HTTP + application-level caching.

## When NOT to
No optimization without evidence of a real problem. A "this could be faster" with no
measurement is not a finding — it's noise. Don't trade readability for micro-gains the
profiler didn't ask for.
