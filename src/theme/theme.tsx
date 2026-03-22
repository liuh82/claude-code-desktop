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
  'bg-primary': '#131314',
  'bg-secondary': '#201f20',
  'bg-tertiary': '#2a2a2b',
  'bg-elevated': '#1c1b1c',
  'bg-input': '#0e0e0f',
  'bg-hover': '#353436',
  'text-primary': '#e5e2e3',
  'text-secondary': '#c1c6d7',
  'text-muted': '#8b90a0',
  'text-inverse': '#f7f7ff',
  'accent': '#adc6ff',
  'accent-hover': '#4b8eff',
  'accent-muted': 'rgba(173, 198, 255, 0.10)',
  'border': '#414755',
  'border-ghost': 'rgba(65, 71, 85, 0.20)',
  'border-focus': 'rgba(173, 198, 255, 0.50)',
  'success': '#4ade80',
  'error': '#f87171',
  'warning': '#fbbf24',
  'info': '#adc6ff',
  'cta': '#adc6ff',
  'scrollbar': 'rgba(53, 52, 54, 0.6)',
  'scrollbar-hover': 'rgba(53, 52, 54, 0.9)',
  'code-bg': '#0e0e0f',
  'code-border': 'rgba(65, 71, 85, 0.20)',
  'glass-bg': 'rgba(19, 19, 20, 0.80)',
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
  'border-ghost': 'rgba(169, 180, 185, 0.30)',
  'border-focus': 'rgba(0, 91, 192, 0.50)',
  'success': '#22c55e',
  'error': '#ef4444',
  'warning': '#f59e0b',
  'info': '#005bc0',
  'cta': '#f97316',
  'scrollbar': '#d9e4ea',
  'scrollbar-hover': '#a9b4b9',
  'code-bg': '#ffffff',
  'code-border': 'rgba(169, 180, 185, 0.40)',
  'glass-bg': 'rgba(255, 255, 255, 0.90)',
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
