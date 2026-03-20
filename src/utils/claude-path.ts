/**
 * Electron IPC wrapper for Claude path detection.
 */

export interface CliInfo {
  path: string;
  version: string;
  available: boolean;
}

export interface AppInfo {
  version: string;
  platform: string;
  arch: string;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  const api = (window as unknown as { claudeAPI?: Record<string, (...args: unknown[]) => Promise<unknown>> }).claudeAPI;
  if (!api) return null;
  const method = api[command.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (typeof method !== 'function') return null;
  return method(args) as Promise<T>;
}

export async function detectClaudePath(): Promise<string | null> {
  try {
    const info = await invoke<CliInfo>('check_claude_cli');
    return info?.available ? info.path : null;
  } catch {
    return null;
  }
}

export async function verifyClaudePath(path: string): Promise<CliInfo | null> {
  try {
    const info = await invoke<CliInfo>('check_claude_cli');
    if (info?.path === path && info?.available) return info;
    return null;
  } catch {
    return null;
  }
}

export async function getAppInfo(): Promise<AppInfo | null> {
  try {
    return await invoke<AppInfo>('get_app_info');
  } catch {
    return null;
  }
}
