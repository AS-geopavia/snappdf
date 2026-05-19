const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let autoUpdater = null;
let updaterLog = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  updaterLog = require('electron-log');
  updaterLog.transports.file.level = 'info';
  autoUpdater.logger = updaterLog;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
} catch (e) {
  // Updater not available (e.g. dev mode without deps installed) — non-fatal
  autoUpdater = null;
}

// Performance: disable hardware-acceleration warnings, prevent throttling
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let mainWindow = null;
let isBusy = false;

ipcMain.handle('set-busy', (_evt, busy) => { isBusy = !!busy; });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    show: false,
    backgroundColor: '#fafafa',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    title: 'SnapPDF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    // Trigger update check shortly after launch
    if (autoUpdater) {
      setTimeout(() => {
        try { autoUpdater.checkForUpdates(); } catch { /* ignore */ }
      }, 2500);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  mainWindow.on('close', (e) => {
    if (!isBusy) return;
    e.preventDefault();
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Annulla', 'Esci comunque'],
      defaultId: 0,
      cancelId: 0,
      title: 'Estrazione in corso',
      message: 'Estrazione in corso',
      detail: "L'estrazione delle immagini non è ancora terminata.\nSe esci ora il file corrente andrà perso. Vuoi uscire comunque?"
    }).then(({ response }) => {
      if (response === 1) {
        isBusy = false;
        mainWindow.close();
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Auto-updater wiring ---
function sendUpdaterEvent(event, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-event', { event, payload });
  }
}

function setupAutoUpdater() {
  if (!autoUpdater) return;

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterEvent('checking');
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdaterEvent('available', { version: info && info.version });
  });
  autoUpdater.on('update-not-available', () => {
    sendUpdaterEvent('not-available');
  });
  autoUpdater.on('download-progress', (p) => {
    sendUpdaterEvent('download-progress', {
      percent: p && p.percent,
      transferred: p && p.transferred,
      total: p && p.total
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterEvent('downloaded', { version: info && info.version });
  });
  autoUpdater.on('error', (err) => {
    sendUpdaterEvent('error', { message: err && err.message ? err.message : String(err) });
  });
}

ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater) return { ok: false, reason: 'updater-unavailable' };
  try {
    const r = await autoUpdater.checkForUpdates();
    return { ok: true, version: r && r.updateInfo && r.updateInfo.version };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
});

ipcMain.handle('install-update-now', async () => {
  if (!autoUpdater) return false;
  try {
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('app-version', async () => app.getVersion());

// --- Persistent config ---
const configPath = () => path.join(app.getPath('userData'), 'snappdf-config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch { /* non-fatal */ }
}

// --- Folder scanning for drag-drop of directories ---
function scanFolderForPdfs(folder, maxFiles = 500) {
  const found = [];
  function walk(dir) {
    if (found.length >= maxFiles) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (found.length >= maxFiles) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && /\.pdf$/i.test(e.name)) {
        try {
          found.push({ path: full, name: e.name, size: fs.statSync(full).size });
        } catch { /* ignore unreadable */ }
      }
    }
  }
  walk(folder);
  return found;
}

ipcMain.handle('select-pdfs', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona i file PDF',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled) return [];
  return result.filePaths.map((p) => ({
    path: p,
    name: path.basename(p),
    size: fs.statSync(p).size
  }));
});

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona la cartella di destinazione',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('read-pdf', async (_evt, filePath) => {
  const buffer = fs.readFileSync(filePath);
  return new Uint8Array(buffer).buffer;
});

ipcMain.handle('save-image', async (_evt, { folder, filename, data }) => {
  const fullPath = path.join(folder, filename);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, Buffer.from(data));
  return fullPath;
});

ipcMain.handle('open-folder', async (_evt, folder) => {
  await shell.openPath(folder);
});

ipcMain.handle('resolve-dropped-paths', async (_evt, paths) => {
  const out = [];
  for (const p of paths) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        out.push(...scanFolderForPdfs(p));
      } else if (stat.isFile() && /\.pdf$/i.test(p)) {
        out.push({ path: p, name: path.basename(p), size: stat.size });
      }
    } catch { /* skip */ }
  }
  return out;
});

ipcMain.handle('load-config', async () => readConfig());
ipcMain.handle('save-config', async (_evt, cfg) => { writeConfig(cfg); return true; });
