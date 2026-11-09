import { getNative, AiVariationRaw, LocalModelStatus, PullProgress } from '../storage/nativeBridge';
import {
  getStoredBrowserKey,
  setStoredBrowserKey,
  clearStoredBrowserKey,
  browserTranscribe,
  browserMix,
  validateGeminiKey,
} from './browserGemini';

export interface AiStatus {
  hasKey: boolean;
  model: string;
  local: LocalModelStatus;
}

export function aiSupported(): boolean {
  // Always true: Electron uses native bridge, browser uses direct Google AI Studio API
  return true;
}

export async function aiStatus(): Promise<AiStatus | null> {
  const native = getNative()?.ai;
  if (native) {
    const res = await native.status();
    return res.ok ? res.data : null;
  }

  // Web Browser mode
  const key = getStoredBrowserKey();
  let localRunning = false;
  let hasLocalModel = false;
  try {
    const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(800) });
    if (r.ok) {
      localRunning = true;
      const data = await r.json();
      hasLocalModel = Array.isArray(data.models) && data.models.some((m: { name?: string }) => m.name?.includes('qwen2.5-coder'));
    }
  } catch {
    // Ollama not reachable in browser
  }

  return {
    hasKey: !!key,
    model: 'gemini-2.5-flash',
    local: {
      running: localRunning,
      hasModel: hasLocalModel,
      model: 'qwen2.5-coder:3b',
    },
  };
}

export async function saveApiKey(key: string): Promise<void> {
  const native = getNative()?.ai;
  if (native) {
    const res = await native.setKey(key);
    if (!res.ok) throw new Error(res.error);
    return;
  }

  // Validate in browser before saving
  const validation = await validateGeminiKey(key);
  if (!validation.ok) {
    throw new Error(validation.error || 'Could not verify Gemini API key. Please check the key and try again.');
  }
  setStoredBrowserKey(key);
}

export async function removeApiKey(): Promise<void> {
  const native = getNative()?.ai;
  if (native) {
    const res = await native.clearKey();
    if (!res.ok) throw new Error(res.error);
    return;
  }
  clearStoredBrowserKey();
}

/** Opens Google's page for creating a Gemini API key in the user's browser. */
export async function openGeminiKeyPage(): Promise<void> {
  const native = getNative()?.ai;
  if (native) {
    const res = await native.openPage('https://aistudio.google.com/apikey');
    if (!res.ok) throw new Error(res.error);
    return;
  }
  window.open('https://aistudio.google.com/apikey', '_blank', 'noopener,noreferrer');
}

export async function openOllamaDownloadPage(): Promise<void> {
  const native = getNative()?.ai;
  if (native) {
    const res = await native.openPage('https://ollama.com/download');
    if (!res.ok) throw new Error(res.error);
    return;
  }
  window.open('https://ollama.com/download', '_blank', 'noopener,noreferrer');
}

/** The clipboard text, only if it looks like a Gemini API key. */
export async function readClipboardKey(): Promise<string | null> {
  const native = getNative()?.ai;
  if (native) {
    const res = await native.clipboardKey();
    return res.ok ? res.data : null;
  }

  // Browser clipboard API (if permissions allow)
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = (await navigator.clipboard.readText()).trim();
      if (/^AIza[0-9A-Za-z-_]{35}$/.test(text)) {
        return text;
      }
    }
  } catch {
    // Clipboard permission not granted or document not active
  }
  return null;
}

export async function downloadLocalModel(onProgress: (p: PullProgress) => void): Promise<void> {
  const native = getNative()?.ai;
  if (!native) {
    throw new Error('Local model downloads require the desktop app.');
  }
  const stop = native.onPullProgress(onProgress);
  try {
    const res = await native.pullLocal();
    if (!res.ok) throw new Error(res.error);
  } finally {
    stop();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the recording.'));
    reader.readAsDataURL(blob);
  });
}

/** Audio transcription through Gemini. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob);
  const native = getNative()?.ai;
  if (native) {
    const res = await native.transcribe(base64, blob.type || 'audio/webm');
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }

  const key = getStoredBrowserKey();
  if (!key) throw new Error('No Gemini API key connected. Connect Gemini first.');
  return browserTranscribe(key, base64, blob.type || 'audio/webm');
}

export async function micAccess(): Promise<boolean> {
  const native = getNative()?.ai;
  if (native) {
    const res = await native.micAccess();
    return res.ok && res.data;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function requestAiMix(payload: unknown): Promise<AiVariationRaw[]> {
  const native = getNative()?.ai;
  if (native) {
    const res = await native.mix(payload);
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }

  const key = getStoredBrowserKey();
  if (!key) throw new Error('No Gemini API key connected. Please connect your Gemini API key in the mixer tray.');
  return browserMix(key, payload);
}
