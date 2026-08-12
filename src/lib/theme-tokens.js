const TOKEN_LABELS = {
  bgBody: 'Background',
  textBody: 'Body Text',
  textH1: 'Heading 1',
  textH2: 'Heading 2',
  textH3: 'Heading 3',
  textH4: 'Heading 4',
  textLink: 'Link',
  bgCode: 'Code Background',
  textCode: 'Inline Code',
  bgBlockquote: 'Blockquote BG',
  borderAccent: 'Accent Border',
  bgTableHeader: 'Table Header BG'
};

const DEFAULT_TOKENS = {
  bgBody: '#1a1a2e',
  textBody: '#d4d4e4',
  textH1: '#e2e2f0',
  textH2: '#b8b8d0',
  textH3: '#9898b8',
  textH4: '#8888a8',
  textLink: '#7aa2f7',
  bgCode: '#252542',
  textCode: '#c0a0e0',
  bgBlockquote: '#1e1e38',
  borderAccent: '#4a4a70',
  bgTableHeader: '#1e1e38'
};

const COLOR_PATTERN = /^(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^)]*\)|[a-zA-Z]+)$/;

function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const c = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r; let g; let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('');
}

function fitContrast(hex, bgHex, target) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const bgIsDark = relativeLuminance(bgHex) < 0.5;
  if (contrastRatio(hex, bgHex) >= target) return hex;
  for (let step = 1; step <= 100; step++) {
    const cand = rgbToHex(...hslToRgb(h, s, bgIsDark ? Math.min(100, l + step) : Math.max(0, l - step)));
    if (contrastRatio(cand, bgHex) >= target) return cand;
  }
  return bgIsDark ? '#ffffff' : '#000000';
}

const DARK_SYNTAX_SEEDS = {
  keyword: '#ff7b72',
  string: '#a5d6ff',
  comment: '#8b949e',
  number: '#79c0ff',
  title: '#d2a8ff',
  variable: '#ffa657',
  type: '#7ee787',
  bullet: '#f2cc60',
  heading: '#4c8eff',
  addition: '#3fb950',
  deletion: '#f85149'
};

const LIGHT_SYNTAX_SEEDS = {
  keyword: '#cf222e',
  string: '#0a3069',
  comment: '#57606a',
  number: '#0550ae',
  title: '#8250df',
  variable: '#953800',
  type: '#116329',
  bullet: '#7d4e00',
  heading: '#0969da',
  addition: '#1a7f37',
  deletion: '#cf222e'
};

const AA_CONTRAST = 4.5;

function buildSyntaxPalette(bgColor, textColor) {
  const seeds = relativeLuminance(bgColor) < 0.5 ? DARK_SYNTAX_SEEDS : LIGHT_SYNTAX_SEEDS;
  const palette = {};
  for (const [key, seed] of Object.entries(seeds)) {
    palette[key] = fitContrast(seed, bgColor, AA_CONTRAST);
  }
  const fallbackText = relativeLuminance(bgColor) < 0.5 ? '#c9d1d9' : '#1f2328';
  const seedText = hexToRgb(textColor) ? textColor : fallbackText;
  palette.text = fitContrast(seedText, bgColor, AA_CONTRAST);
  return palette;
}

