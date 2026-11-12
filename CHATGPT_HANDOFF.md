# Handoff: UI Studio Mixer (UI Mixer Studio & 3D Product Studio)

> **Repository URL:** [https://github.com/dooleydarko/UI-STUDIO-MIXER](https://github.com/dooleydarko/UI-STUDIO-MIXER)  
> **Local Workspace:** `/Users/abcd/.gemini/antigravity/scratch/code-mixer-3d-studio`  
> **Status:** All 19 commits synced to GitHub `main` branch. TypeScript + Vite production build passing cleanly. 34/34 test suites verified.

---

## Scope boundary (November 12, 2026)
The interactive branding storefront is explicitly canceled from this project and all its development phases. It belongs to a separate project. Do not implement, schedule, or merge storefront features here, including in a final update.

## Current feature branch
- `feature/glb-import-studio` / PR #1: import GLB and self-contained glTF, animation player, PBR material editing, local Draco + Meshopt decoding, adaptive preview, memory diagnostics, optional 2K texture resizing and deduplicated GPU cleanup.
- Build and runtime verification pending; do not merge or package before checks pass. Remaining: detailed product presets, per-zone materials, persistence, actual compressed-model browser tests and Mac smoke tests. KTX2 and geometry simplification are not implemented.

## 1. Project Overview
**UI Studio Mixer** is a standalone Mac workstation featuring two creative environments sharing a unified component, asset, and branding pipeline:

1. **UI Playground / Code Mixer:** Collect, inspect, and interact with live HTML/CSS/JS components on an infinite obsidian canvas. Mixes selected components into three distinct creative variations (*Refined*, *Reimagined*, *Experimental*) with CSS isolation, AST token grafting, and card-pack reveal motion.
2. **3D Product Studio:** A high-fidelity Three.js WebGL viewport with PBR physical materials, customizable studio lighting rigs, dynamic decal/branding texture projection, and real binary `.glb` export.

- **Stack:** React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, Three.js 0.173, Electron 45.
- **Hardware Profile:** Optimized for macOS Ventura (Intel & Apple Silicon), 8 GB RAM, with GPU resource cleanup; hardware performance requires verification.

---

## 2. Current File Map

### Core Application
- `src/App.tsx`: Top-level workspace switcher (`UI Mixer`, `3D Studio`, `Engine Foundry`, `Discovery Room`), room routing, and layout.
- `src/types/index.ts`: Definitions for `Product3DProject`, `ProductPreset`, `LightingPreset`, `DecalTransform`, `ComponentPackage`.
- `package.json`: Project manifest (named `ui-studio-mixer`).

### 3D Studio Engine (`src/studio3d/`)
- `Viewport3D.tsx`: Three.js scene, camera, OrbitControls, PMREM studio environment, contact shadow floor, and postprocessing pipeline.
- `Studio3DWorkstation.tsx`: Studio UI sidebar, preset selector, PBR material sliders, turntable controls, and export triggers.
- `proceduralModels.ts`: Mesh generation engine (`createProductMeshGroup`) creating procedural PBR geometries.
- `labelTexture.ts`: Dynamic canvas-based decal texture synthesizer for projecting logos and branding onto 3D surfaces.
- `lightingRigs.ts`: Studio lighting rigs (`studio`, `neon`, `daylight`, `dramatic_rim`).
- `glbExporter.ts`: Binary `.glb` export utility via Three.js `GLTFExporter`.
- `disposal.ts`: Recursive GPU memory disposal for geometries, materials, and textures.

---

## 3. Next Milestone: High-Detail Models & GLB Texture Editing

### Objective A: High-Detail Product Models (Replacing Basic Low-Poly Primitives)
- **Sneaker Preset (`'sneaker'`):** Multi-part procedural model featuring sculpted rubber outsole, cushioned midsole, stitched upper vamp, tongue, collar, laces, and heel counter.
- **Over-Ear Headphones (`'headphones'`):** Ergonomic padded headband, telescoping slider arms, gimbal yolk, angled earcups, plush memory foam cushions, metallic driver grilles.
- **Luxury Bags (`'tote_bag'` / `'shopping_bag'`):** Textured canvas/leather tote bag with strap handles, paper shopping bag with rope handles and side gussets.

### Objective B: Multi-Part Material Editability
- Expand `Product3DProject` and `Studio3DWorkstation.tsx` so each zone of a product can have its own editable material:
  - *Sneaker:* Sole color/roughness, Upper leather/mesh material, Lace color, Accent badge.
  - *Headphones:* Headband leather/fabric, Earcups outer shell, Cushion padding, Metallic sliders.

### Objective C: Full GLB Import, Inspection & Texture Editing
- **Drag-and-Drop & File Picker GLB Import:**
  - Support importing external `.glb` and `.gltf` binary models directly into the 3D Product Studio viewport using Three.js `GLTFLoader`.
  - Automatically center geometries and compute bounding box extents to normalize scale into the studio lighting setup.
  - Support animated GLB models with `AnimationMixer` (play, pause, timeline scrub controls).
- **In-GLB Texture & Material Decomposition:**
  - Inspect the glTF scene hierarchy with `scene.traverse((node) => ...)`.
  - Extract all material references (`MeshStandardMaterial`, `MeshPhysicalMaterial`) and expose their map channels (albedo/map, normalMap, roughnessMap, metalnessMap) in the studio sidebar.
  - In-place texture swapping: allow users to replace specific internal image textures (e.g. replacing a printed logo, label, or pattern on a model) without modifying the 3D geometry or rigging.
  - Re-export the modified model as a binary `.glb` via `GLTFExporter`.

### Objective D: Heavy-Model Performance
- Local Draco and Meshopt decoding; no external decoder service.
- Model diagnostics, adaptive preview quality, and optional texture downscaling.
- Preserve geometry, rigs, and source files; do not silently simplify assets.

---

## 4. Copy-Paste Instructions for ChatGPT

Copy and paste the prompt below directly into ChatGPT to continue development:

```markdown
I am developing UI Studio Mixer (https://github.com/dooleydarko/UI-STUDIO-MIXER), a React 18 + TypeScript + Three.js workstation for 3D product design.

The codebase currently has:
1. Procedural 3D studio with PBR materials, dynamic decal projection, lighting rigs, and GLB export in `src/studio3d/`.
2. Infinite canvas UI component mixer in `src/mixer/` and `src/components/`.
3. Verified Vite build and 34 passing test suites.

I want to implement the next milestone:
1. Direct GLB Import & Animation Player: Drag-and-drop / file picker for `.glb` / `.gltf` models with automatic scaling, bounding box centering, and `AnimationMixer` controls.
2. In-GLB Material & Texture Decomposition: Traverse loaded GLBs, expose each mesh's material and texture maps in the sidebar, and allow replacing specific textures/images without altering underlying geometry.
3. High-Detail Product Models: Add detailed procedural models for Sneakers, Over-Ear Headphones, and Luxury Bags with multi-part material zones (e.g., sole vs upper vs laces).
4. Heavy-Model Performance: Improve local decoding, viewport quality, and texture memory usage.

Please provide the concrete TypeScript/Three.js code modifications for:
- `src/types/index.ts` (GLB import state, new presets, and multi-zone material definitions)
- `src/studio3d/glbLoader.ts` (custom GLTF loader with auto-centering, bounds normalization, and animation mixer)
- `src/studio3d/glbTextureSwapper.ts` (glTF node traversal, texture extraction, and in-place replacement utility)
- `src/studio3d/proceduralModels.ts` (high-detail sneaker, headphones, and bag mesh generators)
- `src/studio3d/Studio3DWorkstation.tsx` (import button, animation controls, material zone sidebar)
```
