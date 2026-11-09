import * as THREE from 'three';
import { Product3DProject, DecalTransform } from '../types';

/**
 * Procedurally generates a physically accurate 3D model with PBR materials
 * for the selected product preset.
 */
export function createProductMeshGroup(
  project: Product3DProject,
  decalTexture?: THREE.Texture | null
): THREE.Group {
  const group = new THREE.Group();
  group.name = `product_${project.preset}`;

  const { material: matProps, state, preset } = project;

  // Base PBR material
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(matProps.baseColor),
    roughness: matProps.roughness,
    metalness: matProps.metalness,
    wireframe: state.showWireframe,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(matProps.secondaryColor || '#cccccc'),
    roughness: 0.15,
    metalness: 0.95,
  });

  const emissiveMaterial = new THREE.MeshStandardMaterial({
    color: state.powerOn ? new THREE.Color(matProps.emissiveColor || '#10b981') : new THREE.Color('#1f2937'),
    emissive: state.powerOn ? new THREE.Color(matProps.emissiveColor || '#10b981') : new THREE.Color('#000000'),
    emissiveIntensity: state.powerOn ? matProps.emissiveIntensity || 1.5 : 0,
    roughness: 0.2,
  });

  // If a decal texture is loaded, apply to body material map
  if (decalTexture) {
    bodyMaterial.map = decalTexture;
    bodyMaterial.needsUpdate = true;
  }

  if (preset === 'beverage_can') {
    // 1. Sleek Aluminum Beverage Can (Can body + tapered neck + chime rim + pull tab)
    const canHeight = 2.4;
    const canRadius = 0.7;

    // Main cylinder body
    const cylinderGeo = new THREE.CylinderGeometry(canRadius, canRadius, canHeight * 0.8, 64);
    const cylinderMesh = new THREE.Mesh(cylinderGeo, bodyMaterial);
    cylinderMesh.position.y = canHeight * 0.4;
    cylinderMesh.castShadow = true;
    cylinderMesh.receiveShadow = true;
    group.add(cylinderMesh);

    // Tapered neck
    const neckGeo = new THREE.CylinderGeometry(canRadius * 0.82, canRadius, canHeight * 0.12, 64);
    const neckMesh = new THREE.Mesh(neckGeo, chromeMaterial);
    neckMesh.position.y = canHeight * 0.8 + canHeight * 0.06;
    neckMesh.castShadow = true;
    group.add(neckMesh);

    // Top rim / chime
    const rimGeo = new THREE.TorusGeometry(canRadius * 0.82, 0.035, 16, 64);
    const rimMesh = new THREE.Mesh(rimGeo, chromeMaterial);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = canHeight * 0.8 + canHeight * 0.12;
    group.add(rimMesh);

    // Top lid surface
    const lidGeo = new THREE.CircleGeometry(canRadius * 0.81, 64);
    const lidMesh = new THREE.Mesh(lidGeo, chromeMaterial);
    lidMesh.rotation.x = -Math.PI / 2;
    lidMesh.position.y = canHeight * 0.8 + canHeight * 0.12 - 0.01;
    group.add(lidMesh);

    // Pull tab detail
    const tabGeo = new THREE.BoxGeometry(0.25, 0.015, 0.45);
    const tabMesh = new THREE.Mesh(tabGeo, chromeMaterial);
    tabMesh.position.set(0, canHeight * 0.8 + canHeight * 0.12 + 0.01, 0.1);
    tabMesh.rotation.y = 0.2;
    group.add(tabMesh);

    // Bottom base indentation
    const bottomGeo = new THREE.CylinderGeometry(canRadius, canRadius * 0.85, canHeight * 0.08, 64);
    const bottomMesh = new THREE.Mesh(bottomGeo, chromeMaterial);
    bottomMesh.position.y = canHeight * 0.04;
    group.add(bottomMesh);

  } else if (preset === 'device_case') {
    // 2. AirPods-style Electronics Device Case (Rounded rectangular clamshell)
    const caseWidth = 1.6;
    const caseHeight = 1.2;
    const caseDepth = 0.8;

    // Bottom base body
    const bodyGeo = new THREE.BoxGeometry(caseWidth, caseHeight * 0.65, caseDepth, 16, 16, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
    bodyMesh.position.y = caseHeight * 0.325;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Clamshell Top Lid with opening pivot
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, caseHeight * 0.65, -caseDepth / 2);

    const lidGeo = new THREE.BoxGeometry(caseWidth, caseHeight * 0.35, caseDepth, 16, 16, 16);
    const lidMesh = new THREE.Mesh(lidGeo, bodyMaterial);
    lidMesh.position.set(0, caseHeight * 0.175, caseDepth / 2);
    lidMesh.castShadow = true;
    lidPivot.add(lidMesh);

    // Rotate lid if opened
    const lidRad = (project.state.lidAngle || 0) * (Math.PI / 180);
    lidPivot.rotation.x = -lidRad;
    group.add(lidPivot);

    // Emissive Virtual Status LED
    const ledGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const ledMesh = new THREE.Mesh(ledGeo, emissiveMaterial);
    ledMesh.position.set(0, caseHeight * 0.325, caseDepth / 2 + 0.01);
    group.add(ledMesh);

  } else if (preset === 'bottle') {
    // 3. Perfume / Beverage Bottle
    const bHeight = 2.2;
    const bRadius = 0.65;

    const bGeo = new THREE.CylinderGeometry(bRadius, bRadius, bHeight * 0.65, 32);
    const bMesh = new THREE.Mesh(bGeo, bodyMaterial);
    bMesh.position.y = bHeight * 0.325;
    bMesh.castShadow = true;
    group.add(bMesh);

    const shoulderGeo = new THREE.ConeGeometry(bRadius, 0.4, 32);
    const shoulderMesh = new THREE.Mesh(shoulderGeo, bodyMaterial);
    shoulderMesh.position.y = bHeight * 0.65 + 0.2;
    group.add(shoulderMesh);

    const capGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.4, 32);
    const capMesh = new THREE.Mesh(capGeo, chromeMaterial);
    capMesh.position.y = bHeight * 0.65 + 0.4 + 0.2;
    group.add(capMesh);

  } else {
    // 4. Minimalist Product Packaging Box
    const boxGeo = new THREE.BoxGeometry(1.8, 2.2, 0.9);
    const boxMesh = new THREE.Mesh(boxGeo, bodyMaterial);
    boxMesh.position.y = 1.1;
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    group.add(boxMesh);
  }

  return group;
}
