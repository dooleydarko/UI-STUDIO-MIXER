import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Download,
  Terminal,
  Sparkles,
  Cpu,
  Layers,
  X,
  ShieldCheck,
} from 'lucide-react';

interface ProxyHealth {
  status: string;
  port: number;
  configuredProviders: string[];
  unconfiguredProviders: string[];
  note?: string;
}

interface UpdatePatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspace: 'ui_playground' | '3d_studio' | 'discovery' | 'engine_foundry';
  onSwitchWorkspace: (ws: 'ui_playground' | '3d_studio' | 'discovery' | 'engine_foundry') => void;
  onSyncStorage: () => void;
  theme: 'obsidian' | 'frost';
}

const PATCH_NOTES = [
  {
    version: 'v1.4.0',
    commit: 'live-pwa',
    date: '2026-11-10',
    target: 'Both Apps (UI Studio + AI Engine Foundry)',
    title: 'Standalone App Icons, PWA Manifests & Update Patch Menu',
    items: [
      'Added custom SVG app emblems (/icon-ui-studio.svg & /icon-engine-foundry.svg) and standalone manifests.',
      'Added direct Canvas Mirror mode to AI Engine Foundry alongside the Server Blade Rack layout.',
      'Integrated live Update & Patch Menu with proxy health diagnostics and storage hot-sync.',
    ],
  },
  {
    version: 'v1.3.2',
    commit: 'e5bca6e',
    date: '2026-11-09',
    target: 'AI Engine Foundry + Proxy Daemon',
    title: 'GitHub Models Token Support, Hot-Reload .env.local & Live Foundry Test',
    items: [
      'Added GITHUB_TOKEN (GitHub Models gpt-4o-mini) to scripts/freeLlmDaemon.js.',
      'Proxy now hot-reloads .env.local on every request without needing a daemon restart.',
      'Wired EngineFoundryRoom Test Prompt button directly to http://localhost:3001/v1/chat/completions.',
    ],
  },
  {
    version: 'v1.3.0',
    commit: '987859e',
    date: '2026-11-09',
    target: 'FreeLLM Proxy Daemon (Port 3001)',
    title: 'Real Multi-Provider Forwarding & Automatic Failover',
    items: [
      'Forwards OpenAI and Anthropic requests to Groq, Cerebras, Google AI Studio Gemini, and OpenRouter.',
      'Returns honest 503 status when no provider keys are configured in .env.local.',
    ],
  },
  {
    version: 'v1.2.0',
    commit: '97fd5e5',
    date: '2026-11-09',
    target: 'AI Engine Foundry + Storage Backbone',
    title: 'Engine Foundry Room & Replicated Storage Manager',
    items: [
      'Replicated UI Library storage methods (loadEngines, saveEngines, addEngine, updateEngine, deleteEngine).',
      'Added Hybrid Engine Mixer and custom emblem schema slots.',
    ],
  },
];

