import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface ThemeTokens {
  'bg-primary': string;
  'bg-secondary': string;
  'bg-tertiary': string;
  'bg-input': string;
  'text-primary': string;
  'text-secondary': string;
  'text-muted': string;
  'accent': string;
  'accent-hover': string;
  'border': string;
  'success': string;
  'error': string;
  'warning': string;
  'scrollbar': string;
  'scrollbar-hover': string;
}

const darkTokens: ThemeTokens = {
  'bg-primary': '#1e1e1e',
  'bg-secondary': '#252526',
  'bg-tertiary': '#2d2d2d',
  'bg-input': '#3c3c3c',
  'text-primary': '#cccccc',
  'text-secondary': '#999999',
  'text-muted': '#666666',
  'accent': '#007acc',
  'accent-hover': '#1a8ad4',
  'border': '#3e3e42',
  'success': '#4ec9b0',
  'error': '#f44747',
  'warning': '#cca700',
  'scrollbar': '#424242',
  'scrollbar-hover': '#555555',
};

const lightTokens: ThemeTokens = {
  'bg-primary': '#ffffff',
  'bg-secondary': '#f3f3f3',
  'bg-tertiary': '#e8e8e8',
  'bg-input': '#ffffff',
  'text-primary': '#1e1e1e',
  'text-secondary': '#616161',
  'text-muted': '#999999',
  'accent': '#0066b8',
  'accent-hover': '#005ba4',
  'border': '#d4d4d4',
  'success': '#388a34',
  'error': '#d32f2f',
  'warning': '#bf8803',
  'scrollbar': '#c1c1c1',
  'scrollbar-hover': '#a8a8a8',
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