const HLJS_ROLE_MAP = {
  '.hljs-doctag': 'keyword',
  '.hljs-keyword': 'keyword',
  '.hljs-meta .hljs-keyword': 'keyword',
  '.hljs-template-tag': 'keyword',
  '.hljs-template-variable': 'keyword',
  '.hljs-type': 'keyword',
  '.hljs-variable.language_': 'keyword',
  '.hljs-title': 'title',
  '.hljs-title.class_': 'title',
  '.hljs-title.class_.inherited__': 'title',
  '.hljs-title.function_': 'title',
  '.hljs-attr': 'number',
  '.hljs-attribute': 'number',
  '.hljs-literal': 'number',
  '.hljs-meta': 'number',
  '.hljs-number': 'number',
  '.hljs-operator': 'number',
  '.hljs-variable': 'number',
  '.hljs-selector-attr': 'number',
  '.hljs-selector-class': 'number',
  '.hljs-selector-id': 'number',
  '.hljs-regexp': 'string',
  '.hljs-string': 'string',
  '.hljs-meta .hljs-string': 'string',
  '.hljs-built_in': 'variable',
  '.hljs-symbol': 'variable',
  '.hljs-comment': 'comment',
  '.hljs-code': 'comment',
  '.hljs-formula': 'comment',
  '.hljs-name': 'type',
  '.hljs-quote': 'type',
  '.hljs-selector-tag': 'type',
  '.hljs-selector-pseudo': 'type',
  '.hljs-subst': 'text',
  '.hljs-section': 'heading',
  '.hljs-bullet': 'bullet',
  '.hljs-emphasis': 'text',
  '.hljs-strong': 'text',
  '.hljs-addition': 'addition',
  '.hljs-deletion': 'deletion',
  '.hljs-char.escape_': 'text',
  '.hljs-link': 'text',
  '.hljs-params': 'text',
  '.hljs-property': 'text',
  '.hljs-punctuation': 'text',
  '.hljs-tag': 'text'
};

function syntaxCssForPalette(palette, prefix = '') {
  const groups = {};
  for (const [sel, role] of Object.entries(HLJS_ROLE_MAP)) {
    (groups[role] ||= []).push(sel);
  }
  const lines = [];
  for (const [role, sels] of Object.entries(groups)) {
    lines.push(`${sels.map((s) => prefix + s).join(', ')} { color: ${palette[role]}; }`);
  }
  return lines.join('\n');
}

function shadeColor(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const target = amount >= 0 ? 255 : 0;
  const k = Math.abs(amount);
  return rgbToHex(...rgb.map((v) => v + (target - v) * k));
}

