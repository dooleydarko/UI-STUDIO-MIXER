/**
 * Derives a small glow palette from a component's own CSS/HTML so a card's glow
 * matches the UI it contains, instead of using one fixed accent color.
 */

export type RGB = [number, number, number];

const FALLBACK: RGB[] = [
  [167, 139, 250],
  [129, 140, 248],
  [192, 132, 252],
];

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function collectColors(source: string): RGB[] {
  const colors: RGB[] = [];

  for (const m of source.matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    colors.push([parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]);
  }

  for (const m of source.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi)) {
    colors.push([Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])]);
  }

  for (const m of source.matchAll(/hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/gi)) {
    colors.push(hslToRgb(+m[1] % 360, Math.min(1, +m[2] / 100), Math.min(1, +m[3] / 100)));
  }

  return colors;
}

/**
 * Returns up to three distinct, saturated glow colors found in the component,
 * most prominent first. Falls back to a soft violet set when the component is
 * monochrome or uses no explicit colors.
 */
export function extractGlowPalette(css: string, html = ''): RGB[] {
  const buckets = new Map<number, { score: number; h: number; s: number }>();

  for (const rgb of collectColors(`${css}\n${html}`)) {
    const [h, s, l] = rgbToHsl(rgb);
    // Ignore near-black, near-white and grayish colors; they make a muddy glow
    if (l < 0.12 || l > 0.92 || s < 0.25) continue;
    const key = Math.round(h / 20) % 18;
    const entry = buckets.get(key) ?? { score: 0, h: 0, s: 0 };
    entry.score += 0.5 + s;
    entry.h += h * (0.5 + s);
    entry.s += s * (0.5 + s);
    buckets.set(key, entry);
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.score - a.score)
    .map((e) => ({ h: e.h / e.score, s: e.s / e.score }));

  const chosen: { h: number; s: number }[] = [];
  for (const candidate of ranked) {
    const distinct = chosen.every((c) => {
      const diff = Math.abs(c.h - candidate.h);
      return Math.min(diff, 360 - diff) >= 35;
    });
    if (distinct) chosen.push(candidate);
    if (chosen.length === 3) break;
  }

  if (chosen.length === 0) return FALLBACK;

  // Normalize for a glow on dark: vivid but not blown out
  const palette = chosen.map(({ h, s }) => hslToRgb(h, Math.max(s, 0.6), 0.62));
  while (palette.length < 3) palette.push(palette[palette.length - 1]);
  return palette;
}
