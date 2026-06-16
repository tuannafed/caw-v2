import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(text: string): string {
  if (!text || !text.trim()) return '';
  try {
    const out = marked.parse(text);
    return typeof out === 'string' ? out : '';
  } catch {
    return escapeHtml(text);
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
