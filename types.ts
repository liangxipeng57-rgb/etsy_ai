export interface ImageGenSeoResult {
  titles: string[];
  keywords: string[];
}

export interface EtsySeoResult {
  titles: string[];
  description: string;
  tags: string[];
  groundingUrls?: Array<{ title: string; uri: string }>;
}

export type StyleOption = 'auto' | 'home' | 'pinterest' | 'instagram' | 'custom' | 'auto-model';

export interface Dimensions {
  width: string;
  height: string;
  depth: string;
}

export type DimensionUnit = 'cm' | 'in';

export type ImageSize =
  | '800x800'
  | '2000x2000'
  | '1440x1920'
  | '1200x1600'
  | '1600x1200'
  | '1500x1200';

export interface GenerationOptions {
  includeImages: boolean;
  includeSeo: boolean;
  dimensionUnit: DimensionUnit;
  imageCount: number;
}

export type AICapability = 'text' | 'image' | 'video';
