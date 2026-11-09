import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ComponentPackage, Product3DProject, MixVariationResult, QueuedComponent } from './types';
import type { StartMixOptions } from './components/MixerTray';
import { mixWithAI } from './ai/aiMixer';
import { StorageManager } from './storage/storageManager';
import { CodeMixerEngine } from './mixer/mixerEngine';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { MixerTray } from './components/MixerTray';
import { PackRevealModal } from './components/PackRevealModal';
import { PopoutPreview } from './components/PopoutPreview';
import { AddUIModal } from './components/AddUIModal';
import { NativePromptBar } from './components/NativePromptBar';
import { QueueLibraryDock } from './components/QueueLibraryDock';
import { VideoStudioDrawer } from './components/VideoStudioDrawer';
import { DiscoveryRoom } from './discovery/DiscoveryRoom';
import { EngineFoundryRoom } from './engineFoundry/EngineFoundryRoom';
// Loaded on demand so three.js stays out of the initial bundle
const Studio3DWorkstation = lazy(() =>
  import('./studio3d/Studio3DWorkstation').then((m) => ({ default: m.Studio3DWorkstation }))
);
import { BuildProgressModal } from './components/BuildProgressModal';
import { 
  Sparkles, 
  Box, 
  Compass, 
  Layers, 
  Sun, 
  Moon, 
  Activity, 
  Plus, 
  HardDrive,
  Sliders,
  Film,
  Cpu
} from 'lucide-react';

