import React, { useState } from 'react';
import { ComponentPackage } from '../types';
import { SandboxedPreview } from '../components/SandboxedPreview';
import { 
  Search, 
  Sparkles, 
  Download, 
  ExternalLink, 
  Trash2, 
  CheckCircle2, 
  Filter, 
  Layers,
  ArrowRight
} from 'lucide-react';

interface DiscoveryRoomProps {
  theme: 'obsidian' | 'frost';
  onAddCompToCanvas: (comp: ComponentPackage) => void;
  onAddCompToMixer: (comp: ComponentPackage) => void;
}

interface DiscoveryItem {
  id: string;
  title: string;
  category: string;
  source: string;
  sourceUrl: string;
  author: string;
  license: string;
  verified: boolean;
  component: ComponentPackage;
}

const DISCOVERY_FEED: DiscoveryItem[] = [
  {
    id: 'disc-neon-cyber-pill',
    title: 'Holographic Cyber Status Pill',
    category: 'Status Badges',
    source: 'shadcn/ui Community',
    sourceUrl: 'https://ui.shadcn.com/docs/registry',
    author: 'alex_cyber',
    license: 'MIT',
    verified: true,
    component: {
      id: 'disc-comp-pill',
      name: 'Cyber Status Pill',
      description: 'Animated glowing cyan telemetry pill with pulse effect',
      author: 'alex_cyber',
      license: 'MIT',
      sourceUrl: 'https://ui.shadcn.com/docs/registry',
      framework: 'html-css',
      tags: ['badge', 'telemetry', 'neon'],
      canvasX: 200,
      canvasY: 200,
      width: 320,
      height: 380,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      html: `<div class="pill-badge"><span class="pill-dot"></span><span>QUANTUM LINK // ENCRYPTED</span></div>`,
      css: `body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.pill-badge {
  display: flex; align-items: center; gap: 8px;
  background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.4);
  padding: 8px 16px; border-radius: 9999px; color: #06b6d4; font-family: monospace; font-size: 11px;
  letter-spacing: 1.5px; box-shadow: 0 0 20px rgba(6, 182, 212, 0.2);
}
.pill-dot { width: 6px; height: 6px; border-radius: 50%; background: #06b6d4; box-shadow: 0 0 8px #06b6d4; }`,
      js: '',
    }
  },
  {
    id: 'disc-liquid-progress',
    title: 'Liquid Glass Progress Bar',
    category: 'Indicators',
    source: 'GitHub / liquid-glass-web',
    sourceUrl: 'https://github.com/kwlck/liquid-glass-web',
    author: 'kwlck',
    license: 'MIT',
    verified: true,
    component: {
      id: 'disc-comp-liquid',
      name: 'Liquid Glass Progress Bar',
      description: 'Frosted liquid glass bar with soft refraction edge and specular gradient',
      author: 'kwlck',
      license: 'MIT',
      sourceUrl: 'https://github.com/kwlck/liquid-glass-web',
      framework: 'html-css',
      tags: ['progress', 'liquid-glass', 'minimal'],
      canvasX: 250,
      canvasY: 250,
      width: 320,
      height: 380,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      html: `<div class="glass-progress-wrap"><div class="glass-fill" style="width: 68%;"></div></div>`,
      css: `body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.glass-progress-wrap {
  width: 240px; height: 16px; border-radius: 12px;
  background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12); padding: 2px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.5);
}
.glass-fill {
  height: 100%; border-radius: 10px;
  background: linear-gradient(90deg, #38bdf8 0%, #818cf8 100%);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.5);
}`,
      js: '',
    }
  },
  {
    id: 'disc-neumorph-dial',
    title: 'Skeuomorphic Audio Volume Dial',
    category: 'Audio Controls',
    source: 'CodePen Community',
    sourceUrl: 'https://codepen.io',
    author: 'sound_craft',
    license: 'MIT',
    verified: true,
    component: {
      id: 'disc-comp-dial',
      name: 'Audio Volume Dial',
      description: 'Physical rotary potentiometer with notched detents and LED indicator',
      author: 'sound_craft',
      license: 'MIT',
      sourceUrl: 'https://codepen.io',
      framework: 'html-css',
      tags: ['audio', 'rotary', 'dial', 'controls'],
      canvasX: 300,
      canvasY: 300,
      width: 320,
      height: 380,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      html: `<div class="rotary-dial"><div class="dial-marker"></div></div>`,
      css: `body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.rotary-dial {
  width: 90px; height: 90px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #2a2a2a, #0d0d0d);
  border: 2px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 32px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.2);
  display: flex; justify-content: center; padding-top: 10px; cursor: pointer;
  transition: transform 0.2s ease;
}
.rotary-dial:hover { transform: rotate(45deg); }
.dial-marker { width: 4px; height: 16px; border-radius: 2px; background: #38bdf8; box-shadow: 0 0 8px #38bdf8; }`,
      js: '',
    }
  }
];

