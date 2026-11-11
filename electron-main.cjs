const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const http = require("http");

// Memory & sandbox optimization for low-spec systems
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');

const BACKEND_PORT = process.env.PORT || '3000';

let mainWindow = null;
let serverProcess = null;

const getBackendPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend", "server.js");
  }
  return path.join(__dirname, "backend", "server.js");
};

const getBackendCwd = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend");
  }
  return path.join(__dirname, "backend");
};

function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/leads`, (res) => {
      resolve(true);
    });
    req.on("error", () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(port, timeout = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/leads`, (res) => {
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server failed to start on port ${port} within ${timeout}ms`));
        } else {
          setTimeout(check, 300);
        }
      });
      req.end();
    };
    check();
  });
}

function startBackend() {
  const serverPath = getBackendPath();
  const serverCwd = getBackendCwd();

  console.log(`[Electron] Launching backend server from: ${serverPath}`);
  serverProcess = fork(serverPath, [], {
    cwd: serverCwd,
    execArgv: ['--max-old-space-size=512'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: BACKEND_PORT,
      NODE_ENV: 'production'
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  if (serverProcess.stdout) {
    serverProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data}`);
    });
  }

  if (serverProcess.stderr) {
    serverProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data}`);
    });
  }

  serverProcess.on('error', (err) => {
    console.error('[Electron] Backend process error:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.warn(`[Electron] Backend server exited with code ${code}, signal ${signal}`);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'Google Maps Lead Scanner PRO',
    backgroundColor: '#f6f3eb',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Intercept all external links (Google Maps location button, websites, etc.) and open in default Chrome/browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log(`[Electron] Opening external link in Chrome / system browser: ${url}`);
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Intercept any in-page link navigation to external domains
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${BACKEND_PORT}`) && !url.startsWith(`http://localhost:${BACKEND_PORT}`)) {
      event.preventDefault();
      console.log(`[Electron] Intercepted navigation to external link: ${url}`);
      shell.openExternal(url);
    }
  });

  // Automatically retry loading if backend takes a few seconds to start
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log(`[Electron] Connection not ready yet (${errorDescription}), retrying in 1.5s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
      }
    }, 1500);
  });

  // Check if server is already running, or start it
  const alreadyRunning = await isServerRunning(BACKEND_PORT);
  if (!alreadyRunning) {
    startBackend();
  } else {
    console.log(`[Electron] Backend server already running on port ${BACKEND_PORT}. Reusing active instance.`);
  }

  try {
    console.log(`[Electron] Waiting for backend server on port ${BACKEND_PORT}...`);
    await waitForServer(BACKEND_PORT, 30000);
    console.log('[Electron] Backend is live! Loading dashboard...');
    await mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
  } catch (err) {
    console.warn('[Electron] Warning while waiting for server:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {}
  }
});

