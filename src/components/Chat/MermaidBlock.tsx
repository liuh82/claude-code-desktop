import React, { useEffect, useState, useId, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import styles from './MermaidBlock.module.css';

// Initialize mermaid once with polished theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    // Background
    primaryColor: '#EEF2FF',
    primaryTextColor: '#1E293B',
    primaryBorderColor: '#818CF8',
    // Secondary
    secondaryColor: '#F0FDF4',
    secondaryTextColor: '#1E293B',
    secondaryBorderColor: '#34D399',
    // Tertiary
    tertiaryColor: '#FFF7ED',
    tertiaryTextColor: '#1E293B',
    tertiaryBorderColor: '#FB923C',
    // Lines & edges
    lineColor: '#94A3B8',
    // General
    fontSize: '14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    // Nodes
    nodeBorder: '#CBD5E1',
    nodeTextColor: '#1E293B',
    mainBkg: '#EEF2FF',
    // Edges
    edgeLabelBackground: '#FFFFFF',
    clusterBkg: '#F8FAFC',
    clusterBorder: '#E2E8F0',
    // Title
    titleColor: '#0F172A',
    // Actor (sequence diagrams)
    actorBkg: '#EEF2FF',
    actorBorder: '#818CF8',
    actorTextColor: '#1E293B',
    // Signal (sequence diagrams)
    signalColor: '#64748B',
    signalTextColor: '#1E293B',
    // Label
    labelBoxBkgColor: '#F8FAFC',
    labelBoxBorderColor: '#E2E8F0',
    labelTextColor: '#1E293B',
    // Loop
    loopTextColor: '#64748B',
    // Activation
    activationBkgColor: '#EEF2FF',
    activationBorderColor: '#818CF8',
    // Sequence
    sequenceNumberColor: '#FFFFFF',
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
    padding: 15,
  },
  sequence: {
    useMaxWidth: true,
    wrap: true,
    width: 180,
    height: 50,
    messageMargin: 35,
  },
});

interface MermaidBlockProps {
  code: string;
  onRenderError?: () => void;
}

const MermaidBlock: React.FC<MermaidBlockProps> = ({ code, onRenderError }) => {
  const [svg, setSvg] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const uniqueId = useId();
  const renderRef = useRef(false);

  const handleError = useCallback((_msg: string) => {
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
