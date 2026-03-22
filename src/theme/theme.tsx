import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface ThemeTokens {
  'bg-primary': string;
  'bg-secondary': string;
  'bg-tertiary': string;
  'bg-elevated': string;
  'bg-input': string;
  'bg-hover': string;
  'text-primary': string;
  'text-secondary': string;
  'text-muted': string;
  'text-inverse': string;
  'accent': string;
  'accent-hover': string;
  'accent-muted': string;
  'border': string;
  'border-ghost': string;
  'border-focus': string;
  'success': string;
  'error': string;
  'warning': string;
  'info': string;
  'cta': string;
  'scrollbar': string;
  'scrollbar-hover': string;
  'code-bg': string;
  'code-border': string;
  'glass-bg': string;
}

const darkTokens: ThemeTokens = {
  'bg-primary': '#0b0f10',
  'bg-secondary': '#1a1e20',
  'bg-tertiary': '#252a2d',
  'bg-elevated': '#1e2224',
  'bg-input': '#2a2f32',
  'bg-hover': '#3a3f42',
  'text-primary': '#e0e4e8',
  'text-secondary': '#b8bcc0',
  'text-muted': '#8a8f92',
  'text-inverse': '#f7f7ff',
  'accent': '#4a8eff',
  'accent-hover': '#6c9fff',
  'accent-muted': 'rgba(74, 142, 255, 0.15)',
  'border': '#3a3f42',
  'border-ghost': 'rgba(58, 63, 66, 0.40)',
  'border-focus': 'rgba(74, 142, 255, 0.50)',
  'success': '#4ec9b0',
  'error': '#f14c4c',
  'warning': '#cca700',
  'info': '#3794ff',
  'cta': '#fb923c',
  'scrollbar': 'rgba(121, 121, 121, 0.4)',
  'scrollbar-hover': 'rgba(121, 121, 121, 0.7)',
  'code-bg': '#1a1e20',
  'code-border': '#3a3f42',
  'glass-bg': 'rgba(26, 30, 32, 0.85)',
};

const lightTokens: ThemeTokens = {
  'bg-primary': '#f8f9fb',
  'bg-secondary': '#e8eff3',
  'bg-tertiary': '#e1e9ee',
  'bg-elevated': '#f0f4f7',
  'bg-input': '#ffffff',
  'bg-hover': '#d9e4ea',
  'text-primary': '#2a3439',
  'text-secondary': '#57606a',
  'text-muted': '#566166',
  'text-inverse': '#f7f7ff',
  'accent': '#005bc0',
  'accent-hover': '#004fa9',
  'accent-muted': 'rgba(0, 91, 192, 0.10)',
  'border': '#a9b4b9',
  'border-ghost': 'rgba(169, 180, 185, 0.20)',
  'border-focus': 'rgba(0, 91, 192, 0.50)',
  'success': '#22c55e',
  'error': '#ef4444',
  'warning': '#f59e0b',
  'info': '#005bc0',
  'cta': '#f97316',
  'scrollbar': '#d9e4ea',
  'scrollbar-hover': '#a9b4b9',
  'code-bg': '#f8f9fb',
  'code-border': 'transparent',
  'glass-bg': 'rgba(248, 249, 251, 0.85)',
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
  // CSS custom properties in globals.css already define all tokens.
  // JS tokens are used only for programmatic access (e.g. inline styles).
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

  useEffect(() => {
    applyAndStore(theme);
  }, [theme, applyAndStore]);

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
