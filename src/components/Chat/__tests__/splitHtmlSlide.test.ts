import { describe, it, expect } from 'vitest';
import { splitHtmlSlideBlocks } from '../MarkdownRenderer';

describe('splitHtmlSlideBlocks', () => {
  it('returns single markdown block when no htmlslide present', () => {
    const result = splitHtmlSlideBlocks('# Hello\n\nSome text', false);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('markdown');
    expect(result[0].content).toBe('# Hello\n\nSome text');
  });

  it('splits single closed htmlslide into [markdown, htmlslide, markdown]', () => {
    const content = 'Before\n```htmlslide\n<div>Hello</div>\n```\nAfter';
    const result = splitHtmlSlideBlocks(content, false);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('markdown');
    expect(result[0].content).toBe('Before\n');
    expect(result[1].type).toBe('htmlslide');
    expect(result[1].html).toBe('<div>Hello</div>');
    expect(result[2].type).toBe('markdown');
    expect(result[2].content).toBe('\nAfter');
  });

  it('handles multiple htmlslide blocks correctly', () => {
    const content = 'A\n```htmlslide\n<div>A</div>\n```\nB\n```htmlslide\n<div>B</div>\n```\nC';
    const result = splitHtmlSlideBlocks(content, false);
    expect(result).toHaveLength(5);
    expect(result[0].type).toBe('markdown');
    expect(result[0].content).toBe('A\n');
    expect(result[1].type).toBe('htmlslide');
    expect(result[1].html).toBe('<div>A</div>');
    expect(result[2].type).toBe('markdown');
    expect(result[2].content).toBe('\nB\n');
    expect(result[3].type).toBe('htmlslide');
    expect(result[3].html).toBe('<div>B</div>');
    expect(result[4].type).toBe('markdown');
    expect(result[4].content).toBe('\nC');
  });

  it('returns htmlslide-incomplete for unclosed block when isStreaming=false', () => {
    const content = 'Before\n```htmlslide\n<div>open';
    const result = splitHtmlSlideBlocks(content, false);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('markdown');
    expect(result[0].content).toBe('Before\n');
    expect(result[1].type).toBe('htmlslide-incomplete');
  });

  it('returns htmlslide-incomplete for unclosed block when isStreaming=true', () => {
    const content = 'Before\n```htmlslide\n<div>still streaming';
    const result = splitHtmlSlideBlocks(content, true);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('markdown');
    expect(result[0].content).toBe('Before\n');
    expect(result[1].type).toBe('htmlslide-incomplete');
  });

  it('keeps mermaid in markdown part when mixed with htmlslide', () => {
    const content = '```mermaid\ngraph LR\n  A-->B\n```\n```htmlslide\n<div>slide</div>\n```';
    const result = splitHtmlSlideBlocks(content, false);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('markdown');
    expect(result[0].content).toBe('```mermaid\ngraph LR\n  A-->B\n```\n');
    expect(result[1].type).toBe('htmlslide');
    expect(result[1].html).toBe('<div>slide</div>');
  });

  it('returns single markdown block for empty string', () => {
    const result = splitHtmlSlideBlocks('', false);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('markdown');
    expect(result[0].content).toBe('');
  });

  it('handles htmlslide at the start of content', () => {
    const content = '```htmlslide\n<div>first</div>\n```\nrest';
    const result = splitHtmlSlideBlocks(content, false);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('htmlslide');
    expect(result[0].html).toBe('<div>first</div>');
    expect(result[1].type).toBe('markdown');
    expect(result[1].content).toBe('\nrest');
  });
});
