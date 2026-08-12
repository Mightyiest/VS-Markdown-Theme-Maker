#!/usr/bin/env node
/**
 * Append a generated syntax-highlighting block to each shipped theme.
 *
 * The shipped stylesheets are hand-authored and carry color nuance the 12
 * customizer tokens do not capture (forest-dark alone uses four hexes that no
 * token maps to), so they are preserved verbatim rather than regenerated. Only
 * the block between the markers below is owned by this script, which makes
 * re-running it idempotent and keeps hand edits above the marker safe.
 *
 * The block supplies what the hand-authored files were missing entirely:
 * highlight.js classes and the code-block chrome. Without `.hljs-*` rules a
 * theme inherits the host's palette — VS Code's built-in preview injects a
 * hardcoded VS2015 *dark* palette, so light themes rendered dark-theme syntax
 * colors on a near-white background at ~1.3:1 contrast.
 *
 * Usage: node scripts/build-themes.js [--check]
 *   --check  exit non-zero if any file is out of date (for CI), write nothing
 */

const fs = require('fs');
const path = require('path');

const {
  extractTokensFromCss,
  generateSyntaxCss,
  generateCodeChromeCss,
  buildSyntaxPalette,
  contrastRatio,
  AA_CONTRAST
} = require('../src/lib/theme-tokens');

const THEMES_DIR = path.join(__dirname, '..', 'src', 'renderer', 'themes');

const BEGIN = '/* === BEGIN GENERATED: syntax + code chrome — do not edit by hand === */';
const END = '/* === END GENERATED === */';

/** Strip a previously generated block so the script is idempotent. */
function stripGeneratedBlock(css) {
  const start = css.indexOf(BEGIN);
  if (start === -1) return css.trimEnd();
  const end = css.indexOf(END, start);
  if (end === -1) return css.slice(0, start).trimEnd();
  return (css.slice(0, start) + css.slice(end + END.length)).trimEnd();
}

function buildBlock(tokens) {
  return [
    BEGIN,
    '',
    '/* Code block container, header strip, language label and copy button.',
    "   Only this app's preview emits this markup; the selectors are inert in",
    '   VS Code and MPE, which render a bare <pre><code>. */',
    generateCodeChromeCss(tokens),
    '',
    '/* highlight.js palette, contrast-fitted to this theme\'s code background. */',
    generateSyntaxCss(tokens),
    '',
    END,
    ''
  ].join('\n');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const files = fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith('.css')).sort();

  let stale = 0;
  let worst = { ratio: Infinity, theme: null, role: null };

  for (const file of files) {
    const full = path.join(THEMES_DIR, file);
    const current = fs.readFileSync(full, 'utf8');
    const base = stripGeneratedBlock(current);
    const tokens = extractTokensFromCss(base);
    const next = `${base}\n\n${buildBlock(tokens)}`;

    // Verify the emitted palette actually clears AA before writing it.
    const palette = buildSyntaxPalette(tokens.bgCode, tokens.textBody);
    const failures = [];
    for (const [role, color] of Object.entries(palette)) {
      const ratio = contrastRatio(color, tokens.bgCode);
      if (ratio !== null && ratio < worst.ratio) worst = { ratio, theme: file, role };
      if (ratio !== null && ratio < AA_CONTRAST) failures.push(`${role} ${ratio.toFixed(2)}:1`);
    }
    if (failures.length) {
      console.error(`FAIL ${file}: below AA -> ${failures.join(', ')}`);
      process.exitCode = 1;
      continue;
    }

    const changed = next !== current;
    if (changed) stale++;
    if (changed && !checkOnly) fs.writeFileSync(full, next, 'utf8');
    console.log(`${changed ? (checkOnly ? 'STALE' : 'write') : 'ok   '}  ${file}`);
  }

  console.log(
    `\n${files.length} themes | worst contrast ${worst.ratio.toFixed(2)}:1 ` +
    `(${worst.theme} ${worst.role}) | AA target ${AA_CONTRAST}:1`
  );

  if (checkOnly && stale > 0) {
    console.error(`\n${stale} theme(s) out of date. Run: node scripts/build-themes.js`);
    process.exitCode = 1;
  }
}

main();
