# Architecture Decision Records (ADRs)

## ADR-001: Web + Desktop Architecture over Tauri 2 for Initial Host Target

### Context
Section 8 specified Tauri 2 as a default desktop shell candidate, while requiring host environment verification:
*"Verify current macOS/Intel compatibility, toolchain requirements, signing and installer on the user's actual machine before committing. Alternatives may be selected with written technical justification and equivalent capabilities."*

### Discovery & Findings
1. Target machine is an Intel Mac (`x86_64`) with 8 GB RAM running macOS Ventura 13.7.8.
2. Internal disk (`/`) has only 5.2 GiB available space.
3. Rust (`rustc`, `cargo`) is not installed on the system.
4. Installing Rustup, the stable toolchain, and compiling a Tauri 2 debug binary requires between 3.5 GiB and 5.5 GiB of disk space, risking critical exhaustion of the root disk (`No space left on device`).
5. Node.js `v24.20.0` and npm `11.19.0` are already natively installed and verified.

### Decision
Select a modern, high-performance Vite + React + TypeScript + Three.js + Tailwind stack designed to run locally with zero-overhead node runtime. Component sandboxing is achieved via opaque-origin iframes with strict Content Security Policy (`sandbox="allow-scripts"`), mirroring Tauri/Electron security without filling the disk with Rust compilation artifacts. The app is fully architected so that an Electron or Tauri 2 wrapper can be bundled when additional host disk space is freed.

### Status
Accepted and verified on target machine.

---

## ADR-002: Dual-Volume Local-First Storage Strategy

### Context
The internal drive has 5.2 GiB free, while an external SanDisk Extreme SSD (`/Volumes/Extreme`) is connected with 860 GiB free.

### Decision
Implement a storage adapter that writes metadata and lightweight project records locally (ensuring the app always works even when the external drive is unplugged), while automatically detecting `/Volumes/Extreme` to mirror project snapshots, 3D project exports, and heavy assets. If `/Volumes/Extreme` is detached, the application detects this gracefully, falls back to local storage, and presents a status badge without crashing or blocking.

### Status
Accepted.

---

## ADR-003: Deterministic Sandbox Preview Engine

### Context
Imported UI components and mixed variations contain arbitrary HTML, CSS, and JS. They must render reliably, support hover/click animations, but never escape their container or hijack parent events.

### Decision
Render each component in an isolated iframe with:
- `sandbox="allow-scripts"` (strictly avoiding `allow-same-origin` or `allow-top-navigation`)
- Scoped CSS isolation pass to ensure component styles never bleed into parent or neighboring components.
- Dedicated interactive popout mode that enables full pointer-events and live responsive resizing.

### Status
Accepted.
