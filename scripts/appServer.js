/**
 * Desktop App Server & Live Update Runner (http://127.0.0.1:4173)
 *
 * Serves the built production bundle (`dist/`) for both standalone macOS apps
 * (`UI Mixer Studio.app` and `AI Engine Foundry.app`), ensures the FreeLLM proxy
 * (`localhost:3001`) is running, and exposes `/api/app-status` + `/api/app-update`
 * so updates can be built and applied directly from inside the desktop apps.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const PORT = Number(process.env.AG_APP_PORT || 4173);
const PROXY_URL = 'http://127.0.0.1:3001/health';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
};

let isUpdating = false;

async function ensureProxyRunning() {
  try {
    const res = await fetch(PROXY_URL, { signal: AbortSignal.timeout(1200) });
    if (res.ok) return true;
  } catch {
    // Proxy not reachable yet; start it detached so it persists cleanly
  }
  try {
    const child = spawn(process.execPath, [path.join(__dirname, 'freeLlmDaemon.js')], {
      cwd: ROOT_DIR,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (err) {
    console.error('[AppServer] Failed to spawn freeLlmDaemon:', err.message);
  }
  return false;
}

function getGitHead() {
  try {
    return execSync('git log -1 --format="%h %s"', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getDistMtimeMs() {
  try {
    return fs.statSync(path.join(DIST_DIR, 'index.html')).mtimeMs;
  } catch {
    return 0;
  }
}

function getLatestSrcMtimeMs(dir) {
  let latest = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        latest = Math.max(latest, getLatestSrcMtimeMs(full));
      } else {
        latest = Math.max(latest, fs.statSync(full).mtimeMs);
      }
    }
  } catch {
    // ignore
  }
  return latest;
}

function getDistMtime() {
  const ms = getDistMtimeMs();
  return ms ? new Date(ms).toISOString() : null;
}

function isUpdateAvailable() {
  const distMs = getDistMtimeMs();
  if (!distMs) return true;
  const srcMs = Math.max(
    getLatestSrcMtimeMs(path.join(ROOT_DIR, 'src')),
    fs.existsSync(path.join(ROOT_DIR, 'index.html'))
      ? fs.statSync(path.join(ROOT_DIR, 'index.html')).mtimeMs
      : 0
  );
  return srcMs > distMs + 1500;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function runAppBuild() {
  return new Promise((resolve) => {
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmBin, ['run', 'build'], { cwd: ROOT_DIR });
    let output = '';
    child.stdout.on('data', (d) => (output += d.toString()));
    child.stderr.on('data', (d) => (output += d.toString()));
    child.on('close', (code) => {
      resolve({ ok: code === 0, code, output: output.slice(-3000) });
    });
    child.on('error', (err) => {
      resolve({ ok: false, code: 1, output: err.message });
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const pathname = reqUrl.pathname;

  if (req.method === 'GET' && pathname === '/api/fetch-component') {
    const target = reqUrl.searchParams.get('url') || '';
    if (!/^https?:\/\//i.test(target)) {
      return sendJson(res, 400, { ok: false, error: 'Invalid URL' });
    }
    try {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        return sendJson(res, 502, { ok: false, error: `Upstream returned HTTP ${upstream.status}` });
      }
      const text = await upstream.text();

      // 1. Uiverse Next.js __NEXT_DATA__
      const nextMatch = text.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (nextMatch) {
        try {
          const parsed = JSON.parse(nextMatch[1]);
          const post = parsed?.props?.pageProps?.post;
          if (post && (post.html || post.css)) {
            return sendJson(res, 200, {
              ok: true,
              name: post.title || post.name || '',
              html: post.html || '',
              css: post.css || '',
              js: post.js || '',
            });
          }
        } catch {
          // continue to other extractors
        }
      }

      // 2. Remix / React Router / JSON embedded {"html": "...", "css": "..."}
      const jsonPair = text.match(/"html"\s*:\s*"((?:\\.|[^"\\])+)"\s*,\s*"css"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (jsonPair) {
        try {
          const htmlVal = JSON.parse(`"${jsonPair[1]}"`);
          const cssVal = JSON.parse(`"${jsonPair[2]}"`);
          if (htmlVal) {
            return sendJson(res, 200, { ok: true, name: '', html: htmlVal, css: cssVal, js: '' });
          }
        } catch {
          // continue
        }
      }

      // 3. Raw snippet (not a full webpage shell)
      if (!/<html[\s>]|<!doctype/i.test(text)) {
        return sendJson(res, 200, { ok: true, raw: text });
      }

      return sendJson(res, 422, {
        ok: false,
        error: 'Could not extract a standalone UI component from this URL. Copy the HTML and CSS tabs directly and paste them into Separate or Smart Paste.',
      });
    } catch (err) {
      return sendJson(res, 502, { ok: false, error: err instanceof Error ? err.message : 'Fetch failed' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/app-status') {
    let proxy = null;
    try {
      const pRes = await fetch(PROXY_URL, { signal: AbortSignal.timeout(1500) });
      if (pRes.ok) proxy = await pRes.json();
    } catch {
      proxy = { status: 'offline', configuredProviders: [] };
    }
    return sendJson(res, 200, {
      status: 'running',
      port: PORT,
      commit: getGitHead(),
      builtAt: getDistMtime(),
      updateAvailable: isUpdateAvailable(),
      isUpdating,
      proxy,
    });
  }

  if (req.method === 'POST' && pathname === '/api/app-update') {
    if (isUpdating) {
      return sendJson(res, 409, { ok: false, message: 'Update build already in progress.' });
    }
    isUpdating = true;
    try {
      await ensureProxyRunning();
      const result = await runAppBuild();
      return sendJson(res, result.ok ? 200 : 500, {
        ok: result.ok,
        commit: getGitHead(),
        builtAt: getDistMtime(),
        log: result.output,
      });
    } finally {
      isUpdating = false;
    }
  }

  // Static file serving from dist/
  let relPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const safePath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  let targetFile = path.join(DIST_DIR, safePath);

  if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
    targetFile = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(targetFile)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('dist/index.html not built yet. Run npm run build.');
  }

  const ext = path.extname(targetFile).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  fs.createReadStream(targetFile).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[AppServer] Port ${PORT} already active.`);
    process.exit(0);
  }
  console.error('[AppServer] Fatal error:', err);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[AppServer] Serving apps on http://127.0.0.1:${PORT}`);
  ensureProxyRunning();
});
