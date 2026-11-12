import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import decoderJs from 'three/examples/jsm/libs/draco/gltf/draco_decoder.js?url';
import decoderWasm from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url';
import wrapperJs from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url';

// A dedicated manager resolves only bundled decoder assets, never model URLs.
export function createLocalDracoLoader(): DRACOLoader {
  const assets: Record<string, string> = {
    'draco_decoder.js': decoderJs,
    'draco_decoder.wasm': decoderWasm,
    'draco_wasm_wrapper.js': wrapperJs,
  };
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const asset = assets[url];
    if (!asset) throw new Error('Unknown Draco decoder asset');
    return asset;
  });
  return new DRACOLoader(manager).setWorkerLimit(2);
}
