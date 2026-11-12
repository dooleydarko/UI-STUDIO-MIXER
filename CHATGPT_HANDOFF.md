# Handoff: UI Studio Mixer (UI Mixer Studio & 3D Product Showcase)

> **Repository URL:** [https://github.com/dooleydarko/UI-STUDIO-MIXER](https://github.com/dooleydarko/UI-STUDIO-MIXER)  
> **Local Workspace:** `/Users/abcd/.gemini/antigravity/scratch/code-mixer-3d-studio`  
> **Status:** All 19 commits synced to GitHub `main` branch. TypeScript + Vite production build passing cleanly. 34/34 test suites verified.

---

## 1. Project Overview
**UI Studio Mixer** is a standalone Mac workstation featuring two creative environments sharing a unified component, asset, and branding pipeline:

1. **UI Playground / Code Mixer:** Collect, inspect, and interact with live HTML/CSS/JS components on an infinite obsidian canvas. Mixes selected components into three distinct creative variations (*Refined*, *Reimagined*, *Experimental*) with CSS isolation, AST token grafting, and card-pack reveal motion.
2. **3D Product Studio & Interactive Storefront:** A high-fidelity Three.js WebGL viewport with PBR physical materials, customizable studio lighting rigs, dynamic decal/branding texture projection, and real binary `.glb` export.

- **Stack:** React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, Three.js 0.173, Electron 45.
- **Hardware Profile:** Optimized for macOS Ventura (Intel & Apple Silicon), 8 GB RAM, with strict memory disposal and zero GPU memory leaks.

---

## 2. Current File Map

### Core Application
- `src/App.tsx`: Top-level workspace switcher (`UI Mixer`, `3D Studio`, `Engine Foundry`, `Discovery Room`), room routing, and layout.
- `src/types/index.ts`: Definitions for `Product3DProject`, `ProductPreset`, `LightingPreset`, `DecalTransform`, `ComponentPackage`.
- `package.json`: Project manifest (named `ui-studio-mixer`).

### 3D Studio & Storefront Engine (`src/studio3d/`)
- `Viewport3D.tsx`: Three.js scene, camera, OrbitControls, PMREM studio environment, contact shadow floor, and postprocessing pipeline.
- `Studio3DWorkstation.tsx`: Studio UI sidebar, preset selector, PBR material sliders, turntable controls, and export triggers.
- `proceduralModels.ts`: Mesh generation engine (`createProductMeshGroup`) creating procedural PBR geometries.
- `labelTexture.ts`: Dynamic canvas-based decal texture synthesizer for projecting logos and branding onto 3D surfaces.
- `lightingRigs.ts`: Studio lighting rigs (`studio`, `neon`, `daylight`, `dramatic_rim`).
- `glbExporter.ts`: Binary `.glb` export utility via Three.js `GLTFExporter`.
- `disposal.ts`: Recursive GPU memory disposal for geometries, materials, and textures.

---

## 3. Next Milestone: High-Detail Models, GLB Texture Editing & Storefront

### Objective A: High-Detail Product Models (Replacing Basic Low-Poly Primitives)
- **Sneaker Preset (`'sneaker'`):** Multi-part procedural model featuring sculpted rubber outsole, cushioned midsole, stitched upper vamp, tongue, collar, laces, and heel counter.
- **Over-Ear Headphones (`'headphones'`):** Ergonomic padded headband, telescoping slider arms, gimbal yolk, angled earcups, plush memory foam cushions, metallic driver grilles.
- **Luxury Bags (`'tote_bag'` / `'shopping_bag'`):** Textured canvas/leather tote bag with strap handles, paper shopping bag with rope handles and side gussets.

### Objective B: Multi-Part Material Editability
- Expand `Product3DProject` and `Studio3DWorkstation.tsx` so each zone of a product can have its own editable material:
  - *Sneaker:* Sole color/roughness, Upper leather/mesh material, Lace color, Accent badge.
  - *Headphones:* Headband leather/fabric, Earcups outer shell, Cushion padding, Metallic sliders.

### Objective C: In-GLB Texture Swapping & Image Replacement
- Allow users to load or import existing `.glb` models and swap specific image maps without touching the geometry:
  - Inspect glTF node hierarchy using `scene.traverse((node) => ...)`.
  - Identify named meshes and their `MeshStandardMaterial` / `MeshPhysicalMaterial`.
  - Dynamically replace `material.map` (albedo/diffuse), `normalMap`, or `roughnessMap` with user-uploaded artwork or decals.
  - Re-export the modified model as a binary `.glb` via `GLTFExporter`.

### Objective D: Swipeable Storefront Showcase Mode
- A storefront presentation view allowing shoppers or clients to swipe horizontally between a hero product and complementary branded items (bags, bottles, accessories).
- Synchronized brand theme: updating the brand palette or logo projects across all items in the showcase.

---

## 4. Copy-Paste Instructions for ChatGPT

Copy and paste the prompt below directly into ChatGPT to continue development:

```markdown
I am developing UI Studio Mixer (https://github.com/dooleydarko/UI-STUDIO-MIXER), a React 18 + TypeScript + Three.js workstation for interactive 3D product design and storefront branding.

The codebase currently has:
1. Procedural 3D studio with PBR materials, dynamic decal projection, lighting rigs, and GLB export in `src/studio3d/`.
2. Infinite canvas UI component mixer in `src/mixer/` and `src/components/`.
3. Verified Vite build and 34 passing test suites.

I want to implement the next milestone:
1. High-Detail Product Models: Add detailed procedural models for Sneakers, Over-Ear Headphones, and Luxury Bags to replace basic primitives.
2. Multi-Zone Material Editing: Allow separate color, roughness, and metalness controls for distinct parts of each model (e.g. sneaker sole vs upper vs laces).
3. GLB Image/Texture In-Place Replacement: Allow loading a GLB model and replacing specific internal texture images (like decals, logos, or printed artwork) without modifying the 3D mesh geometry, and re-exporting it as GLB.
4. Storefront Carousel: An interactive swipeable carousel showcasing hero products alongside matching branded merchandise.

Please provide the concrete TypeScript/Three.js code modifications for:
- `src/types/index.ts` (new presets and multi-zone material definitions)
- `src/studio3d/proceduralModels.ts` (high-detail sneaker, headphones, and bag mesh generators)
- `src/studio3d/glbTextureSwapper.ts` (glTF texture traversal and in-place replacement utility)
- `src/studio3d/Studio3DWorkstation.tsx` (multi-zone UI controls and storefront carousel view)
```
