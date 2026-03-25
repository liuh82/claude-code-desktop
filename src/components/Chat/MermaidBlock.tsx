import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid once with light theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#E3F2FD',
    primaryTextColor: '#1E293B',
    primaryBorderColor: '#3B82F6',
    lineColor: '#94A3B8',
    secondaryColor: '#F0FDF4',
    tertiaryColor: '#FAF5FF',
    background: '#FFFFFF',
    mainBkg: '#E3F2FD',
    nodeBorder: '#3B82F6',
    clusterBkg: '#F8FAFC',
    titleColor: '#1E293B',
    edgeLabelBackground: '#FFFFFF',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 15,
    nodeSpacing: 50,
    rankSpacing: 50,
  },
  sequence: {
    actorMargin: 50,
    messageMargin: 40,
    mirrorActors: false,
  },
});

let renderCount = 0;

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const id = `mermaid-${++renderCount}`;
    const trimmed = code.trim();

    if (!trimmed) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setSvg('');

    mermaid.render(id, trimmed).then(
      ({ svg }) => {
        setSvg(svg);
        setLoading(false);
      },
      (err) => {
        setError('Mermaid render error: ' + (err?.message || String(err)));
        setLoading(false);
      },
    );

    return () => {
      // Clean up the temporary element mermaid creates
      const el = document.getElementById('d' + id);
      if (el) el.remove();
    };
  }, [code]);

  if (error) {
    return (
      <div style={{
        padding: '8px 12px',
        borderRadius: '6px',
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        color: '#991B1B',
        fontSize: '12px',
        fontFamily: 'monospace',
      }}>
        {error}
      </div>
    );
  }

  if (loading || !svg) {
    return (
      <div style={{
        padding: '16px',
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: '13px',
      }}>
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      style={{
        padding: '12px',
        background: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        overflow: 'auto',
        maxWidth: '100%',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export { MermaidBlock };

// Named export for React.lazy: default re-export
export default MermaidBlock;
