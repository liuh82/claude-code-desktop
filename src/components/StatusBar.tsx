import { useTheme } from '@/theme/theme';
import './StatusBar.css';

export interface StatusBarProps {
  sessionStatus: 'idle' | 'running' | 'waiting' | 'error' | 'starting';
  modelName?: string;
  tokenUsage?: { input: number; output: number };
  projectPath?: string;
  connected?: boolean;
  onToggleTheme?: () => void;
  onOpenSettings?: () => void;
}

const statusLabels: Record<string, string> = {
  idle: 'Ready',
  running: 'Running',
  waiting: 'Waiting',
  error: 'Error',
  starting: 'Starting...',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StatusBar({
  sessionStatus,
  modelName,
  tokenUsage,
  projectPath,
  connected = true,
  onToggleTheme,
  onOpenSettings,
}: StatusBarProps) {
  const { theme } = useTheme();

  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__connection">
          <span className={`status-bar__dot ${connected ? 'status-bar__dot--ok' : 'status-bar__dot--err'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="status-bar__separator" />
        <span className={`status-bar__status status-bar__status--${sessionStatus}`}>
          {statusLabels[sessionStatus] ?? sessionStatus}
        </span>
        {modelName && (
          <>
            <span className="status-bar__separator" />
            <span className="status-bar__model">{modelName}</span>
          </>
        )}
        {tokenUsage && (
          <>
            <span className="status-bar__separator" />
            <span className="status-bar__tokens">
              Tokens: {formatTokens(tokenUsage.input + tokenUsage.output)}
            </span>
          </>
        )}
      </div>
      <div className="status-bar__right">
        {projectPath && (
          <span className="status-bar__project" title={projectPath}>
            {projectPath.split('/').pop()}
          </span>
        )}
        <button
          className="status-bar__btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>
        <button
          className="status-bar__btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Open settings"
        >
          \u2699\uFE0F Settings
        </button>
      </div>
    </footer>
  );
}

export default StatusBar;
