import { lazy, Suspense, useState, useCallback } from 'react';

const MermaidBlock = lazy(() => import('./MermaidBlock'));

interface MermaidSafeProps {
  code: string;
}

function MermaidSafe({ code }: MermaidSafeProps) {
  const [failed, setFailed] = useState(false);

  const handleRenderError = useCallback(() => {
    setFailed(true);
  }, []);

  if (failed) {
    return (
      <div style={{
        padding: '10px 14px',
        background: '#FFFBEB',
        borderRadius: 8,
        border: '1px solid #FDE68A',
        fontSize: 12,
        color: '#92400E',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#D97706' }}>warning_amber</span>
        图表语法有误，已显示为代码块
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'mermaid-spin 1s linear infinite' }}>progress_activity</span>
        正在渲染图表...
      </div>
    }>
      <MermaidBlock code={code} onRenderError={handleRenderError} />
    </Suspense>
  );
}

export { MermaidSafe };
