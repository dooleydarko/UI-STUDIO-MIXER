/**
 * Pulls selected kinds of styling (colors, texture, depth, ...) out of a donor
 * component's CSS and re-targets them onto a base component, so the user can say
 * exactly what to take from one component and apply to another.
 */

export type ExtractionTarget =
  | 'structure'
  | 'colors'
  | 'texture'
  | 'depth'
  | 'shape'
  | 'typography'
  | 'motion'
  | 'behavior';

export const EXTRACTION_OPTIONS: { id: ExtractionTarget; label: string; hint: string }[] = [
  { id: 'structure', label: 'Structure', hint: 'Include the other components\u2019 markup and layout in the mix' },
  { id: 'colors', label: 'Colors', hint: 'Text, background, border and fill colors' },
  { id: 'texture', label: 'Texture', hint: 'Gradients, images, blur / frosted glass, filters, blend modes' },
  { id: 'depth', label: 'Depth', hint: 'Shadows, glow, 3D transforms, layering' },
  { id: 'shape', label: 'Shape', hint: 'Corner radius, borders, outlines, clipping' },
  { id: 'typography', label: 'Typography', hint: 'Fonts, sizes, weight, spacing, casing' },
  { id: 'motion', label: 'Motion', hint: 'Animations, transitions, hover movement, keyframes' },
  { id: 'behavior', label: 'Behavior', hint: 'The other components\u2019 JavaScript' },
];

export const DEFAULT_EXTRACTION: ExtractionTarget[] = ['structure', 'colors', 'texture', 'depth', 'shape'];

type StyleTarget = Exclude<ExtractionTarget, 'structure' | 'behavior'>;

interface Rule {
  selectors: string[];
  decls: [string, string][];
}

/** Splits a declaration block on ';' while respecting parentheses and quotes (url(data:...;base64,...)). */
function parseDecls(body: string): [string, string][] {
  const out: [string, string][] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  const flush = () => {
    const idx = current.indexOf(':');
    if (idx > 0) {
      const prop = current.slice(0, idx).trim().toLowerCase();
      const value = current.slice(idx + 1).replace(/!important/gi, '').trim();
      if (prop && value) out.push([prop, value]);
    }
    current = '';
  };
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = '';
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (ch === ';' && depth === 0) {
      flush();
    } else {
      current += ch;
    }
  }
  flush();
  return out;
}

function matchBrace(css: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length - 1;
}

/** Top-level rules plus raw @keyframes blocks. @media/@supports rules are skipped. */
function parseCss(raw: string): { rules: Rule[]; keyframes: string[] } {
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const keyframes: string[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    const close = matchBrace(css, open);
    if (prelude.startsWith('@')) {
      if (/^@(-webkit-)?keyframes/i.test(prelude)) keyframes.push(`${prelude} ${css.slice(open, close + 1)}`);
    } else if (prelude) {
      rules.push({
        selectors: prelude.split(',').map((s) => s.trim()).filter(Boolean),
        decls: parseDecls(css.slice(open + 1, close)),
      });
    }
    i = close + 1;
  }
  return { rules, keyframes };
}

