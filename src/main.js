const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable disk cache file locking on Windows to prevent singleton lock and access denial errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

const { isKnownThemeId, isCustomThemeId } = require('./lib/theme-registry');
const { installTheme, detectTheme, uninstallTheme } = require('./lib/theme-installer');
const { extractTokensFromCss, generateCssFromTokens, DEFAULT_TOKENS } = require('./lib/theme-tokens');
const { listCustomThemes, getCustomTheme, saveCustomTheme, deleteCustomTheme, getCustomThemeCss } = require('./lib/custom-themes');
const { getProjectInstallationRecord, listInstalledProjects, removeProjectRecord } = require('./lib/project-registry');
const { renderMarkdownToHtml, getKatexCss, getMermaidJs } = require('./lib/markdown-engine');
const { getDependenciesStatus } = require('./lib/dependency-checker');

let mainWindow = null;
const APP_THEMES_DIR = path.join(__dirname, 'renderer', 'themes');

function setupApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Create Custom Theme',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu:create-custom-theme');
          }
        },
        {
          label: 'Open Workspace Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu:open-folder');
          }
        },
        { type: 'separator' },
        {
          label: 'About VS MD Theme Maker',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu:open-about');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          role: process.platform === 'darwin' ? 'close' : 'quit'
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'VS MD Theme Maker',
    frame: false,
    backgroundColor: '#0b0f19',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.setName('VS MD Theme Maker');

// Single instance lock (graceful fallback)
let gotTheLock = true;
try {
  gotTheLock = app.requestSingleInstanceLock();
} catch (_) {
  gotTheLock = true;
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  setupApplicationMenu();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  const getUserDataPath = () => app.getPath('userData');

  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });
  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return { ok: false, canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select VS Code / Antigravity Project Folder',
      properties: ['openDirectory']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { ok: true, canceled: true, path: null };
    }

    return { ok: true, canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle('theme:getCss', async (_, { themeId }) => {
    const userDataPath = getUserDataPath();

    if (isCustomThemeId(themeId)) {
      const css = getCustomThemeCss(userDataPath, themeId);
      if (!css) {
        return { ok: false, code: 'ENOENT', message: `Custom theme missing: ${themeId}` };
      }
      return { ok: true, css };
    }

    if (!isKnownThemeId(themeId, userDataPath)) {
      return { ok: false, code: 'EINVALID_THEME', message: `Unknown theme ID: ${themeId}` };
    }

    const cssPath = path.join(APP_THEMES_DIR, `${themeId}.css`);
    try {
      if (!fs.existsSync(cssPath)) {
        return { ok: false, code: 'ENOENT', message: `CSS file missing: ${themeId}` };
      }
      const css = fs.readFileSync(cssPath, 'utf8');
      return { ok: true, css };
    } catch (err) {
      return { ok: false, code: 'EREAD_FAILED', message: err.message };
    }
  });

  ipcMain.handle('theme:getTokens', async (_, { themeId }) => {
    const userDataPath = getUserDataPath();

    if (isCustomThemeId(themeId)) {
      const custom = getCustomTheme(userDataPath, themeId);
      if (custom && custom.tokens) {
        return { ok: true, tokens: custom.tokens, baseThemeId: custom.baseThemeId || 'midnight-dark' };
      }
      return { ok: false, code: 'ENOENT', message: `Custom theme not found: ${themeId}` };
    }

    const cssPath = path.join(APP_THEMES_DIR, `${themeId}.css`);
    if (fs.existsSync(cssPath)) {
      const css = fs.readFileSync(cssPath, 'utf8');
      const tokens = extractTokensFromCss(css);
      return { ok: true, tokens, baseThemeId: themeId };
    }

    return { ok: true, tokens: { ...DEFAULT_TOKENS }, baseThemeId: 'midnight-dark' };
  });

  ipcMain.handle('theme:previewFromTokens', async (_, { tokens }) => {
    if (!tokens || typeof tokens !== 'object') {
      return { ok: false, message: 'Invalid tokens object' };
    }
    const css = generateCssFromTokens(tokens);
    return { ok: true, css };
  });

  ipcMain.handle('custom:save', async (_, { id, name, baseThemeId, group, tokens }) => {
    const userDataPath = getUserDataPath();
    const result = saveCustomTheme(userDataPath, { id, name, baseThemeId, group, tokens });
    return result;
  });

  ipcMain.handle('custom:list', async () => {
    const userDataPath = getUserDataPath();
    const themes = listCustomThemes(userDataPath);
    return { ok: true, themes };
  });

  ipcMain.handle('custom:delete', async (_, { themeId }) => {
    const userDataPath = getUserDataPath();
    return deleteCustomTheme(userDataPath, themeId);
  });

  ipcMain.handle('theme:install', async (_, { projectPath, themeId, tokens }) => {
    return installTheme({
      projectPath,
      themeId,
      appThemesDir: APP_THEMES_DIR,
      userDataPath: getUserDataPath(),
      tokens
    });
  });

  ipcMain.handle('theme:detect', async (_, { projectPath }) => {
    return detectTheme({ projectPath });
  });

  ipcMain.handle('theme:uninstall', async (_, { projectPath }) => {
    return uninstallTheme({ projectPath, userDataPath: getUserDataPath() });
  });

  ipcMain.handle('project:getRecord', async (_, { projectPath }) => {
    const record = getProjectInstallationRecord(getUserDataPath(), projectPath);
    return { ok: true, record };
  });

  ipcMain.handle('project:listInstalled', async () => {
    const projects = listInstalledProjects(getUserDataPath());
    return { ok: true, projects };
  });

  ipcMain.handle('project:removeRecord', async (_, { projectPath }) => {
    return removeProjectRecord(getUserDataPath(), projectPath);
  });

  ipcMain.handle('markdown:render', async (_, { markdown }) => {
    try {
      const html = renderMarkdownToHtml(markdown || '');
      return { ok: true, html };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('markdown:getKatexCss', async () => {
    return { ok: true, css: getKatexCss() };
  });

  ipcMain.handle('markdown:getMermaidJs', async () => {
    return { ok: true, js: getMermaidJs() };
  });

  ipcMain.handle('dependencies:getStatus', async () => {
    return getDependenciesStatus();
  });

  ipcMain.handle('open:external', async (_, { url }) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
      return { ok: true };
    }
    return { ok: false, message: 'Invalid URL' };
  });
}


