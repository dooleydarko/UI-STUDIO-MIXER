import { getNative, AiVariationRaw, LocalModelStatus, PullProgress } from '../storage/nativeBridge';

export const DESKTOP_ONLY = 'AI features work in the desktop app only.';

export interface AiStatus {
  hasKey: boolean;
  model: string;
  local: LocalModelStatus;
}

function ai() {
  const native = getNative()?.ai;
  if (!native) throw new Error(DESKTOP_ONLY);
  return native;
}

export function aiSupported(): boolean {
  return !!getNative()?.ai;
}

export async function aiStatus(): Promise<AiStatus | null> {
  if (!aiSupported()) return null;
  const res = await ai().status();
  return res.ok ? res.data : null;
}

export async function saveApiKey(key: string): Promise<void> {
  const res = await ai().setKey(key);
  if (!res.ok) throw new Error(res.error);
}

export async function removeApiKey(): Promise<void> {
  const res = await ai().clearKey();
  if (!res.ok) throw new Error(res.error);
}

/** Opens Google's page for creating a Gemini API key in the user's browser. */
export async function openGeminiKeyPage(): Promise<void> {
  const res = await ai().openPage('https://aistudio.google.com/apikey');
  if (!res.ok) throw new Error(res.error);
}

export async function openOllamaDownloadPage(): Promise<void> {
  const res = await ai().openPage('https://ollama.com/download');
  if (!res.ok) throw new Error(res.error);
}

/** The clipboard text, only if it looks like a Gemini API key. */
export async function readClipboardKey(): Promise<string | null> {
  const res = await ai().clipboardKey();
  return res.ok ? res.data : null;
}

export async function downloadLocalModel(onProgress: (p: PullProgress) => void): Promise<void> {
  const native = ai();
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

/** Cloud transcription through Gemini. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob);
  const res = await ai().transcribe(base64, blob.type || 'audio/webm');
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function micAccess(): Promise<boolean> {
  const res = await ai().micAccess();
  return res.ok && res.data;
}

export async function requestAiMix(payload: unknown): Promise<AiVariationRaw[]> {
  const res = await ai().mix(payload);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
