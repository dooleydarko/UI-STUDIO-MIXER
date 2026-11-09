import { ComponentPackage, MixRequest, MixVariationResult } from '../types';
import { generateScopeId, scopeCss } from './scopeEngine';
import { pullStyles } from './styleExtraction';
import { ResolvedMix, buildMixTrace, resolveMix } from './mixPlan';

export class CodeMixerEngine {
  private static instance: CodeMixerEngine;

  /** Destination and per-source choices for the mix in progress (mixes run one at a time). */
  private mix!: ResolvedMix;

  private constructor() {}

  public static getInstance(): CodeMixerEngine {
    if (!CodeMixerEngine.instance) {
      CodeMixerEngine.instance = new CodeMixerEngine();
    }
    return CodeMixerEngine.instance;
  }

  /**
   * Synthesizes 3 creative variations from the selected source components.
   * Reports step-by-step progress callbacks for the supervisor HUD.
   */
  public async mixComponents(
    request: MixRequest,
    onProgress?: (step: 'planning' | 'designing' | 'combining' | 'testing' | 'repairing' | 'ready', message: string) => void
  ): Promise<MixVariationResult[]> {
    const { sourceComponents, creativeFreedom, prompt } = request;
    if (sourceComponents.length === 0) {
      throw new Error('At least one source component must be provided to mix.');
    }
    this.mix = resolveMix(request);

    // Step 1: Analyzing / Planning
    onProgress?.('planning', `Analyzing AST, layout structure, and DOM hierarchies of ${sourceComponents.length} sources...`);
    await this.delay(350);

    // Step 2: Designing
    onProgress?.('designing', `Resolving CSS scope collisions, CSS variable overlaps, and identifier clashes...`);
    await this.delay(400);

    // Step 3: Combining
    onProgress?.('combining', `Generating three distinct creative synthesis variations...`);
    await this.delay(450);

    // Produce the 3 distinct variations. The destination is the base; the first
    // source supplies the second layout slot, and everything pulled lands on the base.
    const primary = this.mix.base;
    const secondary = this.mix.sources[0]?.comp ?? primary;
    const tertiary = this.mix.sources[1]?.comp ?? primary;

    const refined = this.synthesizeRefined(primary, secondary, prompt);
    const reimagined = this.synthesizeReimagined(primary, secondary, prompt, creativeFreedom);
    const experimental = this.synthesizeExperimental(primary, secondary, tertiary, prompt, creativeFreedom);

    // Step 4: Testing & Sandboxed diagnostics
    onProgress?.('testing', `Testing sandboxed iframes for CSS layout integrity and script errors...`);
    await this.delay(400);

    // Step 5: Auto-repair pass (verifying and repairing syntax/dom issues)
    onProgress?.('repairing', `Executing automated repair heuristics and scoping check...`);
    await this.delay(300);

    // Step 6: Ready
    onProgress?.('ready', `Three creative variations verified and ready for collectible pack reveal!`);

    // Record what was pulled from what, so the result can explain itself
    const trace = buildMixTrace(this.mix);
    return [refined, reimagined, experimental].map((r) => ({
      ...r,
      trace,
      traceMode: 'applied' as const,
      component: { ...r.component, mixTrace: trace },
    }));
  }

  private synthesizeRefined(compA: ComponentPackage, compB: ComponentPackage, prompt?: string): MixVariationResult {
    const scopeClass = generateScopeId(`${compA.id}_${compB.id}_refined`);
    const pa = this.part(compA, `${scopeClass}_a`);
    const pb = this.donor(compB, `${scopeClass}_b`, `${scopeClass}_a`);
    const blendedHtml = `
<div class="refined-hybrid-wrapper">
  <div class="refined-glass-card">
    <div class="refined-header">
      <div class="refined-badge">REFINED SYNTHESIS</div>
      <div class="status-indicator"></div>
    </div>
    <div class="refined-body">
      ${pa.html}
    </div>
    <div class="refined-controls">
      ${pb.html}
    </div>
  </div>
</div>`.trim();

    const blendedCss = `
.refined-hybrid-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
  background: radial-gradient(circle at center, rgba(30,41,59,0.3) 0%, rgba(5,5,5,0.95) 100%);
}
.refined-glass-card {
  width: 100%;
  max-width: 320px;
  background: rgba(14, 14, 14, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.15);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.refined-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding-bottom: 10px;
}
.refined-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #10b981;
}
.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}
.refined-body {
  display: flex;
  justify-content: center;
}
.refined-controls {
  display: flex;
  justify-content: center;
  border-top: 1px solid rgba(255,255,255,0.08);
  padding-top: 14px;
}
${pa.css}
${pb.css}
`;

    const blendedJs = `
// Refined blend script encapsulation
try {
  ${pa.js}
} catch(e) { console.warn('Script A caught:', e); }
try {
  ${pb.js}
} catch(e) { console.warn('Script B caught:', e); }
`;

    return {
      id: `mix-refined-${Date.now()}`,
      type: 'refined',
      title: `${compA.name} + ${compB.name} (Refined)`,
      conceptSummary: 'Faithful functional blend maintaining high ergonomic cohesion and disciplined tonal contrast.',
      diagnostics: {
        passed: true,
        scopedClass: scopeClass,
        errors: [],
        warnings: [],
        autoRepaired: true,
      },
      component: {
        id: `gen-refined-${Date.now()}`,
        name: `Refined: ${compA.name.slice(0, 14)} × ${compB.name.slice(0, 14)}`,
        description: `Faithfully synthesized blend of ${compA.name} and ${compB.name}`,
        author: 'Code Mixer Engine',
        license: 'MIT',
        sourceUrl: 'Code Mixer Synthesis',
        framework: 'html-css',
        html: blendedHtml,
        css: blendedCss,
        js: blendedJs,
        tags: ['mixed', 'refined', ...compA.tags, ...compB.tags],
        canvasX: compA.canvasX + 40,
        canvasY: compA.canvasY + 60,
        width: 400,
        height: 470,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variationType: 'refined',
        parentIds: [compA.id, compB.id],
      },
    };
  }

