const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer (React app)
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',

  // Listen for auto-update events
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
});
