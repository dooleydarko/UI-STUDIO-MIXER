/**
 * FreeLLM Proxy Daemon (http://localhost:3001)
 *
 * Accepts OpenAI (/v1/chat/completions) and Anthropic (/v1/messages) requests and
 * forwards them to REAL upstream providers that offer free tiers, using YOUR OWN keys.
 * Providers are tried in order; on 429 / 5xx / network error the next one is used.
 *
 * Configure keys via environment variables or a git-ignored `.env.local` file:
 *   GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY
 *
 * Limits: free tiers have real rate limits (this is not unlimited usage).
 * Anthropic tool_use blocks are NOT translated, so agentic tool calling in Claude Code
 * will not work through this proxy; plain chat/completion requests do.
 * Streaming is emulated: the full upstream reply is fetched, then sent as SSE chunks.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = Number(process.env.FREELLM_PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile();

// Real OpenAI-compatible upstreams, in failover order.
const PROVIDERS = [
  { name: 'groq', keyEnv: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { name: 'cerebras', keyEnv: 'CEREBRAS_API_KEY', url: 'https://api.cerebras.ai/v1/chat/completions', model: 'llama-3.3-70b' },
  { name: 'gemini', keyEnv: 'GEMINI_API_KEY', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.0-flash' },
  { name: 'openrouter', keyEnv: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct:free' },
];

const configured = () => PROVIDERS.filter((p) => process.env[p.keyEnv]);

async function callUpstream(messages, opts = {}) {
  const list = configured();
  if (list.length === 0) {
    const err = new Error('No provider keys configured. Set GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY or CEREBRAS_API_KEY.');
    err.status = 503;
    throw err;
  }
  const errors = [];
  for (const p of list) {
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[p.keyEnv]}` },
        body: JSON.stringify({
          model: p.model,
          messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.max_tokens,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 429 || res.status >= 500) {
        errors.push(`${p.name}: HTTP ${res.status}`);
        continue; // fail over
      }
      if (!res.ok) {
        errors.push(`${p.name}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      return { text, provider: p.name, model: p.model, usage: data.usage || {} };
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  const err = new Error(`All configured providers failed: ${errors.join(' | ')}`);
  err.status = 502;
  throw err;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(Object.assign(e, { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const anthropicText = (c) =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : '';

const json = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj, null, 2));
};

export function createFreeLlmProxyServer(port = PORT) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');
    if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

    const pathname = new URL(req.url || '/', 'http://localhost').pathname;

    if (req.method === 'GET' && (pathname === '/' || pathname === '/health' || pathname === '/v1/health')) {
      const list = configured();
      return json(res, 200, {
        status: list.length ? 'online' : 'online-no-keys',
        port,
        configuredProviders: list.map((p) => p.name),
        unconfiguredProviders: PROVIDERS.filter((p) => !process.env[p.keyEnv]).map((p) => p.name),
        note: 'Free tiers have rate limits. Add provider keys to .env.local to enable routing.',
      });
    }

    if (req.method === 'GET' && pathname === '/v1/models') {
      return json(res, 200, {
        object: 'list',
        data: configured().map((p) => ({ id: p.model, object: 'model', owned_by: p.name })),
      });
    }

    try {
      if (req.method === 'POST' && pathname === '/v1/chat/completions') {
        const payload = await readBody(req);
        const r = await callUpstream(payload.messages || [], payload);
        const id = `chatcmpl_${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        if (payload.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
          const chunk = (delta, finish) => `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model: r.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
          res.write(chunk({ role: 'assistant', content: r.text }, null));
          res.write(chunk({}, 'stop'));
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        return json(res, 200, {
          id, object: 'chat.completion', created, model: r.model,
          choices: [{ index: 0, message: { role: 'assistant', content: r.text }, finish_reason: 'stop' }],
          usage: r.usage,
          x_provider: r.provider,
        });
      }

      if (req.method === 'POST' && pathname === '/v1/messages') {
        const payload = await readBody(req);
        const messages = [];
        const sys = anthropicText(payload.system);
        if (sys) messages.push({ role: 'system', content: sys });
        for (const m of payload.messages || []) messages.push({ role: m.role, content: anthropicText(m.content) });
        const r = await callUpstream(messages, payload);
        const id = `msg_${Date.now()}`;
        const usage = { input_tokens: r.usage.prompt_tokens || 0, output_tokens: r.usage.completion_tokens || 0 };
        if (payload.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
          const ev = (e, d) => res.write(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`);
          ev('message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant', model: payload.model, content: [], usage } });
          ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
          ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: r.text } });
          ev('content_block_stop', { type: 'content_block_stop', index: 0 });
          ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
          ev('message_stop', { type: 'message_stop' });
          return res.end();
        }
        return json(res, 200, {
          id, type: 'message', role: 'assistant', model: payload.model,
          content: [{ type: 'text', text: r.text }],
          stop_reason: 'end_turn', stop_sequence: null, usage,
        });
      }
    } catch (err) {
      return json(res, err.status || 500, { error: { type: 'proxy_error', message: err.message } });
    }

    json(res, 404, { error: 'Endpoint not found', available: ['/v1/messages', '/v1/chat/completions', '/v1/models', '/health'] });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[FreeLLMDaemon] Port ${port} already in use. Another instance may be running.`);
      process.exit(0);
    }
    console.error('[FreeLLMDaemon] Server error:', err);
    process.exit(1);
  });

  server.listen(port, () => {
    const list = configured().map((p) => p.name);
    console.log(`[FreeLLMDaemon] Listening on http://localhost:${port}`);
    console.log(list.length ? `[FreeLLMDaemon] Providers: ${list.join(', ')}` : '[FreeLLMDaemon] WARNING: no provider keys set; requests will return 503.');
  });
  return server;
}

if (process.argv[1]?.includes('freeLlmDaemon')) createFreeLlmProxyServer();
