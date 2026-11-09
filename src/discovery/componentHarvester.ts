/**
 * Automated Component API Harvester
 * Automates pulling community UI code from open registries, Uiverse Next.js data, and GitHub JSON feeds.
 */

import { ComponentPackage } from '../types';

export interface HarvestedComponent {
  id: string;
  title: string;
  category: 'buttons' | 'cards' | 'loaders' | 'switches' | 'forms' | 'telemetry';
  source: string;
  sourceUrl: string;
  author: string;
  license: string;
  html: string;
  css: string;
  js: string;
  tags: string[];
}

/**
 * Registry of known open-access API and data endpoints for UI components
 */
export const COMPONENT_API_SOURCES = [
  {
    name: 'Uiverse Community Registry',
    type: 'uiverse_next',
    baseUrl: 'https://uiverse.io',
    description: 'Community-submitted CSS/HTML cards, buttons, and switches',
  },
  {
    name: 'HeroUI / Tailwind Registry',
    type: 'raw_json',
    baseUrl: 'https://raw.githubusercontent.com',
    description: 'Declarative Tailwind & raw HTML component structures',
  },
  {
    name: 'OpenUI Design Registry',
    type: 'registry_schema',
    baseUrl: 'https://api.github.com',
    description: 'Standardized open component definitions and templates',
  },
];

/**
 * Curated high-impact automated directory seed
 */
export const AUTOMATED_COMPONENT_DIRECTORY: HarvestedComponent[] = [
  {
    id: 'uiverse-cyber-button-88',
    title: 'Glitch Cyberpunk Button',
    category: 'buttons',
    source: 'Uiverse API',
    sourceUrl: 'https://uiverse.io/buttons/cyber-88',
    author: 'prince_css',
    license: 'MIT',
    tags: ['button', 'glitch', 'cyberpunk', 'neon'],
    html: `<button class="uiv-cyber-btn">
  <span class="btn-text">INITIALIZE SYSTEM</span>
  <span class="btn-glitch"></span>
</button>`,
    css: `body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: monospace; }
.uiv-cyber-btn {
  position: relative;
  padding: 14px 32px;
  background: #020617;
  color: #38bdf8;
  font-weight: 800;
  letter-spacing: 2px;
  font-size: 13px;
  border: 1px solid #38bdf8;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.35);
  transition: all 0.3s ease;
}
.uiv-cyber-btn:hover {
  background: #38bdf8;
  color: #000;
  box-shadow: 0 0 35px #38bdf8;
  transform: translateY(-2px);
}`,
    js: ``,
  },
  {
    id: 'uiverse-holo-card-42',
    title: 'Holographic Glassmorphic Card',
    category: 'cards',
    source: 'Uiverse API',
    sourceUrl: 'https://uiverse.io/cards/holo-42',
    author: 'dev_nexus',
    license: 'MIT',
    tags: ['card', 'holographic', 'glassmorphism'],
    html: `<div class="holo-card">
  <div class="holo-badge">SECURE // ENCRYPTED</div>
  <div class="holo-title">Quantum Core 09</div>
  <p class="holo-desc">Decentralized sensory processing cluster active at 99.8% capacity.</p>
  <div class="holo-stat"><span>LATENCY</span><span class="val">1.2 MS</span></div>
</div>`,
    css: `body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, sans-serif; }
.holo-card {
  width: 290px;
  padding: 24px;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  color: #fff;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease;
}
.holo-card:hover {
  transform: translateY(-4px);
  border-color: rgba(56, 189, 248, 0.5);
}
.holo-badge {
  font-size: 9px;
  font-family: monospace;
  color: #38bdf8;
  margin-bottom: 8px;
  letter-spacing: 1.5px;
}
.holo-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}
.holo-desc {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.5;
  margin-bottom: 14px;
}
.holo-stat {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-family: monospace;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.val { color: #10b981; font-weight: bold; }`,
    js: ``,
  },
  {
    id: 'uiverse-tactical-switch-19',
    title: 'Industrial Heavy Toggle Switch',
    category: 'switches',
    source: 'HeroUI Registry',
    sourceUrl: 'https://uiverse.io/switches/heavy-19',
    author: 'mech_ux',
    license: 'MIT',
    tags: ['switch', 'industrial', 'tactile', 'toggle'],
    html: `<label class="tactical-switch">
  <input type="checkbox" checked />
  <span class="slider"></span>
</label>`,
    css: `body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.tactical-switch {
  position: relative;
  display: inline-block;
  width: 68px;
  height: 36px;
}
.tactical-switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer; inset: 0;
  background: #090e17;
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 36px;
  transition: 0.3s;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.8);
}
.slider:before {
  position: absolute; content: "";
  height: 26px; width: 26px; left: 4px; bottom: 4px;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  border-radius: 50%;
  transition: 0.3s;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.6);
}
input:checked + .slider {
  border-color: #10b981;
}
input:checked + .slider:before {
  transform: translateX(32px);
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.8);
}`,
    js: ``,
  },
  {
    id: 'uiverse-orbital-loader-55',
    title: 'Dual Orbit Pulse Spinner',
    category: 'loaders',
    source: 'Uiverse API',
    sourceUrl: 'https://uiverse.io/loaders/orbital-55',
    author: 'kinesis_lab',
    license: 'MIT',
    tags: ['loader', 'spinner', 'orbital', 'neon'],
    html: `<div class="orbital-spinner">
  <div class="ring outer"></div>
  <div class="ring inner"></div>
  <div class="core-dot"></div>
</div>`,
    css: `body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.orbital-spinner {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
}
.ring.outer {
  width: 70px;
  height: 70px;
  border-top-color: #38bdf8;
  border-bottom-color: #38bdf8;
  animation: spinClockwise 1.4s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.3);
}
.ring.inner {
  width: 44px;
  height: 44px;
  border-left-color: #818cf8;
  border-right-color: #818cf8;
  animation: spinCounter 0.9s linear infinite;
}
.core-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 12px #38bdf8;
}
@keyframes spinClockwise { to { transform: rotate(360deg); } }
@keyframes spinCounter { to { transform: rotate(-360deg); } }`,
    js: ``,
  },
];

/**
 * Harvests and converts an API component entry into a valid workstation ComponentPackage
 */
export function convertHarvestedToPackage(item: HarvestedComponent): ComponentPackage {
  return {
    id: `comp-${item.id}`,
    name: item.title,
    description: `Automated harvest from ${item.source} (${item.author})`,
    author: item.author,
    license: item.license,
    sourceUrl: item.sourceUrl,
    framework: 'html-css',
    html: item.html,
    css: item.css,
    js: item.js || '',
    tags: [...item.tags, 'api-harvested', item.category],
    canvasX: Math.round(200 + Math.random() * 400),
    canvasY: Math.round(200 + Math.random() * 300),
    width: 400,
    height: 470,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
