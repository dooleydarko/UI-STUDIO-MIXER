import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Zap,
  Search,
  Plus,
  Play,
  RotateCw,
  LayoutGrid,
  Move,
  Code2,
  Upload,
  Check,
  Copy,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { EnginePackage, EngineCategory, STARTER_ENGINES_CATALOG, HybridEngineMix } from './types';
import { StorageManager } from '../storage/storageManager';
import { EngineCard } from './EngineCard';
import { EngineCanvasMirror } from './EngineCanvasMirror';

interface EngineFoundryRoomProps {
  theme: 'obsidian' | 'frost';
  onLaunchClaudeFree?: () => void;
}

export const EngineFoundryRoom: React.FC<EngineFoundryRoomProps> = ({ theme }) => {
  const isFrost = theme === 'frost';
  const storage = StorageManager.getInstance();

  const [engines, setEngines] = useState<EnginePackage[]>(() => storage.loadEngines());
  const [viewMode, setViewMode] = useState<'rack' | 'canvas'>('rack');
  const [selectedCategory, setSelectedCategory] = useState<EngineCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [proxyStatus, setProxyStatus] = useState<{ state: 'checking' | 'ready' | 'no-keys' | 'offline'; providers: string[] }>({
    state: 'checking',
    providers: [],
  });

  // Engine Mixer State
  const [mixerSelectedEngineIds, setMixerSelectedEngineIds] = useState<string[]>([]);
  const [isMixerDrawerOpen, setIsMixerDrawerOpen] = useState(false);
  const [synthesizedPipeline, setSynthesizedPipeline] = useState<HybridEngineMix | null>(null);

  // Test Runner Sandbox State
  const [activeTestingEngine, setActiveTestingEngine] = useState<EnginePackage | null>(null);
  const [testPrompt, setTestPrompt] = useState('');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Code & Emblem Inspector Modal State
  const [codeEmblemEngine, setCodeEmblemEngine] = useState<EnginePackage | null>(null);
  const [emblemUrlDraft, setEmblemUrlDraft] = useState('');
  const [emblemSvgDraft, setEmblemSvgDraft] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Import New Engine Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newEngineName, setNewEngineName] = useState('');
  const [newEngineCategory, setNewEngineCategory] = useState<EngineCategory>('code_generation');
  const [newEngineEndpoint, setNewEngineEndpoint] = useState('');
  const [newEngineDescription, setNewEngineDescription] = useState('');

  const refreshProxyHealth = async () => {
    try {
      const res = await fetch('http://localhost:3001/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const providers: string[] = Array.isArray(data.configuredProviders) ? data.configuredProviders : [];
      setProxyStatus({
        state: providers.length > 0 ? 'ready' : 'no-keys',
        providers,
      });
    } catch {
      setProxyStatus({ state: 'offline', providers: [] });
    }
  };

  useEffect(() => {
    setEngines(storage.loadEngines());
    refreshProxyHealth();
  }, []);

  const filteredEngines = engines.filter((eng) => {
    const matchesCategory = selectedCategory === 'all' || eng.category === selectedCategory;
    const matchesSearch =
      eng.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleCopyEndpoint = (eng: EnginePackage) => {
    navigator.clipboard.writeText(eng.endpointUrl);
    setCopiedId(eng.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleMixerSelection = (id: string) => {
    setMixerSelectedEngineIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const handleSynthesizeMix = () => {
    if (mixerSelectedEngineIds.length < 2) return;
    const selected = engines.filter((e) => mixerSelectedEngineIds.includes(e.id));
    const mix: HybridEngineMix = {
      id: `mix-${Date.now()}`,
      name: `Hybrid // ${selected.map((s) => s.name.split(' ')[0]).join(' + ')}`,
      primaryEngineId: selected[0].id,
      secondaryEngineId: selected[1].id,
      fallbackEngineId: selected[2]?.id,
      synthesizedPurpose: `Pipelines ${selected[0].name} for generation, verified by ${selected[1].name} with proxy failover.`,
      createdAt: Date.now(),
    };
    setSynthesizedPipeline(mix);
  };

  const handleRunTestPrompt = async (eng: EnginePackage, customPrompt?: string) => {
    const promptToUse = customPrompt ?? eng.samplePrompt;
    setActiveTestingEngine(eng);
    setTestPrompt(promptToUse);
    setTestOutput(null);
    setIsTesting(true);

    const startTime = performance.now();
    try {
      const res = await fetch('http://localhost:3001/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: eng.id,
          messages: [{ role: 'user', content: promptToUse }],
        }),
      });
      const elapsed = Math.round(performance.now() - startTime);
      const data = await res.json();
      if (!res.ok) {
        setTestOutput(
          `[${eng.name} // HTTP ${res.status} Proxy Response]\n` +
            `Latency: ${elapsed}ms\n\n` +
            `${data?.error?.message || JSON.stringify(data, null, 2)}`
        );
      } else {
        const reply = data?.choices?.[0]?.message?.content || '';
        const provider = data?.x_provider || data?.model || 'proxy';
        setTestOutput(
          `[${eng.name} // Live Proxy 200 OK via ${provider}]\n` +
            `Latency: ${elapsed}ms | Model: ${data?.model || eng.id}\n\n` +
            `${reply}`
        );
      }
      refreshProxyHealth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestOutput(
        `[${eng.name} // Connection Error]\n` +
          `Could not reach http://localhost:3001/v1/chat/completions: ${msg}`
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleUpdatePosition = (id: string, x: number, y: number) => {
    setEngines((prev) =>
      prev.map((e) => (e.id === id ? { ...e, canvasX: x, canvasY: y } : e))
    );
    storage.updateEngine(id, { canvasX: x, canvasY: y });
  };

  const handleOpenCodeEmblem = (eng: EnginePackage) => {
    setCodeEmblemEngine(eng);
    setEmblemUrlDraft(eng.emblemUrl || '');
    setEmblemSvgDraft(eng.emblemSvg || '');
  };

  const handleSaveEmblem = () => {
    if (!codeEmblemEngine) return;
    const updates: Partial<EnginePackage> = {
      emblemUrl: emblemUrlDraft.trim() || undefined,
      emblemSvg: emblemSvgDraft.trim() || undefined,
    };
    storage.updateEngine(codeEmblemEngine.id, updates);
    setEngines((prev) =>
      prev.map((e) => (e.id === codeEmblemEngine.id ? { ...e, ...updates } : e))
    );
    setCodeEmblemEngine({ ...codeEmblemEngine, ...updates });
  };

  const handleEmblemFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setEmblemSvgDraft(reader.result);
          setEmblemUrlDraft('');
        }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setEmblemUrlDraft(reader.result);
          setEmblemSvgDraft('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCustomEngine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEngineName.trim() || !newEngineEndpoint.trim()) return;

    const customPkg: EnginePackage = {
      id: `custom-eng-${Date.now()}`,
      name: newEngineName.trim(),
      version: '1.0.0',
      category: newEngineCategory,
      costTier: 'free_unmetered',
      description: newEngineDescription.trim() || 'Custom registered model endpoint.',
      latencyEstimateMs: 65,
      tokenQuota: 'Custom Endpoint Quota',
      endpointUrl: newEngineEndpoint.trim(),
      schemaProtocol: 'openai',
      tags: ['Custom', 'User-Added', newEngineCategory],
      status: 'online',
      samplePrompt: 'Test custom endpoint health and prompt synthesis.',
      author: 'Custom Added',
      canvasX: 40,
      canvasY: 40,
    };

    storage.addEngine(customPkg);
    setEngines((prev) => [customPkg, ...prev]);
    setIsImportModalOpen(false);
    setNewEngineName('');
    setNewEngineEndpoint('');
    setNewEngineDescription('');
  };

  const handleResetCatalog = () => {
    storage.saveEngines(STARTER_ENGINES_CATALOG);
    setEngines(STARTER_ENGINES_CATALOG);
  };

  const buildDisplayCode = (eng: EnginePackage) => {
    const curlCode = `curl -s ${eng.endpointUrl === 'http://localhost:3001/v1' ? 'http://localhost:3001/v1/chat/completions' : eng.endpointUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${eng.id}","messages":[{"role":"user","content":"${eng.samplePrompt.replace(/"/g, '\\"')}"}]}'`;

    const fetchCode = `const res = await fetch("http://localhost:3001/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "${eng.id}",
    messages: [{ role: "user", content: "${eng.samplePrompt.replace(/"/g, '\\"')}" }],
  }),
});
const data = await res.json();
console.log(data.choices?.[0]?.message?.content);`;

    return { curlCode, fetchCode };
  };

  const copySnippet = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(label);
    setTimeout(() => setCopiedSnippet(null), 1800);
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden ${
        isFrost ? 'bg-slate-50 text-slate-900' : 'bg-neutral-950 text-neutral-100'
      }`}
    >
      {/* Header Bar */}
      <div
        className={`p-5 border-b flex flex-wrap items-center justify-between gap-4 ${
          isFrost ? 'bg-white/80 border-slate-200 backdrop-blur' : 'bg-neutral-900/60 border-white/10 backdrop-blur'
        }`}
      >
        <div className="flex items-center gap-3">
          <img
            src="/icon-engine-foundry.svg"
            alt="AI Engine Foundry Emblem"
            className="w-10 h-10 rounded-xl shadow-lg shadow-cyan-500/20 border border-cyan-500/40"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">AI Engine Foundry</h1>
              {proxyStatus.state === 'ready' ? (
                <span className="text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Proxy Active ({proxyStatus.providers.join(', ')})
                </span>
              ) : proxyStatus.state === 'no-keys' ? (
                <span className="text-[10px] font-mono uppercase bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Proxy :3001 Ready — Add Keys in .env.local
                </span>
              ) : (
                <span className="text-[10px] font-mono uppercase bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-semibold">
                  {engines.length} Engines Loaded
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Browse, arrange on infinite canvas, attach custom emblems, copy integration code, and test live proxy routes
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Rack / Canvas Mirror Toggle */}
          <div className="flex items-center p-1 rounded-xl border border-white/10 bg-black/40">
            <button
              type="button"
              onClick={() => setViewMode('rack')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'rack'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Server Blade Rack Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Blade Rack</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'canvas'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Infinite Canvas Mirror View"
            >
              <Move className="w-3.5 h-3.5" />
              <span>Canvas Mirror</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import Engine</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMixerDrawerOpen(!isMixerDrawerOpen)}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              mixerSelectedEngineIds.length > 0
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-md shadow-purple-500/30'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Engine Mixer ({mixerSelectedEngineIds.length}/3)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
          isFrost ? 'bg-slate-100/60 border-slate-200' : 'bg-neutral-900/40 border-white/[0.06]'
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['all', 'code_generation', 'reasoning', 'video_diffusion', 'local_webgpu', 'universal_proxy'] as const).map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-medium transition capitalize whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-white/5 text-neutral-400 hover:text-neutral-200 hover:bg-white/10'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search engines, tags, models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="button"
            onClick={handleResetCatalog}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-[11px]"
            title="Reset engine library to starter defaults"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Active Pipeline Announcement Banner */}
      {synthesizedPipeline && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-purple-200">{synthesizedPipeline.name}</span>
            <span className="text-purple-300/80">— {synthesizedPipeline.synthesizedPurpose}</span>
          </div>
          <button
            type="button"
            onClick={() => setSynthesizedPipeline(null)}
            className="text-[11px] text-purple-400 hover:text-purple-200 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area: Blade Rack Grid OR Infinite Canvas Mirror */}
      {viewMode === 'canvas' ? (
        <div className="flex-1 overflow-hidden relative">
          <EngineCanvasMirror
            engines={filteredEngines}
            theme={theme}
            mixerSelectedIds={mixerSelectedEngineIds}
            copiedId={copiedId}
            onRunTest={(eng) => handleRunTestPrompt(eng)}
            onCopyEndpoint={handleCopyEndpoint}
            onToggleMix={handleToggleMixerSelection}
            onOpenCodeEmblem={handleOpenCodeEmblem}
            onUpdatePosition={handleUpdatePosition}
          />
        </div>
      ) : (
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredEngines.map((eng) => (
              <EngineCard
                key={eng.id}
                engine={eng}
                theme={theme}
                isSelectedForMix={mixerSelectedEngineIds.includes(eng.id)}
                copiedId={copiedId}
                onRunTest={(target) => handleRunTestPrompt(target)}
                onCopyEndpoint={handleCopyEndpoint}
                onToggleMix={handleToggleMixerSelection}
                onOpenCodeEmblem={handleOpenCodeEmblem}
              />
            ))}
          </div>
        </div>
      )}

      {/* Engine Mixer Bottom Drawer */}
      {isMixerDrawerOpen && (
        <div className="p-4 bg-neutral-900 border-t border-purple-500/30 text-xs">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-bold text-sm text-purple-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Multi-Engine Synthesis Foundry
              </span>
              <p className="text-neutral-400 text-xs mt-0.5">
                Select 2 or 3 engines to combine their capabilities into a single pipeline.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={mixerSelectedEngineIds.length < 2}
                onClick={handleSynthesizeMix}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-40 text-white font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synthesize Hybrid Pipeline</span>
              </button>

              <button
                type="button"
                onClick={() => setMixerSelectedEngineIds([])}
                className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Sandbox Test Drawer */}
      {activeTestingEngine && (
        <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-neutral-950/95 backdrop-blur-2xl border-l border-cyan-500/30 z-50 p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                <h3 className="font-bold text-sm text-neutral-100">{activeTestingEngine.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTestingEngine(null)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                  Test Prompt
                </label>
                <textarea
                  rows={3}
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="button"
                onClick={() => handleRunTestPrompt(activeTestingEngine, testPrompt)}
                disabled={isTesting}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                {isTesting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{isTesting ? 'Calling Local Proxy...' : 'Run Test via Local Proxy'}</span>
              </button>

              {testOutput && (
                <div className="mt-4">
                  <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                    Engine Response & Telemetry
                  </label>
                  <pre className="p-3.5 rounded-xl bg-black border border-cyan-500/30 text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
                    {testOutput}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 text-[10px] text-neutral-500 font-mono flex justify-between">
            <span>Endpoint: {activeTestingEngine.endpointUrl}</span>
            <span className="text-emerald-400">Status: {activeTestingEngine.status}</span>
          </div>
        </div>
      )}

      {/* Display Code & Custom Emblem Modal */}
      {codeEmblemEngine && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-neutral-950 border border-cyan-500/30 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm text-neutral-100">
                  {codeEmblemEngine.name} — Display Code & Emblem
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCodeEmblemEngine(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Custom Emblem Section */}
            <div className="p-3.5 rounded-xl border border-white/10 bg-neutral-900/60 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200">Custom Card Emblem (Saved to Storage)</span>
                <label className="px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-semibold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload SVG / Image</span>
                  <input
                    type="file"
                    accept="image/*,.svg"
                    onChange={handleEmblemFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <input
                type="text"
                placeholder="Or paste emblem image URL..."
                value={emblemUrlDraft}
                onChange={(e) => setEmblemUrlDraft(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-neutral-200 font-mono"
              />
              <textarea
                rows={2}
                placeholder="Or paste raw <svg>...</svg> emblem code..."
                value={emblemSvgDraft}
                onChange={(e) => setEmblemSvgDraft(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-neutral-200 font-mono"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveEmblem}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Save Emblem to Card
                </button>
              </div>
            </div>

            {/* Display Code Snippets */}
            {(() => {
              const { curlCode, fetchCode } = buildDisplayCode(codeEmblemEngine);
              return (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-neutral-400 uppercase tracking-wider text-[10px]">
                        cURL Quick Call
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet('curl', curlCode)}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                      >
                        {copiedSnippet === 'curl' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSnippet === 'curl' ? 'Copied' : 'Copy cURL'}</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-black border border-white/10 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                      {curlCode}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-neutral-400 uppercase tracking-wider text-[10px]">
                        JavaScript / TypeScript Fetch
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet('fetch', fetchCode)}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                      >
                        {copiedSnippet === 'fetch' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSnippet === 'fetch' ? 'Copied' : 'Copy JS'}</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-black border border-white/10 text-[11px] font-mono text-cyan-300 overflow-x-auto">
                      {fetchCode}
                    </pre>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Import New Custom Engine Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-cyan-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Register New Engine or Endpoint
              </h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddCustomEngine} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-400 mb-1">Engine / Model Name</label>
                <input
                  type="text"
                  placeholder="e.g. Local Mistral 7B / Ollama Coder"
                  value={newEngineName}
                  onChange={(e) => setNewEngineName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-200"
                  required
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Category</label>
                <select
                  value={newEngineCategory}
                  onChange={(e) => setNewEngineCategory(e.target.value as EngineCategory)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-200"
                >
                  <option value="code_generation">Code Generation</option>
                  <option value="reasoning">Reasoning & Logic</option>
                  <option value="video_diffusion">Video Diffusion</option>
                  <option value="local_webgpu">Local WebGPU</option>
                  <option value="universal_proxy">Universal Proxy</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">API Base URL / Endpoint</label>
                <input
                  type="text"
                  placeholder="e.g. http://127.0.0.1:11434/v1 or http://localhost:3001"
                  value={newEngineEndpoint}
                  onChange={(e) => setNewEngineEndpoint(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-200 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short summary of model strengths..."
                  value={newEngineDescription}
                  onChange={(e) => setNewEngineDescription(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-200"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-xl shadow mt-2"
              >
                Register Engine to Foundry Library
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
