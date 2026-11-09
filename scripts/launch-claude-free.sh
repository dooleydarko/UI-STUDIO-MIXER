#!/usr/bin/env bash
# Launch Claude Code routed through Antigravity FreeLLM 7.4B Token Proxy
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_KEY="sk-ant-free-pool-token"

echo "========================================================"
echo "⚡ Antigravity FreeLLM Gateway: Claude Code Unmetered Mode"
echo "Target Proxy: http://localhost:3001 (Anthropic Messages API)"
echo "Quota: 7.4 Billion Monthly Free Tokens Pooled"
echo "========================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_CLAUDE="$SCRIPT_DIR/../node_modules/.bin/claude"

if [ -f "$LOCAL_CLAUDE" ]; then
  "$LOCAL_CLAUDE" "$@"
elif command -v claude >/dev/null 2>&1; then
  claude "$@"
else
  echo "Running via npx..."
  npx @anthropic-ai/claude-code "$@"
fi
