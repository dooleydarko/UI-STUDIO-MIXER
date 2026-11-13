# UI Studio Mixer 2.0.0 — chart UV and artwork remapping

Base: fully verified v1.9.0 geometry tools (CI run 43430410225).

## Integrated workflow

1. Open a GLB, open the Geometry Tools section, and select a static single-material mesh. If it has multiple material slots, split by material first.
2. Pick 512, 1024 or 2048 maximum atlas size, then choose **Unwrap charts + preserve artwork**. The xatlas-wasm engine generates packed surface charts inside a cancellable local worker. No cloud service or runtime CDN is needed.
3. Existing UV0 is not overwritten: the new base-color atlas uses UV1 when UV0 exists and UV1 is free, or UV0 on a genuinely unmapped mesh. Existing base-color artwork is rasterized from its original UV mapping into the new atlas, including its texture transform and alpha; material tint and other physical material maps remain on their original channels. New materials are independent from shared source materials.
4. Review the chart count, output dimensions and occupied-texel percentage. Open Texture Canvas to add artwork, gray-out, paint, mask, project six views or use PSD layers. Save an editable project or export a baked GLB using the existing workflows. Reload the imported source to discard unsaved topology edits.

## Dependency and implementation

Pinned xatlas-wasm 0.1.3 (MIT; upstream xatlas attribution in package). Reference: https://github.com/mode777/xatlas-wasm and https://www.npmjs.com/package/xatlas-wasm. The Vite worker and bundled WebAssembly must run locally. The old triangle atlas remains available as a fallback, not as a substitute for xatlas results.

## Limits

Static triangle geometry only, single standard/physical material, up to 25,000 triangles, no skinning, instancing, morphs, or unsupported custom attributes. An occupied UV1 or any texture using the target channel is rejected. Source texture must be a readable UV-mapped raster no larger than 4096px. Output is capped at chosen resolution and is a raster resample (not bit-for-bit lossless). Texture wrapping and transforms are evaluated, but resampling, mipmap behavior, filtering, compressed maps and fine artwork may differ; compare the result visually. Normal, roughness, metalness, emissive, occlusion and other maps are not baked or edited; their old UVs and material settings stay intact. Existing source layers cannot be recovered from baked textures. No semantic AI mesh separation. The input file is not overwritten.

The chart worker has a 90-second execution limit, and bake operations use a bounded raster budget with cancellation checkpoints. A failure before commit leaves the original mesh unchanged. Atlas packing rejects unassigned corners, multiple atlases, invalid UVs and overlapping rasterized interiors. Structural undo is still source reload rather than a full history stack. Use 512 or 1024 first on the older Intel Mac.

## Acceptance

The CI suite includes real Chromium xatlas worker execution, chart count on planar geometry, color transfer at original triangle centroids, independent shared-material preservation, 3D paint compatibility, rejection of occupied UV1, cancellation safety, and real GLB export/reopen with base-color UV1 and normal UV0. Existing PSD, multiview, geometry and project persistence checks remain enabled. Only a successful pipeline is eligible for Intel Mac packaging. The destination Mac and real-model visual quality still need hands-on testing.

For a successful source update archive, extract it to a stable path and run `bash scripts/install-mac-update.sh`. Installer preserves application IDs/local history and backs up app bundles. Previous release branches stay untouched. No main merge.
