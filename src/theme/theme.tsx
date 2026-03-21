import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface ThemeTokens {
  'bg-primary': string;
  'bg-secondary': string;
  'bg-tertiary': string;
  'bg-input': string;
  'bg-hover': string;
  'text-primary': string;
  'text-secondary': string;
  'text-muted': string;
  'accent': string;
  'accent-hover': string;
  'accent-muted': string;
  'border': string;
  'border-focus': string;
  'success': string;
  'error': string;
  'warning': string;
  'info': string;
  'scrollbar': string;
  'scrollbar-hover': string;
  'code-bg': string;
  'code-border': string;
}

const darkTokens: ThemeTokens = {
  'bg-primary': '#1e1e1e',
  'bg-secondary': '#252526',
  'bg-tertiary': '#2d2d30',
  'bg-input': '#3c3c3c',
  'bg-hover': '#3e3e42',
  'text-primary': '#e0e0e0',
  'text-secondary': '#a0a0a0',
  'text-muted': '#6a6a6a',
  'accent': '#6c8cff',
  'accent-hover': '#5a7ae8',
  'accent-muted': 'rgba(108, 140, 255, 0.15)',
  'border': '#3e3e42',
  'border-focus': '#6c8cff',
  'success': '#4ec9b0',
  'error': '#f14c4c',
  'warning': '#cca700',
  'info': '#3794ff',
  'scrollbar': 'rgba(121, 121, 121, 0.4)',
  'scrollbar-hover': 'rgba(121, 121, 121, 0.7)',
  'code-bg': '#1a1a1a',
  'code-border': '#3e3e42',
};

const lightTokens: ThemeTokens = {
  'bg-primary': '#ffffff',
  'bg-secondary': '#f9f9f9',
  'bg-tertiary': '#f0f0f0',
  'bg-input': '#ffffff',
  'bg-hover': '#f0f0f0',
  'text-primary': '#1f2937',
  'text-secondary': '#6b7280',
  'text-muted': '#9ca3af',
  'accent': '#6366f1',
  'accent-hover': '#4f46e5',
  'accent-muted': 'rgba(99, 102, 241, 0.12)',
  'border': '#e5e7eb',
  'border-focus': '#6366f1',
  'success': '#059669',
  'error': '#dc2626',
  'warning': '#d97706',
  'info': '#2563eb',
  'scrollbar': '#d1d5db',
  'scrollbar-hover': '#9ca3af',
  'code-bg': '#f3f4f6',
  'code-border': '#e5e7eb',
};

const tokenSets: Record<ResolvedTheme, ThemeTokens> = { dark: darkTokens, light: lightTokens };

export type ResolvedTheme = 'dark' | 'light';
export type Theme = ResolvedTheme | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  tokens: ThemeTokens;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'claude-code-desktop-theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'system';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(t: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  const tokens = tokenSets[t];
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${key}`, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  const applyAndStore = useCallback((t: Theme) => {
    applyTheme(resolveTheme(t));
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyAndStore(theme);
  }, [theme, applyAndStore]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(resolveTheme('system'));
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const resolved = resolveTheme(theme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const current = resolveTheme(prev);
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, tokens: tokenSets[resolved], setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
