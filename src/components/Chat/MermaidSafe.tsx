import { lazy, Suspense, useState, useCallback } from 'react';

const MermaidBlock = lazy(() => import('./MermaidBlock'));

interface MermaidSafeProps {
  code: string;
}

/**
 * MermaidSafe — wraps MermaidBlock with error fallback.
 * If mermaid rendering fails (bad syntax), gracefully falls back to a code block.
 */
function MermaidSafe({ code }: MermaidSafeProps) {
  const [failed, setFailed] = useState(false);

  const handleRenderError = useCallback(() => {
    setFailed(true);
  }, []);

  if (failed) {
    return (
      <div style={{ marginBottom: '6px', fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error_outline</span>
        Diagram syntax error — showing as code
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
        Rendering diagram...
      </div>
    }>
      <MermaidBlock code={code} onRenderError={handleRenderError} />
    </Suspense>
  );
}

export { MermaidSafe };
