import * as THREE from 'three';

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'alphaMap',
  'envMap',
  'clearcoatMap',
] as const;

/**
 * Releases GPU resources (geometries, materials, textures) held by an object tree.
 * Call before discarding a mesh group; three.js does not free these automatically.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    // Sprites share one internal geometry across the app; only dispose real mesh geometry.
    if (mesh.geometry && !(obj instanceof THREE.Sprite)) mesh.geometry.dispose();

    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const mat of materials) {
      for (const key of TEXTURE_KEYS) {
        const tex = (mat as unknown as Record<string, unknown>)[key];
        if (tex instanceof THREE.Texture) tex.dispose();
      }
      mat.dispose();
    }
  });
}
