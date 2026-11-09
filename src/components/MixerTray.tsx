import React, { useState } from 'react';
import { ComponentPackage } from '../types';
import { 
  Sparkles, 
  X, 
  Sliders, 
  Send, 
  Layers, 
  ChevronUp, 
  ChevronDown, 
  Cpu, 
  Activity,
  CheckCircle2
} from 'lucide-react';

interface MixerTrayProps {
  stagedComponents: ComponentPackage[];
  theme: 'obsidian' | 'frost';
  isMixing: boolean;
  supervisorStep: string;
  supervisorMessage: string;
  onRemoveFromTray: (id: string) => void;
  onClearTray: () => void;
  onStartMix: (prompt: string, freedom: number) => void;
}

export const MixerTray: React.FC<MixerTrayProps> = ({
  stagedComponents,
  theme,
  isMixing,
  supervisorStep,
  supervisorMessage,
  onRemoveFromTray,
  onClearTray,
  onStartMix,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [freedom, setFreedom] = useState(0.75);

  const isFrost = theme === 'frost';

  if (stagedComponents.length === 0 && !isMixing) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-full max-w-md transition-all duration-300">
      <div className={`rounded-3xl border shadow-2xl backdrop-blur-2xl overflow-hidden ${
        isFrost 
          ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-400/30' 
          : 'bg-[#080808]/95 border-white/[0.12] text-neutral-100 shadow-[0_16px_48px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.15)]'
      }`}>
        {/* Tray Header Bar */}
        <div className={`px-5 py-3 flex items-center justify-between border-b ${
          isFrost ? 'border-slate-100 bg-slate-50/70' : 'border-white/[0.06] bg-black/40'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-tight block">Code Mixer Tray</span>
              <span className={`text-[10px] ${isFrost ? 'text-slate-500' : 'text-neutral-400'}`}>
                {stagedComponents.length} component{stagedComponents.length === 1 ? '' : 's'} queued
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isFrost ? 'hover:bg-slate-200 border-slate-200 text-slate-600' : 'hover:bg-white/10 border-white/10 text-neutral-400'
              }`}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClearTray}
              className={`p-1.5 rounded-lg border transition-colors hover:text-red-400 ${
                isFrost ? 'hover:bg-slate-200 border-slate-200 text-slate-500' : 'hover:bg-white/10 border-white/10 text-neutral-400'
              }`}
              title="Clear all from tray"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tray Body */}
        {isExpanded && (
          <div className="p-4 flex flex-col gap-3.5">
            {/* Staged Component Chips */}
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
              {stagedComponents.map((comp) => (
                <div
                  key={comp.id}
                  className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${
                    isFrost 
                      ? 'bg-slate-100 border-slate-200 text-slate-700' 
                      : 'bg-neutral-900 border-white/10 text-neutral-200'
                  }`}
                >
                  <span className="truncate max-w-[140px] font-medium">{comp.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveFromTray(comp.id)}
                    className="text-neutral-500 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Prompt Input */}
            <div>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Direct the mix (e.g. blend metallic dial into cyber card)..."
                disabled={isMixing}
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                  isFrost 
                    ? 'bg-slate-50 border-slate-200 text-slate-800' 
                    : 'bg-neutral-950 border-white/10 text-white'
                }`}
              />
            </div>

            {/* Creative Freedom Slider */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isFrost ? 'text-slate-500' : 'text-neutral-400'}`}>
                Strict (0.1)
              </span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={freedom}
                onChange={(e) => setFreedom(parseFloat(e.target.value))}
                disabled={isMixing}
                className="flex-1 accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isFrost ? 'text-slate-500' : 'text-neutral-400'}`}>
                Wild (1.0)
              </span>
            </div>

            {/* Supervisor Status HUD if mixing */}
            {isMixing && (
              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex flex-col gap-1.5 animate-pulse">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-400">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>Supervisor: {supervisorStep.toUpperCase()}</span>
                  </span>
                  <span className="text-[10px] font-mono">3 Variations</span>
                </div>
                <p className="text-[11px] text-sky-300/80 truncate">
                  {supervisorMessage}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1 flex items-center justify-between">
              <span className={`text-[10px] font-mono ${isFrost ? 'text-slate-400' : 'text-neutral-500'}`}>
                Generates: Refined, Reimagined, Exp
              </span>
              <button
                type="button"
                onClick={() => onStartMix(prompt, freedom)}
                disabled={isMixing || stagedComponents.length === 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-black text-xs font-bold transition-all shadow-lg shadow-sky-500/25 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isMixing ? 'Mixing Variations...' : 'Mix 3 Variations'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
