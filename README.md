# Code Mixer & 3D Product Studio

A professional standalone Mac workstation featuring two interconnected creative environments sharing a unified component and asset library:

1. **UI Playground / Code Mixer:** Collect, inspect, and interact with live HTML/CSS/JS components on an infinite obsidian canvas. Supervise an AI coding mixer that blends selected components into three distinct creative variations (Refined, Reimagined, Experimental) with automatic collision resolution, sandboxed validation, and collectible card-pack reveal motion.
2. **3D Product Studio:** A full 3D workstation featuring a high-fidelity WebGL/Three.js viewport, procedural physically accurate models (beverage can, electronics device case, packaging), PBR materials, custom lighting rigs, interactive physical controls, artwork/label decal projection, and real binary `.glb` export.

---

## System Requirements & Target Environment

- **Architecture:** x86_64 (Intel Mac) or arm64 (Apple Silicon)
- **Tested Hardware:** 2017 Intel MacBook Pro, 8 GB RAM, macOS Ventura 13.7.8
- **Runtime:** Node.js >= 18 (Tested on v24.20.0), npm >= 9 (Tested on 11.19.0)
- **Storage Profile:**
  - Local repository and config: ~150 MB (fits within internal disk constraints)
  - Asset & backup cache: Automatically detects and supports external SanDisk SSD (`/Volumes/Extreme`), gracefully falling back to local storage if unmounted.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Run automated test suite
npm run test
```

---

## Project Structure

```
├── src/
│   ├── components/         # UI cards, canvas, popout preview, inspector panels
│   ├── mixer/              # Component mixer engine, AST/CSS scope isolation, 3 variation generators
│   ├── studio3d/           # Three.js 3D viewport, procedural meshes, PBR shaders, decal projection
│   ├── discovery/          # Discovery room search, intake queue, license validator
│   ├── storage/            # Local-first storage adapter with external drive detection
│   ├── providers/          # Modular agent provider interface (Gemini, Claude, OpenAI, Local/Offline)
│   ├── assets/             # Built-in starter components (Uiverse references)
│   └── App.tsx             # Root workspace switcher & layout
├── tests/                  # Unit and integration test suites
├── public/                 # Static assets, environment maps, textures
├── ARCHITECTURE.md         # Detailed technical design & security boundaries
├── BUILD_STATUS.md         # Current milestone status and live progress
├── DECISIONS.md            # Architecture Decision Records (ADRs)
├── PROJECT_RECOVERY.md     # Checkpoint restoration & disaster recovery
├── TEST_REPORT.md          # Verification outputs and test results
└── ASSET_LICENSES.md       # Attribution and licensing for components & presets
```
