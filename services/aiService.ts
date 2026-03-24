
import type { ImageGenSeoResult, EtsySeoResult, StyleOption, Dimensions, ImageSize, GenerationOptions, DimensionUnit } from '../types';
import type { TextProvider, ImageProvider, VideoProvider, ImagePayload } from './providers/types';
import { HARDCODED_MODELS } from './providerRegistry';
import { compressImagePayload } from '../utils/fileUtils';

import { ToAPIsTextProvider, ToAPIsImageProvider, ToAPIsVideoProvider } from './providers/toApiProvider';
import { MODEL_SCENE_PROMPT_TEMPLATE, DETAIL_ENHANCE_PROMPT, IMAGE_FUSION_PROMPT_TEMPLATE } from './prompts';

// ── 压缩工具：将一组 ImagePayload 全部压缩到 API 友好体积 ──────────
async function compressPayloads(payloads: ImagePayload[]): Promise<ImagePayload[]> {
  return Promise.all(
    payloads.map((p) => compressImagePayload(p.base64Data, p.mimeType))
  );
}

function normalizeGeneratedPrompt(prompt: unknown): string {
  return String(prompt ?? '').replace(/\s+/g, ' ').trim();
}

export interface EcomImageProgress {
  image: string;
  index: number;
  total: number;
  isDimension: boolean;
}

interface EcomAssetsResult {
  images: string[];
  seo: ImageGenSeoResult | null;
  etsySeo: EtsySeoResult | null;
  seoError: Error | null;
}

async function runWithRetry<T>(
  worker: () => Promise<T>,
  retries: number = 1,
  delayMs: number = 800
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function generateWithConcurrencyInOrder<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<string>,
  onResolved?: (image: string, index: number) => void
): Promise<string[]> {
  const results: Array<string | undefined> = new Array(items.length);
  let nextIndex = 0;
  let nextEmitIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;

      const image = await worker(items[currentIndex], currentIndex);
      results[currentIndex] = image;

      while (nextEmitIndex < results.length && results[nextEmitIndex] !== undefined) {
        onResolved?.(results[nextEmitIndex] as string, nextEmitIndex);
        nextEmitIndex += 1;
      }
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => runWorker());
  await Promise.all(workers);
  return results as string[];
}

async function generateImageBatchWithRetry(
  count: number,
  worker: (index: number) => Promise<string>,
  retries: number = 2
): Promise<string[]> {
  const images: string[] = [];
  const failures: string[] = [];

  for (let index = 0; index < count; index += 1) {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        images.push(await worker(index));
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        }
      }
    }

    if (lastError) {
      failures.push(lastError instanceof Error ? lastError.message : String(lastError));
    }
  }

  if (images.length === 0) {
    throw new Error(failures[0] || 'Image generation failed.');
  }

  return images;
}

// ── 固定供应商：全部走 ToAPIs + 硬编码模型 ─────────────────────────
function getTextProvider(): TextProvider {
  return new ToAPIsTextProvider(HARDCODED_MODELS.text);
}

function getImageProvider(): ImageProvider {
  return new ToAPIsImageProvider(HARDCODED_MODELS.image);
}

function getTextToImageProvider(): ImageProvider {
  return new ToAPIsImageProvider(HARDCODED_MODELS.textToImage);
}

function getVideoProvider(): VideoProvider {
  return new ToAPIsVideoProvider(HARDCODED_MODELS.video);
}

// --- Re-export getDimensionPrompt (pure function, no provider dependency) ---
export const getDimensionPrompt = (dimensions: Dimensions, unit: DimensionUnit = 'cm', activeDims?: {width: boolean, height: boolean, depth: boolean}): string | null => {
  const { width, height, depth } = dimensions;
  if (activeDims) {
      if ((!activeDims.width || !width) && (!activeDims.height || !height) && (!activeDims.depth || !depth)) {
          return null;
      }
  } else if (!width && !height && !depth) {
    return null;
  }
  const dimensionParts = [];
  if (height && (!activeDims || activeDims.height)) dimensionParts.push(`Height (${height}${unit})`);
  if (width && (!activeDims || activeDims.width)) dimensionParts.push(`Width (${width}${unit})`);
  if (depth && (!activeDims || activeDims.depth)) dimensionParts.push(`Length (${depth}${unit})`);
  if (dimensionParts.length === 0) return null;
  return `Using the provided product images as a reference, create a professional technical illustration on white background. Add clean dimension lines: ${dimensionParts.join(', ')}.`;
};

