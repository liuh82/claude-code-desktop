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
  'bg-secondary': '#f3f3f3',
  'bg-tertiary': '#e8e8e8',
  'bg-input': '#ffffff',
  'bg-hover': '#e8e8e8',
  'text-primary': '#1e1e1e',
  'text-secondary': '#616161',
  'text-muted': '#999999',
  'accent': '#5a7ae8',
  'accent-hover': '#4a6ad6',
  'accent-muted': 'rgba(90, 122, 232, 0.12)',
  'border': '#d4d4d4',
  'border-focus': '#5a7ae8',
  'success': '#388a34',
  'error': '#d32f2f',
  'warning': '#bf8803',
  'info': '#007acc',
  'scrollbar': '#c1c1c1',
  'scrollbar-hover': '#a8a8a8',
  'code-bg': '#f5f5f5',
  'code-border': '#d4d4d4',
};

const tokenSets: Record<Theme, ThemeTokens> = { dark: darkTokens, light: lightTokens };

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  tokens: ThemeTokens;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'claude-code-desktop-theme';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'dark';
}

function applyTokens(tokens: ThemeTokens) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${key}`, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  const applyAndStore = useCallback((t: Theme) => {
    applyTokens(tokenSets[t]);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    applyAndStore(theme);
  }, [theme, applyAndStore]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, tokens: tokenSets[theme], toggleTheme, setTheme }}>
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
