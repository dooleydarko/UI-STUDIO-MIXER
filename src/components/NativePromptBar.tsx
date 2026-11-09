import React, { useState } from 'react';
import { Sparkles, Loader2, ArrowRight, Wand2 } from 'lucide-react';
import { generateNativeUi, GenerationProgress } from '../ai/nativeUiGenerator';
import { ComponentPackage } from '../types';

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

  const isFrost = theme === 'frost';

  const handleGenerate = async (customPrompt?: string) => {
    const text = (customPrompt || prompt).trim();
    if (!text || isGenerating) return;

    setIsGenerating(true);
    setProgress({ step: 'analyzing', message: 'Starting native synthesis...' });

    try {
      const pkg = await generateNativeUi(text, setProgress);
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
      <div className={`flex items-center gap-2 p-1.5 pl-3.5 rounded-full backdrop-blur-2xl border shadow-2xl transition-all w-[360px] md:w-[540px] ${
        isFrost
          ? 'bg-white/85 border-slate-200/90 shadow-slate-300/50 text-slate-800'
          : 'bg-black/70 border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15)] text-neutral-100'
      }`}>
        <Wand2 className="w-4 h-4 text-sky-400 shrink-0" />
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
              ? progress?.message || 'Synthesizing with native engine...'
              : 'Prompt our native engine (e.g. glowing speed gauge, cyber card)...'
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
