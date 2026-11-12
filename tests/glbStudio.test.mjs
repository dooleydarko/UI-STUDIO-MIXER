import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

// Compile only the targeted modules, preserving normal package resolution.
const temp = await mkdtemp(path.join(process.cwd(), '.glb-test-'));
try {
  for (const name of ['disposal', 'glbLoader', 'glbTextureSwapper', 'modelPerformance']) {
    const source = await readFile(path.join(process.cwd(), 'src/studio3d', name + '.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    }).outputText.replace(/from ['"]\.\/disposal['"]/g, "from './disposal.mjs'");
    await writeFile(path.join(temp, name + '.mjs'), compiled);
  }
  const { normalizeModel, loadStudioModel, releaseStudioModel } = await import(pathToFileURL(path.join(temp, 'glbLoader.mjs')));
  const { inspectMaterials } = await import(pathToFileURL(path.join(temp, 'glbTextureSwapper.mjs')));

  const { estimateModelBudget, recommendQuality, scaledTextureSize } = await import(pathToFileURL(path.join(temp, 'modelPerformance.mjs')));

  await test('model budget counts shared buffers and textures once', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture({ width: 4096, height: 2048 });
    const material = new THREE.MeshStandardMaterial({ map: texture });
    root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
    const budget = estimateModelBudget(root);
    assert.equal(budget.textureCount, 1);
    assert.equal(budget.triangles, 24);
    assert.equal(budget.largestTexture, 4096);
    assert.equal(recommendQuality(budget), 'balanced');
    assert.equal(recommendQuality({ ...budget, triangles: 600000 }), 'eco');
    assert.deepEqual(scaledTextureSize(4096, 2048, 2048), { width: 2048, height: 1024 });
    assert.deepEqual(scaledTextureSize(512, 256, 2048), { width: 512, height: 256 });
    geometry.dispose(); material.dispose(); texture.dispose();
  });

  await test('normalizes a displaced model without changing source transforms', () => {
    const root = new THREE.Group();
    root.position.set(7, -4, 3);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 8), new THREE.MeshStandardMaterial());
    root.add(mesh);
    const original = root.position.clone();
    const display = normalizeModel(root);
    display.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(display);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    assert(Math.abs(size.z - 2.2) < 1e-6);
    assert(Math.abs(bounds.min.y) < 1e-6);
    assert(Math.abs(center.x) < 1e-6 && Math.abs(center.z) < 1e-6);
    assert(root.position.equals(original));
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  await test('rejects empty model bounds and unsupported files', async () => {
    assert.throws(() => normalizeModel(new THREE.Group()), /no valid/i);
    await assert.rejects(loadStudioModel(new File(['bad'], 'bad.obj')), /GLB/);
  });

  await test('deduplicates shared materials without modifying mesh geometry', () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ name: 'Logo' });
    const geometry = new THREE.BoxGeometry();
    const a = new THREE.Mesh(geometry, material);
    const b = new THREE.Mesh(geometry, [material, new THREE.MeshPhysicalMaterial({ name: 'Trim' })]);
    a.name = 'Front'; b.name = 'Back';
    root.add(a, b);
    const entries = inspectMaterials(root);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0].meshes, ['Front', 'Back']);
    assert.equal(entries[0].material, material);
    assert.equal(a.geometry, geometry);
    geometry.dispose(); material.dispose(); b.material[1].dispose();
  });

  await test('imports a real binary GLB triangle and releases its resources', async () => {
    const json = {
      asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [1,1,0] }],
    };
    const data = Buffer.from(JSON.stringify(json));
    const jsonSize = Math.ceil(data.length / 4) * 4;
    const buffer = Buffer.alloc(12 + 8 + jsonSize + 8 + 36);
    buffer.writeUInt32LE(0x46546c67, 0);
    buffer.writeUInt32LE(2, 4);
    buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(jsonSize, 12);
    buffer.writeUInt32LE(0x4e4f534a, 16);
    buffer.fill(0x20, 20, 20 + jsonSize);
    data.copy(buffer, 20);
    const binOffset = 20 + jsonSize;
    buffer.writeUInt32LE(36, binOffset);
    buffer.writeUInt32LE(0x004e4942, binOffset + 4);
    [0,0,0,1,0,0,0,1,0].forEach((value, i) => buffer.writeFloatLE(value, binOffset + 8 + 4*i));
    const model = await loadStudioModel(new File([buffer], 'triangle.glb'));
    assert.equal(model.meshCount, 1);
    assert.equal(model.triangles, 1);
    assert.equal(model.clips.length, 0);
    releaseStudioModel(model);
  });
} finally {
  await rm(temp, { recursive: true, force: true });
}
