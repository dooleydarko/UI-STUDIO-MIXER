import React, { useState } from 'react';
import { ComponentPackage } from '../types';
import { SandboxedPreview } from './SandboxedPreview';
import { 
  Maximize2, 
  Copy, 
  Sparkles, 
  Code, 
  Check, 
  MousePointer, 
  Move, 
  Trash2, 
  Tag 
} from 'lucide-react';

interface UICardProps {
  component: ComponentPackage;
  isSelected: boolean;
  isInMixer: boolean;
  theme: 'obsidian' | 'frost';
  onSelect: (comp: ComponentPackage) => void;
  onPreviewPopout: (comp: ComponentPackage) => void;
  onToggleMixer: (comp: ComponentPackage) => void;
  onEdit: (comp: ComponentPackage) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.MouseEvent, comp: ComponentPackage) => void;
}

export const UICard: React.FC<UICardProps> = ({
  component,
  isSelected,
  isInMixer,
  theme,
  onSelect,
  onPreviewPopout,
  onToggleMixer,
  onEdit,
  onDelete,
  onDragStart,
}) => {
  const [copied, setCopied] = useState(false);
  const [interactMode, setInteractMode] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullSnippet = `<!-- HTML -->\n${component.html}\n\n/* CSS */\n${component.css}\n\n// JS\n${component.js}`;
    navigator.clipboard.writeText(fullSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFrost = theme === 'frost';

  return (
    <div
      style={{
        transform: `translate3d(${component.canvasX}px, ${component.canvasY}px, 0)`,
        width: `${component.width}px`,
        height: `${component.height}px`,
      }}
      className={`absolute select-none rounded-2xl transition-shadow duration-300 flex flex-col group ${
        isFrost
          ? 'bg-white/95 border border-slate-200/80 shadow-xl text-slate-800'
          : 'bg-[#080808] border border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.85)] text-neutral-100'
      } ${
        isSelected
          ? 'ring-2 ring-sky-500/80 shadow-[0_0_24px_rgba(56,189,248,0.25)]'
          : 'hover:border-white/[0.18]'
      }`}
      onClick={() => onSelect(component)}
    >
      {/* Top Header / Drag Bar */}
      <div 
        className={`px-3.5 py-2.5 rounded-t-2xl flex items-center justify-between border-b cursor-grab active:cursor-grabbing ${
          isFrost ? 'border-slate-100 bg-slate-50/70' : 'border-white/[0.05] bg-black/40 backdrop-blur-md'
        }`}
        onMouseDown={(e) => onDragStart(e, component)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Move className={`w-3.5 h-3.5 shrink-0 ${isFrost ? 'text-slate-400' : 'text-neutral-500'}`} />
          <span className="text-xs font-semibold tracking-wide truncate max-w-[130px]">
            {component.name}
          </span>
          {component.variationType && component.variationType !== 'original' && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider ${
              component.variationType === 'refined'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : component.variationType === 'reimagined'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            }`}>
              {component.variationType}
            </span>
          )}
        </div>

        {/* Interaction / Drag Mode Toggle */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInteractMode(!interactMode);
            }}
            className={`p-1 rounded-md transition-colors ${
              interactMode 
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                : isFrost ? 'hover:bg-slate-200 text-slate-400' : 'hover:bg-white/10 text-neutral-400'
            }`}
            title={interactMode ? "Interaction Mode active (click to enable Drag)" : "Drag Mode active (click to interact)"}
          >
            <MousePointer className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewPopout(component);
            }}
            className={`p-1 rounded-md transition-colors ${
              isFrost ? 'hover:bg-slate-200 text-slate-400' : 'hover:bg-white/10 text-neutral-400'
            }`}
            title="Open dedicated preview window"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 relative overflow-hidden bg-transparent">
        <SandboxedPreview
          html={component.html}
          css={component.css}
          js={component.js}
          theme={theme}
          interactive={interactMode}
          className="w-full h-full"
        />
      </div>

      {/* Bottom Footer Controls */}
      <div className={`px-3 py-2 rounded-b-2xl flex items-center justify-between border-t text-xs ${
        isFrost ? 'border-slate-100 bg-slate-50/70' : 'border-white/[0.05] bg-black/30'
      }`}>
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className={`text-[10px] truncate max-w-[80px] ${isFrost ? 'text-slate-400' : 'text-neutral-500'}`}>
            by {component.author}
          </span>
          <span className={`text-[9px] px-1 rounded ${isFrost ? 'bg-slate-200 text-slate-600' : 'bg-neutral-800 text-neutral-400'}`}>
            {component.license}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Mix Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMixer(component);
            }}
            className={`px-2 py-1 rounded-md font-medium text-[11px] flex items-center gap-1 transition-all ${
              isInMixer
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : isFrost
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 border border-white/[0.08]'
            }`}
            title="Add or remove from Code Mixer Tray"
          >
            <Sparkles className="w-3 h-3" />
            <span>{isInMixer ? 'In Tray' : 'Mix'}</span>
          </button>

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            className={`p-1.5 rounded-md transition-colors ${
              isFrost ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-white/10 text-neutral-300'
            }`}
            title="Copy component code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          {/* Edit */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(component);
            }}
            className={`p-1.5 rounded-md transition-colors ${
              isFrost ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-white/10 text-neutral-300'
            }`}
            title="Edit component source"
          >
            <Code className="w-3 h-3" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(component.id);
            }}
            className={`p-1.5 rounded-md transition-colors hover:text-red-400 ${
              isFrost ? 'hover:bg-slate-200 text-slate-400' : 'hover:bg-white/10 text-neutral-500'
            }`}
            title="Delete from canvas"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
