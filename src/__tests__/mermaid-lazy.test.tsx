import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock mermaid — it's heavy and has DOM dependencies
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>mock</svg>' }),
  },
}));

// Mock CSS modules
vi.mock('../components/Chat/MermaidBlock.module.css', () => ({
  default: new Proxy({}, { get(_, key) { return key; } }),
}));

describe('Mermaid lazy loading and streaming protection', () => {
  describe('MarkdownRenderer with mermaid content', () => {
    it('renders complete mermaid block as MermaidBlock (via Suspense)', async () => {
      // Dynamic import to avoid module caching issues with lazy
      const { MarkdownRenderer } = await import('../components/Chat/MarkdownRenderer');

      const content = '```mermaid\ngraph LR\nA-->B\n```';
      const { container } = render(<MarkdownRenderer content={content} />);

      // Should have a markdown-body wrapper
      expect(container.firstElementChild?.classList.contains('markdown-body')).toBe(true);
    });

    it('renders incomplete mermaid block as CodeBlock during streaming', async () => {
      const { MarkdownRenderer } = await import('../components/Chat/MarkdownRenderer');

      // Incomplete: no closing ```
      const content = '```mermaid\ngraph LR\nA-->B';
      const { container } = render(
        <MarkdownRenderer content={content} isStreaming={true} />
      );

      // Should show "Generating diagram..." text since it renders as CodeBlock with hint
      expect(container.textContent).toContain('Generating diagram...');
    });

    it('renders incomplete mermaid as MermaidBlock when not streaming', async () => {
      const { MarkdownRenderer } = await import('../components/Chat/MarkdownRenderer');

      // Same incomplete content but not streaming — should still attempt MermaidBlock
      const content = '```mermaid\ngraph LR\nA-->B';
      const { container } = render(
        <MarkdownRenderer content={content} isStreaming={false} />
      );

      // Should NOT show the streaming hint
      expect(container.textContent).not.toContain('Generating diagram...');
    });

    it('handles empty mermaid block', async () => {
      const { MarkdownRenderer } = await import('../components/Chat/MarkdownRenderer');

      const content = '```mermaid\n```';
      const { container } = render(<MarkdownRenderer content={content} />);

      expect(container.firstElementChild?.classList.contains('markdown-body')).toBe(true);
    });

    it('handles mermaid opening without content', async () => {
      const { MarkdownRenderer } = await import('../components/Chat/MarkdownRenderer');

      const content = '```mermaid\n';
      const { container } = render(
        <MarkdownRenderer content={content} isStreaming={true} />
      );

      // Incomplete during streaming → shows code block with hint
      expect(container.textContent).toContain('Generating diagram...');
    });

    it('handles multiple code blocks with one incomplete mermaid', async () => {
      const { MarkdownRenderer } = await import('../components/Chat/MarkdownRenderer');

      const content = '```js\nconsole.log("hi")\n```\n\n```mermaid\ngraph LR\nA-->B';
      const { container } = render(
        <MarkdownRenderer content={content} isStreaming={true} />
      );

      // Should show the streaming hint for the incomplete mermaid
      expect(container.textContent).toContain('Generating diagram...');
      // The js code block header should still render with language label
      expect(container.textContent).toContain('js');
      // Should also show the mermaid code content
      expect(container.textContent).toContain('graph LR');
    });

    it('handles complete mermaid followed by text', async () => {
      const { MarkdownRenderer } = await import('../components/Chat/MarkdownRenderer');

      const content = '```mermaid\ngraph LR\nA-->B\n```\n\nSome text after.';
      const { container } = render(<MarkdownRenderer content={content} />);

      expect(container.textContent).toContain('Some text after.');
    });
  });
});
