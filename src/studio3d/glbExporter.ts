import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function encodeSceneGlb(sceneOrGroup: THREE.Object3D, animations: THREE.AnimationClip[] = []): Promise<Blob> {
  const hidden: THREE.Object3D[] = [];
  sceneOrGroup.traverse(obj => {
    if (obj.userData.exportExclude && obj.visible) { obj.visible = false; hidden.push(obj); }
  });
  try {
    const result = await new GLTFExporter().parseAsync(sceneOrGroup, { binary: true, onlyVisible: true, animations });
    if (!(result instanceof ArrayBuffer)) throw new Error('Expected binary GLB export.');
    return new Blob([result], { type: 'model/gltf-binary' });
  } finally { hidden.forEach(obj => { obj.visible = true; }); }
}

export async function exportSceneToGlb(sceneOrGroup: THREE.Object3D, fileName = 'product_model.glb', animations: THREE.AnimationClip[] = []): Promise<void> {
  const blob = await encodeSceneGlb(sceneOrGroup, animations);
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName.endsWith('.glb') ? fileName : fileName + '.glb';
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
