# UI Studio Mixer 1.6.0 — Surface Editor candidate

Base: v1.5.1 GLB catalog and imported-model editor, commit ac4752c22c62dae3b05ee26fad9f69b9156bbe7b. This is a development candidate on `feature/surface-editor-foundation` / PR #2. Main and the existing GLB feature branch are not replaced. The separate branding storefront remains out of scope.

## Workflow

1. Open 3D Product Studio → Import GLB. Select a PBR material in the inspector or open the object hierarchy. Shared materials affect linked meshes; use Isolate on mesh when independent material editing is required.
2. Use Gray Out for a reversible preview on the selected material or object; Open Texture Canvas for independently editable Gray Out, artwork and paint layers. Canvas can use split, 2D or 3D view.
3. Add Artwork; use V to move, numeric position/size/rotation and flips. Use B/E with a paint layer; use Edit mask for hide/reveal on an unlocked layer. S is Clone Stamp; Option-click to sample a source. Cleanup mask → E → Clean masked area creates a separate deterministic local reconstruction patch. This is not AI inpainting. UV guides are optional and never included in baked texture.
4. Layers have visibility, lock, rename, duplicate, delete, ordering, opacity, normal/multiply/screen/overlay, editable masks and bounded undo/redo. Cmd/Ctrl+S downloads the native texture document; the top Save editable project button persists the complete source and baked GLB with layers.
5. Export PSD for Photoshop raster editing; keep the native JSON for brush strokes, original transforms and app-specific state. Import PSD with exact texture dimensions. Unsupported PSD features are rejected with a compatibility report, not silently discarded.
6. Send Back to Product Studio saves the project association, lighting, source model and editable document. Reopen under Edited GLB surfaces or the local model library. Explicit project save refreshes the baked GLB; draft autosave after the first save updates the editable document without overwriting the baked copy.

## Scope and limitations

- One active material canvas per saved surface project. Other PBR channels remain untouched by base-color editing. Existing material-map replacement remains available outside the canvas. Simultaneous multi-material layer documents, arbitrary mesh separation, UV generation, overlap resolution and advanced geometry tools are not complete.
- Canvas uses original UV layouts and existing material sampler/UV transform. 3D painting supports UV0/UV1, commits strokes at pointer release and can affect shared/overlapping UVs. Compressed or oversized image maps may require preprocessing. Texture canvas limit is 4096 px per side; browser memory limits and PSD working budgets apply.
- Gray Out removes base-color graphics but cannot recover details baked into base color, vertex colors, other maps or geometry. Normal/roughness/metallic maps and transparency remain unchanged. Clone and local masked fill help with small flat regions; local fill is approximate, not texture synthesis.
- PSD import/export supports 8-bit RGB raster layers, positioning, supported blends, masks, opacity and visibility. Native brush vectors and artwork transform parameters are rasterized into the PSD; native JSON preserves them. Text, smart objects, effects, groups, vector masks, arbitrary clipping groups, adjustments and unsupported blend modes are rejected. Photoshop desktop visual acceptance is pending.
- No AI provider or multi-view 360° texture generation is configured. No claim of actual AI inpainting or consistent full-object AI generation. No paid AI requirement for basic editing.
- Saved editable projects are device-local IndexedDB data. Save explicitly before relying on autosave. Native JSON and GLB exports are portable backups. Existing local storage and application identifiers are not cleared.
- Intel Mac build uses the existing local Cocoa/WebKit host and Node server. A CI-built app host embeds its build workspace path, so the portable artifact is the source update package, installed locally with the script. Actual destination Intel Mac launch, visual interaction, Photoshop round-trip and heavy-model performance remain required before production distribution.

## Verification commands

```sh
npm ci --ignore-scripts
npm run build
npm test
node --test tests/glbStudio.test.mjs
node tests/verifyProductCatalog.mjs
# Linux/browser acceptance (pinned test runner; no package-lock changes):
npm install --no-save --package-lock=false --ignore-scripts playwright@1.62.1
npx playwright install --with-deps chromium
node tests/surfaceBrowser.test.mjs
```

The pull request CI runs production build, targeted GLB tests, product catalog verification, real Chromium canvas/PSD/IndexedDB acceptance and gated Intel Mac build/signature/source packaging. Consult the latest run for actual results; no test is considered passed merely because its code exists.

## Local Mac update

Use the source archive from the **successful** 1.6.0 surface candidate CI run, not an older downloaded folder. Quit both app windows first. Extract the source into a stable location with sufficient disk space and use:

```sh
cd /path/to/UI-STUDIO-MIXER-1.6.0-surface
bash scripts/install-mac-update.sh
```

Requires macOS 12+, Node 22+, npm, Python 3 and Xcode command-line tools. Installer builds and checks before replacing app bundles; existing bundles are backed up. It preserves application IDs, localStorage, IndexedDB and support data. Do not delete original source, local project data or backups. Verify launch, opening saved assets, editing a GLB, PSD round-trip and Send Back before marking the release production-ready.
