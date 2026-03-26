import { useEffect, useRef } from 'react';
import { sanitizeHtml } from '@/lib/html-sanitize';
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
    const cleanHtml = sanitizeHtml(html);
    shadow.innerHTML = cleanHtml;

    // Prevent links inside the slide from opening in external browser
    const clickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' && target.hasAttribute('href')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    shadow.addEventListener('click', clickHandler, true);

    return () => {
      shadow.removeEventListener('click', clickHandler, true);
      if (container.shadowRoot) {
        container.shadowRoot.innerHTML = '';
      }
    };
  }, [html]);

  return <div ref={containerRef} className={styles.slideHost} />;
}

export { HtmlSlideBlock };
