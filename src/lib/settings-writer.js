const fs = require('fs');
const path = require('path');
const { parse, modify, applyEdits } = require('jsonc-parser');
const { THEME_IDS } = require('./theme-registry');

/**
 * Strip UTF-8 Byte Order Mark (BOM) if present.
 */
function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

/**
 * Detect file indentation (2 spaces, 4 spaces, or tab).
 */
function detectIndent(content) {
  const match = content.match(/^[\t ]+(?=\S)/m);
  if (!match) return { insertSpaces: true, tabSize: 2 };
  const indentStr = match[0];
  if (indentStr.includes('\t')) {
    return { insertSpaces: false, tabSize: 4 };
  }
  return { insertSpaces: true, tabSize: indentStr.length };
}

/**
 * Extract filename without .css extension, normalized.
 */
function extractThemeIdFromPath(stylePath) {
  if (typeof stylePath !== 'string') return null;
  const normalized = stylePath.replace(/\\/g, '/');
  const filename = path.basename(normalized);
  if (filename.endsWith('.css')) {
    const id = filename.slice(0, -4);
    if (THEME_IDS.has(id) || id.startsWith('custom-')) {
      return id;
    }
  }
  return null;
}

/**
 * Read and parse settings.json into a plain object.
 *
 * Shared by every key-specific reader so that BOM handling, jsonc tolerance and
 * malformed-file reporting stay in exactly one place.
 */
function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) {
    return { exists: false, data: null };
  }

  try {
    const raw = stripBOM(fs.readFileSync(settingsPath, 'utf8'));
    const errors = [];
    const data = parse(raw, errors, { allowTrailingComma: true });

    if (errors.length > 0) {
      return {
        exists: true,
        malformed: true,
        data: null,
        errorDetail: `JSON parse error offset ${errors[0].offset}`
      };
    }

    if (!data || typeof data !== 'object') {
      return { exists: true, data: {}, rawText: raw };
    }

    return { exists: true, data, rawText: raw };
  } catch (err) {
    return { exists: true, malformed: true, data: null, errorDetail: err.message };
  }
}

/**
 * Read a single settings key. Returns `value: undefined` when absent.
 */
function readSettingValue(settingsPath, key) {
  const res = readSettings(settingsPath);
  if (!res.exists || res.malformed) {
    return { exists: res.exists, malformed: res.malformed, errorDetail: res.errorDetail, value: undefined };
  }
  return { exists: true, value: res.data[key], rawText: res.rawText };
}

/**
 * Read and parse markdown.styles from settings.json.
 */
function readStyles(settingsPath) {
  const res = readSettings(settingsPath);

  if (!res.exists) {
    return { exists: false, styles: [] };
  }

  if (res.malformed) {
    return { exists: true, malformed: true, styles: [], errorDetail: res.errorDetail };
  }

  const rawStyles = res.data['markdown.styles'];
  let styles = [];
  if (Array.isArray(rawStyles)) {
    styles = rawStyles.filter(s => typeof s === 'string');
  } else if (typeof rawStyles === 'string') {
    styles = [rawStyles];
  }

  return { exists: true, styles, rawData: res.data, rawText: res.rawText };
}

/**
 * Merge current markdown.styles with new theme ID.
 */
function computeNextStyles(currentStyles, newThemeId) {
  const preserved = [];

  for (const entry of currentStyles) {
    const matchedId = extractThemeIdFromPath(entry);
    if (!matchedId) {
      preserved.push(entry);
    }
  }

  if (newThemeId) {
    preserved.push(`./.vscode/${newThemeId}.css`);
  }

  return {
    nextStyles: preserved,
    preservedUserCount: currentStyles.length - (currentStyles.filter(e => extractThemeIdFromPath(e)).length)
  };
}

/**
 * Create a rolling backup settings.json.bak-N (max 3 backups).
 */
function backupSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return null;

  const dir = path.dirname(settingsPath);
  const base = path.basename(settingsPath);

  // Shift existing backups 2 -> 3, 1 -> 2
  if (fs.existsSync(path.join(dir, `${base}.bak-2`))) {
    fs.copyFileSync(path.join(dir, `${base}.bak-2`), path.join(dir, `${base}.bak-3`));
  }
  if (fs.existsSync(path.join(dir, `${base}.bak-1`))) {
    fs.copyFileSync(path.join(dir, `${base}.bak-1`), path.join(dir, `${base}.bak-2`));
  }

  const backupPath = path.join(dir, `${base}.bak-1`);
  fs.copyFileSync(settingsPath, backupPath);
  return backupPath;
}

