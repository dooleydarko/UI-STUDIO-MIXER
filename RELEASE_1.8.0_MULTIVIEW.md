# UI Studio Mixer 1.8.0 — Multiview Texture Projection candidate

Base: v1.7.0 advanced surface engine, verified commit 901ac7638adf0d8b10508ebfff53ed4438737437 and successful CI run 43422229233.

## Implemented workflow

1. Open GLB Import Studio, select a material and open Texture Canvas.
2. Open **360° Texture Projection** in the layer inspector. Capture six model views. Guides use the current static world-space geometry, orthographic framing and the selected material's composite base texture. They are deliberately unlit, with non-selected occluding geometry shown in gray.
3. Choose Front, Back, Left, Right, Top or Bottom. Download the guide, edit it externally while retaining exact square framing, and upload the aligned replacement. Alternatively use the optional local AUTOMATIC1111 view-variation request (reference image, fixed camera/silhouette prompt, low denoising). No server or model is installed automatically.
4. Supply one to six views and click Project. The engine rasterizes the selected surface's UVs, checks view-facing orientation and depth against visible geometry, blends eligible view colors by angle, rejects conflicting overlapping UV texels, and adds two texels of seam padding outside occupied islands. Uncovered or ambiguous occupied pixels remain transparent, preserving the original composite beneath the result.
5. Review projected UV image, coverage and conflicting pixel count. Accept creates a separate image layer that is editable with the existing transforms, masks and blend tools. Discard leaves the document unchanged. Save editable project or Send Back to Product Studio for native layers, source GLB and baked export; existing PSD and PNG workflows remain available.

## Safety and limits

- This is a real six-direction geometry-to-UV projection workflow, not a trained joint multiview diffusion system. Independently generated views can disagree; camera/silhouette alignment is not guaranteed by prompts. Inspect each replacement and the resulting model. Actual inference has not been verified against a real local server.
- Static, visible mesh geometry only. Skinned, instanced, active morph targets, repeating UV tiles and >50,000 triangles are rejected. Occlusion treats geometry as opaque, so alpha cutouts/transmissive meshes may yield incomplete projections. Overlapping UVs are conservatively skipped rather than pretending independent artwork is possible. Existing geometry, PBR maps, animation data and source file are not rewritten by projection.
- Capture size 512 square; projection longest side up to 1024. The output artwork scales to the original canvas dimensions. A high-resolution AI texture, UV generation, true multi-view model integration and automatic mesh separation are still separate milestones.
- Raster work has hard iteration and memory budgets, cancellation checkpoints and transparent fallback. CPU and GPU performance on destination Intel Mac remains to be tested.
- The local AI address is loopback only. No requests are sent until explicit generation. Manual guide upload works without a provider. Cancel stops the local client, not necessarily ongoing server inference.
- Changes to the texture document invalidate captured guides/preview, requiring recapture. A captured view set is a fixed geometry snapshot; stop turntable/animation if consistent orientation is important.
- The existing v1.7.0 branch and artifacts remain intact. No main branch merge or production rollout.

## Verification gate

Linux CI compiles the integrated application, runs GLB regression and catalog checks, and runs real Chromium canvas/PSD/IndexedDB/multi-material acceptance. The new tests check a six-tile cube atlas, single-view coverage, overlap rejection, depth occlusion and mocked local AI view request. Intel Mac builds and signed source-update artifacts follow only if those checks pass. Consult actual run status before installing.

For a successful candidate source archive, extract to a stable location and run `bash scripts/install-mac-update.sh`. The installer requires macOS 12+, Node 22+, npm, Python 3 and Xcode command-line tools. It preserves the existing application IDs and local project stores and backs up app bundles. Destination Mac launch, actual local diffusion inference, representative real-product visual checks and Photoshop desktop acceptance remain required before production distribution.
