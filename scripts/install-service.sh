#!/usr/bin/env bash
# Install Antigravity FreeLLM Proxy Daemon as a persistent macOS LaunchAgent
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_SOURCE="$SCRIPT_DIR/com.antigravity.freellm.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/com.antigravity.freellm.plist"

mkdir -p "$TARGET_DIR"

# Stop existing if running
if launchctl list 2>/dev/null | grep -q "com.antigravity.freellm"; then
  echo "Stopping existing service..."
  launchctl unload "$TARGET_PLIST" 2>/dev/null || true
fi

echo "Copying plist to $TARGET_PLIST..."
cp "$PLIST_SOURCE" "$TARGET_PLIST"

echo "Loading and registering service with launchd..."
launchctl load -w "$TARGET_PLIST"

echo "========================================================"
echo "✅ FreeLLM Persistent Background Service Installed!"
echo "Service: com.antigravity.freellm"
echo "Status: Running on http://localhost:3001"
echo "Persistence: Starts automatically on system boot/login"
echo "Logs: /tmp/freellm-daemon.log"
echo "========================================================"
