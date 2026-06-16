import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'caw-bv-theme-v2';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore quota / private mode errors
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="size-10 rounded-xl flex items-center justify-center transition-colors"
      style={{
        background: 'oklch(0.19 0.01 48)',
        border: '1px solid color-mix(in oklch, var(--primary) 35%, transparent)',
        boxShadow: '0 0 10px -3px color-mix(in oklch, var(--primary) 25%, transparent)',
      }}
    >
      {theme === 'dark' ? (
        <Sun className="size-[18px] text-primary" strokeWidth={1.75} />
      ) : (
        <Moon className="size-[18px] text-primary" strokeWidth={1.75} />
      )}
    </button>
  );
}
