import { type ComponentPropsWithoutRef, type ReactNode, memo, useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import { ChartBlock } from './ChartBlock';
import { HtmlSlideBlock } from './HtmlSlideBlock';
import { MermaidSafe } from "./MermaidSafe";

const MemoHtmlSlideBlock = memo(HtmlSlideBlock);

interface MarkdownRendererProps {
  content: string;
  /** When true, treat unclosed mermaid blocks as regular code blocks */
  isStreaming?: boolean;
}

/**
 * Detect whether a mermaid code block in the content is incomplete (unclosed).
 * During streaming, an unclosed ```mermaid block means the AI is still generating.
 */
export function isIncompleteMermaidBlock(content: string): boolean {
  // Match opening ```mermaid that doesn't have a corresponding closing ```
  const regex = /```mermaid\b([\s\S]*?)(?:```|$)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    // If the block ends at EOF (no closing ```), it's incomplete
    const blockEnd = match.index + match[0].length;
    if (blockEnd === content.length && !match[0].endsWith('```')) {
      return true;
    }
    // Also check: if the match was cut off (regex hit $), it's incomplete
    if (!match[0].trimEnd().endsWith('```')) {
      return true;
    }
  }
  return false;
}

type ContentBlock =
  | { type: 'markdown'; content: string }
  | { type: 'htmlslide'; html: string }
  | { type: 'htmlslide-incomplete'; content: string };

export function splitHtmlSlideBlocks(content: string, _isStreaming?: boolean): ContentBlock[] {
  const regex = /(```htmlslide\b[\s\S]*?```|```htmlslide\b[\s\S]*$)/g;
  const parts: ContentBlock[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'markdown', content: content.slice(lastIndex, match.index) });
    }

    const block = match[0];
    const isClosed = block.trimEnd().endsWith('```');

    if (isClosed) {
      const html = block.replace(/^```htmlslide\s*\n/, '').replace(/\n```\s*$/, '');
      parts.push({ type: 'htmlslide', html });
    } else {
      parts.push({ type: 'htmlslide-incomplete', content: block });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'markdown', content: content.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: 'markdown', content });
  }

  return parts;
}

/** Simple hash for stable React keys */
function stableKey(str: string, fallback: number): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return `b${fallback}-${h}`;
}

/** Inline loading indicator for streaming htmlslide blocks */
function HtmlSlideLoading() {
  return (
    <div style={{
      padding: '16px 20px',
      margin: '8px 0',
      background: 'var(--bg-tertiary, #1e1e2e)',
      borderRadius: '8px',
      border: '1px solid var(--border, #2e2e3e)',
      color: 'var(--text-secondary, #94a3b8)',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'pulse 1.5s infinite' }}>
        pending
      </span>
      Rendering visualization...
    </div>
  );
}

const sharedComponents = {
  pre: PreBlock,
  code: CodeElement,
  p: Paragraph,
  a: Link,
  table: Table,
  th: TableHeader,
  td: TableCell,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  blockquote: BlockQuote,
  hr: HorizontalRule,
  strong: Strong,
};

const STREAM_THROTTLE_MS = 80;

