const { app, BrowserWindow, ipcMain, shell, session, systemPreferences, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const ai = require('./ai.cjs');

const EXTERNAL_ROOT = '/Volumes/Extreme';
const EXTERNAL_DIR = path.join(EXTERNAL_ROOT, 'AntigravityStudio');
const DEV_URL = process.env.ELECTRON_START_URL; // set by `npm run electron:dev`

/** Only these keys may be read/written; prevents path traversal from the renderer. */
const KEY_PATTERN = /^antigravity_cm_[a-z0-9_]+(\.bak)?$/i;

function localDir() {
  return path.join(app.getPath('userData'), 'data');
}

/** Prefer the external SSD when mounted and writable; otherwise fall back to local disk. */
function resolveStorageDir() {
  try {
    if (fs.existsSync(EXTERNAL_ROOT)) {
      fs.mkdirSync(EXTERNAL_DIR, { recursive: true });
      fs.accessSync(EXTERNAL_DIR, fs.constants.W_OK);
      return { dir: EXTERNAL_DIR, external: true };
    }
  } catch {
    // unmounted, read-only or permission denied: fall through to local
  }
  const dir = localDir();
  fs.mkdirSync(dir, { recursive: true });
  return { dir, external: false };
}

function fileFor(dir, key) {
  if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
  return path.join(dir, `${key}.json`);
}

function writeAtomic(file, contents) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, file);
}

function registerStorageIpc() {
  ipcMain.handle('storage:info', () => {
    const { dir, external } = resolveStorageDir();
    return { directory: dir, externalDrive: external ? 'active' : fs.existsSync(EXTERNAL_ROOT) ? 'error' : 'not-mounted' };
  });

  // Returns every persisted key so the renderer can hydrate before first render.
  // If the external drive has no copy yet, local data is used (and migrated on next write).
  ipcMain.handle('storage:readAll', () => {
    const { dir } = resolveStorageDir();
    const sources = dir === localDir() ? [dir] : [dir, localDir()];
    const result = {};
    for (const source of sources.reverse()) {
      if (!fs.existsSync(source)) continue;
      for (const name of fs.readdirSync(source)) {
        if (!name.endsWith('.json')) continue;
        const key = name.slice(0, -5);
        if (!KEY_PATTERN.test(key)) continue;
        try {
          result[key] = fs.readFileSync(path.join(source, name), 'utf8');
        } catch {
          // skip unreadable file
        }
      }
    }
    return result;
  });

  ipcMain.handle('storage:write', (_event, key, value) => {
    if (typeof value !== 'string') throw new Error('Value must be a string');
    const { dir } = resolveStorageDir();
    writeAtomic(fileFor(dir, key), value);
    return true;
  });
}

/** Returns {ok, data} or {ok:false, error} so the page gets a clean message, not an IPC stack. */
function safe(fn) {
  return async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  };
}

function registerAiIpc() {
  ipcMain.handle(
    'ai:status',
    safe(async () => ({ hasKey: ai.hasKey(), model: ai.MODEL, local: await ai.localStatus() }))
  );
  ipcMain.handle('ai:setKey', safe((key) => ai.writeKey(key)));
  ipcMain.handle('ai:clearKey', safe(() => ai.clearKey()));
  ipcMain.handle('ai:transcribe', safe((base64, mimeType) => ai.transcribe({ base64, mimeType })));
  ipcMain.handle('ai:mix', safe((payload) => ai.mix(payload)));

  // Streams model-download progress back to the window that asked
  ipcMain.handle('ai:pullLocal', async (event) => {
    try {
      await ai.pullLocalModel((p) => {
        if (!event.sender.isDestroyed()) event.sender.send('ai:pullProgress', p);
      });
      return { ok: true, data: undefined };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  // Only these pages may be opened in the user's browser (the sign-up / key / install pages)
  const OPENABLE = new Set(['https://aistudio.google.com/apikey', 'https://ollama.com/download']);
  ipcMain.handle(
    'ai:openExternal',
    safe(async (url) => {
      if (!OPENABLE.has(url)) throw new Error('That page is not allowed.');
      await shell.openExternal(url);
    })
  );

  // Lets "Connect Gemini" notice a key the user just copied from the Google page.
  // Returns the clipboard text only if it is shaped like a Gemini API key.
  ipcMain.handle(
    'ai:clipboardKey',
    safe(() => {
      const text = clipboard.readText().trim();
      return /^AIza[0-9A-Za-z_-]{35}$/.test(text) ? text : null;
    })
  );
  // macOS asks for microphone access per app; request it before the page starts recording
  ipcMain.handle(
    'ai:micAccess',
    safe(async () => (process.platform === 'darwin' ? systemPreferences.askForMediaAccess('microphone') : true))
  );

  // Only our own pages may use the microphone
  const ownOrigin = (url) => (DEV_URL ? String(url).startsWith(DEV_URL) : String(url).startsWith('file://'));
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(permission === 'media' && ownOrigin(details.requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    return permission === 'media' && ownOrigin(requestingOrigin);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links in the default browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  // Surface renderer problems in the terminal so a blank window can be diagnosed
  // without opening DevTools.
  const wc = win.webContents;
  wc.on('console-message', (...args) => {
    // Newer Electron passes one details object; older versions pass positional args.
    const d = args[0] && typeof args[0].message === 'string' ? args[0] : null;
    const level = d ? d.level : args[1];
    const message = d ? d.message : args[2];
    const source = d ? `${d.sourceId}:${d.lineNumber}` : `${args[4]}:${args[3]}`;
    if (level === 'error' || level === 'warning' || level === 2 || level === 3) {
      console.error(`[renderer ${level}] ${message} (${source})`);
    }
  });
  // Reliable load path: if the page fails to load (dev server still starting, restarted,
  // or a transient network blip), retry instead of leaving a blank window.
  let loadRetries = 0;
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    console.error(`[renderer] failed to load ${url}: ${desc} (${code})`);
    if (!isMainFrame || code === -3 /* aborted by a newer navigation */) return;
    if (loadRetries++ < 30) {
      setTimeout(() => {
        if (!win.isDestroyed()) reloadMain();
      }, 700);
    }
  });
  wc.on('render-process-gone', (_e, details) => {
    console.error(`[renderer] process gone: ${details.reason}`);
    if (details.reason !== 'clean-exit' && !win.isDestroyed()) setTimeout(reloadMain, 500);
  });
  wc.on('unresponsive', () => console.error('[renderer] window became unresponsive'));
  wc.on('did-finish-load', () => {
    loadRetries = 0;
    // Pinch-zooming the whole page would fight the canvas's own zoom; keep it at 100%.
    wc.setZoomLevel(0);
    wc.setVisualZoomLevelLimits(1, 1);
    console.log('[renderer] page loaded');
  });

  function reloadMain() {
    if (DEV_URL) win.loadURL(DEV_URL);
    else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  reloadMain();
}

// Disable Graphite to avoid GPU process crashes on older Intel Iris Plus hardware
app.commandLine.appendSwitch('disable-features', 'Graphite');

app.whenReady().then(() => {
  registerStorageIpc();
  registerAiIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
