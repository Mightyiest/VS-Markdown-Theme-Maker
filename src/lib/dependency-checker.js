const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const REQUIRED_DEPENDENCIES = [
  {
    id: 'bierner.markdown-mermaid',
    name: 'Mermaid Diagram Engine',
    category: 'Diagrams',
    description: 'Renders flowcharts, sequence diagrams, git graphs, and architecture charts in native Markdown preview.'
  },
  {
    id: 'goessner.mdmath',
    name: 'KaTeX Math Engine',
    category: 'Math & Equations',
    description: 'Fast, high-quality LaTeX math formula rendering for inline ($...$) and block ($$...$$) equations.'
  },
  {
    id: 'yzhang.markdown-all-in-one',
    name: 'Markdown All in One',
    category: 'Formatting & Tasks',
    description: 'Enables GFM task list checkboxes (- [x]), table formatting, and editor shortcuts.'
  }
];

/**
 * Scan local extension directories as fallback if `code` CLI is not available.
 */
function scanLocalExtensionDirectories() {
  const dirs = [
    path.join(os.homedir(), '.vscode', 'extensions'),
    path.join(os.homedir(), '.antigravity', 'extensions'),
    path.join(os.homedir(), '.cursor', 'extensions')
  ];

  const foundIds = new Set();

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        // Directory names in extensions directory usually look like: `publisher.extension-name-1.2.3`
        const match = entry.name.match(/^([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)(?:-\d.*)?$/);
        if (match) {
          foundIds.add(match[1].toLowerCase());
        }
      }
    } catch (_) {}
  }

  return foundIds;
}

/**
 * Get set of installed extension IDs (lowercase) using CLI with filesystem fallback.
 */
function getInstalledExtensionIds() {
  return new Promise((resolve) => {
    const installed = new Set();
    const clis = ['antigravity-ide', 'antigravity', 'cursor', 'code'];
    let pending = clis.length;

    const onDone = () => {
      pending--;
      if (pending === 0) {
        const fallback = scanLocalExtensionDirectories();
        for (const id of fallback) {
          installed.add(id);
        }
        resolve(installed);
      }
    };

    for (const cli of clis) {
      exec(`${cli} --list-extensions`, { timeout: 4000 }, (error, stdout) => {
        if (!error && stdout) {
          const lines = stdout.split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(Boolean);
          for (const line of lines) {
            if (!line.startsWith('[')) {
              installed.add(line);
            }
          }
        }
        onDone();
      });
    }
  });
}

/**
 * Evaluate status for all required dependencies against installed extensions.
 */
async function getDependenciesStatus(installedSetOverride = null) {
  const installedSet = installedSetOverride || (await getInstalledExtensionIds());

  const items = REQUIRED_DEPENDENCIES.map(dep => ({
    ...dep,
    installed: installedSet.has(dep.id.toLowerCase())
  }));

  const installedCount = items.filter(i => i.installed).length;
  const totalCount = items.length;
  const allInstalled = installedCount === totalCount;

  return {
    ok: true,
    items,
    installedCount,
    totalCount,
    allInstalled
  };
}

module.exports = {
  REQUIRED_DEPENDENCIES,
  scanLocalExtensionDirectories,
  getInstalledExtensionIds,
  getDependenciesStatus
};
