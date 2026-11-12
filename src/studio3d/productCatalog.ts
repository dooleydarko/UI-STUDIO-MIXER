import catalog from '../assets/productGlbCatalog.json';

export type ProductGlbAsset = typeof catalog[number];
export const PRODUCT_GLB_CATALOG: readonly ProductGlbAsset[] = catalog;
export const MAX_GLB_BYTES = 100 * 1024 * 1024;

export async function fetchCatalogModel(asset: ProductGlbAsset, signal: AbortSignal, onProgress: (bytes: number, total: number) => void): Promise<File> {
  // Only fixed, curated catalog URLs are accepted. No arbitrary remote URL loading.
  const entry = PRODUCT_GLB_CATALOG.find(item => item.id === asset.id);
  if (!entry || entry.url !== asset.url) throw new Error('Unknown product catalog asset.');
  const response = await fetch(entry.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Product download failed: HTTP ' + response.status);
  const total = Number(response.headers.get('content-length')) || 0;
  if (total > MAX_GLB_BYTES) throw new Error('Product exceeds the current 100 MB limit.');
  if (!response.body) throw new Error('Streaming downloads unavailable.');
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_GLB_BYTES) throw new Error('Product exceeds the current 100 MB limit.');
      chunks.push(new Uint8Array(value));
      onProgress(received, total);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const file = new File(chunks, entry.id + '.glb', { type: 'model/gltf-binary' });
  const header = new DataView(await file.slice(0, 12).arrayBuffer());
  if (header.byteLength < 12 || header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== file.size) {
    throw new Error('Downloaded file is not a valid GLB 2.0 container.');
  }
  return file;
}
