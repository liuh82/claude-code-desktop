import { useEffect, useCallback } from 'react';

export interface KeyboardActions {
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onSwitchTab?: (index: number) => void;
  onSplitPane?: () => void;
  onTogglePaneFocus?: () => void;
  onCommandPalette?: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardActions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      // Cmd/Ctrl+N — new tab
      if (key === 'n' && !e.shiftKey) {
        e.preventDefault();
        actions.onNewTab?.();
        return;
      }

      // Cmd/Ctrl+W — close tab
      if (key === 'w') {
        e.preventDefault();
        actions.onCloseTab?.();
        return;
      }

      // Cmd/Ctrl+Shift+N — new pane (split)
      if (key === 'n' && e.shiftKey) {
        e.preventDefault();
        actions.onSplitPane?.();
        return;
      }

      // Cmd/Ctrl+Shift+P — toggle pane focus
      if (key === 'p' && e.shiftKey) {
        e.preventDefault();
        actions.onTogglePaneFocus?.();
        return;
      }

      // Cmd/Ctrl+K — command palette
      if (key === 'k' && !e.shiftKey) {
        e.preventDefault();
        actions.onCommandPalette?.();
        return;
      }

      // Cmd/Ctrl+1/2/3 — switch tabs
      if (['1', '2', '3'].includes(key) && !e.shiftKey) {
        e.preventDefault();
        actions.onSwitchTab?.(parseInt(key, 10) - 1);
        return;
      }
    },
    [actions],
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
