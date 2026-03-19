import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1e1e1e',
          color: '#cccccc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px',
          zIndex: 99999,
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            background: '#252526',
            borderRadius: '8px',
            border: '1px solid #3e3e42',
            padding: '24px',
          }}>
            <h2 style={{ color: '#f44747', margin: '0 0 12px 0', fontSize: '18px' }}>
              ⚠ Claude Code Desktop crashed
            </h2>
            <p style={{ margin: '0 0 16px 0', color: '#999', fontSize: '14px' }}>
              An unexpected error occurred. Please reload the app.
            </p>

            {this.state.error && (
              <div style={{
                background: '#1e1e1e',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '12px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#f44747',
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {this.state.error.toString()}
              </div>
            )}

            {this.state.errorInfo && (
              <div style={{
                background: '#1e1e1e',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#999',
                overflow: 'auto',
                maxHeight: '150px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {this.state.errorInfo.componentStack}
              </div>
            )}

            <button
              onClick={this.handleReload}
              style={{
                background: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 20px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
