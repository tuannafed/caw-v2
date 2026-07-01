---
name: react-component-testing
description: Fast, leak-free patterns for testing React components with Jest + React Testing Library + TanStack Query. Avoids the common anti-patterns that cause "tests pass but jest hangs" and 5+ GB RAM spikes. Use when writing or reviewing component tests in a Next.js / React app with jest + jsdom. Prefer hook + util + store unit tests over component tests; only test components for high-value user flows that can't be covered by Playwright E2E.
---

# React Component Testing (Jest + RTL + TanStack Query)

Component tests in jsdom are slow (200ms-2s each) and leak-prone. This skill exists because the default Anthropic `webapp-testing` skill is Playwright-only and `javascript-testing-patterns` is generic — neither covers the specific pitfalls of jest + RTL + QueryClient that cause hung test runs.

## When NOT to write a component test

Default to **skipping** component tests. Prefer cheaper alternatives:

| Goal | Better tool |
|---|---|
| Validate schema / business logic | Unit test on the schema/util/store directly |
| Validate hook behavior | `renderHook` test (cheap) |
| Validate user flow end-to-end | Playwright E2E (slower but real) |
| Validate component renders specific markup | Visual review or snapshot (rare) |

Only write a component test when:
1. The component encapsulates non-trivial logic that can't be extracted to a hook/util
2. The flow is critical (auth, payment, data submission) AND no Playwright E2E exists yet
3. You need to assert form validation behavior across multiple interaction states

If none of those apply: write a hook test (`renderHook` from `@testing-library/react`) or a util test instead.

## Mandatory patterns when you DO write a component test

### 1. Hoist QueryClient per `describe`, cleanup in `afterEach`

The single biggest cause of hung jest runs is creating a fresh `QueryClient` inside every `it()`. Each client starts a 5-minute `gcTime` timer that holds the event loop alive.

❌ **WRONG** — leak factory:

```tsx
const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

it("renders", () => {
  render(<Form />, { wrapper: createWrapper() });  // leak per test
});
```

✅ **CORRECT** — hoisted client + explicit cleanup:

```tsx
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

describe("ProfileInfoForm", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
    queryClient.unmount();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("renders pre-populated fields", () => {
    render(<ProfileInfoForm />, { wrapper });
    // assertions...
  });
});
```

Critical flags:
- `gcTime: 0` — disables the 5-minute garbage collection timer
- `retry: false` — disables retry timer (queries + mutations)
- `staleTime: Infinity` — prevents background refetch timer
- `clear()` + `unmount()` in `afterEach` — releases internal subscriptions

### 2. `userEvent.setup({ delay: null })` for fast keystrokes

`userEvent.setup()` defaults to **50ms delay between keystrokes** to simulate real user typing. For `await user.type("Hello World")` (11 chars) that's 550ms wasted per call.

❌ Slow:
```tsx
const user = userEvent.setup();
await user.type(input, "Jane Doe");  // 8 × 50ms = 400ms
```

✅ Fast (use `null` to disable delay):
```tsx
const user = userEvent.setup({ delay: null });
await user.type(input, "Jane Doe");  // ~5ms total
```

Only keep the default delay if your test specifically validates debounce/throttle behavior.

### 3. Mock fetch with explicit responses, not generic `jest.fn()`

Mocking hooks with `jest.fn()` is fine for input testing but breaks integration: mutations don't trigger `onSuccess`, queries don't return data, so `waitFor(() => expect(toast.success).toHaveBeenCalled())` waits the full 1000ms timeout and fails or hangs.

❌ Trap (mutation never resolves, `waitFor` times out):
```tsx
useUpdateProfile.mockReturnValue({
  mutate: jest.fn(),  // never invokes onSuccess
  isPending: false,
});
// later...
await waitFor(() => expect(toast.success).toHaveBeenCalled());  // 1s wait, then fail
```

✅ Either mock fetch with MSW (preferred) OR explicitly invoke the callback:

```tsx
// Option A — explicit callback
useUpdateProfile.mockReturnValue({
  mutate: jest.fn((data, options) => options?.onSuccess?.(data)),
  isPending: false,
});

// Option B — MSW (best for integration tests)
// see msw.io/docs — set up rest.post('/api/profile', ...) handlers
```

### 3b. Mount the real Provider for Context-scoped behavior — never mock the Context itself

