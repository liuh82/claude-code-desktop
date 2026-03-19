import type { Tab } from './tab';
import type { AppSettings } from '@/stores/useSettingsStore';

export interface Project {
  id: string;
  name: string;
  path: string;
  favorite: boolean;
  lastOpened: number;
  sessionCount: number;
}

declare module '@tauri-apps/api/core' {
  interface Invoke {
    create_tab: (args: { projectId: string; projectPath: string; title: string }) => Promise<Tab>;
    close_tab: (args: { tabId: string }) => Promise<void>;
    split_pane: (args: { tabId: string; paneId: string; direction: string }) => Promise<Record<string, unknown>>;
    close_pane: (args: { tabId: string; paneId: string }) => Promise<Record<string, unknown>>;
    focus_pane: (args: { tabId: string; paneId: string }) => Promise<void>;
    create_session: (args: { projectId: string; projectPath: string }) => Promise<{ session_id: string }>;
    start_session: (args: { sessionId: string }) => Promise<number>;
    send_input: (args: { sessionId: string; input: string }) => Promise<void>;
    close_session: (args: { sessionId: string }) => Promise<void>;
    get_config: (args: { key: string }) => Promise<unknown>;
    set_config: (args: { key: string; value: unknown }) => Promise<void>;
    get_settings: () => Promise<AppSettings>;
    save_settings: (args: { settings: AppSettings }) => Promise<void>;
    get_projects: () => Promise<Project[]>;
    open_project: (args: { projectPath: string }) => Promise<Project>;
    remove_project: (args: { projectId: string }) => Promise<void>;
    toggle_favorite_project: (args: { projectId: string }) => Promise<void>;
    get_sessions: (args: { projectId: string }) => Promise<import('./session').Session[]>;
    delete_session: (args: { sessionId: string }) => Promise<void>;
    rename_session: (args: { sessionId: string; title: string }) => Promise<void>;
    detect_claude_cli: () => Promise<string | null>;
    check_claude_cli: () => Promise<{
      path: string;
      version: string;
      available: boolean;
    }>;
    get_app_info: () => Promise<{
      version: string;
      platform: string;
      arch: string;
    }>;
  }
}
