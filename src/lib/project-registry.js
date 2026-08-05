const fs = require('fs');
const path = require('path');

const REGISTRY_FILENAME = 'project-registry.json';
const LOCAL_BACKUP_FILENAME = '.vs-md-theme-backup.json';

function getRegistryPath(userDataPath) {
  return path.join(userDataPath, REGISTRY_FILENAME);
}

function loadRegistry(userDataPath) {
  const registryPath = getRegistryPath(userDataPath);
  try {
    if (!fs.existsSync(registryPath)) return {};
    const content = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(content) || {};
  } catch (err) {
    return {};
  }
}

function saveRegistry(userDataPath, registry) {
  const registryPath = getRegistryPath(userDataPath);
  try {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

function recordProjectInstallation(userDataPath, projectPath, themeRecord) {
  if (!projectPath || !themeRecord) return { ok: false, message: 'Missing required parameters' };

  const normPath = path.normalize(projectPath);
  const now = new Date().toISOString();
  
  const record = {
    projectPath: normPath,
    themeId: themeRecord.themeId,
    themeName: themeRecord.themeName || themeRecord.themeId,
    baseThemeId: themeRecord.baseThemeId || 'midnight-dark',
    tokens: themeRecord.tokens || null,
    installedAt: now
  };

  // 1. Save to app userData registry
  const registry = loadRegistry(userDataPath);
  registry[normPath] = record;
  saveRegistry(userDataPath, registry);

  // 2. Write local backup in target project's .vscode folder
  try {
    const vscodeDir = path.join(normPath, '.vscode');
    fs.mkdirSync(vscodeDir, { recursive: true });
    const backupPath = path.join(vscodeDir, LOCAL_BACKUP_FILENAME);
    fs.writeFileSync(backupPath, JSON.stringify(record, null, 2), 'utf8');
  } catch (err) {
    // Ignore non-fatal local backup write error (e.g. read-only folder)
  }

  return { ok: true, record };
}

function getProjectInstallationRecord(userDataPath, projectPath) {
  if (!projectPath) return null;
  const normPath = path.normalize(projectPath);

  // Check app userData registry first
  const registry = loadRegistry(userDataPath);
  if (registry[normPath]) {
    return registry[normPath];
  }

  // Fallback to local project backup file (.vscode/.vs-md-theme-backup.json)
  try {
    const backupPath = path.join(normPath, '.vscode', LOCAL_BACKUP_FILENAME);
    if (fs.existsSync(backupPath)) {
      const content = fs.readFileSync(backupPath, 'utf8');
      const backupRecord = JSON.parse(content);
      if (backupRecord && backupRecord.themeId) {
        // Heal app registry
        registry[normPath] = backupRecord;
        saveRegistry(userDataPath, registry);
        return backupRecord;
      }
    }
  } catch (_) {}

  return null;
}

function listInstalledProjects(userDataPath) {
  const registry = loadRegistry(userDataPath);
  return Object.values(registry);
}

function removeProjectRecord(userDataPath, projectPath) {
  if (!projectPath) return { ok: false, message: 'Missing project path' };
  const normPath = path.normalize(projectPath);
  const registry = loadRegistry(userDataPath);
  if (registry[normPath]) {
    delete registry[normPath];
    saveRegistry(userDataPath, registry);
  }
  try {
    const backupPath = path.join(normPath, '.vscode', LOCAL_BACKUP_FILENAME);
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  } catch (_) {}
  return { ok: true };
}

module.exports = {
  recordProjectInstallation,
  getProjectInstallationRecord,
  listInstalledProjects,
  removeProjectRecord
};
