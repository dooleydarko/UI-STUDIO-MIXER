import React, { useState, useEffect } from 'react';
import { 
  Film, 
  Sparkles, 
  Play, 
  RotateCw, 
  Layers, 
  ShieldCheck, 
  X, 
  Sliders, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Plus
} from 'lucide-react';
import { VideoGateway } from '../video/videoGateway';
import { sessionVault } from '../video/sessionVault';
import { VideoGenerationJob, VideoProviderId, VideoAccountSession } from '../video/types';

interface VideoStudioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyAs3DTexture?: (videoUrl: string) => void;
}

export const VideoStudioDrawer: React.FC<VideoStudioDrawerProps> = ({
  isOpen,
  onClose,
  onApplyAs3DTexture,
}) => {
  const [prompt, setPrompt] = useState('Futuristic metallic cyber-cube with volumetric neon pulses and liquid chrome reflections');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [motionIntensity, setMotionIntensity] = useState<number>(7);
  const [selectedProvider, setSelectedProvider] = useState<VideoProviderId>('auto_pool');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [currentJob, setCurrentJob] = useState<VideoGenerationJob | null>(null);
  const [sessions, setSessions] = useState<VideoAccountSession[]>([]);
  const [showAccountManager, setShowAccountManager] = useState<boolean>(false);
  const [newSessionProvider, setNewSessionProvider] = useState<'higgsfield' | 'runway'>('higgsfield');
  const [newSessionToken, setNewSessionToken] = useState<string>('');
  const [newSessionCredits, setNewSessionCredits] = useState<number>(20);

  useEffect(() => {
    refreshSessions();
  }, []);

  const refreshSessions = () => {
    setSessions(sessionVault.getSessions());
  };

  if (!isOpen) return null;

  const stats = sessionVault.getStats();

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setProgressPercent(5);
    setProgressStatus('Initializing masked multi-cluster proxy daemon...');

    try {
      const job = await VideoGateway.generateVideo(
        {
          prompt,
          aspectRatio,
          durationSeconds: 5,
          motionIntensity,
          preferredProvider: selectedProvider,
        },
        (pct, status) => {
          setProgressPercent(pct);
          setProgressStatus(status);
        }
      );

      setCurrentJob(job);
      refreshSessions();
    } catch (err: any) {
      console.error('[VideoStudio] Generation failed:', err);
      setProgressStatus(`Rendering halted: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionToken.trim()) return;

    const id = `${newSessionProvider.slice(0, 2)}-cluster-${Date.now().toString().slice(-4)}`;
    sessionVault.upsertSession({
      id,
      provider: newSessionProvider,
      label: `${newSessionProvider === 'higgsfield' ? 'Higgsfield' : 'Runway'} Node (${id})`,
      sessionToken: newSessionToken.trim(),
      remainingCredits: Number(newSessionCredits) || 15,
      status: 'active',
    });

    setNewSessionToken('');
    refreshSessions();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-slate-950/95 backdrop-blur-2xl border-l border-cyan-500/30 z-50 shadow-2xl flex flex-col text-slate-100 overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/20 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Film className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-wide flex items-center gap-2">
              OmniVideo Engine <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">Multi-Account Proxy</span>
            </h2>
            <p className="text-xs text-slate-400">
              Seamless zero-knowledge video generation across Higgsfield, Runway & Zero-GPU
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Cluster Telemetry Pill */}
      <div className="px-4 py-2.5 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-cyan-300 font-mono">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>{stats.totalClustersActive} Masked Clusters Online</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-bold">{stats.totalCreditsAvailable} Pooled Credits</span>
        </div>
        <button
          onClick={() => setShowAccountManager(!showAccountManager)}
          className="text-xs text-cyan-400 hover:text-cyan-200 underline decoration-cyan-500/40"
        >
          {showAccountManager ? 'Hide Clusters' : 'Manage Nodes'}
        </button>
      </div>

      {/* Expandable Account Cluster Manager */}
      {showAccountManager && (
        <div className="p-4 bg-slate-900/90 border-b border-cyan-500/20 text-xs space-y-3 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
              Active Multi-Session Rotation Pool
            </span>
            <button
              onClick={() => {
                sessionVault.resetAllCredits();
                refreshSessions();
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" /> Reset Quotas
            </button>
          </div>

          <div className="space-y-1.5">
            {sessions.map((sess) => (
              <div 
                key={sess.id}
                className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${sess.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {sess.label}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Token: {sess.sessionToken.slice(0, 14)}•••••••• | Generated: {sess.totalGenerated}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-emerald-400 font-bold">{sess.remainingCredits}</span>
                  <span className="text-[10px] text-slate-400 ml-1">credits</span>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSession} className="pt-2 border-t border-slate-800 flex gap-2">
            <select
              value={newSessionProvider}
              onChange={(e) => setNewSessionProvider(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
            >
              <option value="higgsfield">Higgsfield</option>
              <option value="runway">Runway</option>
            </select>
            <input
              type="password"
              placeholder="Paste session cookie or JWT..."
              value={newSessionToken}
              onChange={(e) => setNewSessionToken(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Node
            </button>
          </form>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Prompt Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Motion Synthesis Prompt
          </label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe cinematic lighting, camera trajectory, motion dynamics..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition resize-none"
          />
        </div>

        {/* Configuration Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Aspect Ratio
            </label>
            <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
              {(['16:9', '9:16', '1:1'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAspectRatio(r)}
                  className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-md transition ${
                    aspectRatio === r
                      ? 'bg-cyan-500 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Active Engine Routing
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="auto_pool">⚡ Masked Free Pool (Auto-Cascade)</option>
              <option value="higgsfield">Higgsfield Soul (Motion Core)</option>
              <option value="runway">Runway Gen-3 (Cinematic)</option>
              <option value="zero_gpu">Community Zero-GPU ($0 Free)</option>
              <option value="pollinations">Pollinations Instant Stream</option>
            </select>
          </div>
        </div>

        {/* Motion Intensity Slider */}
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Dynamic Motion Velocity
            </span>
            <span className="font-mono text-cyan-400 font-bold">Level {motionIntensity} / 10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={motionIntensity}
            onChange={(e) => setMotionIntensity(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition duration-200 cursor-pointer text-sm"
        >
          {isGenerating ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>Synthesizing Video...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Synthesize Video with Masked Clusters</span>
            </>
          )}
        </button>

        {/* Live Progress Bar */}
        {isGenerating && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-cyan-300 truncate max-w-[80%]">{progressStatus}</span>
              <span className="font-mono font-bold text-cyan-400">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Rendered Video Result */}
        {currentJob && currentJob.videoUrl && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Motion Render Ready ({currentJob.elapsedMs}ms)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                Node: {currentJob.accountIdUsed || currentJob.providerUsed}
              </span>
            </div>

            <div className="rounded-lg overflow-hidden border border-slate-800 bg-black aspect-video relative group">
              <video
                src={currentJob.videoUrl}
                controls
                autoPlay
                loop
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex gap-2">
              {onApplyAs3DTexture && (
                <button
                  onClick={() => currentJob.videoUrl && onApplyAs3DTexture(currentJob.videoUrl)}
                  className="flex-1 py-2 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Layers className="w-3.5 h-3.5" /> Project onto 3D Studio Mesh
                </button>
              )}
              <a
                href={currentJob.videoUrl}
                target="_blank"
                rel="noreferrer"
                download="synthesized-video.mp4"
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download MP4
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
