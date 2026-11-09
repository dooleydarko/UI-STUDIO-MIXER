// One-command desktop dev loop: starts Vite (hot module reload), waits for it,
// then opens Electron pointed at it. Edits to src/ update the window in place.
// Edits to electron/main.cjs or preload.cjs restart the Electron window automatically.
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');
const PORT = 5173;
const URL = `http://localhost:${PORT}`;
const bin = (name) => path.join(root, 'node_modules', '.bin', name);

const children = new Set();
let electron = null;
let shuttingDown = false;

function run(cmd, args, env = {}) {
  const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
}

// Wait until Vite is serving the app entry module successfully, not just listening.
// Opening the window earlier can race the first transform and show a blank page.
function waitForServer(retries = 240) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      http
        .get(`${URL}/src/main.tsx`, (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve();
          if (left <= 0) return reject(new Error(`Vite returned ${res.statusCode} for the app entry`));
          setTimeout(() => attempt(left - 1), 500);
        })
        .on('error', () => {
          if (left <= 0) return reject(new Error('Vite dev server did not start'));
          setTimeout(() => attempt(left - 1), 500);
        });
    };
    attempt(retries);
  });
}

function startElectron() {
  electron = run(bin('electron'), ['.'], { ELECTRON_START_URL: URL });
  electron.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (electron && electron.restarting) return;
    shutdown(code ?? 0); // user closed the window: stop everything
  });
}

function restartElectron() {
  if (!electron || shuttingDown) return;
  electron.restarting = true;
  const old = electron;
  old.once('exit', () => startElectron());
  old.kill();
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run(bin('vite'), []);
waitForServer()
  .then(() => {
    startElectron();
    let timer = null;
    for (const file of ['main.cjs', 'preload.cjs', 'ai.cjs']) {
      fs.watch(path.join(__dirname, file), () => {
        clearTimeout(timer);
        timer = setTimeout(restartElectron, 200);
      });
    }
  })
  .catch((e) => {
    console.error(e.message);
    shutdown(1);
  });
