const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectPdfs: () => ipcRenderer.invoke('select-pdfs'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  readPdf: (filePath) => ipcRenderer.invoke('read-pdf', filePath),
  saveImage: (payload) => ipcRenderer.invoke('save-image', payload),
  openFolder: (folder) => ipcRenderer.invoke('open-folder', folder),
  resolveDroppedPaths: (paths) => ipcRenderer.invoke('resolve-dropped-paths', paths),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),

  // Busy state (blocks window close during extraction)
  setBusy: (busy) => ipcRenderer.invoke('set-busy', busy),

  // Auto-update API
  appVersion: () => ipcRenderer.invoke('app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdateNow: () => ipcRenderer.invoke('install-update-now'),
  onUpdaterEvent: (handler) => {
    const listener = (_evt, msg) => handler(msg);
    ipcRenderer.on('updater-event', listener);
    return () => ipcRenderer.removeListener('updater-event', listener);
  }
});
