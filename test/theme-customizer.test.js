const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { extractTokensFromCss, generateCssFromTokens, TOKEN_LABELS } = require('../src/lib/theme-tokens');
const { listCustomThemes, saveCustomTheme, deleteCustomTheme, getCustomThemeCss } = require('../src/lib/custom-themes');

const TEST_USERDATA = path.join(__dirname, 'tmp-customizer-test');

function setupDir() {
  if (fs.existsSync(TEST_USERDATA)) {
    fs.rmSync(TEST_USERDATA, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_USERDATA, { recursive: true });
}

function cleanupDir() {
  if (fs.existsSync(TEST_USERDATA)) {
    fs.rmSync(TEST_USERDATA, { recursive: true, force: true });
  }
}

test('theme-tokens: extractTokensFromCss and generateCssFromTokens round-trip', () => {
  const css = `
    body { background-color: #112233; color: #aabbcc; }
    h1 { color: #ff0000; }
    h2 { color: #00ff00; }
    h3 { color: #0000ff; }
    h4 { color: #ffff00; }
    a { color: #ff00ff; }
    code { background-color: #123456; color: #654321; }
    blockquote { background: #111111; border-left: 3px solid #ff0000; }
    th { background-color: #222222; }
  `;

  const tokens = extractTokensFromCss(css);
  assert.strictEqual(tokens.bgBody, '#112233');
  assert.strictEqual(tokens.textBody, '#aabbcc');
  assert.strictEqual(tokens.textH1, '#ff0000');
  assert.strictEqual(tokens.textH2, '#00ff00');
  assert.strictEqual(tokens.textH3, '#0000ff');
  assert.strictEqual(tokens.textH4, '#ffff00');
  assert.strictEqual(tokens.textLink, '#ff00ff');
  assert.strictEqual(tokens.bgCode, '#123456');
  assert.strictEqual(tokens.textCode, '#654321');
  assert.strictEqual(tokens.bgBlockquote, '#111111');
  assert.strictEqual(tokens.borderAccent, '#ff0000');
  assert.strictEqual(tokens.bgTableHeader, '#222222');

  const generatedCss = generateCssFromTokens(tokens);
  assert.ok(generatedCss.includes('background-color: #112233;'));
  assert.ok(generatedCss.includes('color: #aabbcc;'));
  assert.ok(generatedCss.includes('color: #ff0000;'));
});

test('custom-themes: save, list, and delete custom themes', () => {
  setupDir();

  const saveRes = saveCustomTheme(TEST_USERDATA, {
    name: 'Neon Cyber',
    baseThemeId: 'obsidian-dark',
    tokens: { bgBody: '#05050d', textBody: '#00ffcc' }
  });

  assert.strictEqual(saveRes.ok, true);
  assert.ok(saveRes.themeId.startsWith('custom-'));

  const list = listCustomThemes(TEST_USERDATA);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, 'Neon Cyber');
  assert.strictEqual(list[0].tokens.bgBody, '#05050d');

  const css = getCustomThemeCss(TEST_USERDATA, saveRes.themeId);
  assert.ok(css.includes('background-color: #05050d;'));
  assert.ok(css.includes('color: #00ffcc;'));

  const delRes = deleteCustomTheme(TEST_USERDATA, saveRes.themeId);
  assert.strictEqual(delRes.ok, true);

  const emptyList = listCustomThemes(TEST_USERDATA);
  assert.strictEqual(emptyList.length, 0);

  cleanupDir();
});