function generateCodeChromeCss(t) {
  const codeIsDark = relativeLuminance(t.bgCode) < 0.5;
  const headerBg = shadeColor(t.bgCode, codeIsDark ? 0.08 : -0.05);
  const hoverBg = shadeColor(t.bgCode, codeIsDark ? 0.16 : -0.1);
  const labelColor = fitContrast(t.textH3, headerBg, AA_CONTRAST);
  const btnColor = fitContrast(t.textH4, headerBg, AA_CONTRAST);
  const btnHoverColor = fitContrast(t.textBody, hoverBg, AA_CONTRAST);
  const shadow = codeIsDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.08)';

  return `.code-block-container {
  margin: 1.3rem 0;
  background-color: ${t.bgCode};
  border: 1px solid ${t.borderAccent};
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px ${shadow};
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.85rem;
  background: ${headerBg};
  border-bottom: 1px solid ${t.borderAccent};
  user-select: none;
}

.code-lang-label {
  font-size: 0.74rem;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  color: ${labelColor};
  text-transform: lowercase;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.code-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: 1px solid transparent;
  color: ${btnColor};
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.code-copy-btn:hover {
  background: ${hoverBg};
  color: ${btnHoverColor};
  border-color: ${t.borderAccent};
}

.code-copy-btn.copied {
  color: ${fitContrast('#2ea043', headerBg, AA_CONTRAST)} !important;
}

.code-block-container pre {
  margin: 0;
  border: none;
  border-radius: 0;
  padding: 0.9rem 1.1rem !important;
  background: transparent;
}

/* Base Pre Block for standard preview environments */
pre:not(.mermaid):not(:has(code.language-mermaid)):not(:has(code.lang-mermaid)):not(:has(> svg)) {
  position: relative;
  background-color: ${t.bgCode};
  border: 1px solid ${t.borderAccent};
  border-radius: 8px;
  padding: 1rem 1.2rem;
  overflow-x: auto;
  margin: 1.2rem 0;
  box-sizing: border-box;
}

/* Header Bar for Pre Code Blocks (Native VS Code Preview) */
pre[data-lang]:not([data-lang=""]):not(.code-block-container pre):not(.mermaid):not(:has(code.language-mermaid)),
pre:has(code[class*="language-"]):not(.code-block-container pre):not(.mermaid):not(:has(code.language-mermaid)):not(:has(code.lang-mermaid)) {
  padding-top: 2.35rem !important;
}

pre[data-lang]:not([data-lang=""]):not(.code-block-container pre):not(.mermaid):not(:has(code.language-mermaid))::before,
pre:has(code[class*="language-"]):not(.code-block-container pre):not(.mermaid):not(:has(code.language-mermaid)):not(:has(code.lang-mermaid))::before {
  content: 'CODE';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1.85rem;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid ${t.borderAccent};
  padding: 0 0.85rem;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, -apple-system, BlinkMacSystemFont, monospace;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${t.textBody};
  opacity: 0.8;
  display: flex;
  align-items: center;
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  pointer-events: none;
  box-sizing: border-box;
}

/* Use data-lang attribute if present */
pre[data-lang]:not([data-lang=""]):not(.code-block-container pre)::before {
  content: attr(data-lang) !important;
}

/* Specific Language Label Overrides for VS Code Native Markdown */
pre:not([data-lang]):not(.code-block-container pre):has(code.language-javascript)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-javascript)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-js)::before { content: 'JAVASCRIPT' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-typescript)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-typescript)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-ts)::before { content: 'TYPESCRIPT' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-html)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-html)::before { content: 'HTML' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-css)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-css)::before { content: 'CSS' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-json)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-json)::before { content: 'JSON' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-python)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-python)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-py)::before { content: 'PYTHON' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-bash)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-bash)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-sh)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-shell)::before { content: 'BASH' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-cpp)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-cpp)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-c)::before { content: 'C++' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-csharp)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-csharp)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-cs)::before { content: 'C#' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-java)::before { content: 'JAVA' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-sql)::before { content: 'SQL' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-xml)::before { content: 'XML' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-yaml)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-yaml)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-yml)::before { content: 'YAML' !important; }
pre:not([data-lang]):not(.code-block-container pre):has(code.language-markdown)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.lang-markdown)::before, pre:not([data-lang]):not(.code-block-container pre):has(code.language-md)::before { content: 'MARKDOWN' !important; }

/* Rendered Diagram & Mermaid Containers */
.mermaid,
div.mermaid {
  background: ${t.bgCode} !important;
  border: 1px solid ${t.borderAccent} !important;
  border-radius: 8px !important;
  padding: 1.25rem !important;
  margin: 1.3rem 0 !important;
  text-align: center !important;
  overflow-x: auto !important;
  box-sizing: border-box !important;
  max-width: 100% !important;
}

.mermaid svg,
div.mermaid svg {
  max-width: min(100%, 600px) !important;
  height: auto !important;
  margin: 0 auto !important;
  display: inline-block !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
}

/* Ensure Mermaid text, nodes, labels, and arrows match theme tokens in light & dark modes */
.mermaid text,
.mermaid foreignObject,
.mermaid foreignObject div,
.mermaid foreignObject span,
.mermaid foreignObject p,
.mermaid .nodeLabel,
.mermaid .labelText,
.mermaid .label text,
.mermaid .label span,
.mermaid .edgeLabel,
.mermaid .edgeLabel span,
.mermaid .edgeLabel p,
.mermaid .messageText,
.mermaid .noteText,
.mermaid .noteText span,
.mermaid .actor text,
.mermaid .legend text {
  fill: ${t.textBody} !important;
  color: ${t.textBody} !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
}

.mermaid .node rect,
.mermaid .node circle,
.mermaid .node polygon,
.mermaid .node path,
.mermaid .cluster rect,
.mermaid rect.labelBox,
.mermaid .labelBox,
.mermaid .note,
.mermaid rect.note {
  fill: ${t.bgBody} !important;
  stroke: ${t.borderAccent} !important;
}

.mermaid .actor,
.mermaid rect.actor {
  fill: ${t.bgBody} !important;
  stroke: ${t.borderAccent} !important;
}

.mermaid .actor-man line,
.mermaid .actor-man circle,
.mermaid .actor-man path {
  stroke: ${t.textBody} !important;
  fill: ${t.bgBody} !important;
}

.mermaid line.actor,
.mermaid line.messageLine0,
.mermaid line.messageLine1,
.mermaid .loopLine,
.mermaid .edgePath path,
.mermaid .flowchart-link {
  stroke: ${t.textH3} !important;
}

.mermaid .arrowheadPath,
.mermaid .marker,
.mermaid .sequenceNumber {
  fill: ${t.textH3} !important;
  stroke: ${t.textH3} !important;
  color: ${t.bgBody} !important;
}

.mermaid .edgeLabel,
.mermaid .edgeLabel span,
.mermaid .edgeLabel p {
  background-color: ${t.bgCode} !important;
  color: ${t.textBody} !important;
  padding: 2px 6px !important;
  border-radius: 4px !important;
}

/* Completely suppress raw pre blocks when Mermaid or SVG is present */
pre:has(code.language-mermaid),
pre:has(code.lang-mermaid),
pre.mermaid:has(svg),
pre:has(> svg),
pre:has(> div.mermaid) {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  box-shadow: none !important;
}

pre:has(code.language-mermaid)::before,
pre:has(code.lang-mermaid)::before,
pre.mermaid::before,
pre:has(> svg)::before,
pre:has(> div.mermaid)::before {
  display: none !important;
  content: none !important;
}

/* Explicit Table Column Alignment Support */
th[align="left"], td[align="left"] {
  text-align: left !important;
}

th[align="center"], td[align="center"] {
  text-align: center !important;
}

th[align="right"], td[align="right"] {
  text-align: right !important;
}

th[style*="text-align: left"], td[style*="text-align: left"],
th[style*="text-align:left"], td[style*="text-align:left"] {
  text-align: left !important;
}

th[style*="text-align: center"], td[style*="text-align: center"],
th[style*="text-align:center"], td[style*="text-align:center"] {
  text-align: center !important;
}

th[style*="text-align: right"], td[style*="text-align: right"],
th[style*="text-align:right"], td[style*="text-align:right"] {
  text-align: right !important;
}

/* KaTeX & Math */
.katex-display-wrapper,
.katex-display {
  margin: 1.2rem 0;
  padding: 0.6rem 0;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
}

.katex {
  font-size: 1.08em;
  color: ${t.textBody};
}

/* Task Lists & Form Controls */
ul.contains-task-list,
ol.contains-task-list,
ul:has(input[type="checkbox"]),
ol:has(input[type="checkbox"]) {
  list-style-type: none !important;
  padding-left: 0.4rem !important;
}

li.task-list-item,
.task-list-item,
li:has(input[type="checkbox"]) {
  list-style-type: none !important;
  margin-bottom: 0.45rem;
}

input[type="checkbox"],
input[type="radio"],
.task-list-item-checkbox {
  accent-color: ${t.textLink};
  width: 1.05em;
  height: 1.05em;
  margin: 0 0.45em 0.2em 0;
  vertical-align: middle;
}`;
}

