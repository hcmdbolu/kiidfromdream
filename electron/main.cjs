const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
app.commandLine.appendSwitch('experimental-sqlite');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const PORT = process.env.PORT || 3000;
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// Ensure data directory in user's AppData to allow persistence across updates
const userDataPath = app.getPath('userData');
const appDataDir = path.join(userDataPath, 'data');
if (!fs.existsSync(appDataDir)) {
  fs.mkdirSync(appDataDir, { recursive: true });
}
process.env.POS_DATA_DIR = appDataDir;

// Copy initial seed data if pos_database.db or pos_database.json does not yet exist in AppData
const userDbPath = path.join(appDataDir, 'pos_database.db');
const userJsonPath = path.join(appDataDir, 'pos_database.json');
if (!fs.existsSync(userDbPath) && !fs.existsSync(userJsonPath)) {
  const defaultDbPath = path.join(__dirname, '..', 'data', 'pos_database.db');
  const defaultJsonPath = path.join(__dirname, '..', 'data', 'pos_database.json');
  if (fs.existsSync(defaultDbPath)) {
    try {
      fs.copyFileSync(defaultDbPath, userDbPath);
    } catch (e) {
      console.warn('Could not copy initial SQLite database:', e.message);
    }
  } else if (fs.existsSync(defaultJsonPath)) {
    try {
      fs.copyFileSync(defaultJsonPath, userJsonPath);
    } catch (e) {
      console.warn('Could not copy initial JSON database:', e.message);
    }
  }
}

/**
 * Checks if the backend server is responding on http://localhost:PORT
 */
function checkServerReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Polls until backend is online or timeout expires
 */
async function waitForServer(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const ready = await checkServerReady(port);
    if (ready) return true;
    await new Promise((res) => setTimeout(res, 500));
  }
  return false;
}

async function startBackendServer() {
  if (isDev) {
    // In dev mode, server is run externally with npm run dev (or tsx server.ts)
    return;
  }

  // In production packaged mode, import the bundled server directly in-process
  const serverScript = path.join(__dirname, '..', 'dist', 'server.js');
  if (fs.existsSync(serverScript)) {
    try {
      const { pathToFileURL } = require('url');
      process.env.NODE_ENV = 'production';
      process.env.PORT = PORT.toString();
      process.env.POS_DATA_DIR = appDataDir;
      
      console.log(`[ELECTRON] Starting embedded POS server from: ${serverScript}`);
      await import(pathToFileURL(serverScript).href);
      console.log(`[ELECTRON] Embedded POS server loaded successfully on port ${PORT}`);
    } catch (err) {
      console.error('[ELECTRON] Error importing embedded server:', err);
      // Fallback: spawn as separate child process
      try {
        serverProcess = spawn(process.execPath, ['--experimental-sqlite', serverScript], {
          env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: PORT.toString(),
            POS_DATA_DIR: appDataDir,
            ELECTRON_RUN_AS_NODE: '1',
          },
          stdio: 'inherit',
        });
      } catch (spawnErr) {
        console.error('[ELECTRON] Fallback spawn failed:', spawnErr);
      }
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'KIID FROM DREAM - POS & Inventory System',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.maximize();

  const appUrl = `http://127.0.0.1:${PORT}`;

  waitForServer(PORT).then((ready) => {
    if (ready) {
      mainWindow.loadURL(appUrl);
    } else {
      // Fallback: try loading or load packaged dist/index.html
      const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
      if (fs.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      } else {
        mainWindow.loadURL(appUrl);
      }
    }
  });

  // Open external links in default browser
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

// IPC Handlers for Native Desktop Capabilities
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-data-dir', () => appDataDir);

ipcMain.handle('open-data-folder', async () => {
  await shell.openPath(appDataDir);
  return true;
});

ipcMain.handle('print-receipt', (event, options = {}) => {
  if (!mainWindow) return false;
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent ?? false,
        printBackground: true,
        deviceName: options.deviceName || '',
        ...options,
      },
      (success, failureReason) => {
        if (!success) {
          console.warn('Print failed:', failureReason);
        }
        resolve(success);
      }
    );
  });
});

ipcMain.handle('toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const isFullScreen = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFullScreen);
  return !isFullScreen;
});

// App lifecycle
app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