function categorize(prop: string, value: string): StyleTarget | null {
  const p = prop.replace(/^-webkit-/, '');

  if (p === 'background') return /gradient\(|url\(/i.test(value) ? 'texture' : 'colors';
  if (/^(color|background-color|border(-(top|right|bottom|left))?-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color)$/.test(p)) return 'colors';

  if (/^(background-(image|size|position|repeat|blend-mode|attachment)|backdrop-filter|mask(-.*)?|mix-blend-mode|opacity)$/.test(p)) return 'texture';
  if (p === 'filter') return /drop-shadow/i.test(value) ? 'depth' : 'texture';

  if (/^(box-shadow|text-shadow|z-index|perspective|perspective-origin|transform-style|backface-visibility)$/.test(p)) return 'depth';
  if (p === 'transform') return /translatez|translate3d|rotatex|rotatey|perspective|scale3d/i.test(value) ? 'depth' : 'motion';

  if (/^(border(-(top|right|bottom|left))?(-(width|style|radius))?|border-(top|bottom)-(left|right)-radius|outline(-(width|style|offset))?|clip-path)$/.test(p)) return 'shape';

  if (/^(font(-.*)?|letter-spacing|line-height|text-transform|text-align|word-spacing|text-decoration(-(line|style|thickness))?)$/.test(p)) return 'typography';

  if (/^(animation(-.*)?|transition(-.*)?|will-change)$/.test(p)) return 'motion';

  return null;
}

const GLOBAL_SELECTORS = new Set(['body', 'html', ':root', '*']);
const HOVER_SUFFIX = /(:(?:hover|focus|active|focus-visible))$/;

function splitPseudo(selector: string): { base: string; suffix: string } {
  const m = selector.match(HOVER_SUFFIX);
  return m ? { base: selector.slice(0, -m[1].length).trim(), suffix: m[1] } : { base: selector.trim(), suffix: '' };
}

/** The donor's container rule: first simple class/id rule that styles a box. */
function findRootSelector(rules: Rule[]): string {
  for (const rule of rules) {
    for (const sel of rule.selectors) {
      const { base } = splitPseudo(sel);
      if (GLOBAL_SELECTORS.has(base)) continue;
      if (!/^[.#][\w-]+$/.test(base)) continue;
      if (rule.decls.some(([p]) => /^(background|background-color|box-shadow|border|border-radius|width|height|padding)$/.test(p))) {
        return base;
      }
    }
  }
  return '';
}

const TAG_ROLE = /^(button|a|input|textarea|select|label|h[1-6]|p|svg|img)$/i;
const BUTTON_CLASS = /^\.[\w-]*(btn|button)[\w-]*$/i;

/** Maps a donor selector to the equivalent element inside the base component's scope. */
function mapSelector(selector: string, rootBase: string, scope: string): string[] | null {
  const { base, suffix } = splitPseudo(selector);
  if (GLOBAL_SELECTORS.has(base) || (rootBase && base === rootBase)) {
    return [`.${scope} > :first-child${suffix}`];
  }
  if (TAG_ROLE.test(base)) return [`.${scope} ${base}${suffix}`];
  if (BUTTON_CLASS.test(base)) return [`.${scope} button${suffix}`, `.${scope} [class*="btn"]${suffix}`];
  return null;
}

/** Where, inside the destination component, pulled traits should land. */
export type PullTarget =
  | 'auto'
  | 'container'
  | 'buttons'
  | 'headings'
  | 'links'
  | 'fields'
  | 'paragraphs'
  | 'icons'
  | 'images'
  | 'labels';

export const PULL_TARGET_LABELS: Record<PullTarget, string> = {
  auto: 'Matching parts (automatic)',
  container: 'Whole component (container)',
  buttons: 'Buttons',
  headings: 'Headings',
  links: 'Links',
  fields: 'Form fields',
  paragraphs: 'Paragraphs',
  icons: 'Icons',
  images: 'Images',
  labels: 'Labels',
};

/** Which targets the destination actually has, read from its markup. */
export function availableTargets(html: string): PullTarget[] {
  const out: PullTarget[] = ['auto', 'container'];
  if (/<button|class="[^"]*(btn|button)/i.test(html)) out.push('buttons');
  if (/<h[1-6][\s>]/i.test(html)) out.push('headings');
  if (/<a[\s>]/i.test(html)) out.push('links');
  if (/<(input|textarea|select)[\s>]/i.test(html)) out.push('fields');
  if (/<p[\s>]/i.test(html)) out.push('paragraphs');
  if (/<svg[\s>]/i.test(html)) out.push('icons');
  if (/<img[\s>]/i.test(html)) out.push('images');
  if (/<label[\s>]/i.test(html)) out.push('labels');
  return out;
}

/** CSS selectors for an explicit destination target. */
function targetSelectors(target: Exclude<PullTarget, 'auto'>, scope: string, suffix: string): string[] {
  const s = `.${scope}`;
  switch (target) {
    case 'container':
      return [`${s} > :first-child${suffix}`];
    case 'buttons':
      return [`${s} button${suffix}`, `${s} [class*="btn"]${suffix}`, `${s} [class*="button"]${suffix}`];
    case 'headings':
      return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((h) => `${s} ${h}${suffix}`);
    case 'links':
      return [`${s} a${suffix}`];
    case 'fields':
      return ['input', 'textarea', 'select'].map((t) => `${s} ${t}${suffix}`);
    case 'paragraphs':
      return [`${s} p${suffix}`];
    case 'icons':
      return [`${s} svg${suffix}`];
    case 'images':
      return [`${s} img${suffix}`];
    case 'labels':
      return [`${s} label${suffix}`];
  }
}

/** Human name of the element a donor selector corresponds to ("buttons", "container", ...). */
function autoTargetLabel(selector: string, rootBase: string): string | null {
  const { base } = splitPseudo(selector);
  if (GLOBAL_SELECTORS.has(base) || (rootBase && base === rootBase)) return 'container';
  if (BUTTON_CLASS.test(base) || /^button$/i.test(base)) return 'buttons';
  if (/^h[1-6]$/i.test(base)) return 'headings';
  if (/^a$/i.test(base)) return 'links';
  if (/^(input|textarea|select)$/i.test(base)) return 'form fields';
  if (/^p$/i.test(base)) return 'paragraphs';
  if (/^svg$/i.test(base)) return 'icons';
  if (/^img$/i.test(base)) return 'images';
  if (/^label$/i.test(base)) return 'labels';
  return null;
}

export interface PullResult {
  css: string;
  /** Number of declarations pulled, for UI feedback and diagnostics. */
  count: number;
}

export type StyleCategory = Exclude<ExtractionTarget, 'structure' | 'behavior'>;

/** One declaration found in a component's CSS, ready to show as a clickable option. */
export interface StyleItem {
  /** Stable id within a component: "<selector>|<property>". */
  key: string;
  selector: string;
  prop: string;
  value: string;
  category: StyleCategory;
  /** False when the selector has no counterpart in the base component, so it can't be transferred. */
  transferable: boolean;
  /** Which element in the destination this lands on by default (null when not transferable). */
  target: string | null;
}

export type StyleInventory = Record<StyleCategory, StyleItem[]>;

export const STYLE_CATEGORIES: StyleCategory[] = ['colors', 'texture', 'depth', 'shape', 'typography', 'motion'];

/**
 * Reads a component's CSS and sorts every declaration into the category it belongs to
 * (texture code under Texture, color code under Colors, and so on), so the UI can list
 * exactly what each option would pull.
 */
export function analyzeStyles(css: string): StyleInventory {
  const inventory: StyleInventory = { colors: [], texture: [], depth: [], shape: [], typography: [], motion: [] };
  const { rules } = parseCss(css);
  const rootBase = findRootSelector(rules);

  for (const rule of rules) {
    for (const selector of rule.selectors) {
      const transferable = mapSelector(selector, rootBase, 'x') !== null;
      const isGlobal = GLOBAL_SELECTORS.has(splitPseudo(selector).base);
      for (const [prop, value] of rule.decls) {
        const category = categorize(prop, value);
        if (!category) continue;
        if (isGlobal && /^background/.test(prop)) continue;
        inventory[category].push({
          key: `${selector}|${prop}`,
          selector,
          prop,
          value,
          category,
          transferable,
          target: transferable ? autoTargetLabel(selector, rootBase) : null,
        });
      }
    }
  }
  return inventory;
}

/**
 * Returns CSS that applies the chosen kinds of styling from `donorCss` to the
 * component wrapped by `.${baseScope}`. Declarations are !important so they win
 * over the base component's own rules regardless of selector weight.
 * `excluded` holds item keys (see StyleItem.key) the user unchecked.
 */
export function pullStyles(
  donorCss: string,
  baseScope: string,
  targets: ExtractionTarget[],
  excluded: Set<string> = new Set(),
  destination: PullTarget = 'auto'
): PullResult {
  const wanted = new Set<ExtractionTarget>(targets);
  const styleTargets = STYLE_CATEGORIES.filter((t) => wanted.has(t));
  if (styleTargets.length === 0) return { css: '', count: 0 };

  const { rules, keyframes } = parseCss(donorCss);
  const rootBase = findRootSelector(rules);
  let css = '';
  let count = 0;

  for (const rule of rules) {
    for (const sel of rule.selectors) {
      const auto = mapSelector(sel, rootBase, baseScope);
      if (!auto) continue; // only code that has a counterpart can be transferred
      // An explicit destination replaces the automatic match, keeping :hover/:focus states
      const mapped = destination === 'auto' ? auto : targetSelectors(destination, baseScope, splitPseudo(sel).suffix);

      const isGlobalRule = GLOBAL_SELECTORS.has(splitPseudo(sel).base);
      const kept = rule.decls.filter(([prop, value]) => {
        const cat = categorize(prop, value);
        if (!cat || !styleTargets.includes(cat)) return false;
        if (excluded.has(`${sel}|${prop}`)) return false;
        // A page-level background belongs to the page, not to the component being styled
        if (isGlobalRule && /^background/.test(prop)) return false;
        return true;
      });
      if (kept.length === 0) continue;

      count += kept.length;
      css += `${mapped.join(', ')} { ${kept.map(([p, v]) => `${p}: ${v} !important;`).join(' ')} }\n`;
    }
  }

  if (wanted.has('motion') && keyframes.length > 0) {
    css += `${keyframes.join('\n')}\n`;
  }

  return { css, count };
}
