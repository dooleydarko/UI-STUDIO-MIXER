import type { TextureDocument } from './textureCanvasEngine';
import type { LightingPreset } from '../types';

export interface SavedModelInfo { id: string; name: string; savedAt: number; size: number; layered?: boolean; projectId?: string }
export interface SurfaceProjectData { source: Blob; sourceName: string; materialIndex: number; materialName: string; document: TextureDocument; lighting: LightingPreset; projectId: string }
interface SavedModel extends SavedModelInfo { blob: Blob; surface?: SurfaceProjectData }
const DATABASE = 'ui-studio-model-library';
const STORE = 'models';

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Model library is blocked by another window.'));
  });
}
async function transact<T>(mode: IDBTransactionMode, perform: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openLibrary();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = perform(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error ?? new Error('Model library transaction aborted.'));
    });
  } finally { db.close(); }
}
export async function saveModelSnapshot(name: string, blob: Blob, existingId?: string): Promise<SavedModelInfo> {
  const record: SavedModel = { id: existingId ?? crypto.randomUUID(), name, savedAt: Date.now(), size: blob.size, blob };
  await transact('readwrite', store => store.put(record));
  const { blob: _blob, ...info } = record;
  return info;
}
export async function saveSurfaceProject(name:string,baked:Blob,surface:SurfaceProjectData,existingId?:string):Promise<SavedModelInfo>{
  if(existingId){const existing=await transact<SavedModel|undefined>('readonly',store=>store.get(existingId));if(!existing?.surface||existing.projectId!==surface.projectId)throw new Error('Cannot overwrite an unrelated saved model.');}
  const record:SavedModel={id:existingId??crypto.randomUUID(),name,savedAt:Date.now(),size:baked.size,blob:baked,surface,layered:true,projectId:surface.projectId};
  await transact('readwrite',store=>store.put(record));
  const {blob:_blob,surface:_surface,...info}=record;return info;
}
export async function readSurfaceProject(id:string):Promise<SurfaceProjectData|undefined>{
  const record=await transact<SavedModel|undefined>('readonly',store=>store.get(id));return record?.surface;
}
export async function listSavedModels(): Promise<SavedModelInfo[]> {
  // Cursor avoids returning all model blobs to the UI at once.
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const result: SavedModelInfo[] = [];
      const request = tx.objectStore(STORE).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const { id, name, savedAt, size, layered, projectId } = cursor.value as SavedModel;
          result.push({ id, name, savedAt, size, layered, projectId }); cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(result.sort((a,b) => b.savedAt-a.savedAt));
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function readSavedModel(id: string): Promise<File> {
  const record = await transact<SavedModel | undefined>('readonly', store => store.get(id));
  if (!record) throw new Error('Saved model not found.');
  return new File([record.blob], record.name.replace(/\.(gltf|glb)$/i, '') + '.glb', { type: 'model/gltf-binary' });
}
export async function removeSavedModel(id: string): Promise<void> {
  await transact('readwrite', store => store.delete(id));
}
