import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeObject3D } from './disposal';

export interface ImportedStudioModel {
  name: string;
  scene: THREE.Group;
  display: THREE.Group;
  clips: THREE.AnimationClip[];
  mixer: THREE.AnimationMixer;
  meshCount: number;
  triangles: number;
}

export function normalizeModel(scene: THREE.Group): THREE.Group {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (bounds.isEmpty() || !Number.isFinite(extent) || extent <= 0) {
    throw new Error('Model contains no valid visible geometry.');
  }
  // Keep source transforms and animation bindings intact. Only normalize the wrapper.
  const display = new THREE.Group();
  const scale = 2.2 / extent;
  display.scale.setScalar(scale);
  display.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  display.add(scene);
  return display;
}

export async function loadStudioModel(file: File): Promise<ImportedStudioModel> {
  if (!/\.(glb|gltf)$/i.test(file.name)) throw new Error('Choose a GLB or self-contained glTF file.');
  if (file.size > 100 * 1024 * 1024) throw new Error('Model exceeds the 100 MB import limit. Optimize it first.');
  const manager = new THREE.LoadingManager();
  // Local imports must not silently request external network resources.
  manager.setURLModifier((url) => {
    if (/^(data:|blob:)/i.test(url)) return url;
    throw new Error('External resources are not supported. Export a self-contained GLB.');
  });
  const gltf = await new GLTFLoader(manager).parseAsync(await file.arrayBuffer(), '');
  try {
    let meshCount = 0;
    let triangles = 0;
    gltf.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      meshCount++;
      const count = node.geometry.index?.count ?? node.geometry.attributes.position?.count ?? 0;
      triangles += Math.floor(count / 3);
      node.castShadow = true;
      node.receiveShadow = true;
    });
    if (!meshCount) throw new Error('No meshes found.');
    return { name: file.name, scene: gltf.scene, display: normalizeModel(gltf.scene),
      clips: gltf.animations, mixer: new THREE.AnimationMixer(gltf.scene), meshCount, triangles };
  } catch (error) {
    disposeObject3D(gltf.scene);
    throw error;
  }
}

export function releaseStudioModel(model: ImportedStudioModel): void {
  model.mixer.stopAllAction();
  model.mixer.uncacheRoot(model.scene);
  model.display.removeFromParent();
  disposeObject3D(model.scene);
}
