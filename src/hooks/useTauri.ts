import { useEffect } from 'react';

export function useTauriEvent(event: string, handler: (payload: unknown) => void) {
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen(event, (e) => handler(e.payload)).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, [event, handler]);
}
