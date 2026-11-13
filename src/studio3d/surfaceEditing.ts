import * as THREE from 'three';

export interface SurfaceEntry {
  id: string;
  name: string;
  depth: number;
  kind: string;
  materials: string[];
  uvSets: string[];
  groups: number;
}

/** Read-only hierarchy; imported node transforms and geometry are never rebuilt. */
export function inspectSurfaces(root: THREE.Object3D): SurfaceEntry[] {
  const entries: SurfaceEntry[] = [];
  function visit(node: THREE.Object3D, depth: number) {
    const mesh = node instanceof THREE.Mesh ? node : undefined;
    entries.push({ id: node.uuid, name: node.name || node.type, depth, kind: node.type,
      materials: mesh ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => m.uuid) : [],
      uvSets: mesh ? Object.keys(mesh.geometry.attributes).filter(k => /^uv\d*$/.test(k)) : [],
      groups: mesh?.geometry.groups.length ?? 0 });
    node.children.forEach(child => visit(child, depth + 1));
  }
  visit(root, 0);
  return entries;
}

export function neutralizePixels(data: Uint8ClampedArray, rgb: readonly number[], strength: number): void {
  const amount = Math.max(0, Math.min(1, strength));
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) data[i+c] = Math.round(data[i+c] * (1-amount) + rgb[c] * amount);
    // Never change alpha: preserve cutouts, opacity and alpha blending.
  }
}

type Original = { map: THREE.Texture | null; color: THREE.Color; generated: THREE.Texture | null };
export class GrayOutSession {
  private originals = new Map<THREE.MeshStandardMaterial, Original>();
  get active() { return this.originals.size > 0; }

  apply(materials: THREE.MeshStandardMaterial[], hex: string, strength: number): void {
    if (!/^#[0-9a-f]{6}$/i.test(hex) || !Number.isFinite(strength)) throw new Error('Invalid neutral color or strength.');
    const amount = Math.max(0, Math.min(1, strength));
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
    const target = new THREE.Color(hex);
    // Prepare all replacements before modifying any material, so errors are atomic.
    const prepared: { material: THREE.MeshStandardMaterial; original: Original; next: THREE.Texture | null; color: THREE.Color }[] = [];
    try {
      for (const material of new Set(materials)) {
        const original = this.originals.get(material) ?? { map: material.map, color: material.color.clone(), generated: null };
        let next: THREE.Texture | null = original.map;
        let color = original.color.clone().lerp(target, amount);
        if (original.map && amount > 0) {
          const image = original.map.image;
          const width = image?.naturalWidth || image?.videoWidth || image?.width;
          const height = image?.naturalHeight || image?.videoHeight || image?.height;
          if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216 || original.map instanceof THREE.DataTexture || original.map instanceof THREE.CompressedTexture)
            throw new Error('Base-color image is unsupported or too large for Gray Out. Use a compatible image or optimize first.');
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas unavailable.');
          ctx.drawImage(image, 0, 0, width, height);
          const pixels = ctx.getImageData(0, 0, width, height);
          neutralizePixels(pixels.data, rgb, amount);
          ctx.putImageData(pixels, 0, 0);
          next = original.map.clone();
          next.source = new THREE.Source(canvas);
          next.needsUpdate = true;
          color = original.color.clone().lerp(new THREE.Color(0xffffff), amount);
        }
        prepared.push({ material, original, next, color });
      }
    } catch (error) {
      for (const p of prepared) if (p.next && p.next !== p.original.map) p.next.dispose();
      throw error;
    }
    // Restore targets removed from the selected scope.
    const selected = new Set(materials);
    for (const material of [...this.originals.keys()]) if (!selected.has(material)) this.restore(material);
    for (const { material, original, next, color } of prepared) {
      original.generated?.dispose();
      original.generated = next !== original.map ? next : null;
      this.originals.set(material, original);
      material.map = next;
      material.color.copy(color);
      material.needsUpdate = true;
    }
  }

  private restore(material: THREE.MeshStandardMaterial): void {
    const original = this.originals.get(material);
    if (!original) return;
    material.map = original.map;
    material.color.copy(original.color);
    material.needsUpdate = true;
    original.generated?.dispose();
    this.originals.delete(material);
  }

  restoreAll(): void {
    for (const material of [...this.originals.keys()]) this.restore(material);
  }
}
