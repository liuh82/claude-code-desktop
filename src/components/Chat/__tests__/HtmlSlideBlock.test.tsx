import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { HtmlSlideBlock } from '../HtmlSlideBlock';

// Mock DOMPurify — by default pass through HTML unchanged
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => html),
  },
}));

describe('HtmlSlideBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders HTML into Shadow DOM', async () => {
    const html = '<div class="test-content">Hello World</div>';
    const { container } = render(<HtmlSlideBlock html={html} />);

    const host = container.firstElementChild as HTMLElement;
    expect(host).toBeTruthy();
    const shadow = host.shadowRoot;
    expect(shadow).toBeTruthy();
    expect(shadow!.innerHTML).toContain('Hello World');
  });

  it('filters out script tags via DOMPurify', async () => {
    const { default: dompurify } = await import('dompurify');
    vi.mocked(dompurify.sanitize).mockImplementation((html: string) => {
      return html.replace(/<script[\s\S]*?<\/script>/gi, '');
    });

    const html = '<div>safe</div><script>alert("xss")</script>';
    const { container } = render(<HtmlSlideBlock html={html} />);

    const host = container.firstElementChild as HTMLElement;
    const shadow = host.shadowRoot!;
    expect(shadow.innerHTML).not.toContain('<script');
    expect(shadow.innerHTML).toContain('safe');
  });

  it('filters out onclick attributes via DOMPurify', async () => {
    const { default: dompurify } = await import('dompurify');
    vi.mocked(dompurify.sanitize).mockImplementation((html: string) => {
      return html.replace(/\s*onclick="[^"]*"/gi, '');
    });

    const html = '<button onclick="alert(1)">Click me</button>';
    const { container } = render(<HtmlSlideBlock html={html} />);

    const host = container.firstElementChild as HTMLElement;
    const shadow = host.shadowRoot!;
    expect(shadow.innerHTML).not.toContain('onclick');
    expect(shadow.innerHTML).toContain('Click me');
  });

  it('allows style tags', async () => {
    const { default: dompurify } = await import('dompurify');
    vi.mocked(dompurify.sanitize).mockImplementation((html: string) => html);

    const html = '<style>.red { color: red; }</style><div class="red">Styled</div>';
    const { container } = render(<HtmlSlideBlock html={html} />);

    const host = container.firstElementChild as HTMLElement;
    const shadow = host.shadowRoot!;
    expect(shadow.innerHTML).toContain('<style>');
    expect(shadow.innerHTML).toContain('Styled');
  });

  it('renders unclosed htmlslide as markdown code block (not slide)', async () => {
    const { splitHtmlSlideBlocks } = await import('../MarkdownRenderer');

    const content = '```htmlslide\n<div>still streaming...';
    const blocks = splitHtmlSlideBlocks(content, true);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('htmlslide-incomplete');
  });
});
