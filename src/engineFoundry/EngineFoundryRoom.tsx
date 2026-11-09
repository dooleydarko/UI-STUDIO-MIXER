import React, { useState } from 'react';
import { 
  Cpu, 
  Sparkles, 
  Layers, 
  Terminal, 
  Zap, 
  ShieldCheck, 
  Search, 
  Copy, 
  Check, 
  Play, 
  Filter, 
  Plus, 
  ExternalLink, 
  Flame, 
  Sliders, 
  Film,
  RotateCw,
  Boxes
} from 'lucide-react';
import { EnginePackage, EngineCategory, STARTER_ENGINES_CATALOG, HybridEngineMix } from './types';

interface EngineFoundryRoomProps {
  theme: 'obsidian' | 'frost';
  onLaunchClaudeFree?: () => void;
}

export const EngineFoundryRoom: React.FC<EngineFoundryRoomProps> = ({ theme, onLaunchClaudeFree }) => {
  const isFrost = theme === 'frost';

  const [engines, setEngines] = useState<EnginePackage[]>(STARTER_ENGINES_CATALOG);
  const [selectedCategory, setSelectedCategory] = useState<EngineCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Engine Mixer State
  const [mixerSelectedEngineIds, setMixerSelectedEngineIds] = useState<string[]>([]);
  const [isMixerDrawerOpen, setIsMixerDrawerOpen] = useState(false);
  const [synthesizedPipeline, setSynthesizedPipeline] = useState<HybridEngineMix | null>(null);

  // Test Runner Sandbox State
  const [activeTestingEngine, setActiveTestingEngine] = useState<EnginePackage | null>(null);
  const [testPrompt, setTestPrompt] = useState('');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Import New Engine Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newEngineName, setNewEngineName] = useState('');
  const [newEngineCategory, setNewEngineCategory] = useState<EngineCategory>('code_generation');
  const [newEngineEndpoint, setNewEngineEndpoint] = useState('');
  const [newEngineDescription, setNewEngineDescription] = useState('');

  const filteredEngines = engines.filter((eng) => {
    const matchesCategory = selectedCategory === 'all' || eng.category === selectedCategory;
    const matchesSearch = 
      eng.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
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
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleSynthesizeMix = () => {
    if (mixerSelectedEngineIds.length < 2) return;
    const selected = engines.filter(e => mixerSelectedEngineIds.includes(e.id));
    const mix: HybridEngineMix = {
      id: `mix-${Date.now()}`,
      name: `Hybrid // ${selected.map(s => s.name.split(' ')[0]).join(' + ')}`,
      primaryEngineId: selected[0].id,
      secondaryEngineId: selected[1].id,
      fallbackEngineId: selected[2]?.id,
      synthesizedPurpose: `Pipelines ${selected[0].name} for generation, verified by ${selected[1].name} with unmetered failover.`,
      createdAt: Date.now(),
    };
    setSynthesizedPipeline(mix);
  };

  const handleRunTestPrompt = async (eng: EnginePackage) => {
    setActiveTestingEngine(eng);
    setTestPrompt(eng.samplePrompt);
    setTestOutput(null);
    setIsTesting(true);

    // Simulate high-speed generation from the engine endpoint
    setTimeout(() => {
      setTestOutput(
        `[${eng.name} // Telemetry 200 OK]\n` +
        `Latency: ${eng.latencyEstimateMs}ms | Quota Used: 0 Tokens ($0.00)\n\n` +
        `// Synthesized Output for: "${eng.samplePrompt}"\n\n` +
        `export function optimizeRenderPipeline() {\n` +
        `  console.log("⚡ Executing via ${eng.name} (${eng.tokenQuota})");\n` +
        `  return { status: "success", unmetered: true, provider: "${eng.author}" };\n` +
        `}`
      );
      setIsTesting(false);
    }, 800);
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
    };

    setEngines([customPkg, ...engines]);
    setIsImportModalOpen(false);
    setNewEngineName('');
    setNewEngineEndpoint('');
    setNewEngineDescription('');
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${
      isFrost ? 'bg-slate-50 text-slate-900' : 'bg-neutral-950 text-neutral-100'
    }`}>
      {/* Header Bar */}
      <div className={`p-5 border-b flex flex-wrap items-center justify-between gap-4 ${
        isFrost ? 'bg-white/80 border-slate-200 backdrop-blur' : 'bg-neutral-900/60 border-white/10 backdrop-blur'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">AI Engine Foundry</h1>
              <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30 font-semibold">
                7.4B Free Pool Unmetered
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Browse, test, mix, and route AI models and proxy engines with zero subscription costs
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import Engine</span>
          </button>

          <button
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
      <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
        isFrost ? 'bg-slate-100/60 border-slate-200' : 'bg-neutral-900/40 border-white/[0.06]'
      }`}>
        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['all', 'code_generation', 'reasoning', 'video_diffusion', 'local_webgpu', 'universal_proxy'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium transition capitalize whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-white/5 text-neutral-400 hover:text-neutral-200 hover:bg-white/10'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search engines, tags, models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Active Pipeline Announcement Banner if Hybrid Mix Created */}
      {synthesizedPipeline && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-purple-200">{synthesizedPipeline.name}</span>
            <span className="text-purple-300/80">— {synthesizedPipeline.synthesizedPurpose}</span>
          </div>
          <button
            onClick={() => setSynthesizedPipeline(null)}
            className="text-[11px] text-purple-400 hover:text-purple-200 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid of Engine Cards */}
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEngines.map((eng) => {
            const isSelectedForMix = mixerSelectedEngineIds.includes(eng.id);
            return (
              <div
                key={eng.id}
                className={`group rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 ${
                  isSelectedForMix
                    ? 'border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-500/10'
                    : isFrost 
                      ? 'bg-white border-slate-200 hover:border-cyan-400 hover:shadow-md' 
                      : 'bg-neutral-900/60 border-white/10 hover:border-cyan-500/50 hover:bg-neutral-900/90'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      {eng.category.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{eng.latencyEstimateMs}ms</span>
                    </div>
                  </div>

                  {/* Title & Quota */}
                  <h3 className="text-sm font-bold text-neutral-100 group-hover:text-cyan-400 transition-colors">
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
                <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center gap-2">
                  <button
                    onClick={() => handleRunTestPrompt(eng)}
                    className="flex-1 py-1.5 px-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    title="Test engine in sandbox"
                  >
                    <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                    <span>Test Prompt</span>
                  </button>

                  <button
                    onClick={() => handleCopyEndpoint(eng)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                    title="Copy local endpoint URL"
                  >
                    {copiedId === eng.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleToggleMixerSelection(eng.id)}
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
          })}
        </div>
      </div>

      {/* Engine Mixer Bottom Drawer */}
      {isMixerDrawerOpen && (
        <div className="p-4 bg-neutral-900 border-t border-purple-500/30 text-xs animate-in slide-in-from-bottom">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-bold text-sm text-purple-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Multi-Engine Synthesis Foundry
              </span>
              <p className="text-neutral-400 text-xs mt-0.5">
                Select 2 or 3 engines to combine their reasoning, coding, and diffusion capabilities into a single pipeline.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={mixerSelectedEngineIds.length < 2}
                onClick={handleSynthesizeMix}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-40 text-white font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synthesize Hybrid Pipeline</span>
              </button>

              <button
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
        <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-neutral-950/95 backdrop-blur-2xl border-l border-cyan-500/30 z-50 p-5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                <h3 className="font-bold text-sm text-neutral-100">{activeTestingEngine.name}</h3>
              </div>
              <button
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
                onClick={() => handleRunTestPrompt(activeTestingEngine)}
                disabled={isTesting}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                {isTesting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{isTesting ? 'Synthesizing...' : 'Run Test via Local Proxy'}</span>
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

      {/* Import New Custom Engine Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-cyan-500/30 rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Register New Engine or Endpoint
              </h3>
              <button
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
                  onChange={(e) => setNewEngineCategory(e.target.value as any)}
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
