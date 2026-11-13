import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Product3DProject } from '../types';
import { createProductMeshGroup } from './proceduralModels';
import { disposeObject3D } from './disposal';
import { createStudioLights, applyLightingRig, StudioLights } from './lightingRigs';
import { createLabelTexture } from './labelTexture';
import { StorageManager } from '../storage/storageManager';
import { pickVisibleMesh } from './structuralHistory';
import { PREVIEW_PROFILES, type PreviewQuality } from './modelPerformance';

export interface SurfacePaintTarget {
  material: THREE.MeshStandardMaterial;
  onStroke: (segments: {x:number;y:number}[][]) => void;
}

interface Viewport3DProps {
  project: Product3DProject;
  decalDataUrl?: string | null;
  onSceneReady?: (group: THREE.Group) => void;
  importedGroup?: THREE.Group | null;
  onFrame?: (delta: number) => void;
  quality?: PreviewQuality;
  paintTarget?: SurfacePaintTarget | null;
  selectedMeshId?:string;
  onMeshPick?:(id:string,materialId:string)=>void;
  meshPickEnabled?:boolean;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  project,
  decalDataUrl,
  onSceneReady,
  importedGroup,
  onFrame,
  quality,
  paintTarget, selectedMeshId, onMeshPick, meshPickEnabled,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const productGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const projectRef = useRef<Product3DProject>(project);
  const lightsRef = useRef<StudioLights | null>(null);

