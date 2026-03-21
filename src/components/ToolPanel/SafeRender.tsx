import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class SafeRender extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ToolPanel SafeRender]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
          <div>Rendering error</div>
          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>{this.state.error?.message}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8, padding: '4px 12px', background: 'var(--accent)',
              color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11
            }}
          >Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
