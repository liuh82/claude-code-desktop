import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import styles from './HtmlSlideBlock.module.css';

interface HtmlSlideBlockProps {
  html: string;
}

function HtmlSlideBlock({ html }: HtmlSlideBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // React StrictMode double-mount guard
    if (container.shadowRoot) {
      container.shadowRoot.innerHTML = '';
    }

    const shadow = container.attachShadow({ mode: 'open' });

    const cleanHtml = DOMPurify.sanitize(html, {
      ADD_TAGS: ['style', 'link'],
      ADD_ATTR: ['class', 'id', 'style', 'href', 'target', 'rel'],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'],
    });

    shadow.innerHTML = cleanHtml;

    return () => {
      if (container.shadowRoot) {
        container.shadowRoot.innerHTML = '';
      }
    };
  }, [html]);

  return <div ref={containerRef} className={styles.slideHost} />;
}

export { HtmlSlideBlock };
