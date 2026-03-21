import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
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
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function PreBlock({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function CodeElement({ children, className }: ComponentPropsWithoutRef<'code'> & { children?: ReactNode }) {
  const match = /language-(\w+)/.exec(className || '');
  const isInline = !match && !className;

  if (isInline) {
    return <code className="codeInline">{children}</code>;
  }

  const codeString = String(children).replace(/\n$/, '');
  return <CodeBlock code={codeString} language={match ? match[1] : undefined} />;
}

function Paragraph({ children }: { children?: ReactNode }) {
  return <p style={{ margin: '8px 0', lineHeight: '1.6' }}>{children}</p>;
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
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>{children}</table>
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
  return <ul style={{ margin: '8px 0', paddingLeft: '24px', lineHeight: '1.6' }}>{children}</ul>;
}

function OrderedList({ children }: { children?: ReactNode }) {
  return <ol style={{ margin: '8px 0', paddingLeft: '24px', lineHeight: '1.6' }}>{children}</ol>;
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