function generateSyntaxCss(t, prefix = '') {
  const palette = buildSyntaxPalette(t.bgCode, t.textBody);
  const p = prefix;
  return `${p}.hljs,
${p}pre code,
${p}pre code.hljs {
  color: ${palette.text};
  background: transparent;
}

${syntaxCssForPalette(palette, p)}

${p}.hljs-comment,
${p}.hljs-quote {
  font-style: italic;
}

${p}.hljs-emphasis { font-style: italic; }
${p}.hljs-strong { font-weight: 600; }
${p}.hljs-section { font-weight: 600; }
${p}.hljs-link { text-decoration: underline; }`;
}

function splitTopLevelCommas(str) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function sanitizeColorValue(raw) {
  if (typeof raw !== 'string') return null;

  let value = raw.trim().replace(/\s*!important\s*$/i, '').trim();

  let guard = 0;
  while (/^var\s*\(/i.test(value) && guard < 5) {
    guard++;
    const open = value.indexOf('(');
    const close = value.lastIndexOf(')');
    if (open === -1 || close <= open) return null;

    const args = splitTopLevelCommas(value.slice(open + 1, close));
    if (args.length < 2) return null;

    value = args.slice(1).join(',').trim();
  }

  if (!value || !COLOR_PATTERN.test(value)) return null;
  return value;
}

function extractTokensFromCss(cssString) {
  const tokens = { ...DEFAULT_TOKENS };

  const getMatch = (regex) => {
    const match = cssString.match(regex);
    return match ? sanitizeColorValue(match[1]) : null;
  };

  const bgBody = getMatch(/body\s*\{[^}]*background-color:\s*([^;}]+)/i);
  if (bgBody) tokens.bgBody = bgBody;

  const textBody = getMatch(/body\s*\{[^}]*color:\s*([^;}]+)/i);
  if (textBody) tokens.textBody = textBody;

  const textH1 = getMatch(/h1\s*\{[^}]*color:\s*([^;}]+)/i);
  if (textH1) tokens.textH1 = textH1;

  const textH2 = getMatch(/h2\s*\{[^}]*color:\s*([^;}]+)/i);
  if (textH2) tokens.textH2 = textH2;

  const textH3 = getMatch(/h3\s*\{[^}]*color:\s*([^;}]+)/i);
  if (textH3) tokens.textH3 = textH3;

  const textH4 = getMatch(/h4\s*\{[^}]*color:\s*([^;}]+)/i);
  if (textH4) tokens.textH4 = textH4;

  const textLink = getMatch(/a\s*\{[^}]*color:\s*([^;}]+)/i);
  if (textLink) tokens.textLink = textLink;

  const textCode = getMatch(/code\s*\{[^}]*color:\s*([^;}]+)/i);
  if (textCode) tokens.textCode = textCode;

  const bgCode = getMatch(/code\s*\{[^}]*background-color:\s*([^;}]+)/i);
  if (bgCode) tokens.bgCode = bgCode;

  const bgBlockquote = getMatch(/blockquote\s*\{[^}]*background:\s*([^;}]+)/i);
  if (bgBlockquote) tokens.bgBlockquote = bgBlockquote;

  const borderAccent = getMatch(/blockquote\s*\{[^}]*border-left:\s*[^;}]*?(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i);
  if (borderAccent) tokens.borderAccent = borderAccent;

  const bgTableHeader = getMatch(/th\s*\{[^}]*background-color:\s*([^;}]+)/i);
  if (bgTableHeader) tokens.bgTableHeader = bgTableHeader;

  return tokens;
}

