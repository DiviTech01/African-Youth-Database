const { app, BrowserWindow, shell, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// ── Config ───────────────────────────────────────────────
const isDev = !app.isPackaged;
const APP_NAME = 'African Youth Observatory';
const DEV_URL = 'http://localhost:8080';

let mainWindow = null;
let tray = null;

// ── Single Instance Lock ─────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ── Create Window ────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    icon: path.join(__dirname, 'icons', 'icon.png'),
    backgroundColor: '#0A0A0A',
    titleBarStyle: 'hiddenInset', // Clean look on Mac
    trafficLightPosition: { x: 16, y: 16 },
    show: false, // Show when ready to avoid flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // Show window when page is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, load the bundled frontend from extraResources
    const distPath = path.join(process.resourcesPath, 'dist', 'index.html');
    mainWindow.loadFile(distPath);
  }

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appOrigins = [DEV_URL, PROD_URL, 'https://lfvbwpmpuyfujrpwwgol.supabase.co'];
    const isInternal = appOrigins.some((origin) => url.startsWith(origin));
    if (!isInternal) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App Menu ─────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [{
          label: APP_NAME,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+D',
          click: () => mainWindow?.webContents.executeJavaScript("window.location.hash = '#/dashboard'"),
        },
        {
          label: 'Data Explorer',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.executeJavaScript("window.location.hash = '#/data-explorer'"),
        },
        {
          label: 'Youth Index',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow?.webContents.executeJavaScript("window.location.hash = '#/youth-index'"),
        },
        { type: 'separator' },
        {
          label: 'Go Back',
          accelerator: 'Alt+Left',
          click: () => mainWindow?.webContents.goBack(),
        },
        {
          label: 'Go Forward',
          accelerator: 'Alt+Right',
          click: () => mainWindow?.webContents.goForward(),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About African Youth Observatory',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: APP_NAME,
              detail: `Version ${app.getVersion()}\n\nPACSDA — Pan-African Centre for Statistics and Data Analytics\n\nAfrica's youth data intelligence platform.`,
            });
          },
        },
        {
          label: 'Visit Website',
          click: () => shell.openExternal('https://africanyouthobservatory.org'),
        },
        {
          label: 'Contact Support',
          click: () => shell.openExternal('mailto:info@africanyouthdata.org'),
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => autoUpdater.checkForUpdatesAndNotify(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── System Tray ──────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'tray-icon.png');
  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip(APP_NAME);
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch {
    // Tray icon not found — skip (non-critical)
  }
}

// ── Auto-Updater ─────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded. Restart to apply the update?',
        buttons: ['Restart Now', 'Later'],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.checkForUpdatesAndNotify();
}

// ── App Lifecycle ────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();
  createTray();
  setupAutoUpdater();

  app.on('activate', () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Deep Link Protocol (ayd://) ──────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('ayd', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('ayd');
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  // Handle deep links like ayd://dashboard or ayd://signin
  if (mainWindow) {
    const route = url.replace('ayd://', '/');
    if (isDev) {
      mainWindow.loadURL(`${DEV_URL}${route}`);
    } else {
      mainWindow.loadFile(path.join(process.resourcesPath, 'dist', 'index.html'));
    }
    mainWindow.show();
  }
});