/**
 * Apply a batch of key updates to settings.json using jsonc-parser, preserving
 * comments and formatting.
 *
 * `updates` is an array of `{ key, value }`. A value of `undefined` removes the
 * key. Batching matters: each call takes one rolling backup and performs one
 * atomic write, so writing three keys does not burn through all three .bak slots.
 */
function writeSettingValues(settingsPath, updates) {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let raw = '{}';
  if (fs.existsSync(settingsPath)) {
    const readResult = readSettings(settingsPath);
    if (readResult.malformed) {
      return { ok: false, code: 'EMALFORMED', message: `Cannot modify malformed settings.json: ${readResult.errorDetail}` };
    }
    backupSettings(settingsPath);
    raw = readResult.rawText || '{}';
  }

  const formattingOptions = detectIndent(raw);

  let updatedContent = raw;
  for (const { key, value } of updates) {
    const edits = modify(updatedContent, [key], value, { formattingOptions });
    updatedContent = applyEdits(updatedContent, edits);
  }

  // Validate that updated content parses correctly
  const parseErrors = [];
  parse(updatedContent, parseErrors, { allowTrailingComma: true });
  if (parseErrors.length > 0) {
    return { ok: false, code: 'EMALFORMED', message: 'Failed sanity check after edit formatting' };
  }

  // Atomic write
  const tmpPath = `${settingsPath}.tmp-${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, updatedContent, 'utf8');
    fs.renameSync(tmpPath, settingsPath);
    return { ok: true };
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
    return { ok: false, code: 'EWRITE_FAILED', message: err.message };
  }
}

/**
 * Write a single settings key. Pass `undefined` to remove it.
 */
function writeSettingValue(settingsPath, key, value) {
  return writeSettingValues(settingsPath, [{ key, value }]);
}

/**
 * Write updated markdown.styles into settings.json.
 */
function writeStyles(settingsPath, nextStyles) {
  // Empty/undefined removes the property rather than writing an empty array.
  const valueToSet = (Array.isArray(nextStyles) && nextStyles.length > 0) ? nextStyles : undefined;
  return writeSettingValue(settingsPath, 'markdown.styles', valueToSet);
}

const RECOMMENDED_MARKDOWN_EXTENSIONS = [
  'bierner.markdown-mermaid',
  'goessner.mdmath',
  'yzhang.markdown-all-in-one'
];

/**
 * Read recommendations array from extensions.json.
 */
function readRecommendations(extensionsPath) {
  const res = readSettings(extensionsPath);
  if (!res.exists) {
    return { exists: false, recommendations: [] };
  }
  if (res.malformed) {
    return { exists: true, malformed: true, recommendations: [], errorDetail: res.errorDetail };
  }

  const raw = res.data['recommendations'];
  let recommendations = [];
  if (Array.isArray(raw)) {
    recommendations = raw.filter(r => typeof r === 'string');
  }
  return { exists: true, recommendations, rawData: res.data, rawText: res.rawText };
}

/**
 * Merge or remove recommendations while preserving user entries and order.
 */
function computeNextRecommendations(currentList, toAdd = [], toRemove = []) {
  const removeSet = new Set(toRemove);
  const preserved = (currentList || []).filter(item => !removeSet.has(item));

  for (const item of toAdd) {
    if (!preserved.includes(item)) {
      preserved.push(item);
    }
  }

  return preserved;
}

/**
 * Write updated recommendations into extensions.json.
 */
function writeRecommendations(extensionsPath, recommendations) {
  const valueToSet = (Array.isArray(recommendations) && recommendations.length > 0) ? recommendations : undefined;
  return writeSettingValue(extensionsPath, 'recommendations', valueToSet);
}

module.exports = {
  RECOMMENDED_MARKDOWN_EXTENSIONS,
  stripBOM,
  detectIndent,
  extractThemeIdFromPath,
  readSettings,
  readSettingValue,
  readStyles,
  computeNextStyles,
  readRecommendations,
  computeNextRecommendations,
  writeRecommendations,
  backupSettings,
  writeSettingValues,
  writeSettingValue,
  writeStyles
};