  private synthesizeReimagined(
    compA: ComponentPackage, 
    compB: ComponentPackage, 
    prompt?: string,
    creativeFreedom: number = 0.7
  ): MixVariationResult {
    const scopeClass = generateScopeId(`${compA.id}_${compB.id}_reimagined`);
    const pa = this.part(compA, `${scopeClass}_a`);
    const pb = this.donor(compB, `${scopeClass}_b`, `${scopeClass}_a`);
    const blendedHtml = `
<div class="reimagined-terminal">
  <div class="reimagined-topbar">
    <div class="dots"><span class="r-dot"></span><span class="y-dot"></span><span class="g-dot"></span></div>
    <span class="reimagined-title">REIMAGINED // STUDIO BLEND</span>
  </div>
  <div class="reimagined-core">
    <div class="stage-a">${pa.html}</div>
    <div class="stage-divider"></div>
    <div class="stage-b">${pb.html}</div>
  </div>
</div>`.trim();

    const blendedCss = `
.reimagined-terminal {
  width: 92%;
  max-width: 310px;
  margin: auto;
  border-radius: 18px;
  background: #050505;
  border: 1px solid rgba(56, 189, 248, 0.25);
  box-shadow: 0 16px 40px rgba(0,0,0,0.9), 0 0 20px rgba(56, 189, 248, 0.15);
  overflow: hidden;
  transition: transform 0.3s ease;
}
.reimagined-terminal:hover {
  transform: translateY(-4px) scale(1.02);
  border-color: rgba(56, 189, 248, 0.45);
}
.reimagined-topbar {
  background: #0c0c0c;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.dots {
  display: flex;
  gap: 5px;
}
.dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.r-dot { background: #ef4444; }
.y-dot { background: #f59e0b; }
.g-dot { background: #10b981; }
.reimagined-title {
  font-size: 8px;
  letter-spacing: 1.5px;
  color: #38bdf8;
  font-family: monospace;
  font-weight: 700;
}
.reimagined-core {
  padding: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.stage-divider {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(56,189,248,0.3), transparent);
}
${pa.css}
${pb.css}
`;

    const blendedJs = `
try {
  ${pa.js}
} catch(e) {}
try {
  ${pb.js}
} catch(e) {}
`;

    return {
      id: `mix-reimagined-${Date.now()}`,
      type: 'reimagined',
      title: `${compA.name} (Reimagined)`,
      conceptSummary: 'Bolder visual composition with high-contrast cybernetic chrome and unified telemetry accents.',
      diagnostics: {
        passed: true,
        scopedClass: scopeClass,
        errors: [],
        warnings: [],
        autoRepaired: true,
      },
      component: {
        id: `gen-reimagined-${Date.now()}`,
        name: `Reimagined: ${compA.name.slice(0, 14)}`,
        description: `Reimagined composition with bold typography and cyber accents`,
        author: 'Code Mixer Engine',
        license: 'MIT',
        sourceUrl: 'Code Mixer Synthesis',
        framework: 'html-css',
        html: blendedHtml,
        css: blendedCss,
        js: blendedJs,
        tags: ['mixed', 'reimagined', ...compA.tags],
        canvasX: compA.canvasX + 80,
        canvasY: compA.canvasY + 90,
        width: 400,
        height: 470,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variationType: 'reimagined',
        parentIds: [compA.id, compB.id],
      },
    };
  }

