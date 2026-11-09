#!/usr/bin/env bash
# Launch Claude Code routed through Antigravity FreeLLM 7.4B Token Proxy
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_KEY="sk-ant-free-pool-token"

echo "========================================================"
echo "⚡ Antigravity FreeLLM Gateway: Claude Code Unmetered Mode"
echo "Target Proxy: http://localhost:3001 (Anthropic Messages API)"
echo "Quota: 7.4 Billion Monthly Free Tokens Pooled"
echo "========================================================"

if command -v claude >/dev/null 2>&1; then
  claude "$@"
else
  echo "Claude Code CLI not found in PATH. You can install via: npm install -g @anthropic-ai/claude-code"
  echo "Or run with npx: npx @anthropic-ai/claude-code $@"
fi
