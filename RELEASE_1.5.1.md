# UI Studio Mixer 1.5.1 — Product GLB catalog

## Scope
Standalone product design only. No new retro props, snack packaging mockups, visualizer or interactive storefront features.

## What's new
- Ten curated real GLB assets from Khronos glTF Sample Assets, pinned to upstream commit 8f492390ddc7a2ae221a1369ef560589cf8c70fb.
- Search by name and filter by category, download only on selection, progress/cancel/timeout, 100 MB size limit.
- Source and license links, attribution recorded on an exported GLB node. Keep CC-BY attribution and modification notice when sharing; asset license does not grant trademark rights.
- Save locally for offline reuse, existing PBR inspector/animation tools remain available. Material variants are not yet selectable.
- Catalog verification checks the actual binary containers, required extensions and embedded resources before the Intel Mac packaging job.

## Install the verified 1.5.0 baseline now
GitHub Actions run 43311944163 passed Linux and Intel Mac checks and produced the source ZIP artifact 13987335367. It does not include the new catalog.
In your existing checkout, after quitting both Studio apps, ensure there are no uncommitted changes, then:
```bash
git fetch origin feature/glb-import-studio
git merge --ff-only 64a23e9dada81efb38f6debc28315eb55bbf0ec3
bash scripts/install-mac-update.sh
```
Do not reset or force a divergent checkout. For 1.5.1 wait for the latest checks and use its verified commit instead. The source package requires Node 22+, macOS 12+, Xcode command-line tools and Python 3, not a standalone notarized .app. Actual launch and export on the destination Mac still need smoke testing. Keep the previous checkout and app bundles intact.

## Sources
See src/assets/productGlbCatalog.json for per-model creator, license, pinned upstream URL and trademark caveats. Catalog items are fetched on demand; their binary files are not committed to this repository. Source files are not overwritten. See RELEASE_1.5.0.md for the complete Mac acceptance checklist.