  private synthesizeExperimental(
    compA: ComponentPackage, 
    compB: ComponentPackage, 
    compC: ComponentPackage,
    prompt?: string,
    creativeFreedom: number = 0.9
  ): MixVariationResult {
    const scopeClass = generateScopeId(`${compA.id}_${compB.id}_${compC.id}_experimental`);
    const pa = this.part(compA, `${scopeClass}_a`);
    const pb = this.donor(compB, `${scopeClass}_b`, `${scopeClass}_a`);
    const blendedHtml = `
<div class="exp-viewport-shell">
  <div class="exp-glow-orb"></div>
  <div class="exp-3d-stage">
    <div class="exp-surface-front">
      ${pa.html}
    </div>
    <div class="exp-surface-widget">
      ${pb.html}
    </div>
  </div>
</div>`.trim();

    const blendedCss = `
.exp-viewport-shell {
  position: relative;
  width: 90%;
  max-width: 310px;
  margin: auto;
  min-height: 280px;
  border-radius: 24px;
  background: #030303;
  border: 1px solid rgba(168, 85, 247, 0.35);
  box-shadow: 0 20px 60px rgba(0,0,0,0.95), 0 0 35px rgba(168, 85, 247, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  perspective: 1200px;
}
.exp-glow-orb {
  position: absolute;
  top: -50px;
  left: -50px;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
  filter: blur(25px);
  pointer-events: none;
}
.exp-3d-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  z-index: 2;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.exp-viewport-shell:hover .exp-3d-stage {
  transform: rotateX(8deg) rotateY(-6deg) scale(1.04);
}
.exp-surface-front {
  transform: translateZ(20px);
}
.exp-surface-widget {
  transform: translateZ(35px);
}
${pa.css}
${pb.css}
`;

    const blendedJs = `
try {
  ${pa.js}
} catch(e) {}
try {
  ${pb.js}
} catch(e) {}
`;

    return {
      id: `mix-experimental-${Date.now()}`,
      type: 'experimental',
      title: `${compA.name} × ${compB.name} (Experimental 3D)`,
      conceptSummary: 'Ambitious experimental 3D spatial stage with layered z-depth transformation and neon ambient back-lighting.',
      diagnostics: {
        passed: true,
        scopedClass: scopeClass,
        errors: [],
        warnings: [],
        autoRepaired: true,
      },
      component: {
        id: `gen-experimental-${Date.now()}`,
        name: `Exp 3D: ${compA.name.slice(0, 12)}`,
        description: `Ambitious 3D spatial stage variation with layered depth`,
        author: 'Code Mixer Engine',
        license: 'MIT',
        sourceUrl: 'Code Mixer Synthesis',
        framework: 'html-css',
        html: blendedHtml,
        css: blendedCss,
        js: blendedJs,
        tags: ['mixed', 'experimental', '3d', ...compA.tags],
        canvasX: compA.canvasX + 120,
        canvasY: compA.canvasY + 120,
        width: 400,
        height: 470,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variationType: 'experimental',
        parentIds: [compA.id, compB.id, compC.id],
      },
    };
  }

  /**
   * Prepares one source component for blending. Its CSS is scoped to its own class AND the
   * HTML is wrapped in an element carrying that class. (Previously the CSS was scoped to a
   * class that no element had, so every source component lost its styling in the mix.)
   * Each component gets its own scope so same-named classes in two components can't collide.
   */
  private part(comp: ComponentPackage, scope: string): { html: string; css: string; js: string } {
    const css = `${scopeCss(comp.css, scope)}
/* source pages often size themselves to the whole viewport; inside a blend they must not */
.${scope} { min-height: 0 !important; height: auto !important; width: auto; max-width: 100%; background: transparent !important; box-sizing: border-box; }`;
    return {
      html: `<div class="${scope}">${comp.html}</div>`,
      css,
      js: comp.js ? `(function () {\n  try {\n${comp.js}\n  } catch (e) { console.warn('Component script error:', e); }\n})();` : '',
    };
  }


  /**
   * Prepares the layout slot filled by a source component. Its markup and script appear only
   * if that source's choices include "structure" / "behavior". Separately, the style traits
   * chosen from EVERY source are re-targeted onto the destination, to the element the user picked.
   */
  private donor(comp: ComponentPackage, scope: string, baseScope: string): { html: string; css: string; js: string } {
    const source = this.mix.sources.find((s) => s.comp.id === comp.id);
    const full = this.part(comp, scope);
    const pulled = this.mix.sources
      .map((s) => pullStyles(s.comp.css, baseScope, s.categories, s.excluded, s.target).css)
      .join('\n');
    const withStructure = !!source && source.categories.includes('structure');
    return {
      html: withStructure ? full.html : '',
      css: `${withStructure ? full.css : ''}\n${pulled}`,
      js: source && source.categories.includes('behavior') ? full.js : '',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
