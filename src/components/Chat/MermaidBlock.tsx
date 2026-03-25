import React, { useEffect, useState, useId, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import styles from './MermaidBlock.module.css';

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#e8f0fe',
    primaryTextColor: '#1d2129',
    primaryBorderColor: '#c9d1d9',
    lineColor: '#586069',
    secondaryColor: '#f0f4ff',
    tertiaryColor: '#fafafa',
    fontSize: '14px',
  },
});

interface MermaidBlockProps {
  code: string;
  /** Called when rendering fails — parent can use this to show a fallback */
  onRenderError?: () => void;
}

const MermaidBlock: React.FC<MermaidBlockProps> = ({ code, onRenderError }) => {
  const [svg, setSvg] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const uniqueId = useId();
  const renderRef = useRef(false);

  const handleError = useCallback((_msg: string) => {
    // Notify parent to show fallback (code block)
    onRenderError?.();
  }, [onRenderError]);

  useEffect(() => {
    if (!code || !code.trim()) return;
    if (renderRef.current) return;
    renderRef.current = true;

    const id = uniqueId.replace(/:/g, '_');
    const trimmed = code.trim();

    setLoading(true);
    setSvg('');

    mermaid.render(id, trimmed).then(
      (result: { svg: string }) => {
        setSvg(result.svg);
        setLoading(false);
      },
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        handleError(msg);
        setLoading(false);
      },
    );

    return () => {
      // Clean up the temporary element mermaid creates
      const el = document.getElementById('d' + id);
      if (el) el.remove();
    };
  }, [code, uniqueId, handleError]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <span className={styles.spinner} />
        Rendering diagram...
      </div>
    );
  }

  if (!svg) return null;

  return (
    <div
      className={styles.container}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg) }}
    />
  );
};

export default MermaidBlock;
