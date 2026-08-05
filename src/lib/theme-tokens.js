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

/**
 * Extract tokens from a theme CSS file.
 */
function extractTokensFromCss(cssString) {
  const tokens = { ...DEFAULT_TOKENS };

  const getMatch = (regex) => {
    const match = cssString.match(regex);
    return match ? match[1].trim() : null;
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

/**
 * Generate CSS string from token map.
 */
function generateCssFromTokens(tokens) {
  const t = { ...DEFAULT_TOKENS, ...tokens };

  return `/* Custom Markdown Preview Theme */

body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
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

pre {
  background-color: ${t.bgCode};
  border: 1px solid ${t.borderAccent};
  border-radius: 8px;
  padding: 1rem 1.2rem;
  overflow-x: auto;
  margin: 1.2rem 0;
}

pre code {
  background: transparent;
  color: ${t.textBody};
  padding: 0;
  border-radius: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

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

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.2rem 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid ${t.borderAccent};
}

th, td {
  padding: 0.55rem 0.85rem;
  text-align: left;
  border-bottom: 1px solid ${t.borderAccent};
}

th {
  background-color: ${t.bgTableHeader};
  color: ${t.textH2};
  font-weight: 600;
  font-size: 0.9em;
}

tr:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.015);
}

hr {
  height: 1px;
  background-color: ${t.borderAccent};
  border: none;
  margin: 1.8rem 0;
}

img {
  max-width: 100%;
  border-radius: 6px;
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
  extractTokensFromCss,
  generateCssFromTokens
};
