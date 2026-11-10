import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Compass, Cpu } from 'lucide-react';
import { EnginePackage } from './types';
import { EngineCard } from './EngineCard';

interface EngineCanvasMirrorProps {
  engines: EnginePackage[];
  theme: 'obsidian' | 'frost';
  mixerSelectedIds: string[];
  copiedId: string | null;
  onRunTest: (eng: EnginePackage) => void;
  onCopyEndpoint: (eng: EnginePackage) => void;
  onToggleMix: (id: string) => void;
  onOpenCodeEmblem: (eng: EnginePackage) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
}

export const EngineCanvasMirror: React.FC<EngineCanvasMirrorProps> = ({
  engines,
  theme,
  mixerSelectedIds,
  copiedId,
  onRunTest,
  onCopyEndpoint,
  onToggleMix,
  onOpenCodeEmblem,
  onUpdatePosition,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 32, y: 32 });
  const [zoom, setZoom] = useState(0.95);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const isFrost = theme === 'frost';
  const viewRef = useRef({ pan, zoom });
  viewRef.current = { pan, zoom };

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
        const nextZoom = Math.min(Math.max(z * Math.exp(-e.deltaY * 0.01), 0.35), 2.0);
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

  useEffect(() => {
    const stop = () => {
      setIsPanning(false);
      setDraggingId(null);
    };
    window.addEventListener('mouseup', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('blur', stop);
    };
  }, []);

  const getDefaultCoords = (index: number) => ({
    x: (index % 3) * 340,
    y: Math.floor(index / 3) * 330,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).id === 'engine-canvas-plane') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
      } else if (draggingId) {
        const rect = containerRef.current?.getBoundingClientRect();
        const originX = rect ? rect.left : 0;
        const originY = rect ? rect.top : 0;
        const newX = (e.clientX - originX - pan.x) / zoom - dragOffset.x;
        const newY = (e.clientY - originY - pan.y) / zoom - dragOffset.y;
        onUpdatePosition(draggingId, Math.round(newX), Math.round(newY));
      }
    },
    [isPanning, draggingId, startPan, pan, zoom, dragOffset, onUpdatePosition]
  );

  const handleCardDragStart = (e: React.MouseEvent, eng: EnginePackage, idx: number) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const originX = rect ? rect.left : 0;
    const originY = rect ? rect.top : 0;
    const coords = {
      x: eng.canvasX ?? getDefaultCoords(idx).x,
      y: eng.canvasY ?? getDefaultCoords(idx).y,
    };
    setDraggingId(eng.id);
    setDragOffset({
      x: (e.clientX - originX - pan.x) / zoom - coords.x,
      y: (e.clientY - originY - pan.y) / zoom - coords.y,
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => {
        setIsPanning(false);
        setDraggingId(null);
      }}
      className={`relative w-full h-full overflow-hidden select-none ${
        isFrost ? 'bg-[#f4f6f8]' : 'bg-[#030712]'
      }`}
      style={{
        backgroundImage: isFrost
          ? 'radial-gradient(circle, rgba(15,23,42,0.12) 1px, transparent 1px)'
          : 'radial-gradient(circle, rgba(34,211,238,0.14) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div
        id="engine-canvas-plane"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 w-full h-full pointer-events-auto"
      >
        {engines.map((eng, idx) => {
          const fallback = getDefaultCoords(idx);
          const positionedEngine: EnginePackage = {
            ...eng,
            canvasX: eng.canvasX ?? fallback.x,
            canvasY: eng.canvasY ?? fallback.y,
          };
          return (
            <EngineCard
              key={eng.id}
              engine={positionedEngine}
              theme={theme}
              isSelectedForMix={mixerSelectedIds.includes(eng.id)}
              copiedId={copiedId}
              draggable
              onRunTest={onRunTest}
              onCopyEndpoint={onCopyEndpoint}
              onToggleMix={onToggleMix}
              onOpenCodeEmblem={onOpenCodeEmblem}
              onDragStart={(e, target) => handleCardDragStart(e, target, idx)}
            />
          );
        })}
      </div>

      {/* Canvas Floating Controls */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-2">
        <div
          className={`flex items-center gap-1 p-1.5 rounded-2xl backdrop-blur-2xl border shadow-2xl ${
            isFrost
              ? 'bg-white/85 border-slate-200 text-slate-800'
              : 'bg-black/70 border-white/10 text-neutral-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.35))}
            className="p-2 rounded-xl hover:bg-white/10 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono px-2 min-w-[46px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))}
            className="p-2 rounded-xl hover:bg-white/10 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-5 bg-white/15 mx-0.5" />
          <button
            type="button"
            onClick={() => {
              setPan({ x: 32, y: 32 });
              setZoom(0.95);
            }}
            className="p-2 rounded-xl hover:bg-white/10 transition"
            title="Reset Canvas View"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 rounded-2xl backdrop-blur-2xl border border-cyan-500/25 bg-black/60 text-xs font-mono text-cyan-300 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5" />
          <span>{engines.length} engine nodes (drag grip to arrange)</span>
        </div>
      </div>
    </div>
  );
};
