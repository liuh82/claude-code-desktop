/**
 * Lightweight HTML sanitizer — replaces DOMPurify for Shadow DOM rendering.
 * Strips dangerous elements and attributes, preserves safe styling.
 */

const FORBID_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'meta', 'link[rel="stylesheet"]']);

export function sanitizeHtml(html: string): string {
  // Remove <script> tags and their content
  let clean = html.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove forbidden self-closing tags
  for (const tag of FORBID_TAGS) {
    clean = clean.replace(new RegExp(`<${tag}[^>]*\\/?>`, 'gi'), '');
  }
  // Also remove closing tags for elements we stripped
  for (const tag of ['iframe', 'object', 'embed', 'form']) {
    clean = clean.replace(new RegExp(`<\\/${tag}>`, 'gi'), '');
  }

  // Remove event handler attributes (onclick, onload, onerror, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove formaction attribute
  clean = clean.replace(/\s+formaction\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');
  clean = clean.replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');

  // Remove data: URLs in src (potential XSS vector)
  clean = clean.replace(/src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, '');

  return clean.trim();
}
