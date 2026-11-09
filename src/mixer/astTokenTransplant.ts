/**
 * AST Design Token Transplantation Engine
 * Deterministic style extraction and injection across component boundaries.
 */

import { ComponentPackage } from '../types';

export interface DesignTokens {
  gradients: string[];
  boxShadows: string[];
  borderRadii: string[];
  glows: string[];
  primaryColors: string[];
  backgrounds: string[];
  fontFamilies: string[];
  keyframes: { name: string; body: string }[];
}

export interface TransplantResult {
  component: ComponentPackage;
  tokensExtracted: number;
  rulesModified: number;
  appliedGlow: string;
  appliedGradient: string;
  transplantSummary: string;
}

/**
 * Parses raw CSS into a categorized token collection
 */
export function extractDesignTokens(css: string): DesignTokens {
  const tokens: DesignTokens = {
    gradients: [],
    boxShadows: [],
    borderRadii: [],
    glows: [],
    primaryColors: [],
    backgrounds: [],
    fontFamilies: [],
    keyframes: [],
  };

  if (!css) return tokens;

  // 1. Extract Gradients
  const gradMatches = css.match(/(?:linear|radial|conic)-gradient\([^;\}]+\)/gi);
  if (gradMatches) {
    tokens.gradients = Array.from(new Set(gradMatches.map((g) => g.trim())));
  }

  // 2. Extract Box Shadows & Glows
  const shadowMatches = css.match(/box-shadow\s*:\s*([^;\}]+)/gi);
  if (shadowMatches) {
    shadowMatches.forEach((m) => {
      const val = m.replace(/box-shadow\s*:\s*/i, '').trim();
      tokens.boxShadows.push(val);
      if (val.includes('rgba') || val.includes('#') || val.includes('0 0 ')) {
        tokens.glows.push(val);
      }
    });
  }

  // 3. Extract Border Radii
  const radiusMatches = css.match(/border-radius\s*:\s*([^;\}]+)/gi);
  if (radiusMatches) {
    tokens.borderRadii = Array.from(
      new Set(radiusMatches.map((r) => r.replace(/border-radius\s*:\s*/i, '').trim()))
    );
  }

  // 4. Extract Colors (#hex, rgb/rgba, hsl)
  const colorMatches = css.match(/(?:#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))/gi);
  if (colorMatches) {
    tokens.primaryColors = Array.from(new Set(colorMatches.map((c) => c.trim())));
  }

  // 5. Extract Keyframe Animations
  const kfRegex = /@keyframes\s+([a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}\s*\}/gi;
  let kfMatch;
  while ((kfMatch = kfRegex.exec(css)) !== null) {
    tokens.keyframes.push({
      name: kfMatch[1],
      body: kfMatch[0],
    });
  }

  return tokens;
}

/**
 * Injects donor design tokens into recipient CSS
 */
export function transplantTokens(
  recipient: ComponentPackage,
  donor: ComponentPackage
): TransplantResult {
  const donorTokens = extractDesignTokens(donor.css);
  let recipientCss = recipient.css;
  let rulesModified = 0;

  const appliedGlow = donorTokens.glows[0] || '0 0 25px rgba(56, 189, 248, 0.4)';
  const appliedGradient = donorTokens.gradients[0] || 'linear-gradient(135deg, #0f172a, #020617)';

  // 1. Transplant Gradients & Background
  if (donorTokens.gradients.length > 0) {
    if (recipientCss.includes('background:')) {
      recipientCss = recipientCss.replace(
        /background\s*:\s*[^;\}]+;/,
        `background: ${donorTokens.gradients[0]};`
      );
      rulesModified++;
    } else {
      recipientCss = `.transplanted-bg { background: ${donorTokens.gradients[0]}; }\n` + recipientCss;
      rulesModified++;
    }
  }

  // 2. Transplant Box Shadow & Glow
  if (donorTokens.glows.length > 0) {
    if (recipientCss.includes('box-shadow:')) {
      recipientCss = recipientCss.replace(
        /box-shadow\s*:\s*[^;\}]+;/,
        `box-shadow: ${donorTokens.glows[0]};`
      );
      rulesModified++;
    } else {
      recipientCss += `\n* { box-shadow: ${donorTokens.glows[0]}; }\n`;
      rulesModified++;
    }
  }

  // 3. Transplant Border Radius
  if (donorTokens.borderRadii.length > 0) {
    recipientCss = recipientCss.replace(
      /border-radius\s*:\s*[^;\}]+;/g,
      `border-radius: ${donorTokens.borderRadii[0]};`
    );
    rulesModified++;
  }

  // 4. Append Donor Keyframes if present
  if (donorTokens.keyframes.length > 0) {
    donorTokens.keyframes.forEach((kf) => {
      if (!recipientCss.includes(kf.name)) {
        recipientCss += `\n${kf.body}\n`;
        rulesModified++;
      }
    });
  }

  const tokensExtractedCount =
    donorTokens.gradients.length +
    donorTokens.boxShadows.length +
    donorTokens.borderRadii.length +
    donorTokens.primaryColors.length +
    donorTokens.keyframes.length;

  const updatedComponent: ComponentPackage = {
    ...recipient,
    id: `comp-transplanted-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `${recipient.name} × ${donor.name} (AST Harmonized)`,
    css: recipientCss,
    updatedAt: Date.now(),
    tags: [...recipient.tags, 'ast-transplanted', 'harmonized'],
  };

  return {
    component: updatedComponent,
    tokensExtracted: tokensExtractedCount,
    rulesModified,
    appliedGlow,
    appliedGradient,
    transplantSummary: `Transplanted ${tokensExtractedCount} tokens (${donorTokens.gradients.length} gradients, ${donorTokens.glows.length} glow matrices) into ${recipient.name}.`,
  };
}
