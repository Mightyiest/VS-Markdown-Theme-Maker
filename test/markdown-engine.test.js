const test = require('node:test');
const assert = require('node:assert');
const { renderMarkdownToHtml, getKatexCss, getMermaidJs, processMath, processAlerts, processTaskLists } = require('../src/lib/markdown-engine');

test('markdown-engine: renders headers, paragraphs and inline styles', () => {
  const md = '# Title\n\nThis is **bold** and *italic*.';
  const html = renderMarkdownToHtml(md);
  assert.ok(html.includes('<h1>Title</h1>'));
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('<em>italic</em>'));
});

test('markdown-engine: renders clean highlighted code blocks with header and copy button', () => {
  const md = '```javascript\nconst x = 42;\nconsole.log(`Val: ${x}`);\n```';
  const html = renderMarkdownToHtml(md);

  assert.ok(html.includes('class="code-block-container"'));
  assert.ok(html.includes('class="code-block-header"'));
  assert.ok(html.includes('class="code-lang-label">javascript</span>'));
  assert.ok(html.includes('class="code-copy-btn"'));
  assert.ok(html.includes('<pre><code class="hljs language-javascript">'));
  assert.ok(html.includes('hljs-keyword'));
  // Ensure JS template literals ${...} are preserved and NOT parsed as LaTeX math
  assert.ok(!html.includes('class="katex"'));
  assert.ok(html.includes('${x}'));
  assert.ok(html.includes('Val:'));
});

test('markdown-engine: renders LaTeX math equations with KaTeX', () => {
  const md = 'Inline math $E = mc^2$ and block math:\n\n$$ \\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2} $$';
  const html = renderMarkdownToHtml(md);

  assert.ok(html.includes('class="katex"'));
  assert.ok(html.includes('class="katex-display-wrapper"'));
});

test('markdown-engine: renders GitHub-style alert callouts', () => {
  const md = '> [!NOTE]\n> This is a helpful note.\n\n> [!WARNING]\n> Be careful with this action.';
  const html = renderMarkdownToHtml(md);

  assert.ok(html.includes('class="markdown-alert markdown-alert-note"'));
  assert.ok(html.includes('<span>Note</span>'));
  assert.ok(html.includes('class="markdown-alert markdown-alert-warning"'));
  assert.ok(html.includes('<span>Warning</span>'));
});

test('markdown-engine: renders mermaid diagram blocks', () => {
  const md = '```mermaid\ngraph TD;\nA-->B;\n```';
  const html = renderMarkdownToHtml(md);

  assert.ok(html.includes('<div class="mermaid">graph TD;\nA--&gt;B;\n</div>'));
});

test('markdown-engine: renders task list checkboxes', () => {
  const md = '- [x] Completed task\n- [ ] Pending task';
  const html = renderMarkdownToHtml(md);

  assert.ok(html.includes('class="task-list-item"'));
  assert.ok(html.includes('<input type="checkbox" class="task-list-item-checkbox" checked disabled>'));
  assert.ok(html.includes('<input type="checkbox" class="task-list-item-checkbox" disabled>'));
});

test('markdown-engine: provides non-empty KaTeX CSS bundle', () => {
  const css = getKatexCss();
  assert.strictEqual(typeof css, 'string');
  assert.ok(css.length > 0);
  assert.ok(css.includes('.katex'));
});

test('markdown-engine: provides non-empty Mermaid JS bundle', () => {
  const js = getMermaidJs();
  assert.strictEqual(typeof js, 'string');
  assert.ok(js.length > 0);
  assert.ok(js.includes('mermaid'));
});
