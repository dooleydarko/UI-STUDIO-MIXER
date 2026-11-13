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
  for (const name of ['disposal', 'glbLoader', 'glbTextureSwapper', 'modelPerformance', 'detailedProducts', 'surfaceEditing']) {
    const source = await readFile(path.join(process.cwd(), 'src/studio3d', name + '.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    }).outputText.replace(/from ['"]\.\/disposal['"]/g, "from './disposal.mjs'");
    await writeFile(path.join(temp, name + '.mjs'), compiled);
  }
  const { normalizeModel, loadStudioModel, releaseStudioModel } = await import(pathToFileURL(path.join(temp, 'glbLoader.mjs')));
  const { inspectMaterials } = await import(pathToFileURL(path.join(temp, 'glbTextureSwapper.mjs')));

  const { estimateModelBudget, recommendQuality, scaledTextureSize } = await import(pathToFileURL(path.join(temp, 'modelPerformance.mjs')));

  const { GrayOutSession, neutralizePixels, inspectSurfaces } = await import(pathToFileURL(path.join(temp, 'surfaceEditing.mjs')));

  await test('gray out pixel neutralization preserves transparency and supports intensity', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 0, 100, 120, 140, 180]);
    neutralizePixels(data, [200, 200, 200], .5);
    assert.deepEqual([...data], [105, 110, 115, 0, 150, 160, 170, 180]);
    neutralizePixels(data, [64, 64, 64], 1);
    assert.deepEqual([...data], [64,64,64,0,64,64,64,180]);
  });

  await test('gray out restores untextured PBR color without changing physical channels or geometry', () => {
    const root = new THREE.Group();
    const normal = new THREE.Texture();
    const roughnessMap = new THREE.Texture();
    const mat = new THREE.MeshPhysicalMaterial({ color: '#123456', normalMap: normal, roughnessMap, roughness: .4, metalness: .7, opacity: .6, transparent: true, clearcoat: .5 });
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, mat);
    root.add(mesh);
    const original = mat.color.clone();
    const session = new GrayOutSession();
    session.apply([mat], '#bbbbbb', 1);
    assert(session.active);
    assert.equal(mat.color.getHexString(), 'bbbbbb');
    assert.equal(mat.normalMap, normal);
    assert.equal(mat.roughnessMap, roughnessMap);
    assert.equal(mat.roughness, .4);
    assert.equal(mat.metalness, .7);
    assert.equal(mat.clearcoat, .5);
    assert.equal(mat.opacity, .6);
    assert.equal(mat.transparent, true);
    assert.equal(mesh.geometry, geometry);
    session.restoreAll();
    assert(!session.active);
    assert(mat.color.equals(original));
    geometry.dispose(); mat.dispose(); normal.dispose(); roughnessMap.dispose();
  });

  await test('gray out replaces only base color source and restores shared texture references', () => {
    const image = { width: 1, height: 1 };
    const base = new THREE.Texture(image);
    base.offset.set(.2,.3); base.channel = 1; base.flipY = false;
    base.colorSpace = THREE.SRGBColorSpace;
    const first = new THREE.MeshStandardMaterial({ map: base, normalMap: base, color: '#123456' });
    const other = new THREE.MeshStandardMaterial({ map: base });
    const pixels = new Uint8ClampedArray([30,40,50,90]);
    const previous = globalThis.document;
    globalThis.document = { createElement: () => ({ getContext: () => ({
      drawImage() {}, getImageData: () => ({ data: pixels }), putImageData() {},
    }) }) };
    const session = new GrayOutSession();
    try {
      session.apply([first], '#888888', 1);
      assert.notEqual(first.map, base);
      assert.notEqual(first.map.source, base.source);
      assert.equal(first.map.channel, 1);
      assert(first.map.offset.equals(base.offset));
      assert.equal(first.map.flipY, false);
      assert.equal(first.map.colorSpace, base.colorSpace);
      assert.equal(first.normalMap, base);
      assert.equal(other.map, base);
      assert.deepEqual([...pixels], [136,136,136,90]);
      assert.equal(base.image, image);
      session.restoreAll();
      assert.equal(first.map, base);
      assert.equal(first.color.getHexString(), '123456');
    } finally {
      session.restoreAll();
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
      first.dispose(); other.dispose(); base.dispose();
    }
  });

  await test('surface hierarchy exposes nested meshes, UV sets and material slots', () => {
    const root = new THREE.Group();
    const group = new THREE.Group(); group.name = 'Packaging';
    const geo = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geo, material); mesh.name = 'Cover';
    group.add(mesh); root.add(group);
    const items = inspectSurfaces(root);
    assert.equal(items.length, 3);
    assert.equal(items[2].depth, 2);
    assert.equal(items[2].name, 'Cover');
    assert.deepEqual(items[2].materials, [material.uuid]);
    assert(items[2].uvSets.includes('uv'));
    assert.equal(items[2].groups, geo.groups.length);
    geo.dispose(); material.dispose();
  });

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

  const { createDetailedProduct, DETAIL_PRESETS } = await import(pathToFileURL(path.join(temp, 'detailedProducts.mjs')));
  await test('all five detailed product presets contain finite geometry and independent named materials', () => {
    for (const preset of Object.keys(DETAIL_PRESETS)) {
      const zones = DETAIL_PRESETS[preset].zones;
      const zone = Object.keys(zones)[0];
      const project = { preset, state: { showWireframe: false }, materialZones: { [zone]: { color: '#ff0000', roughness: .31, metalness: .4 } } };
      const group = createDetailedProduct(project);
      assert(group);
      const bounds = new THREE.Box3().setFromObject(group);
      assert(!bounds.isEmpty());
      assert(Number.isFinite(bounds.max.y));
      const entries = inspectMaterials(group);
      assert(entries.length >= 3);
      const material = entries.find(e=>e.name === zone).material;
      assert.equal(material.color.getHexString(), 'ff0000');
      assert.equal(material.roughness, .31);
      assert.equal(material.metalness, .4);
      const geometry = new Set(), mats = new Set();
      group.traverse(obj => { if (obj.isMesh) {geometry.add(obj.geometry); mats.add(obj.material);} });
      for (const g of geometry) g.dispose();
      for (const m of mats) m.dispose();
    }
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
