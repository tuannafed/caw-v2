---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---
# Rule: React effect/memo dependencies — never key on an unstable object reference

**Layer:** rules — project-wide convention for React projects (conditional: load only when the
project uses React).
**Used by:** coder (writing React components), reviewer.
**Why this exists:** a `useEffect` that calls `reset`/`setState` and is keyed on an object whose
*reference* changes every render — most commonly a server-state result object — produces an
infinite render loop ("Maximum update depth exceeded") that crashes to the error boundary. It
often hides until a specific data condition appears, so unit tests and a quick manual click don't
surface it.

> **Provenance:** ported into caw from a real project (dava2) where a config editor crashed on the
> first save: a `useMemo` keyed on a React Query result object (new identity every refetch) fed a
> `useEffect` that called `form.reset`. Before the first save the source was a constant `null`
> (stable); the first save made the query return a live, re-fetching object → loop.

---

## The anti-pattern

```tsx
// `source` comes from a query result — a NEW object every refetch, same values, new identity.
const source = remoteData ?? fallback;

const initial = useMemo(() => buildValues(source), [source]); // ❌ keyed on object ref
useEffect(() => { form.reset(initial); }, [initial]);          // ❌ runs every render
```

Why it loops: `source` is a fresh reference each render → `useMemo([source])` recomputes →
`initial` is new each render → `useEffect([initial])` fires → `form.reset` re-renders → repeat.

---

## The rule

**A `useEffect` / `useMemo` / `useCallback` dependency array must contain only values that are
stable across renders unless their *value* actually changed.**

- ✅ **Primitives** (string, number, boolean) — stable by value. Always safe.
- ✅ **Refs / setState functions / stable callbacks** — React guarantees identity.
- ⚠️ **Objects / arrays** — only safe if their reference is stable (their own
  `useMemo`/`useState`/`useRef`, or a prop the parent memoised). A bare object off a query result,
  a prop object, an object literal, or a `.map()`/`.filter()`/spread rebuilt each render is **NOT
  stable** — do not put it in a dep array.

### When you need to react to the *value* of an unstable object

Key the dependency on a **stable derivation of its value**, not the reference:

```tsx
const sourceKey = JSON.stringify(source ?? null);
// keyed on the serialised value, not the object reference
const initial = useMemo(() => buildValues(source), [sourceKey]);
useEffect(() => { form.reset(initial); }, [initial]); // now stable
```

Alternatives, in order of preference:
1. **Depend on the primitive fields you actually use** (`[obj.a, obj.b]`) — best when few fields
   matter.
2. **`JSON.stringify` key** — fine for small config blobs; don't stringify large/hot objects every
   render.
3. **Select a stable reference upstream** — query-library `select` + structural sharing, or
   memoise the object where it's created so identity changes only when value changes.

Never silence the loop by emptying the dep array (`[]`) when the effect genuinely must re-run on
value change — that reintroduces a stale-state bug.

---

## `form.reset` / `setState` inside an effect — extra scrutiny

These trigger a render. In an effect whose deps can change identity every render, they generate a
loop. Before writing one, answer: *what makes this effect's deps change?* (any non-primitive not
pinned by a hook → changes every render) and *does the value actually change, or just the
reference?* (if only the reference, key on the value).

---

## Reviewer enforcement

| Issue | Severity |
|---|---|
| `useEffect` calling `reset`/`setState`/`setValue` with a non-primitive, non-memoised object/array in its dep array | `HIGH` |
| `useMemo`/`useCallback` dep array containing a query `.data` object (or a field destructured from it) **by reference** | `HIGH` |
| Object literal / `.map()` / `.filter()` / spread result placed directly in a dep array | `MEDIUM` |
| A loop "fixed" by emptying the dep array when the effect must react to value changes | `HIGH` (reintroduces a stale-state bug) |

A lint-ignore comment for exhaustive-deps is allowed **only** when the dep is intentionally keyed
on a stable derivation (e.g. a `JSON.stringify` key) and the comment says so. A bare ignore that
hides an unstable object dep is rejected.

---

## Quick self-check before committing a React component

- [ ] Every dep in every `useEffect`/`useMemo`/`useCallback` is a primitive, a ref/stable
      callback, or an object whose identity is pinned by a hook.
- [ ] No object straight off `query.data` / a prop / an object literal sits in a dep array by
      reference.
- [ ] Any `form.reset`/`setState` inside an effect re-runs only when its source *value* changed.
- [ ] If you ran the screen, the first save / first load did not spike CPU or hit "Maximum update
      depth exceeded".

---

## When this rule does not apply

- Non-React code (backend, edge worker, plain scripts).
- Effects whose deps are genuinely all primitives or stable references — the common, correct case.
  This rule targets the unstable-object trap, not all effects.
