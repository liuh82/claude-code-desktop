import { create } from 'zustand';

interface ElectronAPI {
  getSettings: () => Promise<Record<string, unknown>>;
  saveSettings: (settings: unknown) => Promise<void>;
  getAppInfo: () => Promise<{ version: string; platform: string; arch: string }>;
  checkClaudeCli: () => Promise<{ path: string; version: string; available: boolean }>;
  openDirectoryDialog: () => Promise<string | null>;
}

function getApi(): ElectronAPI | null {
  const api = (window as unknown as { claudeAPI?: ElectronAPI }).claudeAPI;
  return api ?? null;
}

export interface AppSettings {
  defaultProjectPath: string;
  autoSaveInterval: number;
  maxConcurrentSessions: number;
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  fontFamily: string;
  claudeCliPath: string;
  defaultModel: string;
  permissionMode: 'default' | 'strict' | 'permissive';
  maxTokens: number;
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
  defaultModel: 'glm-4-plus',
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
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function persistToStorage(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  loadSettings: async () => {
    const local = loadFromStorage();
    const api = getApi();
    if (api) {
      try {
        const remote = await api.getSettings();
        if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
          const merged = { ...local, ...remote } as AppSettings;
          set({ settings: merged, loaded: true });
          persistToStorage(merged);
          return;
        }
      } catch { /* ignore */ }
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
    const api = getApi();
    if (api) {
      try {
        await api.saveSettings(settings);
      } catch { /* ignore */ }
    }
  },

  resetSettings: () => {
    const defaults = { ...DEFAULT_SETTINGS };
    persistToStorage(defaults);
    set({ settings: defaults });
  },
}));
