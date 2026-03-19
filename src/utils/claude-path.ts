import { invoke } from '@tauri-apps/api/core';

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

/**
 * Attempt to locate the Claude CLI binary via the Rust backend.
 */
export async function detectClaudePath(): Promise<string | null> {
  try {
    const info = await invoke<CliInfo>('check_claude_cli');
    return info.available ? info.path : null;
  } catch {
    return null;
  }
}

/**
 * Verify that a given path points to a working Claude CLI installation.
 */
export async function verifyClaudePath(path: string): Promise<CliInfo | null> {
  try {
    const info = await invoke<CliInfo>('check_claude_cli');
    if (info.path === path && info.available) {
      return info;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch application metadata (version, platform, arch).
 */
export async function getAppInfo(): Promise<AppInfo | null> {
  try {
    return await invoke<AppInfo>('get_app_info');
  } catch {
    return null;
  }
}
