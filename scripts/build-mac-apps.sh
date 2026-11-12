#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$ROOT_DIR/.build-tmp"
OUT_APPS_DIR="$ROOT_DIR/apps"
INSTALL_DIR="${INSTALL_DIR:-$HOME/Applications}"
APP_VERSION="${APP_VERSION:-1.5.0}"
BUILD_NUMBER="${BUILD_NUMBER:-2}"
export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-12.0}"

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

  local escaped_root
  escaped_root=$(printf '%s' "$ROOT_DIR" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g')
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
  <string>${APP_VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${BUILD_NUMBER}</string>
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
  <string>${escaped_root}</string>
  <key>AGCompanionApp</key>
  <string>${companion}</string>
  <key>AGAppPort</key>
  <integer>4173</integer>
</dict>
</plist>
EOF
  plutil -lint "$bundle_dir/Contents/Info.plist"
  codesign --force --sign - "$bundle_dir"
  codesign --verify --strict "$bundle_dir"
}

echo "[3/4] Assembling .app bundles in $OUT_APPS_DIR..."
build_bundle "UI Mixer Studio" "com.antigravity.uimixerstudio" "ui_playground" "AI Engine Foundry" "$TMP_DIR/UIStudio.icns"
build_bundle "AI Engine Foundry" "com.antigravity.enginefoundry" "engine_foundry" "UI Mixer Studio" "$TMP_DIR/EngineFoundry.icns"

rm -rf "$TMP_DIR"

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  echo "[4/4] Installing apps to $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"
  BACKUP_DIR="$INSTALL_DIR/.ui-studio-backup-$(date +%Y%m%d-%H%M%S)-$$"
  mkdir -p "$BACKUP_DIR"
  for app_name in 'UI Mixer Studio' 'AI Engine Foundry'; do
    target="$INSTALL_DIR/$app_name.app"
    staged="$INSTALL_DIR/.$app_name.app.new-$$"
    ditto "$OUT_APPS_DIR/$app_name.app" "$staged"
    if [ -e "$target" ]; then mv "$target" "$BACKUP_DIR/$app_name.app"; fi
    if ! mv "$staged" "$target"; then
      if [ -e "$BACKUP_DIR/$app_name.app" ]; then mv "$BACKUP_DIR/$app_name.app" "$target"; fi
      exit 1
    fi
  done
  echo "Previous application bundles backed up to: $BACKUP_DIR"
  echo "Installed:"
  echo "  - $INSTALL_DIR/UI Mixer Studio.app"
  echo "  - $INSTALL_DIR/AI Engine Foundry.app"
fi
