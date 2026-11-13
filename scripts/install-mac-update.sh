#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [ "$(uname -s)" != Darwin ]; then echo "This installer requires macOS."; exit 1; fi
for tool in node npm python3 swiftc iconutil codesign plutil; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool"; exit 1; }
done
node -e 'if (+process.versions.node.split(".")[0] < 22) { console.error("Node 22 or newer required"); process.exit(1) }'
if pgrep -x StudioAppHost >/dev/null 2>&1; then
  echo "Quit UI Mixer Studio and AI Engine Foundry before installing."
  exit 1
fi
# Preserve the original workspace, application IDs, port and data stores.
# Never clear localStorage, IndexedDB, external drive data or the app support directory.
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
npm ci --ignore-scripts
npm run build
node --test tests/glbStudio.test.mjs
npm test
# Only install after all checks; builder creates both bundles before installation.
bash scripts/build-mac-apps.sh
echo "Installed UI Studio Mixer 2.0.0 candidate. Open UI Mixer Studio from Applications."
echo "If an old local server is running from a different checkout, stop that specific server before relaunching."