export const App: React.FC = () => {
  const storage = StorageManager.getInstance();
  const mixerEngine = CodeMixerEngine.getInstance();

  const [activeWorkspace, setActiveWorkspace] = useState<'ui_playground' | '3d_studio' | 'discovery' | 'engine_foundry'>('ui_playground');
  const [theme, setTheme] = useState<'obsidian' | 'frost'>('obsidian');
  const [components, setComponents] = useState<ComponentPackage[]>([]);
  const [projects3D, setProjects3D] = useState<Product3DProject[]>([]);
  
  // Mixer tray state
  const [mixerTrayIds, setMixerTrayIds] = useState<string[]>([]);
  const [isMixing, setIsMixing] = useState(false);
  const [supervisorStep, setSupervisorStep] = useState('idle');
  const [supervisorMessage, setSupervisorMessage] = useState('');
  const [currentVariations, setCurrentVariations] = useState<MixVariationResult[] | null>(null);
  const [mixNotice, setMixNotice] = useState<string | null>(null);

  // Modals state
  const [popoutComp, setPopoutComp] = useState<ComponentPackage | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBuildProgressOpen, setIsBuildProgressOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<QueuedComponent[]>([]);
  const [isQueueDockOpen, setIsQueueDockOpen] = useState(false);
  const [isVideoStudioOpen, setIsVideoStudioOpen] = useState(false);

  // Initial load
  useEffect(() => {
    const loadedSettings = storage.getSettings();
    setTheme(loadedSettings.theme);
    setComponents(storage.loadComponents());
    setProjects3D(storage.load3DProjects());
    setQueue(storage.loadQueue());
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'obsidian' ? 'frost' : 'obsidian';
    setTheme(nextTheme);
    storage.saveSettings({ theme: nextTheme });
    if (nextTheme === 'frost') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  const handleSelectComponent = (comp: ComponentPackage) => {
    // Can be used for selection state
  };

  const handleToggleMixer = (comp: ComponentPackage) => {
    setMixerTrayIds((prev) => 
      prev.includes(comp.id) ? prev.filter(id => id !== comp.id) : [...prev, comp.id]
    );
  };

  const handleUpdateComponentPosition = (id: string, x: number, y: number) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, canvasX: x, canvasY: y } : c))
    );
    storage.updateComponent(id, { canvasX: x, canvasY: y });
  };

  const handleDeleteComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
    setMixerTrayIds((prev) => prev.filter((trayId) => trayId !== id));
    storage.deleteComponent(id);
  };

  const handleSaveNewComponent = (newComp: ComponentPackage) => {
    setComponents((prev) => [newComp, ...prev]);
    storage.addComponent(newComp);
  };

  const handleSaveComponentUpdates = (updated: ComponentPackage) => {
    setComponents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    storage.updateComponent(updated.id, updated);
    setPopoutComp(updated);
  };

  const handleStartMix = async (options: StartMixOptions) => {
    const { prompt: userPrompt, freedom, destinationId, pulls, provider } = options;
    // Tray order is preserved; the destination and per-source choices come from the tray
    const staged = mixerTrayIds
      .map((id) => components.find((c) => c.id === id))
      .filter((c): c is ComponentPackage => !!c);
    if (staged.length === 0) return;

    setIsMixing(true);
    setMixNotice(null);
    const request = {
      sourceComponents: staged,
      destinationId,
      pulls,
      creativeFreedom: freedom,
      prompt: userPrompt,
      mode: 'three_variations' as const,
    };
    const onProgress = (step: string, msg: string) => {
      setSupervisorStep(step);
      setSupervisorMessage(msg);
    };
    try {
      let results: MixVariationResult[];
      if (provider !== 'builtin') {
        try {
          results = await mixWithAI(request, provider, onProgress);
        } catch (aiErr) {
          // Fall back to the built-in blend so the mix still produces something
          const reason = aiErr instanceof Error ? aiErr.message : 'AI mix failed.';
          console.error('AI mix failed, using built-in blend:', aiErr);
          setMixNotice(`AI mix failed: ${reason} Used the quick built-in blend instead.`);
          results = await mixerEngine.mixComponents(request, onProgress);
        }
      } else {
        results = await mixerEngine.mixComponents(request, onProgress);
      }

      // Save results atomically BEFORE opening reveal animation (requirement from Section 5 & 10)
      results.forEach((r) => {
        storage.addComponent(r.component);
      });

      setCurrentVariations(results);
    } catch (err) {
      console.error('Mix failed:', err);
      setMixNotice(err instanceof Error ? err.message : 'Mix failed.');
    } finally {
      setIsMixing(false);
    }
  };

  const handleCloseRevealAndFloatToCanvas = () => {
    if (currentVariations) {
      // Add generated components to live canvas state
      const newComps = currentVariations.map((v) => v.component);
      setComponents((prev) => [...newComps, ...prev]);
      setCurrentVariations(null);
      setMixerTrayIds([]);
    }
  };

  const handleSave3DProject = (proj: Product3DProject) => {
    setProjects3D((prev) => {
      const filtered = prev.filter((p) => p.id !== proj.id);
      return [proj, ...filtered];
    });
    storage.save3DProject(proj);
  };

  const stagedComps = mixerTrayIds
    .map((id) => components.find((c) => c.id === id))
    .filter((c): c is ComponentPackage => !!c);
  const isFrost = theme === 'frost';

  return (
    <div className={`w-screen h-screen flex flex-col overflow-hidden select-none font-sans ${
      isFrost ? 'bg-[#f4f6f8] text-slate-800' : 'bg-[#000000] text-neutral-100'
    }`}>
      {/* Top Application Bar with Liquid-Glass Aesthetic */}
      <header className={`h-14 px-5 border-b flex items-center justify-between shrink-0 z-30 transition-colors ${
        isFrost 
          ? 'bg-white/80 border-slate-200/80 backdrop-blur-xl shadow-sm text-slate-800' 
          : 'bg-[#050505]/80 border-white/[0.08] backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] text-neutral-100'
      }`}>
        {/* Brand Logo & Workstation Mode Pill */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-black font-black shadow-md shadow-sky-500/30 text-sm">
              AG
            </div>
            <div>
              <span className="text-xs font-extrabold tracking-tight block">ANTIGRAVITY</span>
              <span className="text-[9px] font-mono tracking-widest text-sky-400 block -mt-0.5">STUDIO v1.0</span>
            </div>
          </div>

          {/* Workspace Switcher */}
          <div className={`flex items-center p-1 rounded-2xl border ${
            isFrost ? 'bg-slate-100/90 border-slate-200' : 'bg-neutral-900/80 border-white/10'
          }`}>
            <button
              type="button"
              onClick={() => setActiveWorkspace('ui_playground')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeWorkspace === 'ui_playground'
                  ? isFrost ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/15 text-white shadow-inner'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>UI Playground</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkspace('3d_studio')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeWorkspace === '3d_studio'
                  ? isFrost ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/15 text-white shadow-inner'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-amber-400" />
              <span>3D Product Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkspace('discovery')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeWorkspace === 'discovery'
                  ? isFrost ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/15 text-white shadow-inner'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-purple-400" />
              <span>Discovery Room</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkspace('engine_foundry')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeWorkspace === 'engine_foundry'
                  ? isFrost ? 'bg-white text-slate-900 shadow-sm' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-inner'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Engine Foundry</span>
            </button>
          </div>
        </div>

        {/* Right Tools: Storage status, Build Progress, Theme, Add UI */}
        <div className="flex items-center gap-3">
          {/* External SanDisk SSD Indicator */}
          <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[11px] font-mono ${
            isFrost ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-neutral-900/60 border-white/[0.08] text-neutral-400'
          }`}>
            <HardDrive className="w-3 h-3 text-emerald-400" />
            <span>SanDisk Extreme (860GB)</span>
          </div>

          {/* OmniVideo Studio Button */}
          <button
            type="button"
            onClick={() => setIsVideoStudioOpen(true)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isFrost
                ? 'bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100 shadow-sm'
                : 'bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-950/40'
            }`}
            title="Open OmniVideo Multi-Account Proxy Studio"
          >
            <Film className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>OmniVideo</span>
          </button>

          {/* Build Progress View Button */}
          <button
            type="button"
            onClick={() => setIsBuildProgressOpen(true)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isFrost ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
            }`}
            title="Open active build progress and diagnostics"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Build Progress</span>
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className={`p-2 rounded-xl border transition-colors ${
              isFrost ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
            }`}
            title={`Switch to ${theme === 'obsidian' ? 'Frost (Light)' : 'Obsidian (Dark)'} Theme`}
          >
            {theme === 'obsidian' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Quick Intake & Queue Button */}
          {activeWorkspace === 'ui_playground' && (
            <button
              type="button"
              onClick={() => setIsQueueDockOpen((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isQueueDockOpen
                  ? 'bg-sky-500 text-black border-sky-400 shadow-md shadow-sky-500/20'
                  : isFrost
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
              }`}
              title="Open Quick Intake & Queue Library"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Queue</span>
              {queue.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isQueueDockOpen ? 'bg-black text-white' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                }`}>
                  {queue.length}
                </span>
              )}
            </button>
          )}

          {/* Quick Add UI Button */}
          {activeWorkspace === 'ui_playground' && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-sky-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add UI</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Stage */}
      <main className="flex-1 overflow-hidden relative">
        {activeWorkspace === 'ui_playground' && (
          <>
            <NativePromptBar
              theme={theme}
              onComponentGenerated={handleSaveNewComponent}
            />

            <InfiniteCanvas
              components={components}
              theme={theme}
              mixerTrayIds={mixerTrayIds}
              searchQuery={searchQuery}
              onSelectComponent={handleSelectComponent}
              onPreviewPopout={(c) => setPopoutComp(c)}
              onToggleMixer={handleToggleMixer}
              onEditComponent={(c) => setPopoutComp(c)}
              onDeleteComponent={handleDeleteComponent}
              onUpdateComponentPosition={handleUpdateComponentPosition}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />

            {/* Mixer Tray Floating HUD */}
            <MixerTray
              stagedComponents={stagedComps}
              theme={theme}
              isMixing={isMixing}
              supervisorStep={supervisorStep}
              supervisorMessage={supervisorMessage}
              notice={mixNotice}
              onRemoveFromTray={(id) => setMixerTrayIds((prev) => prev.filter((i) => i !== id))}
              onClearTray={() => setMixerTrayIds([])}
              onStartMix={handleStartMix}
            />

            {/* Quick Intake & Queue Library Dock */}
            <QueueLibraryDock
              theme={theme}
              isOpen={isQueueDockOpen}
              onToggleOpen={() => setIsQueueDockOpen((prev) => !prev)}
              initialQueue={queue}
              onQueueChange={(newQueue) => {
                setQueue(newQueue);
                storage.saveQueue(newQueue);
              }}
              onAddToCanvas={(comp) => {
                handleSaveNewComponent(comp);
              }}
              onAddToMixer={(comp) => {
                handleSaveNewComponent(comp);
                if (!mixerTrayIds.includes(comp.id)) {
                  setMixerTrayIds((prev) => [...prev, comp.id]);
                }
              }}
              onInspectComponent={(comp) => {
                setPopoutComp(comp);
              }}
            />
          </>
        )}

        {activeWorkspace === '3d_studio' && (
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-xs font-mono text-neutral-500">
                Loading 3D engine…
              </div>
            }
          >
            <Studio3DWorkstation
              projects={projects3D}
              theme={theme}
              onSaveProject={handleSave3DProject}
            />
          </Suspense>
        )}

        {activeWorkspace === 'discovery' && (
          <DiscoveryRoom
            theme={theme}
            onAddCompToCanvas={(c) => {
              handleSaveNewComponent(c);
              setActiveWorkspace('ui_playground');
            }}
            onAddCompToMixer={(c) => {
              handleSaveNewComponent(c);
              setMixerTrayIds((prev) => [...prev, c.id]);
            }}
          />
        )}

        {activeWorkspace === 'engine_foundry' && (
          <EngineFoundryRoom
            theme={theme}
          />
        )}
      </main>

      {/* Popout Full Preview Modal */}
      {popoutComp && (
        <PopoutPreview
          component={popoutComp}
          theme={theme}
          onClose={() => setPopoutComp(null)}
          onSaveUpdates={handleSaveComponentUpdates}
          onAddToMixer={(c) => {
            if (!mixerTrayIds.includes(c.id)) {
              setMixerTrayIds((prev) => [...prev, c.id]);
            }
          }}
        />
      )}

      {/* Add UI Modal */}
      {isAddModalOpen && (
        <AddUIModal
          theme={theme}
          onClose={() => setIsAddModalOpen(false)}
          onSaveComponent={handleSaveNewComponent}
        />
      )}

      {/* Collectible Pack Opening Reveal Modal */}
      {currentVariations && (
        <PackRevealModal
          variations={currentVariations}
          theme={theme}
          onCloseAndFloatToCanvas={handleCloseRevealAndFloatToCanvas}
          onSaveToLibrary={(c) => storage.addComponent(c)}
        />
      )}

      {/* Build Progress Modal */}
      {isBuildProgressOpen && (
        <BuildProgressModal
          theme={theme}
          onClose={() => setIsBuildProgressOpen(false)}
        />
      )}

      {/* OmniVideo Multi-Account Proxy Studio Drawer */}
      <VideoStudioDrawer
        isOpen={isVideoStudioOpen}
        onClose={() => setIsVideoStudioOpen(false)}
      />
    </div>
  );
};
