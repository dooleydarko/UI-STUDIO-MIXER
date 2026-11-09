import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Product3DProject } from '../types';
import { createProductMeshGroup } from './proceduralModels';

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 25;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xf59e0b, 0.3);
    fillLight.position.set(0, -2, 4);
    scene.add(fillLight);

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

      if (productGroupRef.current && project.state.rotationActive) {
        productGroupRef.current.rotation.y += 0.006 * project.state.rotationSpeed;
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update product mesh when project or decal changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (productGroupRef.current) {
      scene.remove(productGroupRef.current);
    }

    let decalTex: THREE.Texture | null = null;
    if (decalDataUrl) {
      const loader = new THREE.TextureLoader();
      decalTex = loader.load(decalDataUrl);
      decalTex.wrapS = THREE.RepeatWrapping;
      decalTex.wrapT = THREE.ClampToEdgeWrapping;
    }

    const newGroup = createProductMeshGroup(project, decalTex);
    productGroupRef.current = newGroup;
    scene.add(newGroup);

    if (onSceneReady) {
      onSceneReady(newGroup);
    }
  }, [project, decalDataUrl, onSceneReady]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