// --- Public API ---

export const generateEcomAssets = async (
    imagePayloads: ImagePayload[],
    style: StyleOption,
    dimensions: Dimensions,
    size: ImageSize,
    customStyle: string,
    options: GenerationOptions,
    onImageGenerated?: (progress: EcomImageProgress) => void
): Promise<EcomAssetsResult> => {
    const compressedPayloadsPromise = options.includeImages
        ? compressPayloads(imagePayloads)
        : Promise.resolve(imagePayloads);
    const textProvider = getTextProvider();
    const analysisPayloads = await compressedPayloadsPromise;
    const parsedContent = await textProvider.generateEcomAnalysis(analysisPayloads, style, customStyle, options);
    const seoDraft = parsedContent.seo || null;

    const detailedSeoPromise: Promise<{ result: EtsySeoResult | null; error: Error | null }> =
        options.includeSeo && seoDraft?.keywords?.length
            ? generateSeoFromKeywords(seoDraft.keywords.join(', '))
                .then((result) => ({ result, error: null }))
                .catch((error: unknown) => ({
                    result: null,
                    error: error instanceof Error ? error : new Error(String(error)),
                }))
            : Promise.resolve({ result: null, error: null });

    const imagesPromise = (async (): Promise<string[]> => {
        if (!options.includeImages || !parsedContent.prompts) {
            return [];
        }

        const imageProvider = getImageProvider();
        const compressed = await compressedPayloadsPromise;
        const prompts = parsedContent.prompts
            .map(normalizeGeneratedPrompt)
            .filter(Boolean)
            .slice(0, options.imageCount);
        const dimensionPrompt = getDimensionPrompt(dimensions, options.dimensionUnit);
        const totalImages = prompts.length + (dimensionPrompt ? 1 : 0);
        const imageConcurrency = Math.max(1, Math.min(4, prompts.length));

        if (prompts.length === 0) {
            throw new Error('AI did not return valid scene prompts for image generation.');
        }

        const dimensionImagePromise = dimensionPrompt
            ? runWithRetry(() => generateDimensionDiagram(compressed, dimensionPrompt, size))
            : Promise.resolve<string | null>(null);

        const images = await generateWithConcurrencyInOrder(
            prompts,
            imageConcurrency,
            (prompt) => runWithRetry(() => imageProvider.generateImage(compressed, prompt, size)),
            (image, index) => {
                onImageGenerated?.({
                    image,
                    index,
                    total: totalImages,
                    isDimension: false,
                });
            }
        );

        if (dimensionPrompt) {
            const dimImage = await dimensionImagePromise;
            if (!dimImage) {
                throw new Error('Dimension image generation returned no data.');
            }
            images.push(dimImage);
            onImageGenerated?.({
                image: dimImage,
                index: images.length - 1,
                total: totalImages,
                isDimension: true,
            });
        }

        return images;
    })();

    const [images, detailedSeo] = await Promise.all([imagesPromise, detailedSeoPromise]);
    return {
        images,
        seo: seoDraft,
        etsySeo: detailedSeo.result,
        seoError: detailedSeo.error,
    };
};

export async function generateDimensionDiagram(
    images: ImagePayload[],
    prompt: string,
    size: ImageSize
): Promise<string> {
    const imageProvider = getImageProvider();
    return imageProvider.generateImage(images, prompt, size);
}

export const regenerateDimensionImage = async (
    imagePayloads: ImagePayload[],
    dimensions: Dimensions,
    size: ImageSize,
    unit: DimensionUnit
): Promise<string> => {
    const dimensionPrompt = getDimensionPrompt(dimensions, unit);
    if (!dimensionPrompt) throw new Error("缺少尺寸信息。");
    return generateDimensionDiagram(imagePayloads, dimensionPrompt, size);
};

