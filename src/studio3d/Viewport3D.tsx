import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Product3DProject } from '../types';
import { createProductMeshGroup } from './proceduralModels';
import { disposeObject3D } from './disposal';
import { createStudioLights, applyLightingRig, StudioLights } from './lightingRigs';
import { createLabelTexture } from './labelTexture';
import { StorageManager } from '../storage/storageManager';

interface Viewport3DProps {
  project: Product3DProject;
  decalDataUrl?: string | null;
  onSceneReady?: (group: THREE.Group) => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  project,
  decalDataUrl,
  onSceneReady,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const productGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const projectRef = useRef<Product3DProject>(project);
  const lightsRef = useRef<StudioLights | null>(null);

  const onSceneReadyRef = useRef(onSceneReady);
  const decalImageRef = useRef<{ url: string; image: HTMLImageElement | null } | null>(null);
  const [imageVersion, setImageVersion] = useState(0);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    onSceneReadyRef.current = onSceneReady;
  }, [onSceneReady]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060606);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(3.2, 2.5, 4.2);

    // 3. Renderer with antialiasing and shadow maps
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    mount.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't go completely below floor
    controlsRef.current = controls;

    // 5. Lighting setup
    // Procedural studio environment (no downloaded HDRI) so metals have something to reflect
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    // Full studio set: key/rim directionals, hemisphere fill, two softboxes.
    // Colors, intensities and backdrop are applied by the lighting effect below.
    lightsRef.current = createStudioLights(scene);

    // 6. Contact Shadow Floor Grid
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.45 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Subtle dark circular platform
    const diskGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.02, 64);
    const diskMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.8,
      metalness: 0.2,
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.position.y = -0.01;
    disk.receiveShadow = true;
    scene.add(disk);

    // Resize observer
    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    const animate = () => {
      controls.update();

      const liveState = projectRef.current.state;
      if (productGroupRef.current && liveState.rotationActive) {
        productGroupRef.current.rotation.y += 0.006 * (liveState.rotationSpeed || 1);
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      if (productGroupRef.current) {
        scene.remove(productGroupRef.current);
        disposeObject3D(productGroupRef.current);
        productGroupRef.current = null;
      }
      disposeObject3D(floor);
      disposeObject3D(disk);
      decalImageRef.current = null;
      envTexture.dispose();
      if (scene.background instanceof THREE.Texture) scene.background.dispose();
      renderer.dispose();
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update lighting rig when project.state.lighting changes
  useEffect(() => {
    const lights = lightsRef.current;
    const scene = sceneRef.current;
    if (!lights || !scene) return;

    // Softboxes are the GPU-heavy part; eco quality leaves them off.
    const softboxesEnabled = StorageManager.getInstance().getSettings().performanceMode !== 'eco';
    applyLightingRig(scene, lights, {
      preset: project.state.lighting || 'studio',
      reflectionStrength: project.state.reflectionStrength ?? 1,
      softboxesEnabled,
    });
  }, [project.state.lighting, project.state.reflectionStrength]);

  // Update product mesh when project or decal changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Preserve turntable angle across rebuilds
    let previousRotationY = 0;
    if (productGroupRef.current) {
      previousRotationY = productGroupRef.current.rotation.y;
      scene.remove(productGroupRef.current);
      disposeObject3D(productGroupRef.current);
      productGroupRef.current = null;
    }

    // Load the artwork once per image, then compose a fresh canvas label texture
    // each rebuild so scale/rotation/position/wrap edits apply live.
    let labelTexture: THREE.Texture | null = null;
    if (decalDataUrl && project.decal) {
      const cached = decalImageRef.current;
      if (!cached || cached.url !== decalDataUrl) {
        const image = new Image();
        decalImageRef.current = { url: decalDataUrl, image: null };
        image.onload = () => {
          if (decalImageRef.current?.url === decalDataUrl) {
            decalImageRef.current = { url: decalDataUrl, image };
            setImageVersion((v) => v + 1); // rebuild now that the artwork is decoded
          }
        };
        image.src = decalDataUrl;
      } else if (cached.image) {
        labelTexture = createLabelTexture({
          baseColor: project.material.baseColor,
          image: cached.image,
          decal: project.decal,
        });
      }
    } else {
      decalImageRef.current = null;
    }

    const newGroup = createProductMeshGroup(project, labelTexture);
    newGroup.rotation.y = previousRotationY;
    productGroupRef.current = newGroup;
    scene.add(newGroup);

    // Read via ref: an inline callback prop changes every render and would
    // otherwise retrigger this effect in a rebuild loop.
    onSceneReadyRef.current?.(newGroup);
  }, [project, decalDataUrl, imageVersion]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
