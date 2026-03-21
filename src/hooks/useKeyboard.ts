import { useEffect, useCallback } from 'react';

export interface KeyboardActions {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  onToggleToolPanel?: () => void;
  onOpenSettings?: () => void;
  onCommandPalette?: () => void;
  onStopGeneration?: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardActions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      // Cmd/Ctrl+N — new chat
      if (key === 'n' && !e.shiftKey) {
        e.preventDefault();
        actions.onNewChat?.();
        return;
      }

      // Cmd/Ctrl+B — toggle sidebar
      if (key === 'b' && !e.shiftKey) {
        e.preventDefault();
        actions.onToggleSidebar?.();
        return;
      }

      // Cmd/Ctrl+Shift+F — toggle tool panel
      if (key === 'f' && e.shiftKey) {
        e.preventDefault();
        actions.onToggleToolPanel?.();
        return;
      }

      // Cmd/Ctrl+, — open settings
      if (key === ',') {
        e.preventDefault();
        actions.onOpenSettings?.();
        return;
      }

      // Cmd/Ctrl+K — command palette
      if (key === 'k' && !e.shiftKey) {
        e.preventDefault();
        actions.onCommandPalette?.();
        return;
      }

      // Escape — stop generation (handled without mod)
      if (e.key === 'Escape') {
        actions.onStopGeneration?.();
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
