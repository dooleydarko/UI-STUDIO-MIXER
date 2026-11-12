import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Product3DProject, ProductPreset, LightingPreset } from '../types';
import { Viewport3D } from './Viewport3D';
import { ImportedModelStudio } from './ImportedModelStudio';
import { DETAIL_PRESETS } from './detailedProducts';
import { exportSceneToGlb } from './glbExporter';
import { useUndoableState } from '../state/useUndoableState';
import { LIGHTING_RIGS } from './lightingRigs';
import { 
  Box, 
  RotateCw, 
  Download, 
  Save, 
  Layers, 
  Sliders, 
  Sun, 
  Image as ImageIcon, 
  Power, 
  Check, 
  Sparkles,
  Maximize2,
  Undo2,
  Redo2
} from 'lucide-react';

interface Studio3DWorkstationProps {
  projects: Product3DProject[];
  theme: 'obsidian' | 'frost';
  onSaveProject: (project: Product3DProject) => void;
}

export const Studio3DWorkstation: React.FC<Studio3DWorkstationProps> = ({
  projects,
  theme,
  onSaveProject,
}) => {
  const history = useUndoableState<Product3DProject>(() => projects[0]);
  const activeProject = history.state;
  // Rapid edits (e.g. dragging a slider) merge into a single undo step.
  const setActiveProject = (updater: (prev: Product3DProject) => Product3DProject) =>
    history.set(updater, { coalesceKey: 'edit' });
  const [decalUrl, setDecalUrl] = useState<string | null>(activeProject.decal?.imageUrl || null);
  const [activeSceneGroup, setActiveSceneGroup] = useState<THREE.Group | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);
  const handleSceneReady = useCallback((group: THREE.Group) => setActiveSceneGroup(group), []);

  const isFrost = theme === 'frost';
  const [importMode, setImportMode] = useState(false);

  // Keep the decal preview in sync when undo/redo changes the decal
  useEffect(() => {
    setDecalUrl(activeProject.decal?.imageUrl || null);
  }, [activeProject.decal?.imageUrl]);

  // Debounced autosave
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const stamped = { ...activeProject, savedAt: Date.now() };
      onSaveProject(stamped);
      setAutosavedAt(stamped.savedAt);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  // Undo / redo keyboard shortcuts (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (importMode) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history.undo, history.redo, importMode]);

  const handlePresetChange = (preset: ProductPreset) => {
    const existing = projects.find((p) => p.preset === preset);
    if (existing) {
      history.reset(existing);
      setDecalUrl(existing.decal?.imageUrl || null);
    } else {
      const def = DETAIL_PRESETS[preset];
      const size = def?.dimensions ?? (preset === 'bottle' ? [65, 180, 65] : [100, 140, 50]);
      history.reset({
        ...activeProject, id: crypto.randomUUID(), preset,
        name: preset.replace(/_/g, ' ').toUpperCase() + ' Prototype',
        dimensions: { width: size[0], height: size[1], depth: size[2], unit: 'mm' },
        decal: undefined, materialZones: def ? { ...def.zones } : undefined,
        savedAt: Date.now(),
      });
      setDecalUrl(null);
    }
  };

  const handleUpdateMaterial = (field: string, value: any) => {
    setActiveProject((prev) => ({
      ...prev,
      material: {
        ...prev.material,
        [field]: value,
      },
    }));
  };

  const handleTogglePower = () => {
    setActiveProject((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        powerOn: !prev.state.powerOn,
      },
    }));
  };

  const handleToggleRotation = () => {
    setActiveProject((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        rotationActive: !prev.state.rotationActive,
      },
    }));
  };

  const handleDecalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setDecalUrl(dataUrl);
      setActiveProject((prev) => ({
        ...prev,
        decal: {
          imageUrl: dataUrl,
          imageName: file.name,
          scaleX: 1,
          scaleY: 1,
          positionX: 0,
          positionY: 0,
          rotation: 0,
          opacity: 1,
          wrapMode: 'cylindrical',
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSaveProject(activeProject);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleExportGlb = async () => {
    if (!activeSceneGroup) return;
    setIsExporting(true);
    try {
      await exportSceneToGlb(activeSceneGroup, `${activeProject.preset}_model.glb`);
    } catch (err) {
      console.error('Failed to export GLB:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (importMode) return <ImportedModelStudio project={activeProject} onExit={() => setImportMode(false)} />;

  return (
    <div className={`w-full h-full flex flex-col ${isFrost ? 'bg-slate-50 text-slate-800' : 'bg-black text-neutral-100'}`}>
      {/* Top Workstation Bar */}
      <div className={`px-6 py-3 border-b flex items-center justify-between z-20 ${
        isFrost ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-[#080808]'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">{activeProject.name}</h2>
            <span className="text-[10px] text-neutral-500 font-mono">
              Procedural PBR Model • {activeProject.dimensions.width}×{activeProject.dimensions.height}×{activeProject.dimensions.depth} {activeProject.dimensions.unit}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setImportMode(true)} className="px-3 py-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs font-medium">Import GLB</button>
          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={history.undo}
              disabled={!history.canUndo}
              title="Undo (Cmd+Z)"
              className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 ${
                isFrost ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={!history.canRedo}
              title="Redo (Shift+Cmd+Z)"
              className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 ${
                isFrost ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {autosavedAt && (
            <span className="text-[10px] text-neutral-500 font-mono" title="Changes are saved automatically">
              Autosaved {new Date(autosavedAt).toLocaleTimeString()}
            </span>
          )}
          {/* Wireframe Toggle */}
          <button
            type="button"
            onClick={() =>
              setActiveProject((prev) => ({
                ...prev,
                state: { ...prev.state, showWireframe: !prev.state.showWireframe },
              }))
            }
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeProject.state.showWireframe
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                : isFrost ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-neutral-400'
            }`}
            title="Toggle mesh wireframe overlay"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Wireframe</span>
          </button>

          {/* Turntable Auto-Rotate Toggle */}
          <button
            type="button"
            onClick={handleToggleRotation}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeProject.state.rotationActive
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-400'
                : isFrost ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-neutral-400'
            }`}
            title="Toggle turntable auto-rotation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${activeProject.state.rotationActive ? 'animate-spin' : ''}`} />
            <span>Turntable</span>
          </button>

          {/* Virtual Power Switch (interactive demo requirement) */}
          <button
            type="button"
            onClick={handleTogglePower}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeProject.state.powerOn
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                : isFrost ? 'bg-white border-slate-200 text-slate-400' : 'bg-white/5 border-white/10 text-neutral-500'
            }`}
            title="Toggle virtual power switch to alter physical LED emissive state"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Power: {activeProject.state.powerOn ? 'ON' : 'OFF'}</span>
          </button>

          {/* Save Project */}
          <button
            type="button"
            onClick={handleSave}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isFrost ? 'bg-white border-slate-200 text-slate-800' : 'bg-white/10 border-white/15 text-neutral-200 hover:bg-white/15'
            }`}
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? 'Saved' : 'Save Project'}</span>
          </button>

          {/* Export Binary GLB */}
          <button
            type="button"
            onClick={handleExportGlb}
            disabled={isExporting}
            className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-sky-500/25 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export .GLB'}</span>
          </button>
        </div>
      </div>

      {/* Main 3-Pane Workstation Body */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Object & Preset Navigator */}
        <div className={`w-full md:w-64 p-4 border-r flex flex-col gap-4 overflow-y-auto ${
          isFrost ? 'border-slate-200 bg-white/70' : 'border-white/[0.08] bg-[#070707]'
        }`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-2">
              Product Preset
            </span>
            <div className="flex flex-col gap-1.5">
              {(['beverage_can', 'device_case', 'bottle', 'product_box', 'sneaker', 'headphones', 'tote_bag', 'shopping_bag', 'business_card'] as ProductPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetChange(preset)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                    activeProject.preset === preset
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm'
                      : isFrost ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-neutral-400'
                  }`}
                >
                  {preset.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-2">
              Scene Hierarchy
            </span>
            <div className={`p-2 rounded-xl border text-xs font-mono flex flex-col gap-1.5 ${
              isFrost ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-black/40 border-white/[0.06] text-neutral-400'
            }`}>
              <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <span>▸</span>
                <span>product_{activeProject.preset}</span>
              </div>
              <div className="pl-4 flex flex-col gap-1 text-[11px]">
                <span>• Mesh_Body (PBR)</span>
                {activeProject.preset === 'beverage_can' && (
                  <>
                    <span>• Mesh_RimChime (Chrome)</span>
                    <span>• Mesh_PullTab</span>
                  </>
                )}
                {activeProject.preset === 'device_case' && (
                  <>
                    <span>• Pivot_TopLid (Clamshell)</span>
                    <span>• Mesh_LED_Indicator ({activeProject.state.powerOn ? 'Emissive' : 'Off'})</span>
                  </>
                )}
                <span>• Floor_ContactShadow</span>
              </div>
            </div>
          </div>

          {/* Lid Angle Slider for Device Case */}
          {activeProject.preset === 'device_case' && (
            <div className="mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                Clamshell Lid Opening: {activeProject.state.lidAngle || 0}°
              </span>
              <input
                type="range"
                min="0"
                max="105"
                value={activeProject.state.lidAngle || 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setActiveProject((prev) => ({
                    ...prev,
                    state: { ...prev.state, lidAngle: val },
                  }));
                }}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>
          )}

          {/* Studio Lighting Rig Selector */}
          <div className="border-t border-white/[0.08] pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 mb-2">
              <Sun className="w-3 h-3 text-amber-400" />
              <span>Studio Lighting Rig</span>
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(LIGHTING_RIGS) as [LightingPreset, { label: string }][]).map(([id, rig]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setActiveProject((prev) => ({
                      ...prev,
                      state: { ...prev.state, lighting: id },
                    }))
                  }
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    activeProject.state.lighting === id
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : isFrost
                      ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  {rig.label}
                </button>
              ))}
            </div>

            {/* Reflection strength (scene environment intensity multiplier) */}
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                <span>Reflection Strength</span>
                <span className="font-mono">{(activeProject.state.reflectionStrength ?? 1).toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={activeProject.state.reflectionStrength ?? 1}
                onChange={(e) => {
                  const strength = parseFloat(e.target.value);
                  setActiveProject((prev) => ({
                    ...prev,
                    state: { ...prev.state, reflectionStrength: strength },
                  }));
                }}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
              <span className="text-[10px] text-neutral-600 block mt-1">
                Each rig has its own base level; this scales it. Softboxes turn off in Eco mode.
              </span>
            </div>
          </div>

          {/* Postprocessing Unreal Bloom & Emissive Glow */}
          <div className={`p-3.5 rounded-2xl border ${
            isFrost ? 'bg-white border-slate-200' : 'bg-neutral-900/60 border-white/5'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold tracking-tight">Unreal Bloom & Glow</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setActiveProject((prev) => ({
                    ...prev,
                    state: { ...prev.state, bloomEnabled: !prev.state.bloomEnabled },
                  }))
                }
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                  activeProject.state.bloomEnabled
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : 'bg-white/5 text-neutral-400 border-white/10'
                }`}
              >
                {activeProject.state.bloomEnabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
            {activeProject.state.bloomEnabled && (
              <div className="space-y-2 mt-2 pt-2 border-t border-white/5">
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>Bloom Intensity</span>
                  <span className="font-mono">{(activeProject.state.bloomStrength ?? 0.85).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.5"
                  step="0.05"
                  value={activeProject.state.bloomStrength ?? 0.85}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setActiveProject((prev) => ({
                      ...prev,
                      state: { ...prev.state, bloomStrength: val },
                    }));
                  }}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Turntable Rotation Speed */}
          <div>
            <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
              <span>Turntable Speed</span>
              <span className="font-mono">{activeProject.state.rotationSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.2"
              value={activeProject.state.rotationSpeed}
              onChange={(e) => {
                const speed = parseFloat(e.target.value);
                setActiveProject((prev) => ({
                  ...prev,
                  state: { ...prev.state, rotationSpeed: speed },
                }));
              }}
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
            />
          </div>
        </div>

        {/* Center High-Fidelity 3D Viewport */}
        <div className="flex-1 h-full relative bg-[#040404]">
          <Viewport3D
            project={activeProject}
            decalDataUrl={decalUrl}
            onSceneReady={handleSceneReady}
          />

          {/* Viewport Overlay Controls (Bottom Center) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 pointer-events-auto">
            <div className="px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-xs text-neutral-300 flex items-center gap-3 shadow-2xl">
              <span>Drag to Orbit • Scroll to Zoom</span>
              <div className="w-[1px] h-4 bg-white/20" />
              <label className="flex items-center gap-1.5 cursor-pointer text-sky-400 hover:text-sky-300">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Apply Decal / Label</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleDecalUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right PBR Material & Dimensions Inspector */}
        <div className={`w-full md:w-80 p-5 border-l flex flex-col gap-4 overflow-y-auto ${
          isFrost ? 'border-slate-200 bg-white/80' : 'border-white/[0.08] bg-[#080808]'
        }`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-2">
              Physical Dimensions
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div className={`p-2 rounded-xl border text-center ${isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900 border-white/10'}`}>
                <span className="text-[9px] text-neutral-500 block">W</span>
                <span className="text-xs font-mono font-bold">{activeProject.dimensions.width}mm</span>
              </div>
              <div className={`p-2 rounded-xl border text-center ${isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900 border-white/10'}`}>
                <span className="text-[9px] text-neutral-500 block">H</span>
                <span className="text-xs font-mono font-bold">{activeProject.dimensions.height}mm</span>
              </div>
              <div className={`p-2 rounded-xl border text-center ${isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900 border-white/10'}`}>
                <span className="text-[9px] text-neutral-500 block">D</span>
                <span className="text-xs font-mono font-bold">{activeProject.dimensions.depth}mm</span>
              </div>
            </div>
          </div>

          {DETAIL_PRESETS[activeProject.preset] && <div className="space-y-3 border-t border-white/[0.08] pt-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Independent material zones</h3>
            {Object.entries(DETAIL_PRESETS[activeProject.preset]!.zones).map(([key, defaults]) => {
              const zone = activeProject.materialZones?.[key] ?? defaults;
              const updateZone = (patch: Partial<typeof zone>) => setActiveProject(prev => ({
                ...prev, materialZones: { ...prev.materialZones, [key]: { ...(prev.materialZones?.[key] ?? defaults), ...patch } }
              }));
              return <div key={key} className="space-y-2 rounded-xl border border-white/10 p-3">
                <label className="flex items-center justify-between text-xs capitalize">{key}
                  <input aria-label={key + ' color'} type="color" value={zone.color} onChange={e=>updateZone({ color: e.target.value })}/>
                </label>
                {(['roughness','metalness'] as const).map(field => <label key={field} className="block text-xs capitalize">{field} · {zone[field].toFixed(2)}
                  <input aria-label={key + ' ' + field} className="block w-full accent-sky-500" type="range" min={0} max={1} step={.02} value={zone[field]} onChange={e=>updateZone({ [field]: Number(e.target.value) })}/>
                </label>)}
              </div>;
            })}
          </div>}
          {!DETAIL_PRESETS[activeProject.preset] && <div className="border-t border-white/[0.08] pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-2">
              PBR Material Properties
            </span>

            {/* Base Color */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-neutral-400">Base Color</span>
              <input
                type="color"
                value={activeProject.material.baseColor}
                onChange={(e) => handleUpdateMaterial('baseColor', e.target.value)}
                className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
              />
            </div>

            {/* Roughness */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>Roughness</span>
                <span className="font-mono">{activeProject.material.roughness}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.02"
                value={activeProject.material.roughness}
                onChange={(e) => handleUpdateMaterial('roughness', parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Metalness */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>Metalness</span>
                <span className="font-mono">{activeProject.material.metalness}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.02"
                value={activeProject.material.metalness}
                onChange={(e) => handleUpdateMaterial('metalness', parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Clearcoat */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>Clearcoat</span>
                <span className="font-mono">{activeProject.material.clearcoat}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.02"
                value={activeProject.material.clearcoat}
                onChange={(e) => handleUpdateMaterial('clearcoat', parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Emissive Color */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">LED Emissive Glow</span>
              <input
                type="color"
                value={activeProject.material.emissiveColor}
                onChange={(e) => handleUpdateMaterial('emissiveColor', e.target.value)}
                className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
              />
            </div>
          </div>}

          {/* Decal Label Info */}
          <div className="border-t border-white/[0.08] pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-2">
              Artwork & Decal Wrap
            </span>
            <div className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${
              isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900 border-white/10'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Active Decal:</span>
                <span className="truncate max-w-[130px] font-mono text-[11px]">
                  {activeProject.decal?.imageName || 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Label Mapping:</span>
                <span className="font-mono text-[11px] text-sky-400">Canvas texture (UV)</span>
              </div>
              {decalUrl && activeProject.decal && (
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      { id: 'cylindrical', label: 'Single' },
                      { id: 'repeat', label: 'Tile' },
                      { id: 'clamp', label: 'Stretch' },
                    ] as { id: 'cylindrical' | 'repeat' | 'clamp'; label: string }[]).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          setActiveProject((prev) =>
                            prev.decal ? { ...prev, decal: { ...prev.decal, wrapMode: mode.id } } : prev
                          )
                        }
                        className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                          activeProject.decal?.wrapMode === mode.id
                            ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                            : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                        }`}
                        title={
                          mode.id === 'cylindrical'
                            ? 'One label centred on the front'
                            : mode.id === 'repeat'
                            ? 'Tile the label across the surface'
                            : 'Stretch the artwork over the whole surface'
                        }
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-0.5">
                      <span>Position X (around)</span>
                      <span className="font-mono">{activeProject.decal.positionX.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.01"
                      value={activeProject.decal.positionX}
                      onChange={(e) => {
                        const x = parseFloat(e.target.value);
                        setActiveProject((prev) =>
                          prev.decal ? { ...prev, decal: { ...prev.decal, positionX: x } } : prev
                        );
                      }}
                      className="w-full accent-sky-500 cursor-pointer h-1 bg-neutral-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-0.5">
                      <span>Position Y (height)</span>
                      <span className="font-mono">{activeProject.decal.positionY.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.01"
                      value={activeProject.decal.positionY}
                      onChange={(e) => {
                        const y = parseFloat(e.target.value);
                        setActiveProject((prev) =>
                          prev.decal ? { ...prev, decal: { ...prev.decal, positionY: y } } : prev
                        );
                      }}
                      className="w-full accent-sky-500 cursor-pointer h-1 bg-neutral-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-0.5">
                      <span>Decal Scale</span>
                      <span className="font-mono">{activeProject.decal.scaleX.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={activeProject.decal.scaleX}
                      onChange={(e) => {
                        const s = parseFloat(e.target.value);
                        setActiveProject((prev) =>
                          prev.decal ? { ...prev, decal: { ...prev.decal, scaleX: s, scaleY: s } } : prev
                        );
                      }}
                      className="w-full accent-sky-500 cursor-pointer h-1 bg-neutral-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-0.5">
                      <span>Rotation</span>
                      <span className="font-mono">{activeProject.decal.rotation}°</span>
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="5"
                      value={activeProject.decal.rotation}
                      onChange={(e) => {
                        const r = parseInt(e.target.value);
                        setActiveProject((prev) =>
                          prev.decal ? { ...prev, decal: { ...prev.decal, rotation: r } } : prev
                        );
                      }}
                      className="w-full accent-sky-500 cursor-pointer h-1 bg-neutral-800 rounded-lg"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDecalUrl(null);
                      setActiveProject((prev) => ({ ...prev, decal: undefined }));
                    }}
                    className="text-red-400 hover:text-red-300 text-left text-[11px] mt-1"
                  >
                    Remove Decal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
