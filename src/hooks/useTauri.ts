import { useState, useEffect, useCallback } from 'react';

/**
 * Electron IPC invoke wrapper.
 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  const api = (window as unknown as { claudeAPI?: Record<string, (...args: unknown[]) => Promise<unknown>> }).claudeAPI;
  if (!api) return null;

  // camelCase conversion for snake_case commands
  const method = api[command.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (typeof method !== 'function') return null;
  return method(args) as Promise<T>;
}

export function useInvoke<T>(cmd: string, args?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (overrideArgs?: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<T>(cmd, overrideArgs ?? args);
        setData(result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [cmd, args],
  );

  return { data, loading, error, execute };
}

export function useEventListener<T = unknown>(event: string, handler: (payload: T) => void) {
  useEffect(() => {
    const api = (window as unknown as { claudeAPI?: Record<string, (...args: unknown[]) => unknown> }).claudeAPI;
    if (!api) return;

    let cleanup: (() => void) | undefined;
    if (event === 'claude-output') {
      cleanup = (api as Record<string, (cb: (line: string) => void) => () => void>).onClaudeOutput?.(handler as (line: string) => void);
    } else if (event === 'claude-stderr') {
      cleanup = (api as Record<string, (cb: (data: string) => void) => () => void>).onClaudeStderr?.(handler as (data: string) => void);
    } else if (event === 'claude-exit') {
      cleanup = (api as Record<string, (cb: (info: { sessionId: string; exitCode: number | null }) => void) => () => void>).onClaudeExit?.(handler as (info: { sessionId: string; exitCode: number | null }) => void);
    }

    return () => cleanup?.();
  }, [event, handler]);
}

export function useTauriState() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return { ready };
}
