import type { Tab } from './tab';

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
  }
}
