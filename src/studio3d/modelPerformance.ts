import * as THREE from 'three';

export type PreviewQuality = 'eco' | 'balanced' | 'high';
export type QualityMode = PreviewQuality | 'auto';
export const PREVIEW_PROFILES = {
  eco: { pixelRatio: 0.85, shadows: false, bloom: false, softboxes: false },
  balanced: { pixelRatio: 1, shadows: true, bloom: false, softboxes: false },
  high: { pixelRatio: 2, shadows: true, bloom: true, softboxes: true },
} as const;

export interface ModelBudget {
  textureCount: number;
  estimatedTextureBytes: number;
  largestTexture: number;
  geometryBytes: number;
  triangles: number;
}

export function collectTextures(root: THREE.Object3D): THREE.Texture[] {
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  return [...textures];
}

function imageSize(texture: THREE.Texture): { width: number; height: number } {
  const image = texture.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | undefined;
  return { width: image?.naturalWidth || image?.width || 0, height: image?.naturalHeight || image?.height || 0 };
}

export function estimateModelBudget(root: THREE.Object3D): ModelBudget {
  const buffers = new Set<ArrayBufferLike>();
  let triangles = 0;
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const geometry = node.geometry;
    const count = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
    triangles += Math.floor(count / 3) * (node instanceof THREE.InstancedMesh ? node.count : 1);
    const attributes = [...Object.values(geometry.attributes), ...Object.values(geometry.morphAttributes).flat()];
    if (geometry.index) attributes.push(geometry.index);
    for (const attribute of attributes) {
      if (!attribute) continue;
      const array = attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.array : attribute.array;
      buffers.add(array.buffer);
    }
  });
  const textures = collectTextures(root);
  let estimatedTextureBytes = 0;
  let largestTexture = 0;
  for (const texture of textures) {
    const { width, height } = imageSize(texture);
    largestTexture = Math.max(largestTexture, width, height);
    // Conservative RGBA8 estimate with mip overhead; not actual VRAM telemetry.
    estimatedTextureBytes += Math.ceil(width * height * 4 * (texture.generateMipmaps ? 4 / 3 : 1));
  }
  return { textureCount: textures.length, estimatedTextureBytes, largestTexture,
    geometryBytes: [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0), triangles };
}

export function recommendQuality(budget: ModelBudget): PreviewQuality {
  const mb = 1024 * 1024;
  if (budget.triangles > 500_000 || budget.estimatedTextureBytes > 256 * mb || budget.geometryBytes > 128 * mb) return 'eco';
  if (budget.triangles > 100_000 || budget.estimatedTextureBytes > 64 * mb || budget.largestTexture > 2048) return 'balanced';
  return 'high';
}

export function scaledTextureSize(width: number, height: number, limit: number) {
  const factor = Math.min(1, limit / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * factor)), height: Math.max(1, Math.round(height * factor)) };
}

// Explicitly changes the model's exported textures; no geometry or UV mutation.
export function downscaleModelTextures(root: THREE.Object3D, limit = 2048): number {
  let count = 0;
  const canvases = new Map<THREE.Source, HTMLCanvasElement>();
  const oldImages = new Set<ImageBitmap>();
  for (const texture of collectTextures(root)) {
    if (texture instanceof THREE.CompressedTexture || texture instanceof THREE.DataTexture || texture instanceof THREE.CubeTexture) continue;
    const { width, height } = imageSize(texture);
    if (!width || !height || Math.max(width, height) <= limit) continue;
    const image = texture.image as CanvasImageSource;
    let canvas = canvases.get(texture.source);
    if (!canvas) {
      canvas = document.createElement('canvas');
      const size = scaledTextureSize(width, height, limit);
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable for texture optimization.');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvases.set(texture.source, canvas);
    }
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) oldImages.add(image);
    texture.source = new THREE.Source(canvas);
    texture.needsUpdate = true;
    count++;
  }
  const remaining = new Set(collectTextures(root).map((texture) => texture.image));
  for (const image of oldImages) if (!remaining.has(image)) image.close();
  return count;
}
