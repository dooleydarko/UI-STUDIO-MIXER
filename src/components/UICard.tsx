import React, { useState, useMemo } from 'react';
import { extractGlowPalette } from './glowPalette';
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

  // Glow colors come from the component itself, so the card glows in the UI's own palette
  const glowPalette = useMemo(() => extractGlowPalette(component.css, component.html), [component.css, component.html]);

  // Card surface copied from Uiverse "tasty-falcon-38" (kennyotsu): rgb(22,22,22) background,
  // 1rem radius, 300ms transition and the "thumb-thumb" pulse. The glow is derived from the
  // component's own colors and follows the card's shape. See .cm-card* in index.css.
  const [g1, g2, g3] = glowPalette;
  const rgbVar = (c: [number, number, number]) => c.join(' ');

  return (
    <div
      style={{
        transform: `translate3d(${component.canvasX}px, ${component.canvasY}px, 0)`,
        width: `${component.width}px`,
        height: `${component.height}px`,
        ['--g1' as string]: rgbVar(g1),
        ['--g2' as string]: rgbVar(g2),
        ['--g3' as string]: rgbVar(g3),
        boxShadow: isSelected
          ? `0 0 0 2px rgb(${rgbVar(g1)} / 0.85), 0 0 60px -10px rgb(${rgbVar(g1)} / 0.55)`
          : undefined,
      }}
      className={`cm-card absolute select-none flex flex-col group ${isFrost ? 'cm-card-frost' : ''}`}
      onClick={() => onSelect(component)}
    >
      {/* Glow tinted by the component's own colors, shaped to the card */}
      <div aria-hidden className="cm-card-glow" />
      {/* Top Header / Drag Bar */}
      <div 
        className={`relative px-4 py-3 rounded-t-2xl flex items-center justify-between border-b cursor-grab active:cursor-grabbing ${
          isFrost ? 'border-slate-200/60' : 'border-white/[0.06]'
        }`}
        onMouseDown={(e) => onDragStart(e, component)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Move className={`w-3.5 h-3.5 shrink-0 ${isFrost ? 'text-slate-400' : 'text-neutral-500'}`} />
          <span className="text-xs font-semibold tracking-wide truncate max-w-[190px]">
            {component.name}
          </span>
        </div>

        {/* Header actions: Mix and Edit always visible; the rest appear on hover */}
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
              title={interactMode ? 'Interaction Mode active (click to enable Drag)' : 'Drag Mode active (click to interact)'}
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
            <button
              type="button"
              onClick={handleCopyCode}
              className={`p-1 rounded-md transition-colors ${
                isFrost ? 'hover:bg-slate-200 text-slate-400' : 'hover:bg-white/10 text-neutral-400'
              }`}
              title="Copy component code"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(component.id);
              }}
              className={`p-1 rounded-md transition-colors hover:text-red-400 ${
                isFrost ? 'hover:bg-slate-200 text-slate-400' : 'hover:bg-white/10 text-neutral-500'
              }`}
              title="Delete from canvas"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Mix */}
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

          {/* Edit code */}
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
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 relative overflow-hidden bg-transparent p-4">
        <SandboxedPreview
          html={component.html}
          css={component.css}
          js={component.js}
          theme={theme}
          transparent
          interactive={interactMode}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};
