import * as THREE from 'three';

export const MAP_CHANNELS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const;
export type MapChannel = typeof MAP_CHANNELS[number];
export interface MaterialEntry {
  id: string;
  name: string;
  meshes: string[];
  material: THREE.MeshStandardMaterial;
}

export function inspectMaterials(root: THREE.Object3D): MaterialEntry[] {
  const entries = new Map<string, MaterialEntry>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      let entry = entries.get(material.uuid);
      if (!entry) {
        entry = { id: material.uuid, name: material.name || 'Material ' + (entries.size + 1), meshes: [], material };
        entries.set(material.uuid, entry);
      }
      const mesh = node.name || node.uuid;
      if (!entry.meshes.includes(mesh)) entry.meshes.push(mesh);
    }
  });
  return [...entries.values()];
}

export async function replaceMaterialMap(
  root: THREE.Object3D, material: THREE.MeshStandardMaterial, channel: MapChannel, file: File,
  isCurrent: () => boolean = () => true
): Promise<void> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use PNG, JPEG or WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Texture exceeds 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to decode texture.'));
      img.src = url;
    });
    if (Math.max(image.naturalWidth, image.naturalHeight) > 4096) throw new Error('Maximum texture size is 4096 pixels per side.');
    if (!isCurrent()) return;
    const old = material[channel];
    // Preserve UV transform, sampler, and UV channel from the original map.
    const texture = old ? old.clone() : new THREE.Texture();
    // Clones share Source objects; replace the Source rather than mutating it.
    texture.source = new THREE.Source(image);
    texture.flipY = false;
    texture.colorSpace = channel === 'map' || channel === 'emissiveMap' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.needsUpdate = true;
    material[channel] = texture;
    material.needsUpdate = true;
    if (old) {
      let used = false;
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
          if (Object.values(mat).includes(old)) used = true;
        }
      });
      if (!used) old.dispose();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
