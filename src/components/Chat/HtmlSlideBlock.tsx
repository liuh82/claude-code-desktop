import { useRef, useState, useCallback } from 'react';
import styles from './HtmlSlideBlock.module.css';

interface HtmlSlideBlockProps {
  html: string;
}

function HtmlSlideBlock({ html }: HtmlSlideBlockProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>(300);

  const handleLoad = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument
        || iframeRef.current?.contentWindow?.document;
      if (doc?.body) {
        const h = doc.body.scrollHeight;
        setHeight(Math.min(Math.max(h + 16, 200), 800));
      }
    } catch {
      // cross-origin 或 sandbox 限制 — 保持默认高度
    }
  }, []);

  return (
    <div className={styles.slideWrapper}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-scripts"
        style={{ height, width: '100%', border: 'none' }}
        onLoad={handleLoad}
        title="Visualization Slide"
      />
    </div>
  );
}

export { HtmlSlideBlock };