function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
  // Throttle content updates during streaming to reduce DOM churn and jitter
  const [displayContent, setDisplayContent] = useState(content);
  const lastUpdateRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayContent(content);
      return;
    }

    const now = performance.now();
    if (now - lastUpdateRef.current >= STREAM_THROTTLE_MS) {
      lastUpdateRef.current = now;
      setDisplayContent(content);
    } else if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        lastUpdateRef.current = performance.now();
        setDisplayContent(content);
      });
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [content, isStreaming]);

  // Ensure final content is shown when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      setDisplayContent(content);
    }
  }, [isStreaming, content]);

  const blocks = splitHtmlSlideBlocks(displayContent, !!isStreaming);
  const hasIncompleteMermaid = isStreaming && isIncompleteMermaidBlock(content);

  return (
    <div className="markdown-body">
      {blocks.map((block, i) => {
        if (block.type === 'htmlslide') {
          return <MemoHtmlSlideBlock key={isStreaming ? `hs-${i}` : stableKey(block.html, i)} html={block.html} />;
        }
        if (block.type === 'htmlslide-incomplete') {
          // During streaming, show a lightweight placeholder instead of raw code
          // This prevents layout jumps when the block closes
          return <HtmlSlideLoading key={`hslide-loading-${i}`} />;
        }
        return (
          <ReactMarkdown key={isStreaming ? `md-${i}` : stableKey(block.content, i)} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}
            components={{
              ...sharedComponents,
              code: (props: ComponentPropsWithoutRef<'code'> & { children?: ReactNode }) =>
                CodeElement({ ...props, hasIncompleteMermaid }),
            }}
          >
            {block.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

function PreBlock({ children }: { children?: ReactNode }) {
  // Always render a stable <pre> wrapper to avoid DOM node type changes during streaming.
  // react-markdown wraps code blocks in <pre>; returning a Fragment causes React #301
  // when the child tree structure changes between renders.
  return (
    <pre style={{ overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
      {children}
    </pre>
  );
}

function CodeElement({ children, className, hasIncompleteMermaid }: ComponentPropsWithoutRef<'code'> & { children?: ReactNode; hasIncompleteMermaid?: boolean }) {
  const match = /language-(\w+)/.exec(className || '');
  const isInline = !match && !className;

  if (isInline) {
    return <code className="codeInline">{children}</code>;
  }

  const codeString = String(children).replace(/\n$/, '');
  const lang = match ? match[1] : '';

  // Render chart code blocks as interactive ECharts
  if (lang === 'chart' || lang === 'echarts') {
    return (
      <code className="codeBlock">
        <ChartBlock code={codeString} />
      </code>
    );
  }

  // Render mermaid diagrams — only if the code block is complete (not streaming)
  if (lang === 'mermaid') {
    // During streaming with an incomplete mermaid block, render as plain code
    if (hasIncompleteMermaid) {
      return (
        <code className="codeBlock">
          <div style={{ marginBottom: '6px', fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>pending</span>
            Generating diagram...
          </div>
          <CodeBlock code={codeString} language="mermaid" />
        </code>
      );
    }

    return (
      <code className="codeBlock">
        <MermaidSafe code={codeString} />
      </code>
    );
  }

  return (
    <code className="codeBlock">
      <CodeBlock code={codeString} language={lang || undefined} />
    </code>
  );
}

function Paragraph({ children }: { children?: ReactNode }) {
  return <p style={{ margin: '8px 0', lineHeight: 'var(--line-height-relaxed)' }}>{children}</p>;
}

function Link({ href, children }: ComponentPropsWithoutRef<'a'> & { children?: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--accent)', textDecoration: 'none' }}
    >
      {children}
    </a>
  );
}

function Table({ children }: { children?: ReactNode }) {
  return (
    <div style={{ overflowX: 'auto', width: '100%', margin: '8px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '15px' }}>{children}</table>
    </div>
  );
}

function TableHeader({ children }: { children?: ReactNode }) {
  return (
    <th style={{
      padding: '6px 12px',
      border: `1px solid var(--border)`,
      background: 'var(--bg-tertiary)',
      textAlign: 'left',
      fontWeight: 600,
      color: 'var(--text-primary)',
    }}>
      {children}
    </th>
  );
}

function TableCell({ children }: { children?: ReactNode }) {
  return (
    <td style={{
      padding: '6px 12px',
      border: `1px solid var(--border)`,
      color: 'var(--text-secondary)',
    }}>
      {children}
    </td>
  );
}

function UnorderedList({ children }: { children?: ReactNode }) {
  return <ul style={{ margin: '8px 0', paddingLeft: '24px', lineHeight: 'var(--line-height-relaxed)' }}>{children}</ul>;
}

function OrderedList({ children }: { children?: ReactNode }) {
  return <ol style={{ margin: '8px 0', paddingLeft: '24px', lineHeight: 'var(--line-height-relaxed)' }}>{children}</ol>;
}

function ListItem({ children }: { children?: ReactNode }) {
  return <li style={{ margin: '2px 0', color: 'var(--text-primary)' }}>{children}</li>;
}

function Heading1({ children }: { children?: ReactNode }) {
  return <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '16px 0 8px', color: 'var(--text-primary)' }}>{children}</h2>;
}

function Heading2({ children }: { children?: ReactNode }) {
  return <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '12px 0 6px', color: 'var(--text-primary)' }}>{children}</h3>;
}

function Heading3({ children }: { children?: ReactNode }) {
  return <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '10px 0 4px', color: 'var(--text-primary)' }}>{children}</h4>;
}

function BlockQuote({ children }: { children?: ReactNode }) {
  return (
    <blockquote style={{
      margin: '8px 0',
      padding: '4px 16px',
      borderLeft: '3px solid var(--accent)',
      color: 'var(--text-secondary)',
      background: 'var(--accent-muted)',
      borderRadius: '0 4px 4px 0',
    }}>
      {children}
    </blockquote>
  );
}

function HorizontalRule() {
  return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />;
}

function Strong({ children }: { children?: ReactNode }) {
  return <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>;
}

export { MarkdownRenderer };
