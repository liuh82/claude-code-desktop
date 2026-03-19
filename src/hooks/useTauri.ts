import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Hook to invoke Tauri commands with loading/error state.
 */
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

/**
 * Hook to listen to Tauri events from the backend.
 */
export function useEventListener<T = unknown>(
  event: string,
  handler: (payload: T) => void,
) {
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<T>(event, (e) => {
      handler(e.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [event, handler]);
}

/**
 * Hook for global Tauri app state (e.g. recent projects, active tab).
 * Currently a placeholder for future expansion.
 */
export function useTauriState() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return { ready };
}
