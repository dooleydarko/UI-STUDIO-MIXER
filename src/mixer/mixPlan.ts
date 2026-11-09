import {
  ComponentPackage,
  MixPull,
  MixRequest,
  MixTraceEntry,
} from '../types';
import {
  DEFAULT_EXTRACTION,
  EXTRACTION_OPTIONS,
  ExtractionTarget,
  PULL_TARGET_LABELS,
  PullTarget,
  STYLE_CATEGORIES,
  analyzeStyles,
} from './styleExtraction';

export interface ResolvedSource {
  comp: ComponentPackage;
  categories: ExtractionTarget[];
  /** Unchecked style lines for this source: "<selector>|<property>". */
  excluded: Set<string>;
  target: PullTarget;
}

export interface ResolvedMix {
  /** The destination: receives the pulled traits and keeps its own identity. */
  base: ComponentPackage;
  /** Every other component in the tray, with what to pull from it. */
  sources: ResolvedSource[];
}

export const defaultPull = (fromId: string): MixPull => ({
  fromId,
  categories: DEFAULT_EXTRACTION,
  excludedItems: [],
  target: 'auto',
});

/** Works out destination and per-source choices from a request, filling in defaults. */
export function resolveMix(request: Pick<MixRequest, 'sourceComponents' | 'destinationId' | 'pulls'>): ResolvedMix {
  const all = request.sourceComponents;
  const base = all.find((c) => c.id === request.destinationId) ?? all[all.length - 1];
  const sources = all
    .filter((c) => c.id !== base.id)
    .map((comp) => {
      const pull = request.pulls?.find((p) => p.fromId === comp.id) ?? defaultPull(comp.id);
      return { comp, categories: pull.categories, excluded: new Set(pull.excludedItems), target: pull.target };
    });
  return { base, sources };
}

const labelOf = (id: ExtractionTarget) => EXTRACTION_OPTIONS.find((o) => o.id === id)?.label ?? id;

/**
 * Plain-language record of what is taken from which component and where it is put.
 * Built from the same inputs the mixer uses, so what you see is what gets pulled.
 */
export function buildMixTrace(mix: ResolvedMix): MixTraceEntry[] {
  const entries: MixTraceEntry[] = [];
  for (const { comp, categories, excluded, target } of mix.sources) {
    if (categories.includes('structure')) {
      entries.push({
        from: comp.name,
        what: 'Structure',
        to: mix.base.name,
        detail: 'its markup and layout are added alongside',
        count: 1,
      });
    }

    const inventory = analyzeStyles(comp.css);
    for (const cat of STYLE_CATEGORIES) {
      if (!categories.includes(cat)) continue;
      const byTarget = new Map<string, { props: Set<string>; count: number }>();
      for (const item of inventory[cat]) {
        if (!item.transferable || !item.target || excluded.has(item.key)) continue;
        const place = target === 'auto' ? item.target : PULL_TARGET_LABELS[target].replace(/ \(.*\)$/, '').toLowerCase();
        const group = byTarget.get(place) ?? { props: new Set<string>(), count: 0 };
        group.props.add(item.prop);
        group.count += 1;
        byTarget.set(place, group);
      }
      for (const [place, { props, count }] of byTarget) {
        const list = [...props];
        entries.push({
          from: comp.name,
          what: labelOf(cat),
          to: `${mix.base.name} \u203A ${place}`,
          detail: list.length > 4 ? `${list.slice(0, 4).join(', ')} +${list.length - 4} more` : list.join(', '),
          count,
        });
      }
    }

    if (categories.includes('behavior') && comp.js && comp.js.trim()) {
      entries.push({ from: comp.name, what: 'Behavior', to: mix.base.name, detail: 'its script is included', count: 1 });
    }
  }
  return entries;
}
