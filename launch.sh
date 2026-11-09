#!/usr/bin/env bash
# Quick launcher for Antigravity Code Mixer & 3D Product Studio
cd "$(dirname "$0")" || exit 1
echo "🚀 Starting Antigravity Code Mixer & 3D Product Studio..."
echo "📍 Workspace: $(pwd)"
echo "🌐 Opening at: http://localhost:5173"
npm run dev
