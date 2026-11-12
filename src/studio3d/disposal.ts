import * as THREE from 'three';

/** Dispose each shared resource once. Close decoded image bitmaps only for a
 * caller-owned imported scene, never for globally shared procedural assets. */
export function disposeObject3D(root: THREE.Object3D, closeBitmaps = false): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  const images = new Set<ImageBitmap>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !(obj instanceof THREE.Sprite)) geometries.add(mesh.geometry);
    if (obj instanceof THREE.SkinnedMesh) skeletons.add(obj.skeleton);
    for (const mat of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) {
    if (closeBitmaps && typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) images.add(texture.image);
    texture.dispose();
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
  for (const image of images) image.close();
}
