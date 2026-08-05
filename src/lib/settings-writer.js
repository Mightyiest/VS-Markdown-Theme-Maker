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
 * Read and parse markdown.styles from settings.json.
 */
function readStyles(settingsPath) {
  if (!fs.existsSync(settingsPath)) {
    return { exists: false, styles: [] };
  }

  try {
    const raw = stripBOM(fs.readFileSync(settingsPath, 'utf8'));
    const errors = [];
    const data = parse(raw, errors, { allowTrailingComma: true });

    if (errors.length > 0) {
      return {
        exists: true,
        malformed: true,
        styles: [],
        errorDetail: `JSON parse error offset ${errors[0].offset}`
      };
    }

    if (!data || typeof data !== 'object') {
      return { exists: true, styles: [] };
    }

    const rawStyles = data['markdown.styles'];
    let styles = [];
    if (Array.isArray(rawStyles)) {
      styles = rawStyles.filter(s => typeof s === 'string');
    } else if (typeof rawStyles === 'string') {
      styles = [rawStyles];
    }

    return { exists: true, styles, rawData: data, rawText: raw };
  } catch (err) {
    return { exists: true, malformed: true, styles: [], errorDetail: err.message };
  }
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
 * Write updated markdown.styles into settings.json using jsonc-parser.
 */
function writeStyles(settingsPath, nextStyles) {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let raw = '{}';
  if (fs.existsSync(settingsPath)) {
    const readResult = readStyles(settingsPath);
    if (readResult.malformed) {
      return { ok: false, code: 'EMALFORMED', message: `Cannot modify malformed settings.json: ${readResult.errorDetail}` };
    }
    backupSettings(settingsPath);
    raw = readResult.rawText || '{}';
  }

  const formattingOptions = detectIndent(raw);
  
  // If nextStyles is empty/undefined, remove the property, else update it
  const valueToSet = (Array.isArray(nextStyles) && nextStyles.length > 0) ? nextStyles : undefined;
  
  const edits = modify(raw, ['markdown.styles'], valueToSet, { formattingOptions });
  const updatedContent = applyEdits(raw, edits);

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

module.exports = {
  stripBOM,
  detectIndent,
  extractThemeIdFromPath,
  readStyles,
  computeNextStyles,
  backupSettings,
  writeStyles
};
