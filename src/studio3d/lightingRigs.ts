import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { LightingPreset } from '../types';

export interface StudioLights {
  ambient: THREE.AmbientLight;
  main: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Large front-left softbox: gives broad highlights on curved surfaces. */
  softboxKey: THREE.RectAreaLight;
  /** Tall rear-right strip: draws the long edge streak on cans and chrome. */
  softboxStrip: THREE.RectAreaLight;
}

interface LightRig {
  label: string;
  backdrop: { top: string; bottom: string };
  ambient: { color: number; intensity: number };
  main: { color: number; intensity: number };
  rim: { color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
  softboxKey: { color: number; intensity: number };
  softboxStrip: { color: number; intensity: number };
  /** Base reflection strength (scene.environmentIntensity) for this rig. */
  envMapIntensity: number;
}

export const LIGHTING_RIGS: Record<LightingPreset, LightRig> = {
  studio: {
    label: 'Studio Soft',
    backdrop: { top: '#1b1f27', bottom: '#050506' },
    ambient: { color: 0xffffff, intensity: 0.15 },
    main: { color: 0xffffff, intensity: 1.1 },
    rim: { color: 0x38bdf8, intensity: 0.6 },
    hemi: { sky: 0xdfe8ff, ground: 0x1a1a1f, intensity: 0.5 },
    softboxKey: { color: 0xffffff, intensity: 5 },
    softboxStrip: { color: 0xffffff, intensity: 6 },
    envMapIntensity: 1.0,
  },
  neon: {
    label: 'Neon Cyber',
    backdrop: { top: '#1d0b3d', bottom: '#05030a' },
    ambient: { color: 0x1e1b4b, intensity: 0.3 },
    main: { color: 0xec4899, intensity: 1.2 },
    rim: { color: 0x06b6d4, intensity: 1.5 },
    hemi: { sky: 0x8b5cf6, ground: 0x0b0620, intensity: 0.5 },
    softboxKey: { color: 0xec4899, intensity: 4 },
    softboxStrip: { color: 0x06b6d4, intensity: 7 },
    envMapIntensity: 0.6,
  },
  daylight: {
    label: 'Daylight',
    backdrop: { top: '#3d5f8c', bottom: '#0f172a' },
    ambient: { color: 0xe0f2fe, intensity: 0.5 },
    main: { color: 0xfffbeb, intensity: 1.8 },
    rim: { color: 0x7dd3fc, intensity: 0.5 },
    hemi: { sky: 0xbfe3ff, ground: 0x3a3226, intensity: 0.9 },
    softboxKey: { color: 0xfff4e0, intensity: 4 },
    softboxStrip: { color: 0xffffff, intensity: 3 },
    envMapIntensity: 1.2,
  },
  dramatic_rim: {
    label: 'Dramatic Rim',
    backdrop: { top: '#0b0b12', bottom: '#000000' },
    ambient: { color: 0xffffff, intensity: 0.05 },
    main: { color: 0xffffff, intensity: 0.4 },
    rim: { color: 0x38bdf8, intensity: 2.2 },
    hemi: { sky: 0x223344, ground: 0x000000, intensity: 0.2 },
    softboxKey: { color: 0xffffff, intensity: 1 },
    softboxStrip: { color: 0x38bdf8, intensity: 9 },
    envMapIntensity: 0.35,
  },
};

let uniformsReady = false;

/** Adds the full studio light set to the scene. Call once per scene. */
export function createStudioLights(scene: THREE.Scene): StudioLights {
  // RectAreaLight needs its LTC lookup tables registered before first render.
  if (!uniformsReady) {
    RectAreaLightUniformsLib.init();
    uniformsReady = true;
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);

  const main = new THREE.DirectionalLight(0xffffff, 1.1);
  main.position.set(5, 8, 5);
  main.castShadow = true;
  main.shadow.mapSize.set(1024, 1024);
  main.shadow.camera.near = 0.5;
  main.shadow.camera.far = 25;
  main.shadow.bias = -0.001;

  const rim = new THREE.DirectionalLight(0x38bdf8, 0.6);
  rim.position.set(-6, 4, -5);

  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x1a1a1f, 0.5);

  const softboxKey = new THREE.RectAreaLight(0xffffff, 5, 3, 2.2);
  softboxKey.position.set(-3.5, 3.6, 3.5);
  softboxKey.lookAt(0, 1, 0);

  const softboxStrip = new THREE.RectAreaLight(0xffffff, 6, 0.8, 4);
  softboxStrip.position.set(4, 2.4, -3);
  softboxStrip.lookAt(0, 1.2, 0);

  scene.add(ambient, main, rim, hemi, softboxKey, softboxStrip);
  return { ambient, main, rim, hemi, softboxKey, softboxStrip };
}

/** Vertical gradient used as the scene backdrop. */
export function createGradientBackdrop(top: string, bottom: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface ApplyRigOptions {
  preset: LightingPreset;
  /** User multiplier on the rig's base reflection strength (1 = rig default). */
  reflectionStrength: number;
  /** Eco quality turns the GPU-heavy softboxes off. */
  softboxesEnabled: boolean;
}

/** Applies a lighting preset to existing lights, backdrop and reflections. */
export function applyLightingRig(scene: THREE.Scene, lights: StudioLights, options: ApplyRigOptions): void {
  const rig = LIGHTING_RIGS[options.preset] ?? LIGHTING_RIGS.studio;

  lights.ambient.color.setHex(rig.ambient.color);
  lights.ambient.intensity = rig.ambient.intensity;
  lights.main.color.setHex(rig.main.color);
  lights.main.intensity = rig.main.intensity;
  lights.rim.color.setHex(rig.rim.color);
  lights.rim.intensity = rig.rim.intensity;
  lights.hemi.color.setHex(rig.hemi.sky);
  lights.hemi.groundColor.setHex(rig.hemi.ground);
  lights.hemi.intensity = rig.hemi.intensity;

  lights.softboxKey.color.setHex(rig.softboxKey.color);
  lights.softboxKey.intensity = rig.softboxKey.intensity;
  lights.softboxKey.visible = options.softboxesEnabled;
  lights.softboxStrip.color.setHex(rig.softboxStrip.color);
  lights.softboxStrip.intensity = rig.softboxStrip.intensity;
  lights.softboxStrip.visible = options.softboxesEnabled;

  scene.environmentIntensity = rig.envMapIntensity * options.reflectionStrength;

  const previous = scene.background;
  scene.background = createGradientBackdrop(rig.backdrop.top, rig.backdrop.bottom);
  if (previous instanceof THREE.Texture) previous.dispose();
}
