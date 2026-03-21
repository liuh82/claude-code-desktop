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
      try {
        return hljs.highlight(code, { language }).value;
      } catch {
        // fallback
      }
    }
    // Try auto-detect
    try {
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  }, [code, language]);

  const lines = useMemo(() => highlighted.split('\n'), [highlighted]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [code]);

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{language || 'text'}</span>
        <button
          className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="3,8 6.5,11.5 13,4.5" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="5" width="9" height="9" rx="1" />
                <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
              </svg>
              Copy
            </>
          )}
        </button>
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
