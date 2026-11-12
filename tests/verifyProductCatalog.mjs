import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const catalog = JSON.parse(await readFile(new URL('../src/assets/productGlbCatalog.json', import.meta.url), 'utf8'));
const MAX = 100 * 1024 * 1024;
const unsupported = new Set(['KHR_texture_basisu', 'KHR_animation_pointer', 'KHR_meshopt_compression']);
const ids = new Set();
for (const entry of catalog) {
  assert(!ids.has(entry.id), 'Duplicate asset ID');
  ids.add(entry.id);
  assert(['CC0-1.0', 'CC-BY-4.0'].includes(entry.license));
  assert(entry.credit && entry.source.startsWith('https://github.com/KhronosGroup/glTF-Sample-Assets/blob/'));
  assert(entry.url.startsWith('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/8f492390ddc7a2ae221a1369ef560589cf8c70fb/'));
  const response = await fetch(entry.url, { signal: AbortSignal.timeout(120000) });
  assert(response.ok, entry.id + ': HTTP ' + response.status);
  const size = Number(response.headers.get('content-length'));
  assert(!size || size <= MAX, entry.id + ': too large');
  const reader = response.body.getReader();
  let received = 0;
  let prefix = Buffer.alloc(0);
  let jsonEnd = 20;
  let model;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      assert(received <= MAX, entry.id + ': exceeds import limit');
      if (!model) {
        prefix = Buffer.concat([prefix, Buffer.from(value)]);
        if (prefix.length >= 20) {
          assert.equal(prefix.readUInt32LE(0), 0x46546c67, entry.id + ': bad magic');
          assert.equal(prefix.readUInt32LE(4), 2);
          assert.equal(prefix.readUInt32LE(16), 0x4e4f534a);
          jsonEnd = 20 + prefix.readUInt32LE(12);
          assert(jsonEnd <= 8 * 1024 * 1024, entry.id + ': excessive metadata');
          if (prefix.length >= jsonEnd) {
            model = JSON.parse(prefix.toString('utf8', 20, jsonEnd));
            prefix = prefix.subarray(0, 12);
          }
        }
      }
    }
    assert(model, entry.id + ': missing JSON chunk');
    assert.equal(prefix.readUInt32LE(8), received, entry.id + ': invalid byte length');
    assert(model.meshes?.length, entry.id + ': no meshes');
    for (const ext of model.extensionsRequired ?? []) assert(!unsupported.has(ext), entry.id + ': unsupported required extension ' + ext);
    for (const item of [...(model.buffers ?? []), ...(model.images ?? [])]) assert(!item.uri || item.uri.startsWith('data:'), entry.id + ': external dependency');
    console.log(entry.name + ': ' + (received / 1048576).toFixed(1) + ' MB, ' + model.meshes.length + ' mesh definitions, GLB valid');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
console.log('Validated ' + ids.size + ' pinned product GLB files.');
