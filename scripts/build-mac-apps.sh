#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$ROOT_DIR/.build-tmp"
OUT_APPS_DIR="$ROOT_DIR/apps"
INSTALL_DIR="${INSTALL_DIR:-$HOME/Applications}"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR" "$OUT_APPS_DIR"

echo "[1/4] Generating macOS icons..."
python3 "$ROOT_DIR/scripts/macos/generate_icons.py" "$TMP_DIR"
iconutil -c icns "$TMP_DIR/UIStudio.iconset" -o "$TMP_DIR/UIStudio.icns"
iconutil -c icns "$TMP_DIR/EngineFoundry.iconset" -o "$TMP_DIR/EngineFoundry.icns"

echo "[2/4] Compiling native Cocoa/WebKit app host binary..."
swiftc "$ROOT_DIR/scripts/macos/StudioAppHost.swift" \
  -O \
  -framework Cocoa \
  -framework WebKit \
  -o "$TMP_DIR/StudioAppHost"

build_bundle() {
  local app_name="$1"
  local bundle_id="$2"
  local room="$3"
  local companion="$4"
  local icns_file="$5"

  local bundle_dir="$OUT_APPS_DIR/${app_name}.app"
  rm -rf "$bundle_dir"
  mkdir -p "$bundle_dir/Contents/MacOS" "$bundle_dir/Contents/Resources"

  cp "$TMP_DIR/StudioAppHost" "$bundle_dir/Contents/MacOS/StudioAppHost"
  chmod +x "$bundle_dir/Contents/MacOS/StudioAppHost"
  cp "$icns_file" "$bundle_dir/Contents/Resources/AppIcon.icns"

  cat > "$bundle_dir/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>StudioAppHost</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>${bundle_id}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${app_name}</string>
  <key>CFBundleDisplayName</key>
  <string>${app_name}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.4.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
  <key>AGAppTitle</key>
  <string>${app_name}</string>
  <key>AGRoom</key>
  <string>${room}</string>
  <key>AGProjectRoot</key>
  <string>${ROOT_DIR}</string>
  <key>AGCompanionApp</key>
  <string>${companion}</string>
  <key>AGAppPort</key>
  <integer>4173</integer>
</dict>
</plist>
EOF
}

echo "[3/4] Assembling .app bundles in $OUT_APPS_DIR..."
build_bundle "UI Mixer Studio" "com.antigravity.uimixerstudio" "ui_playground" "AI Engine Foundry" "$TMP_DIR/UIStudio.icns"
build_bundle "AI Engine Foundry" "com.antigravity.enginefoundry" "engine_foundry" "UI Mixer Studio" "$TMP_DIR/EngineFoundry.icns"

rm -rf "$TMP_DIR"

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  echo "[4/4] Installing apps to $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"
  rm -rf "$INSTALL_DIR/UI Mixer Studio.app" "$INSTALL_DIR/AI Engine Foundry.app"
  cp -R "$OUT_APPS_DIR/UI Mixer Studio.app" "$INSTALL_DIR/UI Mixer Studio.app"
  cp -R "$OUT_APPS_DIR/AI Engine Foundry.app" "$INSTALL_DIR/AI Engine Foundry.app"
  echo "Installed:"
  echo "  - $INSTALL_DIR/UI Mixer Studio.app"
  echo "  - $INSTALL_DIR/AI Engine Foundry.app"
fi
