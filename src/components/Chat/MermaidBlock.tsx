import { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import styles from './MermaidBlock.module.css';

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

function MermaidBlock({ code, index }: { code: string; index?: number }) {
  const renderCountRef = useRef(0);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const id = useMemo(() => `mermaid-${++renderCountRef.current}-${index ?? 0}`, [index]);

  useEffect(() => {
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
  }, [code, id]);

  if (error) {
    return (
      <div className={styles.error}>
        {error}
      </div>
    );
  }

  if (loading || !svg) {
    return (
      <div className={styles.loading}>
        渲染图表中...
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg) }}
    />
  );
}

export { MermaidBlock };

// Named export for React.lazy: default re-export
export default MermaidBlock;