export const generateSeoFromKeywords = async (
    keywords: string,
    dimensionsText?: string
): Promise<EtsySeoResult> => {
    const textProvider = getTextProvider();
    return textProvider.generateSeoFromKeywords(keywords, dimensionsText);
};

export const generateSeoFromUrl = async (url: string): Promise<EtsySeoResult> => {
    const textProvider = getTextProvider();
    return textProvider.generateSeoFromUrl(url);
};

export const generateFusedImage = async (
    imagePayloads: ImagePayload[],
    prompt: string,
    size: ImageSize
): Promise<string> => {
    const imageProvider = getImageProvider();
    const compressed = await compressPayloads(imagePayloads);
    return imageProvider.generateImage(compressed, IMAGE_FUSION_PROMPT_TEMPLATE(prompt), size);
};

export const generateModelScene = async (
    imagePayload: ImagePayload,
    prompt: string,
    size: ImageSize
): Promise<string> => {
    const imageProvider = getImageProvider();
    const [compressed] = await compressPayloads([imagePayload]);
    return imageProvider.generateImage([compressed], MODEL_SCENE_PROMPT_TEMPLATE(prompt), size);
};

export const generateDetailImage = async (
    imagePayload: ImagePayload,
    size: ImageSize
): Promise<string> => {
    const imageProvider = getImageProvider();
    const [compressed] = await compressPayloads([imagePayload]);
    return imageProvider.generateImage([compressed], DETAIL_ENHANCE_PROMPT, size);
};

export const generatePromoImages = async (
    backgroundPayload: ImagePayload,
    productPayload: ImagePayload,
    size: ImageSize,
    count: number = 4
): Promise<string[]> => {
    const imageProvider = getImageProvider();
    const [compressedBg, compressedProd] = await compressPayloads([backgroundPayload, productPayload]);
    const prompts = [
        `Place the product from the second image naturally onto the background scene from the first image. Create a professional e-commerce flat lay style photo. Keep the product authentic with natural drop shadows and lighting that matches the background. High-quality commercial photography.`,
        `Combine the product from the second image with the background environment from the first image. Create a lifestyle marketing photo where the product appears to be in its natural usage environment. Premium commercial photography with warm, natural lighting.`,
        `Use the background from the first image and the product from the second image to create a minimalist product showcase. Center the product prominently with the background providing elegant context. Depth of field effect. Professional advertising photography.`,
        `Create an eye-catching promotional image by compositing the product from the second image onto the background from the first image. Use dramatic studio-style lighting and artistic composition. Premium brand advertising style photography.`
    ];
    const selectedPrompts = prompts.slice(0, count);
    return generateImageBatchWithRetry(
        selectedPrompts.length,
        (index) => imageProvider.generateImage([compressedBg, compressedProd], selectedPrompts[index], size)
    );
};

// ── 文生图：主生成器（无参考图，纯文本 prompt → N 张图）──────────────
export const generateTextToImages = async (
    prompt: string,
    size: ImageSize,
    count: number = 3
): Promise<string[]> => {
    const imageProvider = getTextToImageProvider();
    const images: string[] = [];
    for (let i = 0; i < count; i++) {
        const img = await imageProvider.generateImage([], prompt, size);
        images.push(img);
    }
    return images;
};

// ── 文生图：宣传图生成（无参考图，纯文本 prompt → N 张图）──────────────
export const generatePromoTextToImages = async (
    prompt: string,
    size: ImageSize,
    count: number = 4
): Promise<string[]> => {
    const imageProvider = getTextToImageProvider();
    return generateImageBatchWithRetry(
        count,
        () => imageProvider.generateImage([], prompt, size)
    );
};

export const generateProductVideo = async (
    imageBase64: string,
    mimeType: string = 'image/png',
    customPrompt?: string,
    onStatus?: (status: string) => void,
    duration: number = 5
): Promise<string> => {
    const videoProvider = getVideoProvider();
    return videoProvider.generateVideo(imageBase64, mimeType, customPrompt || '', onStatus, duration);
};

// --- Test connection utility ---
export async function testProviderConnection(_capability: 'text' | 'image' | 'video'): Promise<boolean> {
  // 统一密钥，只需测一次连通性即可
  return getTextProvider().testConnection();
}
