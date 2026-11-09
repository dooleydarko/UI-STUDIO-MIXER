# Architecture Specification

## 1. System Overview

The application is structured into two main workspaces governed by a shared state store and storage engine:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Top-Level Navigation Bar                     │
│  [ UI Playground & Code Mixer ]    [ 3D Product Studio ]       │
└────────────────┬────────────────────────────────┬───────────────┘
                 │                                │
     ┌───────────▼────────────┐       ┌───────────▼───────────┐
     │  Obsidian Infinite     │       │  Three.js Viewport    │
     │  Canvas Engine         │       │  PBR Material Engine  │
     │  - Spatial Clustering  │       │  - Aluminum Can       │
     │  - Sandboxed Iframes   │       │  - Device Case        │
     │  - Liquid Glass Nav    │       │  - Decal / UV Wrap    │
     │  - Popout Previews     │       │  - GLB Exporter       │
     └───────────┬────────────┘       └───────────┬───────────┘
                 │                                │
     ┌───────────▼────────────┐                   │
     │  Code Mixer Engine     │                   │
     │  - Mix Tray            │                   │
     │  - AST & CSS Scoping   │                   │
     │  - 3 Variations Engine │                   │
     │  - Pack Reveal 3D      │                   │
     └───────────┬────────────┘                   │
                 │                                │
                 └────────────────┬───────────────┘
                                  │
                 ┌────────────────▼───────────────┐
                 │    Storage & Asset Manager     │
                 │    - Local SQLite / IndexedDB  │
                 │    - File System Serializer    │
                 │    - SanDisk Extreme Detector  │
                 └────────────────────────────────┘
```

## 2. Security & Sandboxing Architecture

### Untrusted Code Execution
- Component previews are rendered inside sandboxed iframes using `sandbox="allow-scripts"`.
- Opaque origin (`about:blank` or data-uri) prevents untrusted HTML/CSS/JS from accessing:
  - Parent DOM window
  - Top-level cookies / localStorage
  - Host filesystem, shell commands, or keychain
- Restrictive Content Security Policy (CSP):
  `default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'none';`
- Communication between parent workstation and iframe preview occurs exclusively through validated `postMessage` channels with typed event envelopes.

## 3. UI Playground & Infinite Canvas
- **Visuals:** `#000000` deep black infinite canvas without distracting grid lines; cards rendered in `#080808` with subtle 1px border highlight (`rgba(255,255,255,0.08)`) and physical soft drop shadows.
- **Liquid Glass Navigation:** Layered backdrop blur (`backdrop-filter: blur(16px)`), subtle translucent gradient, micro-rim lighting.
- **Performance:** For distant cards, iframes are suspended or rendered as static snapshots, conserving GPU and memory on the 8 GB Intel Mac.

## 4. Code Mixer Engine
- **Mix Tray:** Collects 2 or more component packages.
- **Scope Isolation:**
  - CSS selectors are automatically prefixed with unique component scopes (`.cm-scope-[hash]`) to prevent global style pollution.
  - Colliding HTML IDs and function names are rewritten or encapsulated into web components / shadow DOM.
- **Synthesis:**
  - Generates 3 creative variations:
    1. **Refined:** Harmonious functional blend of layout and styles.
    2. **Reimagined:** Bold visual aesthetic, typography reimagining.
    3. **Experimental:** Dynamic interactive animations and state transitions.
  - Automated sandbox testing parses DOM tree, listens for runtime errors, and executes auto-repair passes if scripts throw.
- **Collectible Card Pack Reveal:**
  - Timeline-based 3D pack opening.
  - Press-and-hold acceleration smoothly speeds up playback.
  - Double-click fast-forwards.
  - Result cards float to persistent canvas coordinates upon completion.

## 5. 3D Product Studio
- **Viewport:** Three.js scene featuring OrbitControls, HDR lighting studio presets, directional soft rim lights, and contact shadow plane.
- **Procedural Geometry Presets:**
  - **Sleek Beverage Can:** Cylinder body with tapered neck, chime, rim, pull-tab indentation.
  - **Electronics Device Case:** Rounded rectangular clamshell with parting line, glowing LED indicator, interactive virtual power toggle switch.
  - **Packaging Box / Bottle:** Clean UV coordinates ready for decal mapping.
- **Decal & Artwork System:**
  - Cylindrical UV mapping for beverage cans and flat projection for packaging.
  - Accepts PNG, SVG, and JPEG artwork.
  - Live adjustment of position, scale, rotation, and blend mode.
- **Export Pipeline:**
  - Native Three.js `GLTFExporter` outputs valid binary `.glb` files with embedded PBR materials and textures for immediate use in Blender or web engines.

## 6. Storage & Portability
- **Primary:** Local storage / IndexedDB with automatic JSON schema versioning.
- **External Asset Detection:** System queries for `/Volumes/Extreme` (SanDisk Extreme SSD); if present, stores large assets and backups on external volume; gracefully continues with local storage if disconnected.