If the component/hook under test reads scope (auth, tenant, `clinicId`, role, feature
flags, etc.) from a Context, that Context is part of the unit under test — mocking it
directly hides exactly the bugs you're trying to catch (wrong scope, wrong default
value, Provider mounted at the wrong tree depth in production).

❌ **WRONG** — mocks away the thing that can be broken:
```tsx
jest.mock("../contexts/ClinicContext", () => ({
  useClinicContext: () => ({ clinicId: "clinic-123" }), // always "works", proves nothing
}));
```

✅ **CORRECT** — mount the real Provider with realistic values in the wrapper:
```tsx
const wrapper = ({ children }: { children: ReactNode }) => (
  <ClinicProvider clinicId="clinic-123">
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </ClinicProvider>
);
```

This is the only way a test can catch a Provider mounted at the wrong scope, a
`clinicId`/role defaulting to an unscoped value, or a consumer rendered outside its
Provider. A test that mocks the Context can go green while the real component throws
`must be used within Provider` or leaks data across scopes in production.

Ask before mocking anything: *"if the real implementation called/scoped the wrong
thing, would this test still pass?"* If yes, the mock is at the wrong boundary — move
it further out (network/DB client), not onto the Context/hook under test.

### 4. Cap `waitFor` timeout when the assertion is fast

Default `waitFor` timeout is 1000ms. If your assertion is for a synchronous re-render after a mocked mutation, use a short timeout to fail fast:

```tsx
await waitFor(() => expect(toast.success).toHaveBeenCalled(), { timeout: 100 });
```

### 4b. Fake timers when the test uses `setTimeout` / `setInterval` / debounce

**The pitfall (the reason this is here):** real timers from `debounce`/`setTimeout`
keep the jest worker alive *after* assertions pass — another source of "tests pass
but jest hangs." Swap in fake timers and flush pending ones in `afterEach`.

The exact `jest.useFakeTimers()` / `runOnlyPendingTimers()` / `useRealTimers()`
recipe is standard Jest — query Context7 if you need the syntax.

### 4c. Reset zustand `persist` / localStorage between tests

If a store uses the `persist` middleware, reset it in `afterEach` — otherwise state leaks across tests:

```tsx
afterEach(() => {
  useMyStore.persist.clearStorage();
  useMyStore.setState(initialState, true);
});
```

### 5. Cap workers + memory at the run level

Jest defaults to `cpus-1` workers, each ~600MB with jsdom. Always pass:

```bash
node_modules/.bin/jest <file> --maxWorkers=2 --workerIdleMemoryLimit=512MB
```

### 6. Verify no leaks before declaring tests-done

After writing component tests, run once with `--detectOpenHandles`:

```bash
node_modules/.bin/jest <file> --detectOpenHandles --maxWorkers=1
```

If output lists open handles → fix the source. **Do not** mask with `--forceExit`.

## Recommended test count per component file

Cap at **5-7 `it()` blocks per component test file**. More than that = the component is doing too much. Break into smaller components or move to E2E.

## Anti-patterns checklist (reject in review)

- [ ] `createXxxWrapper()` factory called inside `it()` — leak
- [ ] No `afterEach` cleanup of QueryClient — leak
- [ ] `userEvent.setup()` without `delay: null` for non-debounce tests — slow
- [ ] `jest.fn()` mock for mutation/query returning data — broken integration
- [ ] Context/Provider mocked directly instead of mounted for real — hides scope bugs
- [ ] No `gcTime: 0` on test QueryClient — 5-minute timer leak
- [ ] `--forceExit` to hide handle leaks — masks bugs
- [ ] More than 7 `it()` in one component test file — refactor signal (see cap above)

## Quick template

```tsx
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MyComponent } from "../my-component";

jest.mock("../hooks", () => ({
  useMyQuery: jest.fn(() => ({ data: { /* ... */ }, isLoading: false })),
  useMyMutation: jest.fn(() => ({
    mutate: jest.fn((data, options) => options?.onSuccess?.(data)),
    isPending: false,
  })),
}));

describe("MyComponent", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
    queryClient.unmount();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("renders happy path", () => {
    render(<MyComponent />, { wrapper });
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("handles user submit", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MyComponent />, { wrapper });

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText(/success/i)).toBeInTheDocument(), { timeout: 100 });
  });
});
```