export const UpdatePatchModal: React.FC<UpdatePatchModalProps> = ({
  isOpen,
  onClose,
  activeWorkspace,
  onSwitchWorkspace,
  onSyncStorage,
  theme,
}) => {
  const [proxyHealth, setProxyHealth] = useState<ProxyHealth | null>(null);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isBuildingUpdate, setIsBuildingUpdate] = useState(false);
  const [updateLog, setUpdateLog] = useState<string | null>(null);
  const [appCommit, setAppCommit] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('Just now');

  const checkProxyAndSync = async () => {
    setIsChecking(true);
    setProxyError(null);
    onSyncStorage();
    try {
      const res = await fetch('http://localhost:3001/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProxyHealth(data);
    } catch (err: unknown) {
      setProxyHealth(null);
      setProxyError(err instanceof Error ? err.message : 'Unreachable');
    }

    try {
      const statusRes = await fetch('http://127.0.0.1:4173/api/app-status');
      if (statusRes.ok) {
        const st = await statusRes.json();
        setAppCommit(st.commit || null);
      }
    } catch {
      // Running in Vite dev server rather than desktop appServer
    } finally {
      setLastSyncedAt(new Date().toLocaleTimeString());
      setIsChecking(false);
    }
  };

  const handleRebuildUpdate = async () => {
    setIsBuildingUpdate(true);
    setUpdateLog('Running npm run build via local desktop app server...');
    try {
      const res = await fetch('http://127.0.0.1:4173/api/app-update', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setUpdateLog(`Build failed:\n${data.log || data.message || `HTTP ${res.status}`}`);
      } else {
        setAppCommit(data.commit || null);
        setUpdateLog(`Update applied cleanly (${data.commit || 'latest'}). Reloading app...`);
        setTimeout(() => window.location.reload(), 900);
      }
    } catch (err: unknown) {
      setUpdateLog(
        `Desktop app update server not reachable on :4173 (${err instanceof Error ? err.message : 'offline'}). Launch from UI Mixer Studio.app or AI Engine Foundry.app.`
      );
    } finally {
      setIsBuildingUpdate(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkProxyAndSync();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isFrost = theme === 'frost';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] ${
          isFrost
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-neutral-950 border-white/15 text-neutral-100'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-neutral-900 to-cyan-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
              <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Unified App Update & Patch Center</h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  v1.4.0 Live
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Manage updates, app icons, home-screen installation, and live proxy status for both applications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Two Standalone Applications Card */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5">
              1. Standalone Applications & Physical App Icons (Save to Dock / Home Screen)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* UI Studio App Card */}
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/15 flex items-start gap-3.5">
                <img
                  src="/icon-ui-studio.svg"
                  alt="UI Studio App Icon"
                  className="w-14 h-14 rounded-2xl shadow-lg border border-purple-400/30 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">UI Mixer Studio</span>
                    {activeWorkspace === 'ui_playground' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Infinite Canvas UI Component Library & Code Synthesis
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <button
                      onClick={() => {
                        onSwitchWorkspace('ui_playground');
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Layers className="w-3 h-3" />
                      <span>Switch Here</span>
                    </button>
                    <a
                      href="/?room=ui_playground"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg border border-white/15 hover:bg-white/10 text-[11px] font-medium flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open App Tab</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* AI Engine Foundry App Card */}
              <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/15 flex items-start gap-3.5">
                <img
                  src="/icon-engine-foundry.svg"
                  alt="AI Engine Foundry Icon"
                  className="w-14 h-14 rounded-2xl shadow-lg border border-cyan-400/30 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">AI Engine Foundry</span>
                    {activeWorkspace === 'engine_foundry' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Direct UI Mirror Canvas + Modular AI Engine Blades & Proxy
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <button
                      onClick={() => {
                        onSwitchWorkspace('engine_foundry');
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Cpu className="w-3 h-3" />
                      <span>Switch Here</span>
                    </button>
                    <a
                      href="/?room=engine_foundry"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg border border-white/15 hover:bg-white/10 text-[11px] font-medium flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open App Tab</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-neutral-300 flex items-center justify-between gap-2">
              <span>
                💡 <strong>To save either app with its physical icon to your Mac Dock / Home Screen:</strong> Open its tab above, then in Safari click <strong>File → Add to Dock...</strong> or in Chrome click the <strong>Install App</strong> icon in the address bar.
              </span>
            </div>
          </div>

          {/* Live Proxy & Hot-Patch Controls */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                2. Live Update Sync & Free-Tier Proxy Status (localhost:3001)
              </h3>
              <span className="text-[11px] text-neutral-500 font-mono">Last checked: {lastSyncedAt}</span>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-neutral-900/70 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                {proxyHealth ? (
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {proxyHealth.configuredProviders.length > 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">
                          Proxy Online — Active Keys: {proxyHealth.configuredProviders.join(', ')}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300">
                          Proxy Listening on :3001 (No API Keys Set in .env.local Yet)
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Proxy Daemon Offline ({proxyError || 'Run npm run proxy:freellm'})</span>
                  </div>
                )}
                <p className="text-[11px] text-neutral-400">
                  Add GITHUB_TOKEN, GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY to <code className="text-cyan-300">.env.local</code> and click Sync below.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRebuildUpdate}
                  disabled={isBuildingUpdate}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Download className={`w-3.5 h-3.5 ${isBuildingUpdate ? 'animate-bounce' : ''}`} />
                  <span>{isBuildingUpdate ? 'Rebuilding App...' : 'Rebuild & Apply Update'}</span>
                </button>
                <button
                  onClick={checkProxyAndSync}
                  disabled={isChecking}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>Sync Storage & Reload Keys</span>
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-2 rounded-xl border border-white/15 hover:bg-white/10 text-xs font-semibold transition"
                >
                  Hard Reload App
                </button>
              </div>
              {appCommit && (
                <div className="w-full text-[11px] font-mono text-neutral-400">
                  Running desktop build: <span className="text-cyan-300">{appCommit}</span>
                </div>
              )}
              {updateLog && (
                <pre className="w-full p-2.5 rounded-lg bg-black border border-cyan-500/30 text-[10px] font-mono text-cyan-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {updateLog}
                </pre>
              )}
            </div>
          </div>

          {/* Unified Patch History */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5">
              3. Unified Workflow Patch Log
            </h3>
            <div className="space-y-2.5">
              {PATCH_NOTES.map((patch) => (
                <div
                  key={patch.version}
                  className="p-3.5 rounded-xl border border-white/10 bg-neutral-900/40 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-cyan-400 font-mono">{patch.version}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">
                        {patch.commit}
                      </span>
                      <span className="text-xs font-semibold text-neutral-100">{patch.title}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">{patch.target}</span>
                  </div>
                  <ul className="text-[11px] text-neutral-400 list-disc list-inside space-y-0.5">
                    {patch.items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-neutral-900/80 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Both apps share the unified storage backbone and update simultaneously on every patch.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
