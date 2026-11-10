import React, { useState } from 'react';
import { Sparkles, Loader2, ArrowRight, Wand2, Cpu, ChevronDown } from 'lucide-react';
import { generateNativeUi, GenerationProgress } from '../ai/nativeUiGenerator';
import { ComponentPackage } from '../types';

export type EngineMode = 'hybrid' | 'webgpu' | 'ast' | 'gemini';

interface NativePromptBarProps {
  theme: 'obsidian' | 'frost';
  onComponentGenerated: (comp: ComponentPackage) => void;
}

export const NativePromptBar: React.FC<NativePromptBarProps> = ({
  theme,
  onComponentGenerated,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [engineMode, setEngineMode] = useState<EngineMode>('hybrid');
  const [showEngineMenu, setShowEngineMenu] = useState(false);

  const isFrost = theme === 'frost';

  const engineLabels: Record<EngineMode, { label: string; desc: string }> = {
    hybrid: { label: '⚡ Hybrid (WebGPU + AST)', desc: 'Instant blueprint preview + progressive GPU refinement' },
    webgpu: { label: '🧠 WebGPU Shader Engine', desc: '100% offline local GPU shader compute' },
    ast: { label: '⚙️ Parametric AST (15ms)', desc: 'Zero-latency deterministic blueprint synthesizer' },
    gemini: { label: '☁️ Gemini 2.5 Flash', desc: 'Deep semantic cloud generation (requires key)' },
  };

  const handleGenerate = async (customPrompt?: string) => {
    const text = (customPrompt || prompt).trim();
    if (!text || isGenerating) return;

    setIsGenerating(true);
    setProgress({ step: 'analyzing', message: `Initializing ${engineLabels[engineMode].label}...` });

    try {
      const pkg = await generateNativeUi(text, setProgress, engineMode);
      onComponentGenerated(pkg);
      setPrompt('');
      setProgress(null);
    } catch (err) {
      console.error('Generation failed:', err);
      setProgress({ step: 'ready', message: 'Generation failed. Please try again.' });
      setTimeout(() => setProgress(null), 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  const chips = [
    { label: '⚡ Telemetry Gauge', prompt: 'glowing speedometer telemetry gauge with live dial' },
    { label: '🎛️ Tactical Switch', prompt: 'tactical glowing power toggle switch' },
    { label: '◈ Quantum Card', prompt: 'glassmorphic obsidian card with glowing badge' },
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto">
      {/* Liquid Glass Prompt Pill */}
      <div className={`flex items-center gap-2 p-1.5 pl-3.5 rounded-full backdrop-blur-2xl border shadow-2xl transition-all w-[380px] md:w-[600px] ${
        isFrost
          ? 'bg-white/85 border-slate-200/90 shadow-slate-300/50 text-slate-800'
          : 'bg-black/70 border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15)] text-neutral-100'
      }`}>
        {/* Engine Mode Dropdown Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEngineMenu((prev) => !prev)}
            className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1 transition-colors ${
              isFrost
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                : 'bg-white/10 hover:bg-white/15 border-white/15 text-sky-300'
            }`}
            title="Switch Synthesis Engine"
          >
            <Cpu className="w-3 h-3 text-sky-400" />
            <span className="truncate max-w-[110px]">{engineLabels[engineMode].label.split(' ')[0]} {engineLabels[engineMode].label.split(' ')[1]}</span>
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {showEngineMenu && (
            <div className={`absolute top-full left-0 mt-2 w-64 rounded-xl border p-1.5 shadow-2xl z-50 backdrop-blur-xl ${
              isFrost ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-[#0a0d14]/95 border-white/10 text-neutral-100'
            }`}>
              {(Object.keys(engineLabels) as EngineMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setEngineMode(mode);
                    setShowEngineMenu(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 ${
                    engineMode === mode
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'hover:bg-white/5 text-neutral-300'
                  }`}
                >
                  <span className="font-bold">{engineLabels[mode].label}</span>
                  <span className="text-[10px] text-neutral-400">{engineLabels[mode].desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleGenerate();
            }
          }}
          disabled={isGenerating}
          placeholder={
            isGenerating
              ? progress?.message || 'Synthesizing with engine...'
              : 'Prompt our engine (e.g. glowing speed gauge, cyber card)...'
          }
          className={`flex-1 bg-transparent text-xs focus:outline-none placeholder:text-neutral-500 min-w-0 ${
            isGenerating ? 'italic text-sky-400' : ''
          }`}
        />
        <button
          type="button"
          onClick={() => handleGenerate()}
          disabled={isGenerating || !prompt.trim()}
          className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 disabled:opacity-40 text-black text-[11px] font-bold transition-all shadow-md shadow-sky-500/25 flex items-center gap-1 shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Building...</span>
            </>
          ) : (
            <>
              <span>Generate</span>
              <ArrowRight className="w-3 h-3" />
            </>
          )}
        </button>
      </div>

      {/* Quick Suggestion Chips */}
      {!isGenerating && (
        <div className="flex items-center gap-1.5 opacity-75 hover:opacity-100 transition-opacity">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => handleGenerate(c.prompt)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border transition-all ${
                isFrost
                  ? 'bg-white/60 hover:bg-white border-slate-200 text-slate-600'
                  : 'bg-black/40 hover:bg-white/10 border-white/[0.08] text-neutral-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
