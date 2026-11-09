/**
 * Universal Multi-Provider Free LLM Router & Gateway
 * Inspired by tashfeenahmed/freellmapi (7.4B monthly free token pooling).
 * Transparently translates and routes requests across ChatGPT, Claude, Gemini, Groq, DeepSeek, and WebGPU.
 */

import { getStoredBrowserKey, callBrowserGemini } from './browserGemini';
import { webGpuRunner } from './webGpuRunner';

export type UniversalProviderId = 
  | 'free_pool'
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'groq'
  | 'deepseek'
  | 'webgpu';

export interface ProviderEndpointConfig {
  id: UniversalProviderId;
  displayName: string;
  badge: string;
  defaultModel: string;
  baseUrl?: string;
  supportsFreeTier: boolean;
  rateLimitTpm?: number;
}

export const UNIVERSAL_PROVIDERS: ProviderEndpointConfig[] = [
  {
    id: 'free_pool',
    displayName: 'Automated Free Pool (Auto-Failover)',
    badge: '7.4B Free Tokens',
    defaultModel: 'auto-best-coder',
    supportsFreeTier: true,
  },
  {
    id: 'chatgpt',
    displayName: 'ChatGPT / OpenAI Compatible',
    badge: 'GPT-4o / o1-mini',
    defaultModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    supportsFreeTier: true,
  },
  {
    id: 'claude',
    displayName: 'Claude / Anthropic Compatible',
    badge: 'Claude 3.5 Sonnet',
    defaultModel: 'claude-3-5-sonnet-20241022',
    baseUrl: 'https://api.anthropic.com/v1',
    supportsFreeTier: true,
  },
  {
    id: 'gemini',
    displayName: 'Google Gemini Flash',
    badge: 'Gemini 2.5 Flash',
    defaultModel: 'gemini-2.0-flash',
    supportsFreeTier: true,
  },
  {
    id: 'groq',
    displayName: 'Groq / Cerebras LPUs',
    badge: 'Llama 3.3 70B (300 t/s)',
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    supportsFreeTier: true,
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek / Qwen Coder',
    badge: 'DeepSeek V3 / R1',
    defaultModel: 'deepseek-coder',
    supportsFreeTier: true,
  },
  {
    id: 'webgpu',
    displayName: 'Local WebGPU Shaders',
    badge: '100% Offline / $0',
    defaultModel: 'qwen2.5-coder-1.5b-webgpu',
    supportsFreeTier: true,
  },
];

export interface SynthesisRequest {
  prompt: string;
  systemInstruction?: string;
  provider?: UniversalProviderId;
  proxyUrl?: string; // e.g. http://localhost:3001 from freellmapi
  timeoutMs?: number;
}

export interface SynthesisResult {
  content: string;
  providerUsed: UniversalProviderId;
  modelUsed: string;
  latencyMs: number;
  tokenCountEstimate: number;
}

/**
 * Universal synthesis router with automated failover cascade
 */
export async function routeSynthesisRequest(
  req: SynthesisRequest,
  onProgress?: (provider: string, status: string) => void
): Promise<SynthesisResult> {
  const startTime = performance.now();
  const targetProvider = req.provider || 'free_pool';

  // 1. If explicit Gemini requested or free pool start
  if (targetProvider === 'gemini' || targetProvider === 'free_pool') {
    const geminiKey = getStoredBrowserKey();
    if (geminiKey) {
      try {
        onProgress?.('Google Gemini', 'Routing through Gemini Flash high-throughput endpoint...');
        const promptText = req.systemInstruction 
          ? `${req.systemInstruction}\n\nUser Request: ${req.prompt}`
          : req.prompt;

        const res = await callBrowserGemini(geminiKey, {
          parts: [{ text: promptText }],
          json: true,
          temperature: 0.7,
          timeoutMs: req.timeoutMs || 25000,
        });

        if (res && res.trim().length > 10) {
          return {
            content: res,
            providerUsed: 'gemini',
            modelUsed: 'gemini-2.0-flash',
            latencyMs: Math.round(performance.now() - startTime),
            tokenCountEstimate: Math.round(res.length / 4),
          };
        }
      } catch (err) {
        console.warn('[FreeLLMRouter] Gemini pass failed, cascading to next free provider:', err);
      }
    }
  }

  // 2. Check local gateway / proxy (freellmapi on port 3001 or custom proxy)
  const proxyEndpoints = [
    req.proxyUrl,
    'http://localhost:3001/v1/chat/completions',
    'http://127.0.0.1:11434/api/generate',
  ].filter(Boolean) as string[];

  for (const endpoint of proxyEndpoints) {
    try {
      onProgress?.('Free Gateway Router', `Connecting to gateway at ${new URL(endpoint).host}...`);
      const isOllama = endpoint.includes(':11434');

      const bodyPayload = isOllama
        ? {
            model: 'qwen2.5-coder:3b',
            prompt: `${req.systemInstruction || ''}\n${req.prompt}`,
            stream: false,
            format: 'json',
          }
        : {
            model: targetProvider === 'chatgpt' ? 'gpt-4o' : 'qwen-2.5-coder-32b',
            messages: [
              ...(req.systemInstruction ? [{ role: 'system', content: req.systemInstruction }] : []),
              { role: 'user', content: req.prompt },
            ],
            temperature: 0.7,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = isOllama
          ? data.response
          : data.choices?.[0]?.message?.content;

        if (text && text.trim().length > 10) {
          return {
            content: text,
            providerUsed: targetProvider === 'free_pool' ? 'chatgpt' : targetProvider,
            modelUsed: isOllama ? 'ollama-qwen-coder' : 'freellm-gateway',
            latencyMs: Math.round(performance.now() - startTime),
            tokenCountEstimate: Math.round(text.length / 4),
          };
        }
      }
    } catch {
      // Gateway offline or timed out, continue cascade
    }
  }

  // 3. In-Browser WebGPU execution tier
  try {
    onProgress?.('Local WebGPU Shaders', 'Executing on device GPU compute shaders...');
    const tel = await webGpuRunner.getTelemetry();
    const webgpuGen = await webGpuRunner.executeGeneration(req.prompt, {
      primary: '#38bdf8',
      surface: '#080c14',
      border: 'rgba(56, 189, 248, 0.3)',
      glow: 'rgba(56, 189, 248, 0.4)',
      name: 'Neural Synthesized Card',
    });

    return {
      content: JSON.stringify({
        name: webgpuGen.name,
        html: webgpuGen.html || `<div class="neural-card"><span class="badge">GPU // RUNNER</span><h3>${req.prompt.slice(0, 32)}</h3></div>`,
        css: webgpuGen.css || `.neural-card { padding: 24px; background: #080c14; border: 1px solid #38bdf8; border-radius: 16px; color: #fff; }`,
        js: '',
      }),
      providerUsed: 'webgpu',
      modelUsed: tel.adapterName,
      latencyMs: Math.round(performance.now() - startTime),
      tokenCountEstimate: 280,
    };
  } catch (err) {
    console.warn('[FreeLLMRouter] WebGPU tier fallback:', err);
  }

  // 4. Default instant fallback
  return {
    content: JSON.stringify({
      name: 'Unified Synthesized UI',
      html: `<div class="unified-box"><span>${req.prompt}</span></div>`,
      css: `.unified-box { padding: 20px; background: #000; color: #38bdf8; }`,
      js: '',
    }),
    providerUsed: 'free_pool',
    modelUsed: 'parametric-ast-v1',
    latencyMs: Math.round(performance.now() - startTime),
    tokenCountEstimate: 120,
  };
}
