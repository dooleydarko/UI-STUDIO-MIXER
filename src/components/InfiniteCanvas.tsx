import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ComponentPackage } from '../types';
import { UICard } from './UICard';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Compass, 
  Layers, 
  Plus, 
  Sliders, 
  Sparkles,
  Search
} from 'lucide-react';

interface InfiniteCanvasProps {
  components: ComponentPackage[];
  theme: 'obsidian' | 'frost';
  mixerTrayIds: string[];
  searchQuery: string;
  onSelectComponent: (comp: ComponentPackage) => void;
  onPreviewPopout: (comp: ComponentPackage) => void;
  onToggleMixer: (comp: ComponentPackage) => void;
  onEditComponent: (comp: ComponentPackage) => void;
  onDeleteComponent: (id: string) => void;
  onUpdateComponentPosition: (id: string, x: number, y: number) => void;
  onOpenAddModal: () => void;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  components,
  theme,
  mixerTrayIds,
  searchQuery,
  onSelectComponent,
  onPreviewPopout,
  onToggleMixer,
  onEditComponent,
  onDeleteComponent,
  onUpdateComponentPosition,
  onOpenAddModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isFrost = theme === 'frost';

  // Latest pan/zoom for the native wheel handler (updated synchronously so several
  // wheel events inside one frame accumulate instead of overwriting each other).
  const viewRef = useRef({ pan, zoom });
  viewRef.current = { pan, zoom };

  // Wheel / trackpad: scroll pans, pinch (Ctrl/Cmd + wheel) zooms around the cursor.
  // This must be a native non-passive listener: React's onWheel is passive, so its
  // preventDefault() is ignored and the browser would pinch-zoom the whole page instead.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { pan: p, zoom: z } = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const nextZoom = Math.min(Math.max(z * Math.exp(-e.deltaY * 0.01), 0.3), 2.2);
        const k = nextZoom / z;
        const nextPan = { x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k };
        viewRef.current = { pan: nextPan, zoom: nextZoom };
        setPan(nextPan);
        setZoom(nextZoom);
      } else {
        const nextPan = { x: p.x - e.deltaX, y: p.y - e.deltaY };
        viewRef.current = { pan: nextPan, zoom: z };
        setPan(nextPan);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Always end a pan/drag when the button is released or the window loses focus, even
  // if that happens outside the canvas or over a component preview. Otherwise the canvas
  // keeps following the cursor after you leave it.
  useEffect(() => {
    const stop = () => {
      setIsPanning(false);
      setDraggingCompId(null);
    };
    window.addEventListener('mouseup', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('blur', stop);
    };
  }, []);

  // Background pointer pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-plane') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    } else if (draggingCompId) {
      // Dragging a card
      const targetComp = components.find((c) => c.id === draggingCompId);
      if (targetComp) {
        const newX = (e.clientX - pan.x) / zoom - dragOffset.x;
        const newY = (e.clientY - pan.y) / zoom - dragOffset.y;
        onUpdateComponentPosition(draggingCompId, Math.round(newX), Math.round(newY));
      }
    }
  }, [isPanning, draggingCompId, startPan, pan, zoom, dragOffset, components, onUpdateComponentPosition]);

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingCompId(null);
  };

  const handleCardDragStart = (e: React.MouseEvent, comp: ComponentPackage) => {
    e.stopPropagation();
    setDraggingCompId(comp.id);
    setSelectedId(comp.id);
    const mouseCanvasX = (e.clientX - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - pan.y) / zoom;
    setDragOffset({
      x: mouseCanvasX - comp.canvasX,
      y: mouseCanvasY - comp.canvasY,
    });
  };

  const handleResetView = () => {
    setPan({ x: 40, y: 40 });
    setZoom(1);
  };

  // Filter components by search query if any
  const filteredComponents = components.filter((comp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      comp.name.toLowerCase().includes(q) ||
      comp.author.toLowerCase().includes(q) ||
      comp.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`relative w-full h-full overflow-hidden select-none cursor-default transition-colors duration-500 ${
        isFrost ? 'bg-[#f4f6f8]' : 'bg-[#000000]'
      }`}
    >
      {/* Infinite Canvas Layer */}
      <div
        id="canvas-plane"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 w-full h-full pointer-events-auto"
      >
        {filteredComponents.map((comp) => (
          <UICard
            key={comp.id}
            component={comp}
            isSelected={selectedId === comp.id}
            isInMixer={mixerTrayIds.includes(comp.id)}
            theme={theme}
            onSelect={(c) => {
              setSelectedId(c.id);
              onSelectComponent(c);
            }}
            onPreviewPopout={onPreviewPopout}
            onToggleMixer={onToggleMixer}
            onEdit={onEditComponent}
            onDelete={onDeleteComponent}
            onDragStart={handleCardDragStart}
          />
        ))}
      </div>

      {/* Floating Liquid-Glass Controls Toolbar (Bottom Center / Left) */}
      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 p-1.5 rounded-2xl backdrop-blur-2xl border shadow-2xl ${
          isFrost 
            ? 'bg-white/80 border-slate-200/80 shadow-slate-300/40 text-slate-800' 
            : 'bg-black/60 border-white/[0.09] shadow-[0_8px_32px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] text-neutral-200'
        }`}>
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))}
            className={`p-2 rounded-xl transition-all ${
              isFrost ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-white/10 text-neutral-300 hover:text-white'
            }`}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom Readout */}
          <span className="text-[11px] font-mono px-2 font-medium opacity-80 min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 0.15, 2.2))}
            className={`p-2 rounded-xl transition-all ${
              isFrost ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-white/10 text-neutral-300 hover:text-white'
            }`}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className={`w-[1px] h-5 mx-0.5 ${isFrost ? 'bg-slate-300' : 'bg-white/15'}`} />

          {/* Reset / Center View */}
          <button
            type="button"
            onClick={handleResetView}
            className={`p-2 rounded-xl transition-all ${
              isFrost ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-white/10 text-neutral-300 hover:text-white'
            }`}
            title="Fit / Reset View"
          >
            <Compass className="w-4 h-4" />
          </button>

          {/* Add UI Component Button */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="ml-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-sky-500/25"
            title="Add UI component to infinite canvas"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add UI</span>
          </button>
        </div>

        {/* Component Count Pill */}
        <div className={`px-3 py-2 rounded-2xl backdrop-blur-2xl border text-xs font-medium flex items-center gap-1.5 ${
          isFrost 
            ? 'bg-white/70 border-slate-200/80 text-slate-600' 
            : 'bg-black/50 border-white/[0.08] text-neutral-400'
        }`}>
          <Layers className="w-3.5 h-3.5 text-neutral-500" />
          <span>{filteredComponents.length} components</span>
        </div>
      </div>
    </div>
  );
};
