import { MixRequest, MixVariationResult } from '../types';
import { STYLE_CATEGORIES, PULL_TARGET_LABELS, analyzeStyles } from '../mixer/styleExtraction';
import { ResolvedSource, buildMixTrace, resolveMix } from '../mixer/mixPlan';
import { requestAiMix } from './aiClient';

/** The style lines ticked for one source, as readable "selector { prop: value }" strings. */
function selectedCodeFor(source: ResolvedSource): Record<string, string[]> {
  const inventory = analyzeStyles(source.comp.css);
  const out: Record<string, string[]> = {};
  for (const cat of STYLE_CATEGORIES) {
    if (!source.categories.includes(cat)) continue;
    out[cat] = inventory[cat]
      .filter((i) => i.transferable && !source.excluded.has(i.key))
      .map((i) => `${i.selector} { ${i.prop}: ${i.value}; }`);
  }
  return out;
}

export type AiProvider = 'local' | 'gemini';

/**
 * Asks an AI model for three blended variations that follow what the user chose to pull
 * from each component, where to put it, and their direction. 'local' runs the Qwen model
 * through Ollama on this Mac; 'gemini' uses Google's API (the key stays in the main process).
 */
export async function mixWithAI(
  request: MixRequest,
  provider: AiProvider,
  onProgress?: (step: 'planning' | 'designing' | 'combining' | 'testing' | 'repairing' | 'ready', message: string) => void
): Promise<MixVariationResult[]> {
  const mix = resolveMix(request);
  const base = mix.base;

  onProgress?.('planning', 'Reading the components and the traits you picked...');
  const payload = {
    provider,
    prompt: request.prompt ?? '',
    freedom: request.creativeFreedom,
    base: { id: base.id, name: base.name, html: base.html, css: base.css, js: base.js },
    sources: mix.sources.map((s) => ({
      id: s.comp.id,
      name: s.comp.name,
      html: s.comp.html,
      css: s.comp.css,
      js: s.comp.js,
      categories: s.categories,
      // 'auto' means each trait lands on the matching element; otherwise everything goes to one element
      placeOnto: s.target === 'auto' ? 'the matching element of the base' : PULL_TARGET_LABELS[s.target],
      selectedCode: selectedCodeFor(s),
    })),
  };

  onProgress?.(
    'designing',
    provider === 'local'
      ? 'The local model is writing three variations. On this Mac that can take a few minutes...'
      : 'Asking Gemini to blend them. This can take 10-30 seconds...'
  );
  const variations = await requestAiMix(payload);

  onProgress?.('combining', 'Packaging the three variations...');
  const now = Date.now();
  const names = [base, ...mix.sources.map((s) => s.comp)].map((c) => c.name).join(' + ');
  const trace = buildMixTrace(mix);
  const results = variations.map((v, i): MixVariationResult => {
    const label = v.type === 'refined' ? 'Refined' : v.type === 'reimagined' ? 'Reimagined' : 'Experimental';
    return {
      id: `ai-mix-${v.type}-${now}`,
      type: v.type,
      title: v.title || `${base.name} (${label})`,
      conceptSummary: v.summary || `${label} AI blend of ${names}`,
      trace,
      traceMode: 'requested',
      diagnostics: { passed: true, scopedClass: '', errors: [], warnings: [], autoRepaired: false },
      component: {
        id: `gen-ai-${v.type}-${now}`,
        name: `${label}: ${(v.title || base.name).slice(0, 24)}`,
        description: v.summary || `AI blend of ${names}`,
        author: 'AI Mixer',
        license: 'Free / public',
        sourceUrl: 'AI Mix',
        framework: 'html-css',
        html: v.html,
        css: v.css,
        js: v.js,
        tags: ['mixed', 'ai', v.type],
        canvasX: base.canvasX + 50 * (i + 1),
        canvasY: base.canvasY + 70 * (i + 1),
        width: 400,
        height: 470,
        createdAt: now,
        updatedAt: now,
        variationType: v.type,
        parentIds: [base.id, ...mix.sources.map((s) => s.comp.id)],
        mixTrace: trace,
      },
    };
  });

  onProgress?.('ready', 'Three variations are ready.');
  return results;
}
