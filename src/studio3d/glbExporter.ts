import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function exportSceneToGlb(sceneOrGroup: THREE.Object3D, fileName: string = 'product_model.glb', animations: THREE.AnimationClip[] = []): Promise<void> {
  const exporter = new GLTFExporter();

  // Hide viewport-only effects (e.g. the LED glow halo) so they stay out of the file
  const hidden: THREE.Object3D[] = [];
  sceneOrGroup.traverse((obj) => {
    if (obj.userData.exportExclude && obj.visible) {
      obj.visible = false;
      hidden.push(obj);
    }
  });
  const restore = () => hidden.forEach((obj) => (obj.visible = true));

  return new Promise((resolve, reject) => {
    exporter.parse(
      sceneOrGroup,
      (gltf) => {
        restore();
        try {
          const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = fileName.endsWith('.glb') ? fileName : `${fileName}.glb`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      (error) => {
        restore();
        reject(error);
      },
      { binary: true, onlyVisible: true, animations }
    );
  });
}
