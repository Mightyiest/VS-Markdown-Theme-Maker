const MarkdownIt = require('markdown-it');
const hljs = require('highlight.js');
const katex = require('katex');
const fs = require('fs');
const path = require('path');

let katexCssContent = '';
try {
  const katexCssPath = require.resolve('katex/dist/katex.min.css');
  katexCssContent = fs.readFileSync(katexCssPath, 'utf8');
} catch (_) {
  katexCssContent = '';
}

let mermaidJsContent = '';
try {
  const mermaidJsPath = require.resolve('mermaid/dist/mermaid.min.js');
  mermaidJsContent = fs.readFileSync(mermaidJsPath, 'utf8');
} catch (_) {
  mermaidJsContent = '';
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const ALERT_ICONS = {
  NOTE: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
  TIP: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.91.324.567.429 1.08.429 1.783v.5a.75.75 0 0 0 .75.75h2a.75.75 0 0 0 .75-.75v-.5c0-.703.105-1.216.429-1.783.203-.354.45-.646.673-.91l.214-.253c.56-.679.984-1.32.984-2.304 0-2.06-1.637-3.75-4-3.75ZM6 13a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.5H6v.5Z"></path></svg>`,
  IMPORTANT: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h3a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h5.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm6.25 2.5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0V4.75A.75.75 0 0 1 8 4Zm0 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
  WARNING: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>`,
  CAUTION: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6c0 .199-.079.389-.22.53l-4.25 4.25a.749.749 0 0 1-.53.22H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`
};

function createMarkdownRenderer() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true
  });

  // Custom Fence Renderer (Highlight.js + Mermaid + Container with Header & Copy Button)
  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : '';
    const langName = info ? info.split(/\s+/g)[0] : '';
    const rawCode = token.content;

    if (langName.toLowerCase() === 'mermaid') {
      return `<div class="mermaid">${escapeHtml(rawCode)}</div>`;
    }

    let highlighted = '';
    if (langName && hljs.getLanguage(langName)) {
      try {
        highlighted = hljs.highlight(rawCode, { language: langName, ignoreIllegals: true }).value;
      } catch (_) {
        highlighted = escapeHtml(rawCode);
      }
    } else {
      highlighted = escapeHtml(rawCode);
    }

    const langClass = langName ? ` class="hljs language-${escapeHtml(langName)}"` : ' class="hljs"';
    const displayLang = langName ? langName.toLowerCase() : 'text';
    const base64Code = Buffer.from(rawCode).toString('base64');

    return `<div class="code-block-container">
  <div class="code-block-header">
    <span class="code-lang-label">${escapeHtml(displayLang)}</span>
    <button class="code-copy-btn" data-code="${base64Code}" onclick="handleCopyCode(this)" title="Copy Code">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>
      <span class="copy-text">Copy</span>
    </button>
  </div>
  <pre><code${langClass}>${highlighted}</code></pre>
</div>\n`;
  };

  return md;
}

const mdInstance = createMarkdownRenderer();

/**
 * Transform GitHub alert syntax (> [!NOTE], > [!TIP], etc.)
 */
function processAlerts(htmlContent) {
  const alertRegex = /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*<br\s*\/?>|\n)?([\s\S]*?)<\/p>\s*<\/blockquote>/gi;

  return htmlContent.replace(alertRegex, (_, typeRaw, body) => {
    const type = typeRaw.toUpperCase();
    const typeClass = type.toLowerCase();
    const titleText = type.charAt(0) + type.slice(1).toLowerCase();
    const iconSvg = ALERT_ICONS[type] || ALERT_ICONS.NOTE;

    return `<div class="markdown-alert markdown-alert-${typeClass}">
  <div class="markdown-alert-title">
    ${iconSvg}
    <span>${titleText}</span>
  </div>
  <div class="markdown-alert-content">
    <p>${body.trim()}</p>
  </div>
</div>`;
  });
}

/**
 * Transform GitHub task list checkboxes (- [x] and - [ ])
 */
function processTaskLists(htmlContent) {
  return htmlContent
    .replace(/<li>\s*\[ \]\s*/gi, '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled> ')
    .replace(/<li>\s*\[x\]\s*/gi, '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" checked disabled> ');
}

/**
 * Render raw Markdown text to fully enhanced HTML.
 * Preserves code blocks from LaTeX math collisions.
 */
function renderMarkdownToHtml(markdownText) {
  if (!markdownText) return '';

  // 1. Extract Display Math $$...$$ so MarkdownIt doesn't break formatting
  const mathDisplayMap = [];
  let text = markdownText.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false
      });
      const key = `<!--KATEX_DISPLAY_${mathDisplayMap.length}-->`;
      mathDisplayMap.push(`\n<div class="katex-display-wrapper">${rendered}</div>\n`);
      return key;
    } catch (_) {
      const key = `<!--KATEX_DISPLAY_${mathDisplayMap.length}-->`;
      mathDisplayMap.push(`<pre class="katex-error">${escapeHtml(math)}</pre>`);
      return key;
    }
  });

  // 2. Render Markdown via MarkdownIt
  let html = mdInstance.render(text);

  // 3. Restore Display Math
  html = html.replace(/<!--KATEX_DISPLAY_(\d+)-->/g, (_, id) => {
    return mathDisplayMap[parseInt(id, 10)] || '';
  });

  // 4. Process Inline Math $...$ only outside of HTML tags & code blocks
  html = html.replace(/(<code[\s\S]*?<\/code>|<pre[\s\S]*?<\/pre>|<[^>]+>)|(?<!\\)\$(?!\s)([^\$\n]+?)(?<!\s)\$/g, (match, tag, math) => {
    if (tag) return tag;
    if (!math) return match;
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false
      });
    } catch (_) {
      return `<code class="katex-error">${escapeHtml(math)}</code>`;
    }
  });

  // 5. Process GitHub Alerts
  const withAlerts = processAlerts(html);

  // 6. Process Task Lists
  const withTaskLists = processTaskLists(withAlerts);

  return withTaskLists;
}

function getKatexCss() {
  return katexCssContent;
}

function getMermaidJs() {
  return mermaidJsContent;
}

module.exports = {
  renderMarkdownToHtml,
  getKatexCss,
  getMermaidJs,
  processAlerts,
  processTaskLists,
  escapeHtml
};
