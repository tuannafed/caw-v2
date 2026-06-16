import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fetch JSON, rejecting on a non-2xx response. Plain `fetch().then(r => r.json())`
 * silently parses a 500 error body as success — callers must guard on `r.ok`.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
