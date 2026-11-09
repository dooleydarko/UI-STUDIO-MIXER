import { ComponentPackage, Product3DProject, QueuedComponent } from '../types';
import { EnginePackage, STARTER_ENGINES_CATALOG } from '../engineFoundry/types';
import { STARTER_COMPONENTS } from '../assets/starterComponents';
import { STARTER_3D_PROJECTS } from '../assets/starter3dProjects';
import { mirrorToDisk, getNativeStorageInfo } from './nativeBridge';

const STORAGE_KEYS = {
  COMPONENTS: 'antigravity_cm_components_v1',
  PROJECTS_3D: 'antigravity_cm_3d_projects_v1',
  SETTINGS: 'antigravity_cm_settings_v1',
  CANVAS_STATE: 'antigravity_cm_canvas_state_v1',
  QUEUE: 'antigravity_cm_queue_v1',
  ENGINES: 'antigravity_cm_engines_v1',
};

/** Bump when the persisted shape of any collection changes, and add a migration. */
export const SCHEMA_VERSION = 3;

interface Envelope<T> {
  schemaVersion: number;
  savedAt: number;
  data: T;
}

/**
 * Migrations keyed by the version they upgrade FROM. Version 0/1 data was stored
 * as a bare JSON value with no envelope; it is wrapped unchanged by the loader.
 */
const MIGRATIONS: Record<number, (data: any, key: keyof typeof STORAGE_KEYS) => any> = {
  2: (data, key) => {
    // v2 -> v3: cards grew from 320x380 to 400x470. Cards still at the old default
    // size are enlarged and their positions scaled by the same 1.25 so spacing is kept.
    if (key === 'COMPONENTS' && Array.isArray(data)) {
      return data.map((c: ComponentPackage) =>
        c.width === 320 && c.height === 380
          ? { ...c, width: 400, height: 470, canvasX: Math.round(c.canvasX * 1.25), canvasY: Math.round(c.canvasY * 1.25) }
          : c
      );
    }
    return data;
  },
  1: (data, key) => {
    if (key === 'PROJECTS_3D' && Array.isArray(data)) {
      // v1 -> v2: guarantee fields added after the first release
      return data.map((p: Product3DProject) => ({
        ...p,
        state: {
          ...({ rotationSpeed: 1, lighting: 'studio', showWireframe: false } as Partial<Product3DProject['state']>),
          ...p.state,
        },
      }));
    }
    return data;
  },
};

function migrate<T>(data: any, from: number, key: keyof typeof STORAGE_KEYS): T {
  let current = data;
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) current = step(current, key);
  }
  return current as T;
}

/**
 * Reads a versioned value. Accepts legacy un-enveloped data, migrates it, and
 * falls back to the previous-good backup copy if the primary value is corrupt.
 * Returns null if nothing usable exists.
 */
function readVersioned<T>(key: keyof typeof STORAGE_KEYS): T | null {
  for (const storageKey of [STORAGE_KEYS[key], `${STORAGE_KEYS[key]}.bak`]) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const isEnvelope =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'schemaVersion' in parsed && 'data' in parsed;
      if (isEnvelope) {
        const env = parsed as Envelope<unknown>;
        if (env.schemaVersion > SCHEMA_VERSION) continue; // written by a newer app; don't misread it
        return migrate<T>(env.data, env.schemaVersion, key);
      }
      return migrate<T>(parsed, 1, key); // legacy bare value
    } catch {
      // corrupt entry: try the backup
    }
  }
  return null;
}

/** Writes a versioned value, keeping the previous value as a one-step backup. */
function writeVersioned<T>(key: keyof typeof STORAGE_KEYS, data: T): boolean {
  const storageKey = STORAGE_KEYS[key];
  try {
    const previous = localStorage.getItem(storageKey);
    const envelope: Envelope<T> = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), data };
    const serialized = JSON.stringify(envelope);
    localStorage.setItem(storageKey, serialized);
    mirrorToDisk(storageKey, serialized);
    if (previous) {
      try {
        localStorage.setItem(`${storageKey}.bak`, previous);
        mirrorToDisk(`${storageKey}.bak`, previous);
      } catch {
        // backup is best-effort; never fail the primary write because of it
      }
    }
    return true;
  } catch (e) {
    console.error(`Failed to persist ${key}:`, e);
    return false;
  }
}

export interface AppSettings {
  theme: 'obsidian' | 'frost';
  creativeFreedom: number; // 0 to 1
  externalStoragePath: string | null;
  hasExternalDrive: boolean;
  reducedMotion: boolean;
  performanceMode: 'eco' | 'balanced' | 'performance';
}

// In a plain browser, /Volumes is not reachable. In the Electron app the main
// process picks the external SSD when mounted (see electron/main.cjs).
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'obsidian',
  creativeFreedom: 0.7,
  externalStoragePath: null,
  hasExternalDrive: false,
  reducedMotion: false,
  performanceMode: 'balanced',
};

