import React from 'react';
import {
  Play,
  Copy,
  Check,
  Layers,
  Flame,
  Code2,
  Image as ImageIcon,
  GripVertical,
} from 'lucide-react';
import { EnginePackage } from './types';

interface EngineCardProps {
  engine: EnginePackage;
  theme: 'obsidian' | 'frost';
  isSelectedForMix: boolean;
  copiedId: string | null;
  draggable?: boolean;
  onRunTest: (eng: EnginePackage) => void;
  onCopyEndpoint: (eng: EnginePackage) => void;
  onToggleMix: (id: string) => void;
  onOpenCodeEmblem: (eng: EnginePackage) => void;
  onDragStart?: (e: React.MouseEvent, eng: EnginePackage) => void;
}

export const EngineCard: React.FC<EngineCardProps> = ({
  engine: eng,
  theme,
  isSelectedForMix,
  copiedId,
  draggable = false,
  onRunTest,
  onCopyEndpoint,
  onToggleMix,
  onOpenCodeEmblem,
  onDragStart,
}) => {
  const isFrost = theme === 'frost';

  return (
    <div
      style={
        draggable
          ? {
              position: 'absolute',
              left: eng.canvasX ?? 0,
              top: eng.canvasY ?? 0,
              width: 310,
            }
          : undefined
      }
      className={`group rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 ${
        isSelectedForMix
          ? 'border-purple-500 bg-purple-950/30 shadow-lg shadow-purple-500/15'
          : isFrost
          ? 'bg-white border-slate-200 hover:border-cyan-400 hover:shadow-md'
          : 'bg-neutral-900/80 border-white/10 hover:border-cyan-500/50 hover:bg-neutral-900/95 shadow-xl'
      }`}
    >
      <div>
        {/* Top Badges & Emblem */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {draggable && (
              <button
                type="button"
                onMouseDown={(e) => onDragStart?.(e, eng)}
                className="p-1 -ml-1 rounded cursor-grab active:cursor-grabbing text-neutral-500 hover:text-cyan-400"
                title="Drag engine card on canvas"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
            {eng.emblemSvg ? (
              <div
                className="w-6 h-6 rounded-lg border border-cyan-500/30 overflow-hidden shrink-0 flex items-center justify-center bg-black/40"
                dangerouslySetInnerHTML={{ __html: eng.emblemSvg }}
              />
            ) : (
              <img
                src={eng.emblemUrl || '/icon-engine-foundry.svg'}
                alt={eng.name}
                className="w-6 h-6 rounded-lg border border-cyan-500/30 shrink-0 object-cover"
              />
            )}
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 truncate">
              {eng.category.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{eng.latencyEstimateMs}ms</span>
          </div>
        </div>

        {/* Title & Quota */}
        <h3
          className={`text-sm font-bold group-hover:text-cyan-400 transition-colors ${
            isFrost ? 'text-slate-900' : 'text-neutral-100'
          }`}
        >
          {eng.name}
        </h3>
        <div className="text-[11px] font-mono font-medium text-amber-400 mt-0.5 flex items-center gap-1">
          <Flame className="w-3 h-3 text-amber-400" />
          <span>{eng.tokenQuota}</span>
        </div>

        {/* Description */}
        <p className="text-xs text-neutral-400 mt-2 line-clamp-3 leading-relaxed">
          {eng.description}
        </p>

        {/* Benchmark & Protocol */}
        {eng.benchmarkScore && (
          <div className="mt-3 py-1 px-2 rounded-lg bg-white/5 border border-white/5 text-[10px] font-mono text-neutral-300 flex items-center justify-between">
            <span className="text-neutral-500">Benchmark:</span>
            <span className="text-cyan-300 font-bold">{eng.benchmarkScore}</span>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-3">
          {eng.tags.map((t) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Card Action Buttons */}
      <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onRunTest(eng)}
          className="flex-1 py-1.5 px-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          title="Test engine via local proxy"
        >
          <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
          <span>Test Prompt</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenCodeEmblem(eng)}
          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-cyan-300 transition"
          title="Display Code & Custom Emblem"
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onCopyEndpoint(eng)}
          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
          title="Copy endpoint URL"
        >
          {copiedId === eng.id ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onToggleMix(eng.id)}
          className={`p-1.5 rounded-lg border transition ${
            isSelectedForMix
              ? 'bg-purple-600 text-white border-purple-400'
              : 'bg-neutral-800 border-white/5 text-neutral-400 hover:text-white'
          }`}
          title="Toggle selection for Engine Mixer"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
