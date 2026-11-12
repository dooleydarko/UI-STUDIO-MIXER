# UI Studio Mixer 1.5.0 — Mac update candidate

**Scope:** UI component mixer and standalone 3D product editor only. The interactive branding storefront is excluded.

## What's new
- Import local GLB and self-contained glTF, inspect PBR materials, replace maps, play and scrub clips, export edited GLB.
- Bundled Draco / Meshopt decoding, adaptive preview, model diagnostics, optional texture downscaling.
- Five procedural product prototypes with named, independent material zones: sneakers, headphones, tote bags, shopping bags, business cards.
- Local saved GLB library, explicit save/reopen, unsaved-edit prompts.
- Native WebKit download handling and safer Mac application replacement with previous bundle backups.

## Packaging architecture
Existing Mac apps depend on a local Node server and an absolute project directory stored in Info.plist. For that reason, the release artifact is a **source update package**, not a portable standalone .app. The installer builds native wrappers on the destination Mac and preserves the application bundle IDs, server port 4173 and storage origin. It does not delete existing data. It uses local ad-hoc signing, not Apple Developer ID notarization.

## Install only after all PR checks pass
Quit both UI Mixer Studio and AI Engine Foundry. In the existing project checkout (the path shown in CHATGPT_HANDOFF.md), inspect git status and preserve any uncommitted work. After confirming the verified candidate SHA:
```bash
git fetch origin feature/glb-import-studio
git merge --ff-only origin/feature/glb-import-studio
bash scripts/install-mac-update.sh
```
The fast-forward command refuses divergent history. Do not reset or force it. The installer requires macOS 12+, Node 22+, Python 3 and Xcode command-line tools. It runs the production build and tests before installing. The existing app server may need to be restarted if it is still using an old checkout; stop only the verified old server process. Do not wipe application data. Keep the existing checkout in place.

The workflow produces a source ZIP and SHA256 checksum only if Linux and native Intel macOS checks pass. It does not publish an automatic update.

## Mac acceptance checklist
- Launch UI Mixer Studio and confirm saved components and procedural projects are present.
- Open 3D Studio; verify all five new prototypes and separate material changes.
- Import small, animated, Draco-compressed and Meshopt-compressed models; inspect and edit a shared texture, scrub and play clips.
- Save to library, close/reopen the app, reopen the edited model.
- Export to a new GLB using native save dialog; re-import and inspect geometry, textures and clips.
- Check Eco/Auto frame rate on the Intel Mac; confirm the original file remains intact.
- Verify the companion app still launches and prior data remains available.

## Known limits
100 MB input/snapshot cap; self-contained files only; KTX2 and mesh simplification are not implemented. Texture optimization is explicit and changes exported texture resolution. Saved model library is local to the WebKit/browser origin; export portable backups. Procedural presets are approximations, not production scanned assets. Native launch, export and persistence behavior require hardware acceptance testing.
