const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { installTheme, uninstallTheme } = require('../src/lib/theme-installer');
const { readStyles, readRecommendations } = require('../src/lib/settings-writer');

const TEST_DIR = path.join(__dirname, 'tmp-installer-test');
const APP_THEMES_DIR = path.join(__dirname, '..', 'src', 'renderer', 'themes');

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

test('installTheme writes .vscode theme CSS, settings.json, and extensions.json', () => {
  setupTestDir();

  const res = installTheme({
    projectPath: TEST_DIR,
    themeId: 'obsidian-dark',
    appThemesDir: APP_THEMES_DIR,
    userDataPath: null,
    tokens: null
  });

  assert.strictEqual(res.ok, true, res.message);
  assert.strictEqual(res.themeId, 'obsidian-dark');

  const cssFile = path.join(TEST_DIR, '.vscode', 'obsidian-dark.css');
  assert.ok(fs.existsSync(cssFile), 'writes theme CSS into .vscode');

  // Verify .crossnote is NOT created
  assert.ok(!fs.existsSync(path.join(TEST_DIR, '.crossnote')), 'does not create a .crossnote dir');

  const settingsPath = path.join(TEST_DIR, '.vscode', 'settings.json');
  assert.deepStrictEqual(readStyles(settingsPath).styles, ['./.vscode/obsidian-dark.css']);

  const extensionsPath = path.join(TEST_DIR, '.vscode', 'extensions.json');
  assert.ok(fs.existsSync(extensionsPath), 'writes extensions.json');
  const extData = readRecommendations(extensionsPath);
  assert.ok(extData.recommendations.includes('bierner.markdown-mermaid'));
  assert.ok(extData.recommendations.includes('goessner.mdmath'));

  cleanupTestDir();
});

test('installTheme preserves existing user settings, extensions, and comments', () => {
  setupTestDir();
  const vscodeDir = path.join(TEST_DIR, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  fs.writeFileSync(
    path.join(vscodeDir, 'settings.json'),
    `{
  // keep user comment
  "editor.fontSize": 14,
  "markdown.styles": ["./custom/print.css"]
}`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(vscodeDir, 'extensions.json'),
    `{
  // user team recommendation
  "recommendations": ["dbaeumer.vscode-eslint"]
}`,
    'utf8'
  );

  const res = installTheme({
    projectPath: TEST_DIR,
    themeId: 'forest-dark',
    appThemesDir: APP_THEMES_DIR,
    userDataPath: null
  });
  assert.strictEqual(res.ok, true, res.message);

  const settingsPath = path.join(vscodeDir, 'settings.json');
  const raw = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(raw.includes('// keep user comment'), 'preserves comments');
  assert.deepStrictEqual(readStyles(settingsPath).styles, [
    './custom/print.css',
    './.vscode/forest-dark.css'
  ]);
  assert.strictEqual(res.preservedUserCount, 1);

  const extensionsPath = path.join(vscodeDir, 'extensions.json');
  const rawExt = fs.readFileSync(extensionsPath, 'utf8');
  assert.ok(rawExt.includes('// user team recommendation'), 'preserves extensions comments');
  const extData = readRecommendations(extensionsPath);
  assert.ok(extData.recommendations.includes('dbaeumer.vscode-eslint'));
  assert.ok(extData.recommendations.includes('bierner.markdown-mermaid'));

  cleanupTestDir();
});

test('uninstallTheme removes theme CSS and reverts settings.json and extensions.json', () => {
  setupTestDir();

  installTheme({
    projectPath: TEST_DIR,
    themeId: 'obsidian-dark',
    appThemesDir: APP_THEMES_DIR,
    userDataPath: null
  });

  const cssFile = path.join(TEST_DIR, '.vscode', 'obsidian-dark.css');
  assert.ok(fs.existsSync(cssFile));

  const res = uninstallTheme({ projectPath: TEST_DIR, userDataPath: null });
  assert.strictEqual(res.ok, true, res.message);
  assert.strictEqual(res.removedThemeId, 'obsidian-dark');

  assert.ok(!fs.existsSync(cssFile), 'theme CSS removed');

  const settingsPath = path.join(TEST_DIR, '.vscode', 'settings.json');
  assert.deepStrictEqual(readStyles(settingsPath).styles, []);

  const extensionsPath = path.join(TEST_DIR, '.vscode', 'extensions.json');
  const extData = readRecommendations(extensionsPath);
  assert.deepStrictEqual(extData.recommendations, []);

  cleanupTestDir();
});

