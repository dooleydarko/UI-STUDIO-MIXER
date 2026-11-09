export type FrameworkType = 'html-css' | 'react' | 'web-component';

export type { ExtractionTarget, PullTarget } from '../mixer/styleExtraction';
import type { ExtractionTarget, PullTarget } from '../mixer/styleExtraction';

export type VariationType = 'original' | 'refined' | 'reimagined' | 'experimental';

export interface ComponentPackage {
  id: string;
  name: string;
  description: string;
  author: string;
  license: string;
  sourceUrl: string;
  framework: FrameworkType;
  html: string;
  css: string;
  js: string;
  tags: string[];
  canvasX: number;
  canvasY: number;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
  variationType?: VariationType;
  parentIds?: string[];
  versionHash?: string;
  previewThumbnail?: string;
  /** For mixed components: what was pulled from which source, and where it went. */
  mixTrace?: MixTraceEntry[];
}

/** One line of "what was taken from what, and where it was put". */
export interface MixTraceEntry {
  from: string;
  what: string;
  to: string;
  detail: string;
  count: number;
}

/** What to pull from one source component, and where to put it in the destination. */
export interface MixPull {
  fromId: string;
  categories: ExtractionTarget[];
  /** Style lines the user unchecked: "<selector>|<property>". */
  excludedItems: string[];
  target: PullTarget;
}

export interface MixRequest {
  /** Every component in the tray. */
  sourceComponents: ComponentPackage[];
  /** The component that receives the pulled traits. Defaults to the last one in the tray. */
  destinationId?: string;
  /** Per-source choices. Sources without an entry use the default selection. */
  pulls?: MixPull[];
  creativeFreedom: number; // 0 (strict/faithful) to 1 (wild/experimental)
  prompt?: string;
  mode: 'three_variations' | 'single_economical';
}

export interface MixVariationResult {
  id: string;
  type: 'refined' | 'reimagined' | 'experimental';
  title: string;
  conceptSummary: string;
  component: ComponentPackage;
  /** What was pulled from what. */
  trace?: MixTraceEntry[];
  /** "applied" = done by the rule-based mixer; "requested" = what the AI was asked to do. */
  traceMode?: 'applied' | 'requested';
  diagnostics: {
    passed: boolean;
    scopedClass: string;
    errors: string[];
    warnings: string[];
    autoRepaired: boolean;
  };
}


export type ProductPreset = 'beverage_can' | 'device_case' | 'bottle' | 'product_box';
export type LightingPreset = 'studio' | 'neon' | 'daylight' | 'dramatic_rim';

export interface DecalTransform {
  imageUrl: string;
  imageName: string;
  scaleX: number;
  scaleY: number;
  positionX: number;
  positionY: number;
  rotation: number;
  opacity: number;
  wrapMode: 'clamp' | 'repeat' | 'cylindrical';
}

export interface Product3DProject {
  id: string;
  name: string;
  preset: ProductPreset;
  dimensions: {
    width: number;
    height: number;
    depth: number;
    unit: 'mm' | 'in';
  };
  material: {
    baseColor: string;
    secondaryColor: string;
    roughness: number;
    metalness: number;
    clearcoat: number;
    transmission?: number;
    emissiveColor: string;
    emissiveIntensity: number;
  };
  decal?: DecalTransform;
  state: {
    powerOn: boolean;
    lidAngle: number;
    rotationActive: boolean;
    rotationSpeed: number;
    lighting: LightingPreset;
    /** Multiplier on the lighting rig's base reflection strength (1 = default). */
    reflectionStrength?: number;
    showWireframe: boolean;
  };
  savedAt: number;
}

export type QueueItemStatus = 'queued' | 'processing' | 'ready' | 'error';

export interface QueuedComponent {
  id: string;
  name: string;
  status: QueueItemStatus;
  html: string;
  css: string;
  js: string;
  sourceUrl?: string;
  sourceType: 'manual_paste' | 'extension' | 'url_fetch' | 'native_gen';
  createdAt: number;
  tags: string[];
  errorMessage?: string;
  diagnostics?: {
    htmlLines: number;
    cssRules: number;
    hasKeyframes: boolean;
    hasHoverStates: boolean;
  };
}

