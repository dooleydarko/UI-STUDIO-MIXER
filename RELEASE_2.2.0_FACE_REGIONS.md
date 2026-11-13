# UI Studio Mixer 2.2.0 — Face region editing

Cumulative candidate based on v2.1.0, fully verified by Linux/browser and Intel Mac CI run 43436873446.

## Workflow
1. Open a static GLB. In Geometry Tools, turn on **Select individual faces**. Click a triangle to replace selection; Shift-click adds/removes triangles on the same mesh. The cyan overlay is not exported. Toggle face mode off to orbit without clearing the selection.
2. **Separate selected** creates a new selectable mesh from the selected subset, preserves original node identity, vertex attributes, material groups and UVs, and clones the selected part's material instances. Existing texture sources can remain shared until a canvas or map replacement assigns a new texture. Undo/redo is available in the structural history.
3. Alternatively keep the face selection and open Texture Canvas on the corresponding material. Add or select an unlocked layer, then choose **Mask layer to selected 3D faces**. The UV mask is a regular editable raster mask with existing brush/eraser, mask history and PSD export support. Existing masks require confirmation before replacement. Texels also covered by unselected triangles on any mesh using the active material are excluded. If no usable pixels remain, separate and unwrap an independent atlas.
4. Existing Gray Out, texture compositing, reference/inpaint AI adapters, six-view projection, chart UV remapping, native layered document, PSD and GLB export workflows remain available.

## Boundaries
Selection is single-mesh, static geometry; no freehand geometric cut, semantic AI segmentation, skin/morph/instance support or multi-object lasso. Masks are based on UV coverage at canvas resolution, not a geometric clipping plane; repeated/wrapped UV tiles are refused. Shared UV overlap is conservatively excluded and can leave thin boundaries. Geometry editing and texture history are separate; structural history clears on entry to Texture Canvas. The original imported file is unchanged. Real joint multiview AI generation, local diffusion inference quality, Photoshop desktop validation and actual destination Mac testing remain separate acceptance tasks. All automated tests must pass before packaging.

## Release verification
CI runs existing GLB, catalog, texture canvas/PSD, local provider mocks, multiview, chart UV and structural history acceptance, plus selected-region tests covering add/remove, overlay geometry, UV mask containment, shared UV rejection, independent material, triangle preservation and undo/redo. Intel Mac packaging is gated on those tests. The source archive installer preserves previous application IDs and local project stores and backs up existing bundles. No merge to main.
