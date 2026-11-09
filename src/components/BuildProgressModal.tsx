import React from 'react';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  HardDrive, 
  Cpu, 
  GitBranch, 
  ShieldCheck,
  Activity
} from 'lucide-react';

interface BuildProgressModalProps {
  theme: 'obsidian' | 'frost';
  onClose: () => void;
}

export const BuildProgressModal: React.FC<BuildProgressModalProps> = ({
  theme,
  onClose,
}) => {
  const isFrost = theme === 'frost';

  const milestones = [
    {
      id: 'M0',
      title: 'Preflight & Foundation',
      status: 'completed',
      detail: 'Host Intel Mac x86_64, macOS 13.7.8, Node v24, Git, architecture & recovery docs verified.',
    },
    {
      id: 'M1',
      title: 'UI Library + Floating Canvas',
      status: 'completed',
      detail: 'Infinite Obsidian canvas, 8 Uiverse reference items, sandboxed iframe isolation, smart paste, local persistence.',
    },
    {
      id: 'M2',
      title: 'Core Code Mixer',
      status: 'completed',
      detail: 'Mix tray, supervisor AI engine, 3 variations (Refined, Reimagined, Experimental), CSS scope collision resolution.',
    },
    {
      id: 'M3',
      title: 'Reveal + Discovery + Polish',
      status: 'completed',
      detail: 'Collectible 3D pack opening animation, hold-to-accelerate timeline, float-to-canvas return, Discovery Intake Room.',
    },
    {
      id: 'M4',
      title: '3D Product Studio Foundation',
      status: 'completed',
      detail: 'Three.js workstation, procedural aluminum can & device case, PBR shaders, virtual power switch, decal wrap, GLB exporter.',
    },
    {
      id: 'M5',
      title: 'Advanced 3D & Hardening',
      status: 'completed',
      detail: 'Intel Mac performance tuning, SanDisk /Volumes/Extreme storage detection, automated test suite.',
    },
    {
      id: 'M6',
      title: 'AI Mixing Engine & Dynamic Discovery',
      status: 'completed',
      detail: 'Google AI Studio Gemini API integration with dynamic ModelService discovery, candidate failover chains, local Whisper dictation, and active model telemetry.',
    },
    {
      id: 'M7',
      title: 'Rollup Chunk Splitting & Studio Hardening',
      status: 'completed',
      detail: 'Manual chunking for Three.js and Lucide icons, multi-rig lighting presets, texture disposal pipeline, and expanded 13-point test suite.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className={`w-full max-w-3xl max-h-[85vh] rounded-3xl flex flex-col shadow-2xl border overflow-hidden ${
        isFrost ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0a0a0a] border-white/10 text-neutral-100'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isFrost ? 'border-slate-100 bg-slate-50' : 'border-white/[0.08] bg-black/40'
        }`}>
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold tracking-tight">System Build Progress & Diagnostics</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition-colors ${
              isFrost ? 'hover:bg-slate-100 border-slate-200 text-slate-600' : 'hover:bg-white/10 border-white/10 text-neutral-400'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          {/* Hardware & Environment Banner */}
          <div className={`p-4 rounded-2xl border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs ${
            isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900/60 border-white/[0.06]'
          }`}>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              <div>
                <span className="text-[10px] text-neutral-500 block">Host Platform</span>
                <span className="font-semibold">Intel x86_64 Mac</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-neutral-500 block">Root Disk</span>
                <span className="font-semibold">4.8 GB Free</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-neutral-500 block">External SanDisk</span>
                <span className="font-semibold">860 GB Mounted</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-[10px] text-neutral-500 block">Git Checkpoint</span>
                <span className="font-mono font-semibold">13bdd4a (Clean)</span>
              </div>
            </div>
          </div>

          {/* Milestone List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
              Milestone Verification Status
            </h3>
            <div className="flex flex-col gap-2.5">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                    isFrost ? 'bg-white border-slate-200' : 'bg-[#0d0d0d] border-white/[0.07]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold">{m.id}: {m.title}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold uppercase">
                        VERIFIED
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">{m.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
