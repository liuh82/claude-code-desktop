import { create } from 'zustand';

interface SettingsState {
  theme: 'dark' | 'light';
  maxConcurrent: number;
  claudeExecutable: string;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  theme: 'dark',
  maxConcurrent: 10,
  claudeExecutable: '',
  setTheme: (theme) => set({ theme }),
}));
