// auth.ts — client-side localStorage auth check shared across App + pages.
//
// Credentials (PUBLIC_AUTH_USER + PUBLIC_AUTH_PASS) are inlined into the JS
// bundle at build time by Vite. This is a low-stakes deterrent, not a real
// security boundary — anyone with DevTools can read the credentials.
//
// If env vars are missing, auth is bypassed (safe-deploy mode — site is open
// until vars are configured in .env or Vercel dashboard).

const STORAGE_KEY = 'caw_auth';

// Vite 7+ requires static `import.meta.env.X` access.
const EXPECTED_USER = import.meta.env.PUBLIC_AUTH_USER;
const EXPECTED_PASS = import.meta.env.PUBLIC_AUTH_PASS;

export function isAuthConfigured(): boolean {
  return Boolean(EXPECTED_USER) && Boolean(EXPECTED_PASS);
}

export function getExpectedUser(): string | undefined {
  return EXPECTED_USER;
}

export function getExpectedPass(): string | undefined {
  return EXPECTED_PASS;
}

// Returns true when:
//   - Auth not configured (bypass), OR
//   - localStorage.caw_auth equals the expected username
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return true; // SSR safe — no gate
  if (!isAuthConfigured()) return true;
  return localStorage.getItem(STORAGE_KEY) === EXPECTED_USER;
}

export function signIn(user: string, pass: string): boolean {
  if (user !== EXPECTED_USER || pass !== EXPECTED_PASS) return false;
  if (typeof window !== 'undefined' && EXPECTED_USER) {
    localStorage.setItem(STORAGE_KEY, EXPECTED_USER);
  }
  return true;
}

export function signOut(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
