import { useEffect, useCallback } from 'react';

export interface KeyboardActions {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  onToggleToolPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenProject?: () => void;
  onCommandPalette?: () => void;
  onStopGeneration?: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardActions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      const shift = e.shiftKey;

      // Cmd/Ctrl+N — new chat
      if (key === 'n' && !shift) {
        e.preventDefault();
        actions.onNewChat?.();
        return;
      }

      // Cmd/Ctrl+B — toggle sidebar
      if (key === 'b' && !shift) {
        e.preventDefault();
        actions.onToggleSidebar?.();
        return;
      }

      // Cmd/Ctrl+Shift+F — toggle tool panel
      if (key === 'f' && shift) {
        e.preventDefault();
        actions.onToggleToolPanel?.();
        return;
      }

      // Cmd/Ctrl+O — open project
      if (key === 'o' && !shift) {
        e.preventDefault();
        actions.onOpenProject?.();
        return;
      }

      // Cmd/Ctrl+, — settings
      if (key === ',') {
        e.preventDefault();
        actions.onOpenSettings?.();
        return;
      }

      // Cmd/Ctrl+K — command palette
      if (key === 'k' && !shift) {
        e.preventDefault();
        actions.onCommandPalette?.();
        return;
      }

      // Escape — stop generation
      if (key === 'escape') {
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
