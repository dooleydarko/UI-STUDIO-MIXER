const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

// Gemini handles both jobs with one key: reading code + writing mixes, and transcribing speech.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const keyFile = () => path.join(app.getPath('userData'), 'gemini.key');

function hasKey() {
  return fs.existsSync(keyFile());
}

function readKey() {
  if (!hasKey() || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(fs.readFileSync(keyFile()));
  } catch {
    return null;
  }
}

/** The key is encrypted with the OS keychain and never written as plain text. */
function writeKey(key) {
  const trimmed = String(key || '').trim();
  if (trimmed.length < 20) throw new Error('That does not look like an API key.');
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is not available on this system, so the key was not saved.');
  }
  fs.writeFileSync(keyFile(), safeStorage.encryptString(trimmed), { mode: 0o600 });
}

function clearKey() {
  if (hasKey()) fs.unlinkSync(keyFile());
}

async function callGemini({ parts, json = false, temperature = 0.7, timeoutMs = 90000 }) {
  const key = readKey();
  if (!key) throw new Error('No API key saved. Add your Gemini key first.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = body && body.error && body.error.message ? body.error.message : `HTTP ${res.status}`;
      throw new Error(`Gemini request failed: ${detail}`);
    }
    const text = (body.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text.trim()) {
      const reason = body.candidates?.[0]?.finishReason || body.promptFeedback?.blockReason || 'empty response';
      throw new Error(`Gemini returned no text (${reason}).`);
    }
    return text;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Gemini took too long to respond.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function transcribe({ base64, mimeType }) {
  const text = await callGemini({
    parts: [
      {
        text:
          'Transcribe this audio verbatim. Output only the words that were spoken, with normal punctuation and no commentary. ' +
          'If the audio is silent or unintelligible, output nothing.',
      },
      { inlineData: { mimeType: mimeType || 'audio/webm', data: base64 } },
    ],
    temperature: 0,
    timeoutMs: 60000,
  });
  return text.trim();
}

// ---- Local model (Ollama) ---------------------------------------------------------------
// Ollama is a separate free app that runs models on this Mac. We talk to it on localhost only.
const OLLAMA = 'http://127.0.0.1:11434';
const LOCAL_MODEL = process.env.LOCAL_MIX_MODEL || 'qwen2.5-coder:3b';

async function fetchWithTimeout(url, options = {}, ms = 2000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Is Ollama running, and is the mixing model downloaded? */
async function localStatus() {
  try {
    const res = await fetchWithTimeout(`${OLLAMA}/api/tags`, {}, 1500);
    if (!res.ok) return { running: false, hasModel: false, model: LOCAL_MODEL };
    const body = await res.json();
    const base = LOCAL_MODEL.split(':')[0];
    const hasModel = (body.models || []).some((m) => m.name === LOCAL_MODEL || m.name.startsWith(`${base}:`));
    return { running: true, hasModel, model: LOCAL_MODEL };
  } catch {
    return { running: false, hasModel: false, model: LOCAL_MODEL };
  }
}

/** Downloads the model through Ollama, reporting progress as it streams in. */
async function pullLocalModel(onProgress) {
  const res = await fetch(`${OLLAMA}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: LOCAL_MODEL, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error('Ollama could not start the download. Is it running?');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      onProgress({ status: msg.status, completed: msg.completed || 0, total: msg.total || 0 });
    }
  }
}

async function callOllama({ prompt, temperature }) {
  // Generating three full components on a CPU can take minutes, so allow plenty of time
  const res = await fetchWithTimeout(
    `${OLLAMA}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: 'json',
        options: { temperature, num_ctx: 8192 },
      }),
    },
    15 * 60 * 1000
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Local model failed: ${body.error || `HTTP ${res.status}`}`);
  const text = body.message && body.message.content;
  if (!text || !text.trim()) throw new Error('The local model returned nothing.');
  return text;
}

const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n)}\n/* ...truncated... */` : s || '');