export const DiscoveryRoom: React.FC<DiscoveryRoomProps> = ({
  theme,
  onAddCompToCanvas,
  onAddCompToMixer,
}) => {
  const [items, setItems] = useState<DiscoveryItem[]>(DISCOVERY_FEED);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeItem, setActiveItem] = useState<DiscoveryItem | null>(items[0]);

  const isFrost = theme === 'frost';

  const categories = ['All', 'Status Badges', 'Indicators', 'Audio Controls'];

  const filtered = items.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesQ = !query.trim() || item.title.toLowerCase().includes(query.toLowerCase()) || item.author.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQ;
  });

  const handleDismiss = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    if (activeItem?.id === id) setActiveItem(updated[0] || null);
  };

  return (
    <div className={`w-full h-full flex flex-col ${isFrost ? 'bg-slate-50 text-slate-800' : 'bg-black text-neutral-100'}`}>
      {/* Top Search & Filter Bar */}
      <div className={`px-8 py-5 border-b flex flex-col md:flex-row items-center justify-between gap-4 ${
        isFrost ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-[#080808]'
      }`}>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Discovery Intake Room</h2>
          <p className="text-xs text-neutral-500">
            Search registries and verified code repositories without automatically cluttering canvas.
          </p>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className={`flex items-center px-3 py-2 rounded-xl border w-full md:w-72 ${
            isFrost ? 'bg-slate-100 border-slate-200' : 'bg-neutral-900 border-white/10'
          }`}>
            <Search className="w-3.5 h-3.5 text-neutral-500 mr-2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find UI elements..."
              className="bg-transparent text-xs focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? isFrost ? 'bg-slate-900 text-white' : 'bg-white/20 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-Pane Intake Body */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left List of Discovered Items */}
        <div className={`w-full md:w-1/2 p-6 overflow-y-auto border-r flex flex-col gap-3 ${
          isFrost ? 'border-slate-200' : 'border-white/[0.08]'
        }`}>
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveItem(item)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                activeItem?.id === item.id
                  ? isFrost ? 'bg-white border-sky-500 shadow-md' : 'bg-neutral-900/90 border-sky-500/60 shadow-lg'
                  : isFrost ? 'bg-white/50 border-slate-200 hover:border-slate-300' : 'bg-[#080808] border-white/[0.06] hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold">{item.title}</h4>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded ${isFrost ? 'bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-400'}`}>
                  {item.category}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>Source: {item.source} • by {item.author}</span>
                <span className="font-mono">{item.license}</span>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-xs text-neutral-500">
              No discovered items matching query.
            </div>
          )}
        </div>

        {/* Right Active Item Detail & Actions */}
        <div className={`w-full md:w-1/2 p-8 flex flex-col ${
          isFrost ? 'bg-slate-100/40' : 'bg-[#050505]'
        }`}>
          {activeItem ? (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold">{activeItem.title}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">{activeItem.component.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDismiss(activeItem.id)}
                    className="p-2 rounded-xl border border-white/10 hover:text-red-400 text-neutral-500"
                    title="Dismiss item from discovery"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Sandboxed Interactive Preview */}
                <div className={`h-64 rounded-2xl overflow-hidden border shadow-inner ${
                  isFrost ? 'bg-white border-slate-300' : 'bg-black border-white/10'
                }`}>
                  <SandboxedPreview
                    html={activeItem.component.html}
                    css={activeItem.component.css}
                    js={activeItem.component.js}
                    theme={theme}
                    interactive={true}
                    className="w-full h-full"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 flex items-center justify-end gap-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => onAddCompToMixer(activeItem.component)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                    isFrost ? 'bg-white border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-neutral-200 hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Queue in Mixer</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAddCompToCanvas(activeItem.component)}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-sky-500/25"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Add to Main Canvas</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-neutral-500">
              Select an item to preview and review provenance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
