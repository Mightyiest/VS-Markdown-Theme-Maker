const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  getThemeCss: (themeId) => ipcRenderer.invoke('theme:getCss', { themeId }),
  getThemeTokens: (themeId) => ipcRenderer.invoke('theme:getTokens', { themeId }),
  previewFromTokens: (tokens) => ipcRenderer.invoke('theme:previewFromTokens', { tokens }),
  saveCustomTheme: (data) => ipcRenderer.invoke('custom:save', data),
  listCustomThemes: () => ipcRenderer.invoke('custom:list'),
  deleteCustomTheme: (themeId) => ipcRenderer.invoke('custom:delete', { themeId }),
  installTheme: (projectPath, themeId, tokens) => ipcRenderer.invoke('theme:install', { projectPath, themeId, tokens }),
  detectTheme: (projectPath) => ipcRenderer.invoke('theme:detect', { projectPath }),
  uninstallTheme: (projectPath) => ipcRenderer.invoke('theme:uninstall', { projectPath }),
  getProjectRecord: (projectPath) => ipcRenderer.invoke('project:getRecord', { projectPath }),
  listInstalledProjects: () => ipcRenderer.invoke('project:listInstalled'),
  removeProjectRecord: (projectPath) => ipcRenderer.invoke('project:removeRecord', { projectPath }),

  // Window control methods
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // Menu action listeners
  onMenuCreateCustomTheme: (callback) => ipcRenderer.on('menu:create-custom-theme', () => callback()),
  onMenuOpenFolder: (callback) => ipcRenderer.on('menu:open-folder', () => callback())
});
