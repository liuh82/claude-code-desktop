import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface AppSettings {
  // General
  defaultProjectPath: string;
  autoSaveInterval: number;
  maxConcurrentSessions: number;

  // Appearance
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  fontFamily: string;

  // Claude Code
  claudeCliPath: string;
  defaultModel: string;
  permissionMode: 'default' | 'strict' | 'permissive';
  maxTokens: number;

  // Advanced
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  dataDirectory: string;
}

const STORAGE_KEY = 'claude-code-desktop-settings';

const DEFAULT_SETTINGS: AppSettings = {
  defaultProjectPath: '',
  autoSaveInterval: 30,
  maxConcurrentSessions: 10,
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  claudeCliPath: '',
  defaultModel: 'claude-sonnet-4-20250514',
  permissionMode: 'default',
  maxTokens: 8192,
  logLevel: 'info',
  dataDirectory: '',
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  saveSettings: () => Promise<void>;
  resetSettings: () => void;
}

function loadFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // corrupted — fall through
  }
  return { ...DEFAULT_SETTINGS };
}

function persistToStorage(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable
  }
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  loadSettings: async () => {
    const local = loadFromStorage();

    // Try to load from Rust backend (may fail in dev/browser-only mode)
    try {
      const remote = await invoke<AppSettings>('get_settings');
      if (remote) {
        const merged = { ...local, ...remote };
        set({ settings: merged, loaded: true });
        persistToStorage(merged);
        return;
      }
    } catch {
      // Rust backend not available — use local
    }

    set({ settings: local, loaded: true });
  },

  updateSetting: (key, value) => {
    set((state) => {
      const next = { ...state.settings, [key]: value };
      persistToStorage(next);
      return { settings: next };
    });
  },

  saveSettings: async () => {
    const { settings } = get();
    persistToStorage(settings);
    try {
      await invoke('save_settings', { settings });
    } catch {
      // Rust backend not available
    }
  },

  resetSettings: () => {
    const defaults = { ...DEFAULT_SETTINGS };
    persistToStorage(defaults);
    set({ settings: defaults });
  },
}));
