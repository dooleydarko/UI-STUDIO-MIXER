import { ComponentPackage } from '../types';

export const STARTER_COMPONENTS: ComponentPackage[] = [
  {
    id: 'uiverse-smart-liger',
    name: 'Smart Liger 3D Card',
    description: 'Stacked 3D card layout with layered depth, subtle perspective, and glow accent.',
    author: 'Smit-Prajapati',
    license: 'MIT',
    sourceUrl: 'https://uiverse.io/Smit-Prajapati/smart-liger-5',
    framework: 'html-css',
    tags: ['card', '3d', 'depth', 'obsidian'],
    canvasX: 150,
    canvasY: 125,
    width: 400,
    height: 470,
    createdAt: 1731100000000,
    updatedAt: 1731100000000,
    html: `<div class="card-container">
  <div class="card">
    <div class="card-layer-back"></div>
    <div class="card-layer-mid"></div>
    <div class="card-content">
      <div class="chip"></div>
      <div class="card-title">ANTIGRAVITY PRIME</div>
      <div class="card-num">•••• 8842</div>
      <div class="card-footer">
        <span>EXECUTIVE</span>
        <span>11/29</span>
      </div>
    </div>
  </div>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  perspective: 1000px;
}
.card-container {
  width: 270px;
  height: 170px;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-style: preserve-3d;
  cursor: pointer;
}
.card-container:hover {
  transform: rotateY(14deg) rotateX(8deg) translateY(-8px);
}
.card {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%), #0a0a0a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.2);
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}
.card-layer-back {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%);
  filter: blur(20px);
  pointer-events: none;
}
.chip {
  width: 34px;
  height: 24px;
  border-radius: 5px;
  background: linear-gradient(135deg, #d4af37, #aa820a);
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.4);
}
.card-title {
  color: #888;
  font-size: 10px;
  letter-spacing: 2px;
  font-weight: 600;
}
.card-num {
  color: #fff;
  font-size: 16px;
  letter-spacing: 3px;
  font-family: monospace;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  color: #aaa;
  font-size: 11px;
  letter-spacing: 1.5px;
}`,
    js: `// Interactive card tilt sensitivity
const card = document.querySelector('.card-container');
if (card) {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    card.style.transform = \`rotateY(\${x * 0.12}deg) rotateX(\${-y * 0.12}deg) translateY(-6px)\`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
}`
  },
  {
    id: 'uiverse-wet-goose',
    name: 'Wet Goose Vehicle Card',
    description: 'Ultra-dark performance automotive telemetry card with carbon fiber tactile theme.',
    author: 'vikas7754',
    license: 'MIT',
    sourceUrl: 'https://uiverse.io/vikas7754/wet-goose-61',
    framework: 'html-css',
    tags: ['automotive', 'telemetry', 'dark', 'hud'],
    canvasX: 600,
    canvasY: 125,
    width: 400,
    height: 470,
    createdAt: 1731100000000,
    updatedAt: 1731100000000,
    html: `<div class="gauge-card">
  <div class="hud-header">
    <span class="status-dot"></span>
    <span class="hud-label">APEX GT // HYPER-DRIVE</span>
    <span class="hud-mode">SPORT+</span>
  </div>
  <div class="speedo-container">
    <div class="speed-value">168</div>
    <div class="speed-unit">MPH</div>
  </div>
  <div class="bar-meter">
    <div class="bar-fill" style="width: 78%;"></div>
  </div>
  <div class="hud-metrics">
    <div><span>TORQUE</span><strong>890 Nm</strong></div>
    <div><span>G-FORCE</span><strong>1.42 G</strong></div>
    <div><span>BATTERY</span><strong>92%</strong></div>
  </div>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.gauge-card {
  width: 270px;
  background: #080808;
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 16px;
  padding: 20px;
  color: #fff;
  box-shadow: 0 16px 36px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.1);
  transition: all 0.3s ease;
}
.gauge-card:hover {
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 20px 45px rgba(239,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.15);
}
.hud-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 9px;
  letter-spacing: 1px;
  color: #777;
  margin-bottom: 16px;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
}
.hud-mode {
  margin-left: auto;
  color: #ef4444;
  font-weight: 700;
}
.speedo-container {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin: 10px 0;
}
.speed-value {
  font-size: 52px;
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 1;
}
.speed-unit {
  font-size: 13px;
  color: #888;
  margin-left: 6px;
  font-weight: 600;
}
.bar-meter {
  height: 6px;
  background: #181818;
  border-radius: 3px;
  overflow: hidden;
  margin: 16px 0;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ef4444, #f97316);
  border-radius: 3px;
  transition: width 0.5s ease;
}
.hud-metrics {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #1a1a1a;
  padding-top: 14px;
}
.hud-metrics div {
  display: flex;
  flex-direction: column;
}
.hud-metrics span {
  font-size: 8px;
  color: #666;
  letter-spacing: 1px;
}
.hud-metrics strong {
  font-size: 12px;
  color: #eee;
  margin-top: 2px;
}`,
    js: `// Random simulated telemetry fluctuation
setInterval(() => {
  const speedElem = document.querySelector('.speed-value');
  const barElem = document.querySelector('.bar-fill');
  if (speedElem && barElem) {
    const nextSpeed = Math.floor(160 + Math.random() * 14);
    speedElem.innerText = nextSpeed;
    barElem.style.width = \`\${(nextSpeed / 200) * 100}%\`;
  }
}, 1800);`
  },
  {
    id: 'uiverse-honest-earwig',
    name: 'Honest Earwig Product Case',
    description: 'Sleek AirPods-style device case representation with openable lid and magnetic latch.',
    author: 'mahiatlinux',
    license: 'MIT',
    sourceUrl: 'https://uiverse.io/mahiatlinux/honest-earwig-11',
    framework: 'html-css',
    tags: ['hardware', 'case', 'airpods', 'device'],
    canvasX: 1050,
    canvasY: 125,
    width: 400,
    height: 470,
    createdAt: 1731100000000,
    updatedAt: 1731100000000,
    html: `<div class="case-wrapper">
  <div class="pod-case">
    <div class="case-lid"></div>
    <div class="case-body">
      <div class="led-light"></div>
      <div class="brand-emboss">ANTIGRAVITY AUDIO</div>
    </div>
  </div>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.case-wrapper {
  perspective: 600px;
}
.pod-case {
  width: 140px;
  height: 170px;
  cursor: pointer;
  position: relative;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pod-case:hover {
  transform: translateY(-8px) scale(1.03);
}
.case-lid {
  width: 140px;
  height: 48px;
  background: linear-gradient(180deg, #222 0%, #151515 100%);
  border-radius: 36px 36px 8px 8px;
  border: 1px solid rgba(255,255,255,0.12);
  border-bottom: 2px solid #000;
  box-shadow: inset 0 2px 3px rgba(255,255,255,0.25);
  transform-origin: top center;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.pod-case.open .case-lid {
  transform: rotateX(110deg) translateY(-10px);
}
.case-body {
  width: 140px;
  height: 118px;
  background: linear-gradient(180deg, #181818 0%, #0d0d0d 100%);
  border-radius: 8px 8px 36px 36px;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 24px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  position: relative;
}
.led-light {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
  transition: background 0.3s;
}
.brand-emboss {
  color: #444;
  font-size: 8px;
  letter-spacing: 2px;
  font-weight: 700;
}`,
    js: `const podCase = document.querySelector('.pod-case');
if (podCase) {
  podCase.addEventListener('click', () => {
    podCase.classList.toggle('open');
  });
}`
  },
  {
    id: 'uiverse-moody-falcon',
    name: 'Moody Falcon Pip-Boy',
    description: 'Retro-futuristic terminal HUD with monochrome green phosphor display.',
    author: 'Gidarx',
    license: 'MIT',
    sourceUrl: 'https://uiverse.io/Gidarx/moody-falcon-73',
    framework: 'html-css',
    tags: ['terminal', 'crt', 'retro', 'pip-boy'],
    canvasX: 150,
    canvasY: 650,
    width: 400,
    height: 470,
    createdAt: 1731100000000,
    updatedAt: 1731100000000,
    html: `<div class="crt-screen">
  <div class="crt-scanline"></div>
  <div class="terminal-header">
    <span>AGY-OS v4.2 // RUN</span>
    <span class="blinking-pill">ONLINE</span>
  </div>
  <div class="terminal-body">
    <p>> MEM: 8192 MB OK</p>
    <p>> DISK_EXT: MOUNTED (860 GB)</p>
    <p>> WORKSPACE: READY</p>
    <p class="prompt">> MIXER_ENG: LISTENING_<span class="cursor">█</span></p>
  </div>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: monospace;
}
.crt-screen {
  width: 270px;
  background: #020c04;
  border: 2px solid #00ff66;
  border-radius: 12px;
  padding: 16px;
  color: #00ff66;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 25px rgba(0,255,102,0.2), inset 0 0 15px rgba(0,255,102,0.15);
}
.crt-scanline {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%);
  background-size: 100% 4px;
  pointer-events: none;
}
.terminal-header {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  border-bottom: 1px solid #00ff66;
  padding-bottom: 8px;
  margin-bottom: 12px;
}
.blinking-pill {
  animation: pulse 1.2s infinite;
}
.terminal-body {
  font-size: 11px;
  line-height: 1.6;
}
.cursor {
  animation: blink 0.8s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}`,
    js: `console.log('Moody Falcon CRT active');`
  },
  {
    id: 'uiverse-massive-dodo',
    name: 'Massive Dodo Animated Switch',
    description: 'Smooth tactile toggle switch with fluid thumb slide and active state lighting.',
    author: 'Admin12121',
    license: 'MIT',
    sourceUrl: 'https://uiverse.io/Admin12121/massive-dodo-67',
    framework: 'html-css',
    tags: ['toggle', 'switch', 'interaction', 'controls'],
    canvasX: 600,
    canvasY: 650,
    width: 400,
    height: 470,
    createdAt: 1731100000000,
    updatedAt: 1731100000000,
    html: `<div class="switch-box">
  <label class="switch">
    <input type="checkbox" checked id="dodo-input">
    <span class="slider">
      <span class="icon-on">POWER</span>
    </span>
  </label>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.switch-box {
  display: flex;
  align-items: center;
  justify-content: center;
}
.switch {
  position: relative;
  display: inline-block;
  width: 84px;
  height: 44px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #111;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 24px;
  transition: 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.8);
}
.slider:before {
  position: absolute;
  content: "";
  height: 34px;
  width: 34px;
  left: 4px;
  bottom: 4px;
  background: linear-gradient(135deg, #333 0%, #1a1a1a 100%);
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  transition: 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 4px 10px rgba(0,0,0,0.6);
}
input:checked + .slider {
  background: #064e3b;
  border-color: #10b981;
}
input:checked + .slider:before {
  transform: translateX(40px);
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.6);
}
.icon-on {
  position: absolute;
  right: 12px;
  top: 15px;
  font-size: 8px;
  font-weight: 700;
  color: #10b981;
  letter-spacing: 1px;
  opacity: 0;
  transition: 0.3s;
}
input:checked + .slider .icon-on {
  opacity: 1;
  left: 12px;
  right: auto;
}`,
    js: `// Switch event propagation
const input = document.getElementById('dodo-input');
if (input) {
  input.addEventListener('change', (e) => {
    console.log('Power state:', e.target.checked);
  });
}`
  },
  {
    id: 'uiverse-great-rat',
    name: 'Great Rat Metallic Button',
    description: 'Circular tactile knurled metallic push button with brushed edge and physical press depth.',
    author: 'GreyD097',
    license: 'MIT',
    sourceUrl: 'https://uiverse.io/GreyD097/great-rat-93',
    framework: 'html-css',
    tags: ['button', 'metallic', 'tactile', 'skeuomorphic'],
    canvasX: 1050,
    canvasY: 650,
    width: 400,
    height: 470,
    createdAt: 1731100000000,
    updatedAt: 1731100000000,
    html: `<div class="metallic-holder">
  <button class="metallic-btn">
    <div class="inner-core">
      <span class="btn-glyph">✦</span>
    </div>
  </button>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.metallic-holder {
  padding: 10px;
}
.metallic-btn {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: conic-gradient(from 180deg at 50% 50%, #444 0deg, #111 60deg, #666 120deg, #111 180deg, #555 240deg, #111 300deg, #444 360deg);
  box-shadow: 0 12px 28px rgba(0,0,0,0.8), inset 0 2px 3px rgba(255,255,255,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.metallic-btn:active {
  transform: scale(0.94);
  box-shadow: 0 4px 12px rgba(0,0,0,0.9), inset 0 2px 4px rgba(0,0,0,0.8);
}
.inner-core {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #1f1f1f 0%, #0d0d0d 100%);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.2);
}
.btn-glyph {
  color: #38bdf8;
  filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.8));
}`,
    js: `// Button click audio feedback placeholder
const btn = document.querySelector('.metallic-btn');
if (btn) {
  btn.addEventListener('click', () => {
    btn.style.transform = 'scale(0.92)';
    setTimeout(() => { btn.style.transform = ''; }, 150);
  });
}`
  },
  {
    id: 'uiverse-smooth-bird',
    name: 'Smooth Bird Checkbox',
    description: 'Custom fluid-fill interactive checkbox with elastic path animation.',
    author: 'byllzz',
    license: 'MIT',
    sourceUrl: 'https://uiverse.io/byllzz/smooth-bird-47',
    framework: 'html-css',
    tags: ['checkbox', 'micro-interaction', 'form'],
    canvasX: 150,
    canvasY: 1175,
    width: 400,
    height: 470,
    createdAt: 1731100000000,
    updatedAt: 1731100000000,
    html: `<div class="checkbox-container">
  <label class="custom-chk">
    <input type="checkbox" checked>
    <span class="chk-box">
      <svg viewBox="0 0 12 10" height="10px" width="12px">
        <polyline points="1.5 6 4.5 9 10.5 1"></polyline>
      </svg>
    </span>
    <span class="chk-text">ENABLE ACCELERATION</span>
  </label>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.custom-chk {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}
.custom-chk input {
  display: none;
}
.chk-box {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: #111;
  border: 1px solid rgba(255,255,255,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.8);
}
.custom-chk input:checked + .chk-box {
  background: #38bdf8;
  border-color: #38bdf8;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.5);
}
.chk-box svg {
  fill: none;
  stroke: #000;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 16px;
  stroke-dashoffset: 16px;
  transition: all 0.3s ease;
}
.custom-chk input:checked + .chk-box svg {
  stroke-dashoffset: 0;
}
.chk-text {
  color: #ccc;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
}`,
    js: `// Checkbox interaction
const chk = document.querySelector('.custom-chk input');
if (chk) {
  chk.addEventListener('change', (e) => {
    console.log('Checked:', e.target.checked);
  });
}`
  },
  {
    id: 'uiverse-tough-stingray',
    name: 'Tough Stingray Reverse Card',
    description: 'Interactive 3D dual-sided flip card with metallic foil reverse face.',
    author: 'SelfMadeSystem',
    license: 'MIT',
    sourceUrl: 'https://uiverse.io/SelfMadeSystem/tough-stingray-70',
    framework: 'html-css',
    tags: ['card', '3d', 'flip', 'reverse'],
    canvasX: 600,
    canvasY: 1175,
    width: 400,
    height: 470,
    createdAt: 1731100000000,
    updatedAt: 1731100000000,
    html: `<div class="flip-wrapper">
  <div class="flip-card">
    <div class="card-face face-front">
      <div class="badge">SPEC // 01</div>
      <h3>SURFACE MATTE</h3>
      <p>Hover or click to inspect inverse structure.</p>
    </div>
    <div class="card-face face-back">
      <div class="badge">REVERSE</div>
      <h3>TEXTURE FOIL</h3>
      <p>High-reflectivity physical layer.</p>
    </div>
  </div>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.flip-wrapper {
  perspective: 900px;
}
.flip-card {
  width: 250px;
  height: 180px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.flip-wrapper:hover .flip-card, .flip-card.flipped {
  transform: rotateY(180deg);
}
.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  padding: 20px;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.face-front {
  background: #0a0a0a;
  border: 1px solid rgba(255,255,255,0.12);
  color: #fff;
  box-shadow: 0 16px 36px rgba(0,0,0,0.8);
}
.face-back {
  background: linear-gradient(135deg, #1c1917, #0c0a09);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
  transform: rotateY(180deg);
  box-shadow: 0 16px 36px rgba(0,0,0,0.8);
}
.badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  opacity: 0.6;
}
h3 {
  font-size: 16px;
  letter-spacing: 1px;
}
p {
  font-size: 11px;
  opacity: 0.7;
}`,
    js: `const fCard = document.querySelector('.flip-card');
if (fCard) {
  fCard.addEventListener('click', () => {
    fCard.classList.toggle('flipped');
  });
}`
  }
];
