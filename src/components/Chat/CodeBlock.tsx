import { useState, useCallback, useMemo } from 'react';
import hljs from 'highlight.js';
import styles from './CodeBlock.module.css';

interface CodeBlockProps {
  code: string;
  language?: string;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => {
    if (language && hljs.getLanguage(language)) {
      try { return hljs.highlight(code, { language }).value; } catch {}
    }
    try { return hljs.highlightAuto(code).value; } catch { return code; }
  }, [code, language]);

  const lines = useMemo(() => highlighted.split('\n'), [highlighted]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [code]);

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <div className={styles.codeHeaderLeft}>
          <div className={styles.codeTrafficLights}>
            <span className={`${styles.trafficDot} ${styles.trafficRed}`} />
            <span className={`${styles.trafficDot} ${styles.trafficYellow}`} />
            <span className={`${styles.trafficDot} ${styles.trafficGreen}`} />
          </div>
          <span className={styles.codeLang}>{language || 'text'}</span>
        </div>
        <div className={styles.codeHeaderRight}>
          <button
            className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
            onClick={handleCopy}
            aria-label="复制代码"
            title="复制"
          >
            <span className="material-symbols-outlined">
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>
      </div>
      <div className={styles.codeBody}>
        <div className={styles.lineNumbers}>
          {lines.map((_, i) => (
            <span key={i} className={styles.lineNumber}>{i + 1}</span>
          ))}
        </div>
        <div className={styles.codeContent} dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </div>
  );
}

export { CodeBlock };
