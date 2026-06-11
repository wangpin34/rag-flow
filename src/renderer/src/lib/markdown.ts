import hljs from 'highlight.js';
import { marked } from 'marked';

// Configure marked with custom renderer for code highlighting
const renderer = new marked.Renderer();

renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(text, { language: lang }).value;
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    } catch (err) {
      console.error('Highlight error:', err);
    }
  }
  const highlighted = hljs.highlightAuto(text).value;
  return `<pre><code class="hljs">${highlighted}</code></pre>`;
};

marked.setOptions({
  renderer,
  breaks: true, // Convert line breaks to <br>
  gfm: true, // GitHub Flavored Markdown
});

/**
 * Parse markdown text to HTML
 */
export function parseMarkdown(text: string): string {
  try {
    return marked.parse(text) as string;
  } catch (error) {
    console.error('Markdown parse error:', error);
    return text;
  }
}
