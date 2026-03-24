
import type { ImageGenSeoResult, EtsySeoResult, ImageSize, StyleOption, Dimensions, GenerationOptions } from '../../types';

export interface ImagePayload {
  base64Data: string;
  mimeType: string;
}

export interface TextProvider {
  generateEcomAnalysis(
    imagePayloads: ImagePayload[],
    style: StyleOption,
    customStyle: string,
    options: GenerationOptions
  ): Promise<{ prompts?: string[]; seo?: ImageGenSeoResult }>;

  generateSeoFromKeywords(
    keywords: string,
    dimensionsText?: string
  ): Promise<EtsySeoResult>;

  generateSeoFromUrl(url: string): Promise<EtsySeoResult>;

  testConnection(): Promise<boolean>;
}

export interface ImageProvider {
  generateImage(
    imagePayloads: ImagePayload[],
    prompt: string,
    size: ImageSize
  ): Promise<string>;

  testConnection(): Promise<boolean>;
}

export interface VideoProvider {
  generateVideo(
    imageBase64: string,
    mimeType: string,
    prompt: string,
    onStatus?: (status: string) => void,
    duration?: number
  ): Promise<string>;

  testConnection(): Promise<boolean>;
}
