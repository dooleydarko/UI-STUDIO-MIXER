import React, { useState, useEffect, useRef } from 'react';
import { MixVariationResult, ComponentPackage } from '../types';
import { SandboxedPreview } from './SandboxedPreview';
import { 
  Sparkles, 
  FastForward, 
  Check, 
  Save, 
  Copy, 
  X, 
  Eye, 
  ArrowRight,
  Zap
} from 'lucide-react';

interface PackRevealModalProps {
  variations: MixVariationResult[];
  theme: 'obsidian' | 'frost';
  onCloseAndFloatToCanvas: () => void;
  onSaveToLibrary: (comp: ComponentPackage) => void;
}

export const PackRevealModal: React.FC<PackRevealModalProps> = ({
  variations,
  theme,
  onCloseAndFloatToCanvas,
  onSaveToLibrary,
}) => {
  // Animation timeline progress: 0 to 100
  const [timeline, setTimeline] = useState(0);
  const [isHoldingAccelerate, setIsHoldingAccelerate] = useState(false);
  const [activeVariationIdx, setActiveVariationIdx] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Smooth timeline loop with acceleration when held
  useEffect(() => {
    const updateTimeline = (now: number) => {
      if (lastTimeRef.current != null) {
        const delta = now - lastTimeRef.current;
        // Base rate = 25% per sec; accelerated rate = 90% per sec
        const speed = isHoldingAccelerate ? 0.09 : 0.025;
        setTimeline((prev) => {
          const next = prev + delta * speed;
          if (next >= 100) return 100;
          return next;
        });
      }
      lastTimeRef.current = now;
      if (timeline < 100) {
        requestRef.current = requestAnimationFrame(updateTimeline);
      }
    };

    requestRef.current = requestAnimationFrame(updateTimeline);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isHoldingAccelerate, timeline]);

  const handlePointerDown = () => setIsHoldingAccelerate(true);
  const handlePointerUp = () => setIsHoldingAccelerate(false);
  const handleDoubleClick = () => setTimeline(100);

  const isPackOpened = timeline > 55;
  const isFullyRevealed = timeline >= 100;

  const currentResult = variations[activeVariationIdx] || variations[0];

  const handleSaveCurrent = (comp: ComponentPackage) => {
    onSaveToLibrary(comp);
    setSavedIds((prev) => [...prev, comp.id]);
  };

  const isFrost = theme === 'frost';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-2xl select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Top Floating Acceleration Hint & Skip Bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
        <div className={`px-4 py-2 rounded-full border text-xs font-semibold flex items-center gap-2 backdrop-blur-xl ${
          isHoldingAccelerate
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
            : 'bg-white/10 text-neutral-300 border-white/10'
        }`}>
          <Zap className={`w-3.5 h-3.5 ${isHoldingAccelerate ? 'animate-bounce text-amber-400' : 'text-neutral-400'}`} />
          <span>{isHoldingAccelerate ? '⚡ ACCELERATING TIMELINE' : 'Press & Hold to Accelerate • Double-Click to Skip'}</span>
        </div>

        <button
          type="button"
          onClick={() => setTimeline(100)}
          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 border border-white/10 text-xs font-medium transition-colors"
        >
          Skip Animation
        </button>
      </div>

      {/* Main Pack Opening & Card Stage */}
      <div className="w-full max-w-6xl h-[86vh] flex flex-col items-center justify-center relative">
        {/* Phase 1: Sealed Matte-Black Foil Pack */}
        {!isPackOpened && (
          <div 
            style={{
              transform: `scale(${1 + (timeline / 100) * 0.15}) rotateY(${(timeline / 100) * 15}deg)`,
              filter: `drop-shadow(0 20px 40px rgba(56,189,248,${(timeline / 100) * 0.4}))`,
            }}
            className="w-72 h-96 rounded-3xl bg-gradient-to-br from-[#1c1c1c] via-[#0d0d0d] to-[#050505] border-2 border-sky-500/40 shadow-2xl flex flex-col items-center justify-between p-6 relative overflow-hidden transition-transform duration-100"
          >
            {/* Holographic foil sheen */}
            <div 
              style={{ transform: `translateX(${(timeline - 50) * 4}%)` }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none"
            />
            <div className="text-center">
              <span className="text-[10px] font-mono tracking-widest text-sky-400 uppercase font-bold">
                ANTIGRAVITY PACK
              </span>
              <h3 className="text-lg font-black tracking-tight text-white mt-1">CODE MIXER</h3>
            </div>

            <div className="w-20 h-20 rounded-full border border-sky-500/40 flex items-center justify-center bg-sky-500/10">
              <Sparkles className="w-8 h-8 text-sky-400 animate-pulse" />
            </div>

            <div className="text-center">
              <span className="text-xs text-neutral-400 font-medium">3 Curated Variations Inside</span>
              <div className="w-44 h-1.5 bg-neutral-800 rounded-full mt-3 overflow-hidden">
                <div 
                  style={{ width: `${timeline}%` }}
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-75"
                />
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Opened Pack -> 3 Fanning Result Cards */}
        {isPackOpened && (
          <div className="w-full h-full flex flex-col items-center justify-between">
            {/* Variation Selection Tabs */}
            <div className="flex items-center gap-3 z-30">
              {variations.map((v, idx) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveVariationIdx(idx)}
                  className={`px-4 py-2 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2 ${
                    activeVariationIdx === idx
                      ? v.type === 'refined'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                        : v.type === 'reimagined'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                        : 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                      : 'bg-black/40 text-neutral-400 border-white/10 hover:text-white'
                  }`}
                >
                  <span className="uppercase tracking-wider">{v.type}</span>
                  {savedIds.includes(v.component.id) && (
                    <Check className="w-3 h-3 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Active Variation Live Showcase Stage */}
            <div className="flex-1 w-full max-w-4xl flex items-center justify-center p-4">
              <div className={`w-full max-w-2xl h-[56vh] rounded-3xl border shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl ${
                isFrost ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#080808] border-white/15 text-neutral-100'
              }`}>
                {/* Header */}
                <div className={`px-5 py-3 flex items-center justify-between border-b ${
                  isFrost ? 'border-slate-100 bg-slate-50' : 'border-white/[0.08] bg-black/40'
                }`}>
                  <div>
                    <h4 className="text-sm font-bold tracking-tight">{currentResult.title}</h4>
                    <p className="text-[11px] text-neutral-400">{currentResult.conceptSummary}</p>
                    {currentResult.trace && currentResult.trace.length > 0 && (
                      <div className="mt-1.5 max-h-16 overflow-y-auto text-[10px] leading-snug text-neutral-400">
                        <span className="font-semibold uppercase tracking-wider text-sky-400">
                          {currentResult.traceMode === 'requested' ? 'The AI was asked to pull' : 'Pulled'}
                        </span>
                        {currentResult.trace.map((t, i) => (
                          <div key={i}>
                            <span className="text-neutral-200">{t.from}</span> {t.what.toLowerCase()}
                            {t.detail ? ` (${t.detail})` : ''} {'\u2192'} <span className="text-neutral-200">{t.to}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveCurrent(currentResult.component)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-900/30"
                    >
                      {savedIds.includes(currentResult.component.id) ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Variation</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Sandboxed Interactive Preview */}
                <div className="flex-1 relative overflow-hidden bg-black">
                  <SandboxedPreview
                    html={currentResult.component.html}
                    css={currentResult.component.css}
                    js={currentResult.component.js}
                    theme={theme}
                    interactive={true}
                    className="w-full h-full"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Floating Return / Float to Canvas Button */}
            <div className="pb-4 z-30 flex items-center gap-4">
              <button
                type="button"
                onClick={onCloseAndFloatToCanvas}
                className="px-8 py-3 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 hover:opacity-95 text-black font-extrabold text-sm flex items-center gap-2 shadow-2xl shadow-sky-500/30 transition-all hover:scale-105"
              >
                <span>Float Cards to Canvas & Return</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
