const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  readStyles,
  computeNextStyles,
  writeStyles,
  extractThemeIdFromPath,
  readRecommendations,
  computeNextRecommendations,
  writeRecommendations,
  RECOMMENDED_MARKDOWN_EXTENSIONS
} = require('../src/lib/settings-writer');

const TEST_DIR = path.join(__dirname, 'tmp-settings-test');

function setupTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

test('extractThemeIdFromPath matches known theme filenames', () => {
  assert.strictEqual(extractThemeIdFromPath('./.vscode/midnight-dark.css'), 'midnight-dark');
  assert.strictEqual(extractThemeIdFromPath('.\\.vscode\\forest-dark.css'), 'forest-dark');
  assert.strictEqual(extractThemeIdFromPath('./custom/print.css'), null);
  assert.strictEqual(extractThemeIdFromPath(null), null);
});

test('computeNextStyles preserves custom entries and updates theme', () => {
  const current = ['./custom/print.css', './.vscode/midnight-dark.css'];
  const { nextStyles, preservedUserCount } = computeNextStyles(current, 'forest-dark');
  assert.deepStrictEqual(nextStyles, ['./custom/print.css', './.vscode/forest-dark.css']);
  assert.strictEqual(preservedUserCount, 1);
});

test('writeStyles creates file if absent', () => {
  setupTestDir();
  const settingsPath = path.join(TEST_DIR, 'settings.json');
  const res = writeStyles(settingsPath, ['./.vscode/sand-light.css']);
  assert.strictEqual(res.ok, true);

  const read = readStyles(settingsPath);
  assert.strictEqual(read.exists, true);
  assert.deepStrictEqual(read.styles, ['./.vscode/sand-light.css']);
  cleanupTestDir();
});

test('writeStyles preserves comments and existing keys in JSONC', () => {
  setupTestDir();
  const settingsPath = path.join(TEST_DIR, 'settings.json');
  const initialJSONC = `// Global team config
{
  // Editor tab size
  "editor.tabSize": 4,
  "markdown.styles": ["./custom/print.css", "./.vscode/midnight-dark.css"],
}
`;
  fs.writeFileSync(settingsPath, initialJSONC, 'utf8');

  const { nextStyles } = computeNextStyles(readStyles(settingsPath).styles, 'obsidian-dark');
  const res = writeStyles(settingsPath, nextStyles);
  assert.strictEqual(res.ok, true);

  const updatedContent = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(updatedContent.includes('// Global team config'));
  assert.ok(updatedContent.includes('// Editor tab size'));
  assert.ok(updatedContent.includes('"editor.tabSize": 4'));
  assert.ok(updatedContent.includes('"./custom/print.css"'));
  assert.ok(updatedContent.includes('"./.vscode/obsidian-dark.css"'));
  assert.ok(!updatedContent.includes('midnight-dark.css'));
  assert.ok(fs.existsSync(`${settingsPath}.bak-1`));
  cleanupTestDir();
});

test('writeStyles handles malformed JSON safely', () => {
  setupTestDir();
  const settingsPath = path.join(TEST_DIR, 'settings.json');
  fs.writeFileSync(settingsPath, '{ "editor.tabSize": 4, broken json... }', 'utf8');

  const res = writeStyles(settingsPath, ['./.vscode/frost-light.css']);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'EMALFORMED');
  cleanupTestDir();
});

test('uninstall removes property entirely when empty', () => {
  setupTestDir();
  const settingsPath = path.join(TEST_DIR, 'settings.json');
  fs.writeFileSync(settingsPath, '{\n  "markdown.styles": ["./.vscode/paper-light.css"]\n}', 'utf8');

  const { nextStyles } = computeNextStyles(readStyles(settingsPath).styles, null);
  const res = writeStyles(settingsPath, nextStyles);
  assert.strictEqual(res.ok, true);

  const updatedContent = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(!updatedContent.includes('markdown.styles'));
  cleanupTestDir();
});

test('computeNextRecommendations merges and deduplicates recommendations', () => {
  const current = ['esbenp.prettier-vscode', 'bierner.markdown-mermaid'];
  const next = computeNextRecommendations(current, RECOMMENDED_MARKDOWN_EXTENSIONS);
  assert.deepStrictEqual(next, [
    'esbenp.prettier-vscode',
    'bierner.markdown-mermaid',
    'goessner.mdmath',
    'yzhang.markdown-all-in-one'
  ]);
});

test('writeRecommendations writes and preserves extensions.json', () => {
  setupTestDir();
  const extensionsPath = path.join(TEST_DIR, 'extensions.json');
  const initial = `// Project extensions
{
  "recommendations": ["dbaeumer.vscode-eslint"]
}`;
  fs.writeFileSync(extensionsPath, initial, 'utf8');

  const read = readRecommendations(extensionsPath);
  assert.strictEqual(read.exists, true);
  assert.deepStrictEqual(read.recommendations, ['dbaeumer.vscode-eslint']);

  const next = computeNextRecommendations(read.recommendations, RECOMMENDED_MARKDOWN_EXTENSIONS);
  const writeRes = writeRecommendations(extensionsPath, next);
  assert.strictEqual(writeRes.ok, true);

  const updated = readRecommendations(extensionsPath);
  assert.ok(updated.recommendations.includes('dbaeumer.vscode-eslint'));
  assert.ok(updated.recommendations.includes('bierner.markdown-mermaid'));
  assert.ok(updated.recommendations.includes('goessner.mdmath'));
  assert.ok(updated.rawText.includes('// Project extensions'));

  // Test clean removal
  const cleaned = computeNextRecommendations(updated.recommendations, [], RECOMMENDED_MARKDOWN_EXTENSIONS);
  writeRecommendations(extensionsPath, cleaned);
  const afterClean = readRecommendations(extensionsPath);
  assert.deepStrictEqual(afterClean.recommendations, ['dbaeumer.vscode-eslint']);

  cleanupTestDir();
});

