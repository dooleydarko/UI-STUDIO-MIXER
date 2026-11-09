# Handoff: Code Mixer & 3D Product Studio

Paste this whole file into ChatGPT, then say what you want improved.

## What it is
A local Mac web workstation (React 18 + TypeScript + Vite + Tailwind + Three.js 0.173) with two workspaces:
1. **UI Playground / Code Mixer**: an infinite canvas of sandboxed HTML/CSS/JS components. A mixer blends selected components into 3 variations (Refined, Reimagined, Experimental) with CSS scoping and a card-pack reveal.
2. **3D Product Studio**: a procedural Three.js viewport (beverage can, device case, bottle, product box) with PBR materials, decals, lighting rigs and `.glb` export.

Target machine: 2017 Intel MacBook Pro, 8 GB RAM, macOS 13. Run with `npm install && npm run dev` (http://localhost:5173). `npm test` runs 10 checks. `npm run build` runs tsc and vite build; both pass.

## File map (src/)
- `App.tsx`: workspace switcher and layout
- `types/index.ts`: `ComponentPackage`, `MixRequest`, `Product3DProject`, `ProductPreset`, `LightingPreset`, `DecalTransform`
- `components/`: canvas, cards, `SandboxedPreview` (iframe with `sandbox="allow-scripts"` and a CSP)
- `mixer/`: `mixerEngine.ts` (scoping, 3 variation generators)
- `discovery/DiscoveryRoom.tsx`: hardcoded `DISCOVERY_FEED` of components
- `assets/`: `starterComponents.ts` (8 Uiverse items), `starter3dProjects.ts`
- `storage/`: local storage adapter, `/Volumes/Extreme` detection
- `studio3d/`:
  - `Studio3DWorkstation.tsx`: UI and state (`activeProject`)
  - `Viewport3D.tsx`: scene, camera, OrbitControls, 4 lighting rigs
  - `proceduralModels.ts`: `createProductMeshGroup(project, decalTexture)`
  - `glbExporter.ts`: `exportSceneToGlb`

## Recent changes
- Materials are now `MeshPhysicalMaterial` with clearcoat.
- Added wireframe toggle, lighting rigs (studio, neon, daylight, dramatic_rim) and a turntable speed slider.
- Added decal scale and rotation sliders.

## Known weaknesses (candidate backbone improvements)
- **The mixer is template-based.** `mixerEngine.ts` has no real LLM or provider integration. `providers/` is described in the README but not implemented. Auto-repair is shallow.
- **Storage is thin.** The architecture doc mentions SQLite/IndexedDB with schema versioning. The reality is mostly local storage and `/Volumes/Extreme` is absent on this machine.
- **The 3D studio has no state architecture.** All state lives in one `useState` blob in the workstation component. There is no undo/redo and no per-project persistence beyond `onSaveProject`.
- **Decals are basic.** They are a UV map on the body material only, with no projected decal and no position drag. `wrapMode` is stored but unused.
- **Viewport3D mounts the scene once with `[]` deps.** It reads `project` through a ref. It also never disposes geometries, materials or textures when the product is rebuilt (a leak risk on 8 GB).
- **Lighting is fixed.** There are no HDRI environment maps, so metals look flat. The README's `public/` folder and HDR studio presets do not exist.
- **Bundle:** a single 817 kB JS chunk. It needs code-splitting for three.js.
- **Tests:** `tests/runner.js` is a custom script that checks schema and math. It has no component or render tests.

## Constraints to keep
- Untrusted component code must stay in sandboxed iframes with no network.
- It must stay light on 8 GB RAM and an Intel GPU (pixel ratio capped at 2, suspend distant iframes).
- Keep licensing and attribution in `ASSET_LICENSES.md`.

## Suggested ask for ChatGPT
"Propose a refactor plan for the backbone: a typed state store (with undo/redo), a persistence layer, a pluggable AI provider interface for the mixer, and Three.js resource disposal and environment lighting. Give a step-by-step plan I can hand back to a coding agent."
