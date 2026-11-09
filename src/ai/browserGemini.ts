import { AiVariationRaw } from '../storage/nativeBridge';

const STORAGE_KEY = 'antigravity_gemini_api_key';
const MODEL_STORAGE_KEY = 'antigravity_gemini_active_model';

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

const PREFERRED_PATTERNS = [
  /gemini-2\.0-flash/i,
  /gemini-2\.5-flash/i,
  /gemini-3\.\d+-flash/i,
  /flash/i,
  /gemini-2\.0/i,
  /gemini-2\.5/i,
  /gemini-1\.5-pro/i,
  /pro/i,
];

export function getStoredBrowserKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredBrowserKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed.length < 20) {
    throw new Error('Key is too short. Please provide a valid Gemini API key.');
  }
  localStorage.setItem(STORAGE_KEY, trimmed);
}

export function clearStoredBrowserKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MODEL_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getStoredActiveModel(): string | null {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveModel(model: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, model.replace(/^models\//, ''));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Queries Google AI Studio's ModelService to list active models for this API key.
 */
export async function fetchAvailableModels(key: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Gemini API error: ${msg}`);
    }
    if (!Array.isArray(body?.models)) return [];

    const valid = body.models
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m: { name?: string }) => String(m.name || '').replace(/^models\//, ''))
      .filter(Boolean);

    return valid;
  } catch (e: unknown) {
    if (e instanceof Error && e.message.startsWith('Gemini API error:')) {
      throw e;
    }
    return [];
  }
}

/**
 * Resolves the best available Gemini model for generateContent.
 */
export async function resolveBestModel(key: string): Promise<string> {
  const cached = getStoredActiveModel();
  const available = await fetchAvailableModels(key);

  if (available.length > 0) {
    if (cached && available.includes(cached)) {
      return cached;
    }
    for (const pattern of PREFERRED_PATTERNS) {
      const match = available.find((m) => pattern.test(m));
      if (match) {
        setStoredActiveModel(match);
        return match;
      }
    }
    const fallback = available[0];
    setStoredActiveModel(fallback);
    return fallback;
  }

  return cached || CANDIDATE_MODELS[0];
}

interface CallGeminiOptions {
  parts: Array<Record<string, unknown>>;
  json?: boolean;
  temperature?: number;
  timeoutMs?: number;
  model?: string;
}

export async function callBrowserGemini(
  key: string,
  { parts, json = false, temperature = 0.7, timeoutMs = 60000, model }: CallGeminiOptions
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const endpoint = (m: string) => {
    const clean = m.replace(/^models\//, '');
    return `https://generativelanguage.googleapis.com/v1beta/models/${clean}:generateContent?key=${encodeURIComponent(key)}`;
  };

  const initialModel = model || getStoredActiveModel() || CANDIDATE_MODELS[0];

  async function execute(targetModel: string): Promise<string> {
    const res = await fetch(endpoint(targetModel), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      const err = new Error(`Gemini API error: ${msg}`);
      (err as { status?: number }).status = res.status;
      throw err;
    }

    const text = (body.candidates?.[0]?.content?.parts || [])
      .map((p: { text?: string }) => p.text || '')
      .join('');

    if (!text.trim()) {
      const reason = body.candidates?.[0]?.finishReason || body.promptFeedback?.blockReason || 'empty response';
      throw new Error(`Gemini returned an empty response (${reason}).`);
    }

    setStoredActiveModel(targetModel);
    return text;
  }

  try {
    try {
      return await execute(initialModel);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        // Model not found or not supported in this region/key: find available models or iterate candidates
        let modelsToTry: string[] = [];
        try {
          const discovered = await fetchAvailableModels(key);
          modelsToTry = discovered.filter((m) => m !== initialModel);
        } catch {
          // If fetchAvailableModels failed, fallback to static candidates
        }
        if (modelsToTry.length === 0) {
          modelsToTry = CANDIDATE_MODELS.filter((m) => m !== initialModel);
        }

        let lastErr = err;
        for (const candidate of modelsToTry) {
          try {
            return await execute(candidate);
          } catch (retryErr: unknown) {
            lastErr = retryErr;
            if ((retryErr as { status?: number })?.status !== 404) {
              throw retryErr;
            }
          }
        }
        throw lastErr;
      }
      throw err;
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Gemini request timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function validateGeminiKey(key: string): Promise<{ ok: boolean; error?: string; model?: string }> {
  try {
    const model = await resolveBestModel(key);
    const res = await callBrowserGemini(key, {
      parts: [{ text: 'Respond with "OK"' }],
      temperature: 0.1,
      timeoutMs: 12000,
      model,
    });
    const active = getStoredActiveModel() || model;
    return { ok: res.length > 0, model: active };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function browserTranscribe(key: string, base64Audio: string, mimeType = 'audio/webm'): Promise<string> {
  const text = await callBrowserGemini(key, {
    parts: [
      {
        text:
          'Transcribe this audio verbatim. Output only the words that were spoken, with normal punctuation and no commentary. ' +
          'If the audio is silent or unintelligible, output nothing.',
      },
      { inlineData: { mimeType, data: base64Audio } },
    ],
    temperature: 0,
    timeoutMs: 45000,
  });
  return text.trim();
}

const clip = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}\n/* ...truncated... */` : s || '');

interface MixPayload {
  prompt?: string;
  freedom?: number;
  base: { id: string; name: string; html: string; css: string; js: string };
  sources: Array<{
    id: string;
    name: string;
    html: string;
    css: string;
    js: string;
    categories: string[];
    placeOnto: string;
    selectedCode?: Record<string, string[]>;
  }>;
}

export function buildBrowserMixPrompt({ prompt, freedom = 0.7, base, sources }: MixPayload): string {
  const lim = { html: 6000, css: 8000, js: 3000 };
  const describe = (c: { name: string; html: string; css: string; js: string }) =>
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

export async function browserMix(key: string, payload: unknown): Promise<AiVariationRaw[]> {
  const p = payload as MixPayload;
  const freedom = Number(p.freedom) || 0.7;
  const temperature = Math.min(1.2, 0.4 + freedom * 0.8);
  const prompt = buildBrowserMixPrompt(p);

  const text = await callBrowserGemini(key, {
    parts: [{ text: prompt }],
    json: true,
    temperature,
    timeoutMs: 90000,
  });

  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data: { variations?: AiVariationRaw[] };
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new Error('Gemini returned an invalid response. Please try again.');
  }

  const variations = Array.isArray(data.variations) ? data.variations : [];
  const clean = variations
    .filter((v) => v && typeof v.html === 'string' && v.html.trim())
    .slice(0, 3)
    .map((v, i) => ({
      type: (v.type === 'refined' || v.type === 'reimagined' || v.type === 'experimental'
        ? v.type
        : (['refined', 'reimagined', 'experimental'][i] as AiVariationRaw['type'])),
      title: String(v.title || '').trim(),
      summary: String(v.summary || '').trim(),
      html: String(v.html || '').trim(),
      css: String(v.css || '').trim(),
      js: String(v.js || '').trim(),
    }));

  if (clean.length === 0) {
    throw new Error('Gemini did not generate any usable variations. Please try again.');
  }

  return clean;
}
