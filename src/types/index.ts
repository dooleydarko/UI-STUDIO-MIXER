export type FrameworkType = 'html-css' | 'react' | 'web-component';

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
}

export interface MixRequest {
  sourceComponents: ComponentPackage[];
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
    showWireframe: boolean;
  };
  savedAt: number;
}
