import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from '../MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('always renders a div.markdown-body as root element', () => {
    const inputs = [
      '',
      'x',
      '# heading',
      '# ',
      '**',
      '```',
      '```js',
      '```js\nconsole.log("hi")',
      '```js\nconsole.log("hi")\n```',
      'Hello **world**',
      '- item 1\n- item 2',
      '> blockquote',
      '| a | b |\n|---|---|\n| 1 | 2 |',
      'normal paragraph text',
      '# H1\n\nparagraph\n\n```py\npass\n```',
    ];

    for (const input of inputs) {
      const { container, unmount } = render(<MarkdownRenderer content={input} />);
      const root = container.firstElementChild;
      expect(root?.tagName).toBe('DIV');
      expect(root?.classList.contains('markdown-body')).toBe(true);
      unmount();
    }
  });

  it('does not crash on empty string', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('renders plain text inside the wrapper', () => {
    const { container } = render(<MarkdownRenderer content="hello world" />);
    expect(container.textContent).toContain('hello world');
  });

  it('renders markdown content inside the wrapper', () => {
    const { container } = render(<MarkdownRenderer content="# Title\n\nBody text" />);
    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('Body text');
  });
});