function buildMixPrompt({ prompt, freedom, base, sources, compact }) {
  // Small local models have short context windows, so send less code to them
  const lim = compact ? { html: 2500, css: 3500, js: 1200 } : { html: 6000, css: 8000, js: 3000 };
  const describe = (c) =>
    `### ${c.name}\nHTML:\n${clip(c.html, lim.html)}\n\nCSS:\n${clip(c.css, lim.css)}\n\nJS:\n${clip(c.js, lim.js)}`;

  const plan = sources.length
    ? sources
        .map((s) => {
          const styleCats = s.categories.filter((c) => c !== 'structure' && c !== 'behavior');
          const lines = Object.entries(s.selectedCode || {})
            .filter(([, items]) => items.length > 0)
            .map(([cat, items]) => `    ${cat}:\n${items.map((i) => `      ${i}`).join('\n')}`)
            .join('\n');
          return [
            `From "${s.name}":`,
            `  - Style traits to pull: ${styleCats.join(', ') || 'none'}`,
            `  - Put them onto: ${s.placeOnto}`,
            `  - Include its markup and layout: ${s.categories.includes('structure') ? 'YES' : 'NO'}`,
            `  - Include its JavaScript: ${s.categories.includes('behavior') ? 'YES' : 'NO'}`,
            `  - The user ticked these exact code lines:\n${lines || '    (none)'}`,
          ].join('\n');
        })
        .join('\n\n')
    : '(no other components: only restyle the base according to the user direction)';

  return `You are a front-end designer blending UI components.

Return ONLY JSON in exactly this shape, with exactly 3 variations in this order:
{"variations":[{"type":"refined","title":"","summary":"","html":"","css":"","js":""},{"type":"reimagined",...},{"type":"experimental",...}]}

Output rules:
- "html" is a self-contained fragment (no <html>, <head> or <body> tags). "css" is plain CSS. "js" is optional vanilla JS ("" if none).
- No external network resources, imports or fonts. Do not call alert(), prompt() or confirm().
- It renders centered in a ~340x400px stage with a transparent background on a dark gray card. Do not size anything to 100vh, and do not use position:fixed.
- Scope your CSS with a unique root class so nothing leaks.

Blend rules:
- The BASE component is the destination. It keeps its own identity and receives what is pulled.
- Follow the pull plan below exactly: take only what the user chose from each source, and put it where they said. Do not pull traits that were not chosen.
- "refined" is faithful and conservative, "reimagined" is a bolder composition, "experimental" is ambitious but still usable.
- Creative freedom: ${freedom} (0 = strict, 1 = wild).
- User direction: ${prompt && prompt.trim() ? `"${prompt.trim()}"` : '(none)'}

PULL PLAN
${plan}

BASE COMPONENT (destination)
${describe(base)}

SOURCE COMPONENTS
${sources.length ? sources.map(describe).join('\n\n') : '(none)'}`;
}

function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

/**
 * Mixes with the chosen provider: 'gemini' (cloud, best quality) or 'local' (Ollama, offline).
 */
async function mix(payload) {
  const local = payload.provider === 'local';
  const freedom = Number(payload.freedom) || 0.7;
  const temperature = Math.min(1.2, 0.4 + freedom * 0.8);
  const prompt = buildMixPrompt({ ...payload, compact: local });
  const label = local ? 'The local model' : 'Gemini';

  const text = local
    ? await callOllama({ prompt, temperature })
    : await callGemini({ parts: [{ text: prompt }], json: true, temperature });

  let data;
  try {
    data = parseJson(text);
  } catch {
    throw new Error(`${label} returned a malformed mix. Try again.`);
  }
  const variations = Array.isArray(data.variations) ? data.variations : [];
  const clean = variations
    .filter((v) => v && typeof v.html === 'string' && v.html.trim())
    .slice(0, 3)
    .map((v, i) => ({
      type: ['refined', 'reimagined', 'experimental'][i],
      title: String(v.title || '').slice(0, 80),
      summary: String(v.summary || '').slice(0, 240),
      html: v.html,
      css: typeof v.css === 'string' ? v.css : '',
      js: typeof v.js === 'string' ? v.js : '',
    }));
  if (clean.length === 0) throw new Error(`${label} did not return any usable variations.`);
  return clean;
}

module.exports = { MODEL, LOCAL_MODEL, hasKey, writeKey, clearKey, transcribe, mix, localStatus, pullLocalModel };