export interface StorageStatus {
  backend: 'browser-local' | 'desktop-disk';
  schemaVersion: number;
  externalDrive: 'unavailable-in-browser' | 'active' | 'not-mounted' | 'error';
  directory: string | null;
}

export class StorageManager {
  private static instance: StorageManager;

  private constructor() {}

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  public getStatus(): StorageStatus {
    const native = getNativeStorageInfo();
    if (native) {
      return {
        backend: 'desktop-disk',
        schemaVersion: SCHEMA_VERSION,
        externalDrive: native.externalDrive,
        directory: native.directory,
      };
    }
    return { backend: 'browser-local', schemaVersion: SCHEMA_VERSION, externalDrive: 'unavailable-in-browser', directory: null };
  }

  public getSettings(): AppSettings {
    const stored = readVersioned<Partial<AppSettings>>('SETTINGS');
    return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    const updated = { ...this.getSettings(), ...settings };
    writeVersioned('SETTINGS', updated);
    return updated;
  }

  public loadComponents(): ComponentPackage[] {
    const stored = readVersioned<ComponentPackage[]>('COMPONENTS');
    if (!Array.isArray(stored) || stored.length === 0) {
      // Initialize with high quality starter components
      this.saveComponents(STARTER_COMPONENTS);
      return STARTER_COMPONENTS;
    }
    return stored;
  }

  public saveComponents(components: ComponentPackage[]): void {
    writeVersioned('COMPONENTS', components);
  }

  public addComponent(pkg: ComponentPackage): void {
    const existing = this.loadComponents();
    const filtered = existing.filter(c => c.id !== pkg.id);
    this.saveComponents([pkg, ...filtered]);
  }

  public updateComponent(id: string, updates: Partial<ComponentPackage>): ComponentPackage | null {
    const existing = this.loadComponents();
    const idx = existing.findIndex(c => c.id === id);
    if (idx === -1) return null;
    const updated = { ...existing[idx], ...updates, updatedAt: Date.now() };
    existing[idx] = updated;
    this.saveComponents(existing);
    return updated;
  }

  public deleteComponent(id: string): void {
    const existing = this.loadComponents();
    this.saveComponents(existing.filter(c => c.id !== id));
  }

  public load3DProjects(): Product3DProject[] {
    const stored = readVersioned<Product3DProject[]>('PROJECTS_3D');
    if (!Array.isArray(stored) || stored.length === 0) {
      this.save3DProjects(STARTER_3D_PROJECTS);
      return STARTER_3D_PROJECTS;
    }
    return stored;
  }

  public save3DProjects(projects: Product3DProject[]): void {
    writeVersioned('PROJECTS_3D', projects);
  }

  public save3DProject(project: Product3DProject): void {
    const existing = this.load3DProjects();
    const filtered = existing.filter(p => p.id !== project.id);
    this.save3DProjects([project, ...filtered]);
  }

  public getCanvasState(): { panX: number; panY: number; zoom: number } {
    return readVersioned<{ panX: number; panY: number; zoom: number }>('CANVAS_STATE') ?? { panX: 0, panY: 0, zoom: 1 };
  }

  public saveCanvasState(state: { panX: number; panY: number; zoom: number }): void {
    writeVersioned('CANVAS_STATE', state);
  }

  public loadQueue(): QueuedComponent[] {
    const stored = readVersioned<QueuedComponent[]>('QUEUE');
    return Array.isArray(stored) ? stored : [];
  }

  public saveQueue(items: QueuedComponent[]): void {
    writeVersioned('QUEUE', items);
  }

  public enqueueComponent(item: QueuedComponent): void {
    const queue = this.loadQueue();
    // Prepend or append; latest first for fast access
    this.saveQueue([item, ...queue.filter((q) => q.id !== item.id)]);
  }

  public updateQueueItem(id: string, updates: Partial<QueuedComponent>): void {
    const queue = this.loadQueue();
    this.saveQueue(queue.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  }

  public removeQueueItem(id: string): void {
    const queue = this.loadQueue();
    this.saveQueue(queue.filter((q) => q.id !== id));
  }

  public clearQueue(): void {
    this.saveQueue([]);
  }

  // --- Engine Foundry Storage Backbone ---

  public loadEngines(): EnginePackage[] {
    const stored = readVersioned<EnginePackage[]>('ENGINES');
    if (!stored || stored.length === 0) {
      this.saveEngines(STARTER_ENGINES_CATALOG);
      return STARTER_ENGINES_CATALOG;
    }
    return stored;
  }

  public saveEngines(engines: EnginePackage[]): void {
    writeVersioned('ENGINES', engines);
  }

  public addEngine(engine: EnginePackage): void {
    const engines = this.loadEngines();
    this.saveEngines([engine, ...engines.filter(e => e.id !== engine.id)]);
  }

  public updateEngine(id: string, updates: Partial<EnginePackage>): void {
    const engines = this.loadEngines();
    this.saveEngines(engines.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }

  public deleteEngine(id: string): void {
    const engines = this.loadEngines();
    this.saveEngines(engines.filter((e) => e.id !== id));
  }
}
