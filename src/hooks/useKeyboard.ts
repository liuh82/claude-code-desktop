import { useEffect, useCallback } from 'react';

export interface KeyboardActions {
  onNewChat?: () => void;
  onOpenHistory?: () => void;
  onToggleSidebar?: () => void;
  onToggleToolPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenProject?: () => void;
  onCommandPalette?: () => void;
  onStopGeneration?: () => void;
  onNewTab?: () => void;
  onSplitPaneHorizontal?: () => void;
  onSplitPaneVertical?: () => void;
  onClosePane?: () => void;
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

      // Cmd/Ctrl+T — new tab
      if (key === 't' && !shift) {
        e.preventDefault();
        actions.onNewTab?.();
        return;
      }

      // Cmd/Ctrl+W — close pane / tab
      if (key === 'w' && !shift) {
        e.preventDefault();
        actions.onClosePane?.();
        return;
      }

      // Cmd/Ctrl+D — split pane horizontal
      if (key === 'd' && !shift) {
        e.preventDefault();
        actions.onSplitPaneHorizontal?.();
        return;
      }

      // Cmd/Ctrl+Shift+D — split pane vertical
      if (key === 'd' && shift) {
        e.preventDefault();
        actions.onSplitPaneVertical?.();
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

      // Cmd/Ctrl+H — history
      if (key === 'h' && !shift) {
        e.preventDefault();
        actions.onOpenHistory?.();
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
