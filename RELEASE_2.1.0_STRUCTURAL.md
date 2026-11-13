# UI Studio Mixer 2.1.0 — Structural editing

Base: v2.0.0 chart UV remapping with the Vite xatlas prebundle fix. The v2.0 browser acceptance passed on run 43436557641.

## Geometry editing workflow

- Open a GLB and select **Pick mesh in 3D** from Geometry Tools. Click a visible part in the viewport to select its mesh and hit material. A blue world-space bounding box identifies the selected mesh. Toggle pick mode off to orbit normally. The overlay is a scene helper, not exported geometry. The hierarchy selector also synchronizes with the material inspector.
- Separate static geometry by existing material groups, disconnected components, or **sharp-edge surfaces**. The adjustable angle compares the dihedral angle between adjacent faces sharing an exact-position edge. Material boundaries and non-manifold edges remain separate. This is geometric segmentation, not AI recognition of product parts.
- Undo and redo structural operations: material isolation, simple UV creation, xatlas chart remapping, and all three separation modes. Original mesh identity, transforms, child bindings and geometry/material references are restored; a new operation invalidates redo. A maximum of eight commands or approximately 256 MiB of estimated retained geometry/texture data is allowed. A large model can exceed the budget and have no retained undo command.
- Structural history is in-memory only. It is cleared when opening a texture canvas, changing material properties or maps, optimizing textures, or reloading a model. Texture canvas layers retain their own existing history. Saved GLBs/project source contain the current geometry, not prior structural history. Save a new model copy and retain your original source.
- Previous limits remain: static meshes, bounded triangle/part counts, single-material chart remap, spare UV channel, real local diffusion server required for optional AI. Sharp-edge segmentation may split a smooth model differently depending on topology, angle and material boundaries; it cannot infer semantics or recover baked geometry.

## Release checks

CI builds the integrated app and runs the existing GLB, catalog, canvas, PSD, multi-material, projection, geometry and actual xatlas browser tests plus new tests for six-face sharp separation, original node identity through undo/redo, redo invalidation and nearest visible-mesh picking. Intel Mac packaging is gated on Linux/Chromium success. The actual Mac UI, Photoshop desktop and real AI output remain unverified. Source update installer preserves existing app identifiers and local project stores. Main is not merged.
