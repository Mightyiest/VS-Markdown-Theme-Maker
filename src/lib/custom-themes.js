const fs = require('fs');
const path = require('path');
const { generateCssFromTokens } = require('./theme-tokens');

function getCustomThemesDir(userDataPath) {
  const dir = path.join(userDataPath, 'custom-themes');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function listCustomThemes(userDataPath) {
  const dir = getCustomThemesDir(userDataPath);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const list = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      const data = JSON.parse(content);
      if (data && data.id && data.name && data.tokens) {
        list.push(data);
      }
    } catch (_) {}
  }

  return list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
}

function getCustomTheme(userDataPath, themeId) {
  const dir = getCustomThemesDir(userDataPath);
  const filePath = path.join(dir, `${themeId}.json`);

  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (_) {
    return null;
  }
}

function saveCustomTheme(userDataPath, { id, name, baseThemeId, group, tokens }) {
  const dir = getCustomThemesDir(userDataPath);
  const now = new Date().toISOString();
  const themeId = id || `custom-${Date.now()}`;
  const filePath = path.join(dir, `${themeId}.json`);

  let existing = null;
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {}
  }

  const themeData = {
    id: themeId,
    name: name || 'Custom Theme',
    baseThemeId: baseThemeId || 'midnight-dark',
    group: group || 'custom',
    tokens: tokens || {},
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };

  fs.writeFileSync(filePath, JSON.stringify(themeData, null, 2), 'utf8');
  return { ok: true, themeId, themeData };
}

function deleteCustomTheme(userDataPath, themeId) {
  const dir = getCustomThemesDir(userDataPath);
  const filePath = path.join(dir, `${themeId}.json`);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return { ok: true, deletedId: themeId };
    } catch (err) {
      return { ok: false, code: 'EDELETE_FAILED', message: err.message };
    }
  }
  return { ok: false, code: 'ENOENT', message: 'Theme file not found' };
}

function getCustomThemeCss(userDataPath, themeId) {
  const themeData = getCustomTheme(userDataPath, themeId);
  if (!themeData || !themeData.tokens) {
    return null;
  }
  return generateCssFromTokens(themeData.tokens);
}

module.exports = {
  getCustomThemesDir,
  listCustomThemes,
  getCustomTheme,
  saveCustomTheme,
  deleteCustomTheme,
  getCustomThemeCss
};