function generateCssFromTokens(tokens) {
  const t = { ...DEFAULT_TOKENS, ...tokens };

  return `/* Custom Markdown Preview Theme */

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: ${t.bgBody};
  color: ${t.textBody};
  line-height: 1.75;
  padding: 2rem 1.75rem;
  max-width: 860px;
  margin: 0 auto;
  font-size: 15px;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.8em;
  margin-bottom: 0.5em;
  letter-spacing: -0.01em;
}

h1 {
  font-size: 1.8rem;
  color: ${t.textH1};
  border-bottom: 1px solid ${t.borderAccent};
  padding-bottom: 0.4rem;
}

h2 {
  font-size: 1.45rem;
  color: ${t.textH2};
  border-bottom: 1px solid ${t.borderAccent};
  padding-bottom: 0.35rem;
}

h3 {
  font-size: 1.2rem;
  color: ${t.textH3};
}

h4 {
  font-size: 1.05rem;
  color: ${t.textH4};
}

p {
  margin-bottom: 1.1rem;
}

ul, ol {
  margin-bottom: 1.1rem;
  padding-left: 1.5rem;
}

li {
  margin-bottom: 0.3rem;
}

a {
  color: ${t.textLink};
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

strong {
  font-weight: 600;
}

code {
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.875em;
  background-color: ${t.bgCode};
  color: ${t.textCode};
  padding: 0.15em 0.4em;
  border-radius: 4px;
}

/* Code Chrome & Extended Markdown Support */
${generateCodeChromeCss(t)}

/* Standard Blockquotes */
blockquote {
  margin: 1.2rem 0;
  padding: 0.7rem 1rem;
  background: ${t.bgBlockquote};
  border-left: 3px solid ${t.borderAccent};
  border-radius: 0 6px 6px 0;
}

blockquote p:last-child {
  margin-bottom: 0;
}

/* GitHub-Style Alerts */
.markdown-alert {
  padding: 0.85rem 1.1rem;
  margin: 1.3rem 0;
  border-left: 4px solid;
  border-radius: 0 8px 8px 0;
}

.markdown-alert-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.92rem;
  margin-bottom: 0.35rem;
}

.markdown-alert-content p:last-child {
  margin-bottom: 0;
}

.markdown-alert.markdown-alert-note {
  border-color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.08);
}
.markdown-alert.markdown-alert-note .markdown-alert-title {
  color: #3b82f6;
}

.markdown-alert.markdown-alert-tip {
  border-color: #10b981;
  background-color: rgba(16, 185, 129, 0.08);
}
.markdown-alert.markdown-alert-tip .markdown-alert-title {
  color: #10b981;
}

.markdown-alert.markdown-alert-important {
  border-color: #a855f7;
  background-color: rgba(168, 85, 247, 0.08);
}
.markdown-alert.markdown-alert-important .markdown-alert-title {
  color: #a855f7;
}

.markdown-alert.markdown-alert-warning {
  border-color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.08);
}
.markdown-alert.markdown-alert-warning .markdown-alert-title {
  color: #f59e0b;
}

.markdown-alert.markdown-alert-caution {
  border-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.08);
}
.markdown-alert.markdown-alert-caution .markdown-alert-title {
  color: #ef4444;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.3rem 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid ${t.borderAccent};
}

thead {
  background-color: ${t.bgTableHeader};
}

th, td {
  padding: 0.65rem 0.95rem;
  text-align: left;
  vertical-align: middle;
  border: 1px solid ${t.borderAccent};
  font-variant-numeric: tabular-nums;
}

th {
  background-color: ${t.bgTableHeader};
  color: ${t.textH2};
  font-weight: 600;
  font-size: 0.9em;
}

tr:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.02);
}

tr:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

/* Highlight.js Syntax Highlighting Palette */
${generateSyntaxCss(t)}

hr {
  height: 1px;
  background-color: ${t.borderAccent};
  border: none;
  margin: 1.8rem 0;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  box-sizing: border-box;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: ${t.bgBody};
}

::-webkit-scrollbar-thumb {
  background: ${t.borderAccent};
  border-radius: 3px;
}
`;
}

module.exports = {
  TOKEN_LABELS,
  DEFAULT_TOKENS,
  AA_CONTRAST,
  HLJS_ROLE_MAP,
  relativeLuminance,
  contrastRatio,
  fitContrast,
  shadeColor,
  buildSyntaxPalette,
  generateSyntaxCss,
  generateCodeChromeCss,
  sanitizeColorValue,
  extractTokensFromCss,
  generateCssFromTokens
};