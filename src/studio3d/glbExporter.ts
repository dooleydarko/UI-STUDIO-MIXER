import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function exportSceneToGlb(sceneOrGroup: THREE.Object3D, fileName: string = 'product_model.glb'): Promise<void> {
  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      sceneOrGroup,
      (gltf) => {
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
        reject(error);
      },
      { binary: true }
    );
  });
}
