#!/usr/bin/env bash
# Uninstall Antigravity FreeLLM LaunchAgent
TARGET_PLIST="$HOME/Library/LaunchAgents/com.antigravity.freellm.plist"

if [ -f "$TARGET_PLIST" ]; then
  launchctl unload "$TARGET_PLIST" 2>/dev/null || true
  rm -f "$TARGET_PLIST"
  echo "✅ FreeLLM persistent background service uninstalled successfully."
else
  echo "Service was not installed."
fi
