import * as THREE from 'three';
import { DecalTransform } from '../types';

const LABEL_CANVAS_WIDTH = 1536; // 2:1 matches the unrolled surface of can/bottle bodies
const LABEL_CANVAS_HEIGHT = 768;

export interface LabelTextureOptions {
  baseColor: string;
  image: HTMLImageElement;
  decal: DecalTransform;
}

/**
 * Composes the product's color map on a 2D canvas: the base color as the
 * background with the uploaded artwork drawn on top, placed per the decal
 * settings. The canvas becomes a texture mapped through the mesh's own UVs,
 * so there is no extra geometry and no z-fighting.
 *
 * wrapMode:
 * - 'cylindrical': one label centred on the front of the body (u = 0.5, opposite the UV seam)
 * - 'repeat': the label tiled across the whole surface
 * - 'clamp': the artwork stretched to cover the whole surface once
 */
export function createLabelTexture({ baseColor, image, decal }: LabelTextureOptions): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CANVAS_WIDTH;
  canvas.height = LABEL_CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;
  const aspect = image.naturalWidth / Math.max(1, image.naturalHeight);

  // Label footprint at scale 1: fits within half the circumference and 80% of the height
  const maxW = W * 0.5;
  const maxH = H * 0.8;
  let labelW = maxW;
  let labelH = labelW / aspect;
  if (labelH > maxH) {
    labelH = maxH;
    labelW = labelH * aspect;
  }
  labelW *= decal.scaleX || 1;
  labelH *= decal.scaleY || 1;

  ctx.save();
  ctx.globalAlpha = decal.opacity ?? 1;

  if (decal.wrapMode === 'clamp') {
    ctx.drawImage(image, 0, 0, W, H);
  } else if (decal.wrapMode === 'repeat') {
    const stepX = Math.max(8, labelW);
    const stepY = Math.max(8, labelH);
    const angle = ((decal.rotation || 0) * Math.PI) / 180;
    ctx.translate(W / 2 + (decal.positionX || 0) * W, H / 2 - (decal.positionY || 0) * H);
    ctx.rotate(angle);
    const reach = Math.hypot(W, H);
    for (let y = -reach; y <= reach; y += stepY) {
      for (let x = -reach; x <= reach; x += stepX) {
        ctx.drawImage(image, x, y, stepX, stepY);
      }
    }
  } else {
    // 'cylindrical'
    ctx.translate(W / 2 + (decal.positionX || 0) * W, H / 2 - (decal.positionY || 0) * H);
    ctx.rotate(((decal.rotation || 0) * Math.PI) / 180);
    ctx.drawImage(image, -labelW / 2, -labelH / 2, labelW, labelH);
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; // cylinder seam is continuous in u
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}
