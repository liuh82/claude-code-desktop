/**
 * Lightweight HTML sanitizer — replaces DOMPurify for Shadow DOM rendering.
 * Strips dangerous elements and attributes, preserves safe styling.
 */

const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'meta'];

export function sanitizeHtml(html: string): string {
  // Extract body content if full HTML document is provided
  // CC often outputs <!DOCTYPE html><html><body>...</body></html>
  // which doesn't render inside Shadow DOM — we need just the body content
  let clean = html;

  const bodyMatch = clean.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    // Extract <style> tags from <head> if present
    const headStyles: string[] = [];
    const headMatch = clean.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let m;
      while ((m = styleRegex.exec(headMatch[1])) !== null) {
        headStyles.push(m[0]);
      }
    }
    // Also grab <style> tags from before body if no <head>
    if (headStyles.length === 0) {
      const beforeBody = clean.slice(0, clean.indexOf(bodyMatch[0]));
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let m;
      while ((m = styleRegex.exec(beforeBody)) !== null) {
        headStyles.push(m[0]);
      }
    }
    clean = headStyles.join('\n') + bodyMatch[1];
  }

  // Remove <script> tags and their content
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove forbidden tags
  for (const tag of FORBID_TAGS) {
    clean = clean.replace(new RegExp(`<${tag}[^>]*\\/?>`, 'gi'), '');
  }
  for (const tag of ['iframe', 'object', 'embed', 'form']) {
    clean = clean.replace(new RegExp(`<\\/${tag}>`, 'gi'), '');
  }

  // Remove event handler attributes
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  clean = clean.replace(/\s+formaction\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');

  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');
  clean = clean.replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');

  // Remove data: URLs in src
  clean = clean.replace(/src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, '');

  return clean.trim();
}
