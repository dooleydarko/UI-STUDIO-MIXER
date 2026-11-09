import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { Product3DProject, ProductPreset, LightingPreset } from '../types';
import { Viewport3D } from './Viewport3D';
import { exportSceneToGlb } from './glbExporter';
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
  Maximize2
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
  const [activeProject, setActiveProject] = useState<Product3DProject>(projects[0]);
  const [decalUrl, setDecalUrl] = useState<string | null>(activeProject.decal?.imageUrl || null);
  const [activeSceneGroup, setActiveSceneGroup] = useState<THREE.Group | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFrost = theme === 'frost';

  const handlePresetChange = (preset: ProductPreset) => {
    const existing = projects.find((p) => p.preset === preset);
    if (existing) {
      setActiveProject(existing);
      setDecalUrl(existing.decal?.imageUrl || null);
    } else {
      setActiveProject((prev) => ({
        ...prev,
        preset,
        name: `${preset.replace('_', ' ').toUpperCase()} Prototype`,
      }));
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
              {(['beverage_can', 'device_case', 'bottle', 'product_box'] as ProductPreset[]).map((preset) => (
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
                  {preset.replace('_', ' ')}
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
        </div>

        {/* Center High-Fidelity 3D Viewport */}
        <div className="flex-1 h-full relative bg-[#040404]">
          <Viewport3D
            project={activeProject}
            decalDataUrl={decalUrl}
            onSceneReady={(group) => setActiveSceneGroup(group)}
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

          <div className="border-t border-white/[0.08] pt-3">
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
          </div>

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
                <span className="text-neutral-400">Wrap Method:</span>
                <span className="font-mono text-[11px] text-sky-400">Cylindrical UV</span>
              </div>
              {decalUrl && (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
