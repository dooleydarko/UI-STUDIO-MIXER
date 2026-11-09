export interface NativeStorageInfo {
  directory: string;
  externalDrive: 'active' | 'not-mounted' | 'error';
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface AiVariationRaw {
  type: 'refined' | 'reimagined' | 'experimental';
  title: string;
  summary: string;
  html: string;
  css: string;
  js: string;
}

export interface LocalModelStatus {
  running: boolean;
  hasModel: boolean;
  model: string;
}

export interface PullProgress {
  status: string;
  completed: number;
  total: number;
}

interface NativeAi {
  status: () => Promise<IpcResult<{ hasKey: boolean; model: string; local: LocalModelStatus }>>;
  setKey: (key: string) => Promise<IpcResult<void>>;
  clearKey: () => Promise<IpcResult<void>>;
  micAccess: () => Promise<IpcResult<boolean>>;
  transcribe: (base64: string, mimeType: string) => Promise<IpcResult<string>>;
  mix: (payload: unknown) => Promise<IpcResult<AiVariationRaw[]>>;
  pullLocal: () => Promise<IpcResult<void>>;
  onPullProgress: (cb: (p: PullProgress) => void) => () => void;
  openPage: (url: string) => Promise<IpcResult<void>>;
  clipboardKey: () => Promise<IpcResult<string | null>>;
}

interface StudioNative {
  isElectron: true;
  storageInfo: () => Promise<NativeStorageInfo>;
  storageReadAll: () => Promise<Record<string, string>>;
  storageWrite: (key: string, value: string) => Promise<boolean>;
  ai?: NativeAi;
}

declare global {
  interface Window {
    studioNative?: StudioNative;
  }
}

export function getNative(): StudioNative | undefined {
  return typeof window !== 'undefined' ? window.studioNative : undefined;
}

let info: NativeStorageInfo | null = null;
export function getNativeStorageInfo(): NativeStorageInfo | null {
  return info;
}

/**
 * In the desktop app, copies persisted files from disk into localStorage before
 * React renders, so the synchronous StorageManager sees them. No-op in a browser.
 * Disk files win over localStorage because disk is the source of truth.
 */
export async function hydrateFromDisk(): Promise<void> {
  const native = getNative();
  if (!native) return;
  try {
    info = await native.storageInfo();
    const files = await native.storageReadAll();
    for (const [key, value] of Object.entries(files)) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // quota: leave the existing value in place
      }
    }
  } catch (e) {
    console.warn('Native storage hydrate failed; continuing with localStorage only:', e);
  }
}

/** Mirrors a localStorage write to disk (fire-and-forget). */
export function mirrorToDisk(key: string, value: string): void {
  const native = getNative();
  if (!native) return;
  native.storageWrite(key, value).catch((e) => console.warn(`Disk write failed for ${key}:`, e));
}
