const fs = require('fs');
const path = require('path');
const { THEMES, BUILTIN_THEME_IDS, isCustomThemeId, isKnownThemeId } = require('./theme-registry');
const { readStyles, computeNextStyles, writeStyles, extractThemeIdFromPath } = require('./settings-writer');
const { getCustomThemeCss } = require('./custom-themes');
const { generateCssFromTokens } = require('./theme-tokens');
const { recordProjectInstallation } = require('./project-registry');

/**
 * Validate path safety.
 */
function validateProjectPath(projectPath) {
  if (typeof projectPath !== 'string' || !projectPath.trim()) {
    return { ok: false, code: 'EINVALID_PATH', message: 'Project path is required.' };
  }

  const resolved = path.resolve(projectPath);

  if (!path.isAbsolute(resolved)) {
    return { ok: false, code: 'EINVALID_PATH', message: 'Project path must be absolute.' };
  }

  if (!fs.existsSync(resolved)) {
    return { ok: false, code: 'ENOENT', message: `Folder does not exist: ${resolved}` };
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return { ok: false, code: 'EINVALID_PATH', message: 'Target path is not a directory.' };
    }
  } catch (err) {
    return { ok: false, code: 'EACCES', message: `Cannot access folder: ${err.message}` };
  }

  // Prevent system root paths
  const root = path.parse(resolved).root;
  if (resolved.toLowerCase() === root.toLowerCase()) {
    return { ok: false, code: 'EINVALID_PATH', message: 'System root folder is not allowed.' };
  }

  // Check write access by probing .vscode directory
  const vscodeDir = path.join(resolved, '.vscode');
  try {
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    const testFile = path.join(vscodeDir, `.write-probe-${Date.now()}`);
    fs.writeFileSync(testFile, 'probe', 'utf8');
    fs.unlinkSync(testFile);
  } catch (err) {
    return { ok: false, code: 'EACCES', message: `Folder is read-only or permission denied: ${err.message}` };
  }

  return { ok: true, resolvedPath: resolved };
}

/**
 * Remove stale theme CSS files from .vscode directory.
 * Keeps the file matching keepThemeId if provided.
 */
function cleanStaleThemeCss(vscodeDir, keepThemeId = null) {
  if (!fs.existsSync(vscodeDir)) return;
  try {
    const files = fs.readdirSync(vscodeDir);
    for (const file of files) {
      if (!file.endsWith('.css')) continue;
      if (keepThemeId && file === `${keepThemeId}.css`) continue;
      const id = file.slice(0, -4);
      if (BUILTIN_THEME_IDS.has(id) || id.startsWith('custom-')) {
        try { fs.unlinkSync(path.join(vscodeDir, file)); } catch (_) {}
      }
    }
  } catch (_) {}
}

/**
 * Install a theme into project's .vscode folder.
 */
function installTheme({ projectPath, themeId, appThemesDir, userDataPath = null, tokens = null }) {
  const pathCheck = validateProjectPath(projectPath);
  if (!pathCheck.ok) return pathCheck;
  const targetDir = pathCheck.resolvedPath;

  if (!isKnownThemeId(themeId, userDataPath)) {
    return { ok: false, code: 'EINVALID_THEME', message: `Unknown theme ID: ${themeId}` };
  }

  let cssContent = null;

  if (isCustomThemeId(themeId)) {
    if (userDataPath) {
      cssContent = getCustomThemeCss(userDataPath, themeId);
    }
    if (!cssContent && tokens) {
      cssContent = generateCssFromTokens(tokens);
    }
    if (!cssContent) {
      return { ok: false, code: 'ENOENT', message: `Custom theme CSS could not be generated: ${themeId}` };
    }
  } else {
    const srcCssPath = path.join(appThemesDir, `${themeId}.css`);
    if (!fs.existsSync(srcCssPath)) {
      return { ok: false, code: 'ENOENT', message: `Theme source file missing: ${srcCssPath}` };
    }
    cssContent = fs.readFileSync(srcCssPath, 'utf8');
  }

  const vscodeDir = path.join(targetDir, '.vscode');
  const destCssPath = path.join(vscodeDir, `${themeId}.css`);

  // Write new CSS file
  try {
    fs.writeFileSync(destCssPath, cssContent, 'utf8');
  } catch (err) {
    return { ok: false, code: 'EWRITE_FAILED', message: `Failed to write CSS file: ${err.message}` };
  }

  cleanStaleThemeCss(vscodeDir, themeId);

  // Update settings.json
  const settingsPath = path.join(vscodeDir, 'settings.json');
  const readRes = readStyles(settingsPath);
  if (readRes.malformed) {
    return { ok: false, code: 'EMALFORMED', message: `settings.json is malformed: ${readRes.errorDetail}` };
  }

  const { nextStyles, preservedUserCount } = computeNextStyles(readRes.styles, themeId);
  const writeRes = writeStyles(settingsPath, nextStyles);

  if (!writeRes.ok) return writeRes;

  if (userDataPath) {
    const builtinTheme = THEMES.find(t => t.id === themeId);
    const themeName = builtinTheme ? builtinTheme.name : themeId;
    recordProjectInstallation(userDataPath, targetDir, {
      themeId,
      themeName,
      tokens
    });
  }

  return {
    ok: true,
    themeId,
    cssPath: destCssPath,
    preservedUserCount
  };
}

/**
 * Detect installed theme in project folder.
 */
function detectTheme({ projectPath }) {
  const pathCheck = validateProjectPath(projectPath);
  if (!pathCheck.ok) return pathCheck;
  const targetDir = pathCheck.resolvedPath;

  const settingsPath = path.join(targetDir, '.vscode', 'settings.json');
  const readRes = readStyles(settingsPath);

  if (!readRes.exists) {
    return { ok: true, themeId: null, cssMissing: false };
  }

  if (readRes.malformed) {
    return { ok: false, code: 'EMALFORMED', message: `settings.json is malformed: ${readRes.errorDetail}` };
  }

  let installedThemeId = null;
  let cssPath = null;

  for (const styleEntry of readRes.styles) {
    const tid = extractThemeIdFromPath(styleEntry);
    if (tid) {
      installedThemeId = tid;
      cssPath = path.join(targetDir, '.vscode', `${tid}.css`);
      break;
    }
  }

  if (!installedThemeId) {
    return { ok: true, themeId: null, cssMissing: false };
  }

  const cssMissing = !fs.existsSync(cssPath);

  return {
    ok: true,
    themeId: installedThemeId,
    cssMissing,
    cssPath
  };
}

/**
 * Uninstall theme from project folder.
 */
function uninstallTheme({ projectPath }) {
  const pathCheck = validateProjectPath(projectPath);
  if (!pathCheck.ok) return pathCheck;
  const targetDir = pathCheck.resolvedPath;

  const vscodeDir = path.join(targetDir, '.vscode');
  const settingsPath = path.join(vscodeDir, 'settings.json');
  const readRes = readStyles(settingsPath);

  let removedThemeId = null;

  if (readRes.exists && !readRes.malformed) {
    for (const styleEntry of readRes.styles) {
      const tid = extractThemeIdFromPath(styleEntry);
      if (tid) {
        removedThemeId = tid;
        break;
      }
    }

    const { nextStyles } = computeNextStyles(readRes.styles, null);
    const writeRes = writeStyles(settingsPath, nextStyles);
    if (!writeRes.ok) return writeRes;
  }

  cleanStaleThemeCss(vscodeDir);

  return { ok: true, removedThemeId };
}

module.exports = {
  validateProjectPath,
  installTheme,
  detectTheme,
  uninstallTheme
};