  const onSceneReadyRef = useRef(onSceneReady);
  const frameCallbackRef = useRef(onFrame);
  const ownsProductRef = useRef(true);
  const qualityRef = useRef(quality);
  const paintRef = useRef(paintTarget);
  const selectionRef=useRef({selectedMeshId,onMeshPick,meshPickEnabled});
  useEffect(()=>{selectionRef.current={selectedMeshId,onMeshPick,meshPickEnabled};},[selectedMeshId,onMeshPick,meshPickEnabled]);
  useEffect(() => { paintRef.current = paintTarget; if (controlsRef.current) controlsRef.current.enabled = !paintTarget; }, [paintTarget]);
  useEffect(() => { qualityRef.current = quality; }, [quality]);
  useEffect(() => { frameCallbackRef.current = onFrame; }, [onFrame]);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityRef.current ? PREVIEW_PROFILES[qualityRef.current].pixelRatio : 2));
    renderer.shadowMap.enabled = qualityRef.current ? PREVIEW_PROFILES[qualityRef.current].shadows : true;
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
    controls.enabled = !paintRef.current;

    // Paint only the frontmost visible hit of the selected material. UV jumps and
    // misses end a segment instead of drawing a line across unrelated islands.
    const raycaster = new THREE.Raycaster();
    const selectionBox=new THREE.Box3();const selectionHelper=new THREE.Box3Helper(selectionBox,0x60a5fa);selectionHelper.visible=false;selectionHelper.userData.exportExclude=true;scene.add(selectionHelper);
    let drawing: { pointer: number; target: SurfacePaintTarget; segments: {x:number;y:number}[][]; last: {x:number;y:number}|null } | null = null;
    const surfacePoint = (event: PointerEvent, target: SurfacePaintTarget) => {
      const group = productGroupRef.current, map = target.material.map;
      if (!group || !map || map.channel > 1) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1), camera);
      group.updateMatrixWorld(true);
      const hit = raycaster.intersectObject(group, true).find(item => {
        for (let node: THREE.Object3D|null=item.object;node;node=node.parent) if (!node.visible) return false;
        return item.object instanceof THREE.Mesh;
      });
      if (!hit || !(hit.object instanceof THREE.Mesh)) return null;
      const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex ?? 0] : hit.object.material;
      if (material !== target.material) return null;
      const source = map.channel === 1 ? (hit as THREE.Intersection & {uv1?:THREE.Vector2}).uv1 : hit.uv;
      if (!source) return null;
      if (map.matrixAutoUpdate) map.updateMatrix();
      const uv = map.transformUv(source.clone());
      return {x:uv.x,y:uv.y};
    };
    const sample = (event: PointerEvent) => {
      if (!drawing || drawing.pointer !== event.pointerId || paintRef.current !== drawing.target) return;
      const p = surfacePoint(event,drawing.target);
      if (!p) {drawing.last=null;return;}
      if (!drawing.last || Math.hypot(p.x-drawing.last.x,p.y-drawing.last.y)>.12) drawing.segments.push([p]);
      else { const segment=drawing.segments[drawing.segments.length-1]; if(segment.length<10000)segment.push(p); }
      drawing.last=p;
    };
    const paintDown = (event: PointerEvent) => {
      const target=paintRef.current;
      if(!target && event.button===0 && selectionRef.current.meshPickEnabled){
        const group=productGroupRef.current,rect=renderer.domElement.getBoundingClientRect();if(!group||!rect.width||!rect.height)return;
        event.preventDefault();event.stopImmediatePropagation();
        raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
        const hit=pickVisibleMesh(group,raycaster);
        if(hit){const mat=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;selectionRef.current.onMeshPick?.(hit.object.uuid,mat.uuid);}
        else selectionRef.current.onMeshPick?.('','');
        return;
      }
      if(!target || event.button!==0 || drawing) return;
      event.preventDefault(); event.stopImmediatePropagation();
      drawing={pointer:event.pointerId,target,segments:[],last:null};
      renderer.domElement.setPointerCapture(event.pointerId); sample(event);
    };
    const paintMove = (event: PointerEvent) => {
      if(!drawing || drawing.pointer!==event.pointerId)return;
      event.preventDefault();event.stopImmediatePropagation();sample(event);
    };
    const paintEnd = (event: PointerEvent) => {
      if(!drawing || drawing.pointer!==event.pointerId)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(event.type==='pointerup') sample(event);
      const stroke=drawing;drawing=null;
      if(renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      if(event.type==='pointerup' && paintRef.current===stroke.target && stroke.segments.length) stroke.target.onStroke(stroke.segments);
    };
    renderer.domElement.addEventListener('pointerdown',paintDown,true);
    renderer.domElement.addEventListener('pointermove',paintMove,true);
    renderer.domElement.addEventListener('pointerup',paintEnd,true);
    renderer.domElement.addEventListener('pointercancel',paintEnd,true);


    // 5. Lighting setup
    // Procedural studio environment (no downloaded HDRI) so metals have something to reflect
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envTarget = pmrem.fromScene(room, 0.04);
    const envTexture = envTarget.texture;
    room.dispose();
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

    // 7. Postprocessing EffectComposer with UnrealBloomPass & OutputPass
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight),
      projectRef.current.state.bloomStrength ?? 0.85,
      projectRef.current.state.bloomRadius ?? 0.35,
      projectRef.current.state.bloomThreshold ?? 0.82
    );
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    composerRef.current = composer;
    bloomPassRef.current = bloomPass;

    // Resize observer
    const handleResize = () => {
      if (!mount || mount.clientWidth === 0 || mount.clientHeight === 0) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      composer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    // Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      frameCallbackRef.current?.(delta);
      controls.update();

      const liveState = projectRef.current.state;
      if (productGroupRef.current && liveState.rotationActive) {
        productGroupRef.current.rotation.y += 0.006 * (liveState.rotationSpeed || 1);
      }

      const selected=selectionRef.current.selectedMeshId&&productGroupRef.current?.getObjectByProperty('uuid',selectionRef.current.selectedMeshId);
      selectionHelper.visible=false;
      if(selected instanceof THREE.Mesh&&selected.visible){selected.updateWorldMatrix(true,false);if(!selected.geometry.boundingBox)selected.geometry.computeBoundingBox();if(selected.geometry.boundingBox){selectionBox.copy(selected.geometry.boundingBox).applyMatrix4(selected.matrixWorld);selectionHelper.visible=!selectionBox.isEmpty();}}
      // If bloom is enabled in state, render via composer; otherwise direct render
      if (liveState.bloomEnabled && (!qualityRef.current || PREVIEW_PROFILES[qualityRef.current].bloom)) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.domElement.removeEventListener('pointerdown',paintDown,true);
      renderer.domElement.removeEventListener('pointermove',paintMove,true);
      renderer.domElement.removeEventListener('pointerup',paintEnd,true);
      renderer.domElement.removeEventListener('pointercancel',paintEnd,true);
      controls.dispose();
      composer.dispose();
      bloomPass.dispose();
      if (productGroupRef.current) {
        scene.remove(productGroupRef.current);
        if (ownsProductRef.current) disposeObject3D(productGroupRef.current);
        productGroupRef.current = null;
      }
      scene.remove(selectionHelper);selectionHelper.geometry.dispose();(selectionHelper.material as THREE.Material).dispose();
      disposeObject3D(floor);
      disposeObject3D(disk);
      decalImageRef.current = null;
      envTarget.dispose();
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
    const softboxesEnabled = StorageManager.getInstance().getSettings().performanceMode !== 'eco' && (!quality || PREVIEW_PROFILES[quality].softboxes);
    applyLightingRig(scene, lights, {
      preset: project.state.lighting || 'studio',
      reflectionStrength: project.state.reflectionStrength ?? 1,
      softboxesEnabled,
    });
  }, [project.state.lighting, project.state.reflectionStrength, quality]);

  useEffect(() => {
    if (!quality || !rendererRef.current || !mountRef.current) return;
    const renderer = rendererRef.current;
    const profile = PREVIEW_PROFILES[quality];
    const ratio = Math.min(window.devicePixelRatio, profile.pixelRatio);
    renderer.setPixelRatio(ratio);
    renderer.shadowMap.enabled = profile.shadows;
    renderer.shadowMap.needsUpdate = true;
    composerRef.current?.setPixelRatio(ratio);
  }, [quality]);

  // Update postprocessing bloom parameters live
  useEffect(() => {
    if (bloomPassRef.current) {
      if (project.state.bloomStrength !== undefined) {
        bloomPassRef.current.strength = project.state.bloomStrength;
      }
      if (project.state.bloomRadius !== undefined) {
        bloomPassRef.current.radius = project.state.bloomRadius;
      }
      if (project.state.bloomThreshold !== undefined) {
        bloomPassRef.current.threshold = project.state.bloomThreshold;
      }
    }
  }, [project.state.bloomStrength, project.state.bloomRadius, project.state.bloomThreshold]);

  // Update product mesh when project or decal changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Preserve turntable angle across rebuilds
    let previousRotationY = 0;
    if (productGroupRef.current) {
      previousRotationY = productGroupRef.current.rotation.y;
      scene.remove(productGroupRef.current);
      if (ownsProductRef.current) disposeObject3D(productGroupRef.current);
      productGroupRef.current = null;
    }

    if (importedGroup) {
      ownsProductRef.current = false;
      importedGroup.rotation.y = previousRotationY;
      productGroupRef.current = importedGroup;
      scene.add(importedGroup);
      onSceneReadyRef.current?.(importedGroup);
      return;
    }
    ownsProductRef.current = true;

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
  }, [project, decalDataUrl, imageVersion, importedGroup]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
