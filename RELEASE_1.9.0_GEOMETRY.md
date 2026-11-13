# UI Studio Mixer 1.9.0 — Geometry Surface Tools

Built on v1.8.0 six-view projection, whose Linux build and Chromium acceptance passed. The previous source branches and local stores remain unchanged.

## Geometry workflow
Open an imported GLB and choose a mesh in **Geometry Tools**, beside the object hierarchy. Use:
- **Generate missing UV0**: creates a bounded non-overlapping per-triangle atlas, using local triangle proportions, with padding between cells. Copies existing vertex attributes and material groups, isolates materials shared with other meshes, and never overwrites existing UV0. A mesh with textures already relying on missing UV0 is rejected instead of silently changing the existing mapped appearance.
- **Split materials**: separates existing material-slot groups into individually selectable meshes.
- **Split connected parts**: separates disconnected components based on exact coincident positions, including duplicate vertices at UV seams. Coincident shells may remain joined; this is not AI semantic segmentation.
- **Reload imported source**: discard edited topology and reload the current input file, with unsaved-change confirmation. The input file is never overwritten.

The original mesh remains the transform/animation anchor and additional parts are identity-transformed children. Vertex normals, UV sets, colors and material associations are copied; indices are compacted on split. Existing shared geometry is left intact. The hierarchy refreshes and existing material isolation can create separate artwork slots on the new pieces. Save creates a new edited copy instead of overwriting an existing saved model. Opening a canvas after topology edits supports the previous paint, Gray Out, PSD, multi-material and 360° projection workflows; layered projects store the edited source geometry plus editable texture documents and a baked GLB.

## Limits
Static triangle meshes only. No skinning, instancing, morph targets, partial draw ranges, overlapping/uncovered material groups or Float16 attributes. UV atlas generation is capped at 4,096 triangles; separation at 50,000 triangles and 64 parts. Existing UV layouts are not replaced or automatically remapped. Per-triangle packing creates many seams and is not an artist-quality chart unwrap or xatlas integration. It is intended for simple missing-UV objects. Texture maps on other existing UV channels are retained. Semantic object separation, arbitrary mesh cutting and recovery of missing original source layers are not implemented. Structural edits preserve the imported file on disk, but the editable project source is the edited topology, not a second archive of the unmodified file. Reload is available before saving; no structural undo stack is provided.

## Verification
Browser tests exercise actual UV generation and texture rendering, shared-geometry/material protection, normalized vertex attributes, transform preservation, material and disconnected-component splits, and export/reopen through real GLB encoding. Prior regression/PSD/multiview tests remain enabled. Mac source update packaging follows a successful Linux/browser gate. The actual destination Intel Mac, representative product geometry, Photoshop desktop, and real AI inference still need hands-on acceptance.

For the successful source archive, extract it to a stable location and run `bash scripts/install-mac-update.sh`. The existing installer preserves application IDs and project history and backs up prior application bundles. The draft PR does not merge main.
