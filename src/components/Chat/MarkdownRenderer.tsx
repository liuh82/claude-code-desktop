import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import { ChartBlock } from './ChartBlock';
import { VisualizationCard } from './VisualizationCard';
import { QuickVisualParser } from './QuickVisualParser';

// Mermaid rendering with graceful fallback on syntax errors
import { MermaidSafe } from "./MermaidSafe";

interface MarkdownRendererProps {
  content: string;
  /** When true, skip QuickVisualParser to prevent infinite recursion */
  isNested?: boolean;
  /** When true, treat unclosed mermaid blocks as regular code blocks */
  isStreaming?: boolean;
}

/**
 * Detect whether a mermaid code block in the content is incomplete (unclosed).
 * During streaming, an unclosed ```mermaid block means the AI is still generating.
 */
function isIncompleteMermaidBlock(content: string): boolean {
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

function MarkdownRenderer({ content, isNested, isStreaming }: MarkdownRendererProps) {
  // If content contains quick-viz commands, use QuickVisualParser instead
  // Skip when nested to prevent infinite recursion (QVP → MarkdownRenderer → QVP)
  if (!isNested && /^@(arch|flow|compare|timeline)\b/m.test(content)) {
    return (
      <div className="markdown-body">
        <QuickVisualParser content={content} />
      </div>
    );
  }

  // Detect incomplete mermaid blocks during streaming
  const hasIncompleteMermaid = isStreaming && isIncompleteMermaidBlock(content);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
        pre: PreBlock,
        code: (props: ComponentPropsWithoutRef<'code'> & { children?: ReactNode }) =>
          CodeElement({ ...props, hasIncompleteMermaid }),
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
      }}
    >
        {content}
      </ReactMarkdown>
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

  // Render visualization card code blocks
  if (lang === 'visual' || lang === 'card') {
    return (
      <code className="codeBlock">
        <VisualizationCard code={codeString} />
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
