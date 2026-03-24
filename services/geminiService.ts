
import { GoogleGenAI, Type } from '@google/genai';
import type { ImageGenSeoResult, EtsySeoResult, StyleOption, Dimensions, ImageSize, GenerationOptions, DimensionUnit } from '../types';
import { resizeImage } from '../utils/fileUtils';

const ANALYSIS_MODEL = 'gemini-3-pro-preview'; 
const IMAGE_MODEL = 'gemini-2.5-flash-image'; 
const VIDEO_MODEL = 'veo-3.1-fast-generate-preview';

/**
 * 每次调用前实例化客户端，以确保获取最新的密钥。
 * 优先级：localStorage (手动设置) > process.env.API_KEY (环境注入)
 */
const createAIClient = () => {
    const manualKey = localStorage.getItem('user_manual_api_key');
    const apiKey = (manualKey || process.env.API_KEY || '').trim();
    
    if (!apiKey) {
        throw new Error("API_KEY_REQUIRE_BILLING");
    }
    return new GoogleGenAI({ apiKey });
};

const extractJson = (text: string): any => {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    if (match && match[1]) {
        return JSON.parse(match[1]);
    }
    return JSON.parse(text);
};

async function generateStyledImage(
    baseImage: { base64Data: string; mimeType: string },
    prompt: string,
    size: ImageSize
): Promise<string> {
    const ai = createAIClient();
    const imagePart = {
        inlineData: {
            data: baseImage.base64Data,
            mimeType: baseImage.mimeType,
        },
    };
    const textPart = { text: prompt };
    
    try {
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: { parts: [imagePart, textPart] },
        });
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const originalImageSrc = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                return await resizeImage(originalImageSrc, size);
            }
        }
        throw new Error('图片生成失败：API 未返回数据。');
    } catch (err: any) {
        if (err.message?.includes("API key not valid") || err.message?.includes("invalid API key")) {
            throw new Error("API_KEY_INVALID");
        }
        throw err;
    }
}

export async function generateDimensionDiagram(
    images: { base64Data: string; mimeType: string }[],
    prompt: string,
    size: ImageSize
): Promise<string> {
    const ai = createAIClient();
    const imageParts = images.map(image => ({
        inlineData: {
            data: image.base64Data,
            mimeType: image.mimeType,
        },
    }));
    const textPart = { text: prompt };
    
    try {
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: { parts: [...imageParts, textPart] },
        });
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const originalImageSrc = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                return await resizeImage(originalImageSrc, size);
            }
        }
        throw new Error('尺寸图生成失败。');
    } catch (err: any) {
        if (err.message?.includes("API key not valid")) throw new Error("API_KEY_INVALID");
        throw err;
    }
}

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

export const generateEcomAssets = async (
    imagePayloads: { base64Data: string; mimeType: string }[],
    style: StyleOption,
    dimensions: Dimensions,
    size: ImageSize,
    customStyle: string,
    options: GenerationOptions
): Promise<{ images: string[]; seo: ImageGenSeoResult | null; }> => {
    const ai = createAIClient();
    let styleInstruction = "";
    if (style === 'custom' && customStyle.trim() !== '') {
        styleInstruction = `description: "${customStyle.trim()}"`;
    } else if (style === 'auto-model') {
        styleInstruction = `lifestyle featuring a human model.`;
    } else {
        styleInstruction = `style: "${style}"`;
    }

    let promptParts = [`E-commerce photoshoot for the product in the images.`];
    if (options.includeImages) {
        promptParts.push(`1. Scene Descriptions: Exactly ${options.imageCount} prompts for the background. Use ${styleInstruction}. Do not modify the product body.`);
    }
    if (options.includeSeo) {
        promptParts.push(`2. SEO: 5 Titles and 10 Keywords. Bilingual (English || Chinese).`);
    }

    const properties: any = {};
    const required: string[] = [];
    if (options.includeImages) {
        properties.prompts = { type: Type.ARRAY, items: { type: Type.STRING } };
        required.push('prompts');
    }
    if (options.includeSeo) {
        properties.seo = {
            type: Type.OBJECT,
            properties: {
                titles: { type: Type.ARRAY, items: { type: Type.STRING } },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        };
        required.push('seo');
    }

    try {
        const responseSchema = { type: Type.OBJECT, properties, required };
        const imageParts = imagePayloads.map(image => ({ inlineData: { data: image.base64Data, mimeType: image.mimeType } }));
        const analysisResult = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: { parts: [{ text: promptParts.join('\n') }, ...imageParts] },
            config: { responseMimeType: "application/json", responseSchema }
        });
        
        let parsedContent: { prompts?: string[]; seo?: ImageGenSeoResult; } = extractJson((analysisResult.text || '').trim());
        let images: string[] = [];
        if (options.includeImages && parsedContent.prompts) {
            const sceneImages = await Promise.all(parsedContent.prompts.slice(0, options.imageCount).map(prompt => generateStyledImage(imagePayloads[0], prompt, size)));
            images = [...sceneImages];
            const dimensionPrompt = getDimensionPrompt(dimensions, options.dimensionUnit);
            if (dimensionPrompt) {
                const dimImage = await generateDimensionDiagram(imagePayloads, dimensionPrompt, size);
                images.push(dimImage);
            } 
        }
        return { images, seo: parsedContent.seo || null };
    } catch (err: any) {
        if (err.message?.includes("API key not valid")) throw new Error("API_KEY_INVALID");
        throw err;
    }
};

export const regenerateDimensionImage = async (
    imagePayloads: { base64Data: string; mimeType: string }[],
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
    const ai = createAIClient();
    const prompt = `Based on keywords: "${keywords}". ${dimensionsText ? 'Include: '+dimensionsText : ''}. Generate 5 Titles, Description, and 13 Tags. Bilingual format "English || Chinese".`;
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            titles: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["titles", "description", "tags"]
    };
    
    try {
        const result = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", responseSchema }
        });
        return extractJson((result.text || '').trim());
    } catch (err: any) {
        if (err.message?.includes("API key not valid")) throw new Error("API_KEY_INVALID");
        throw err;
    }
};

export const generateSeoFromUrl = async (
    url: string
): Promise<EtsySeoResult> => {
    const ai = createAIClient();
    const prompt = `Analyze: ${url}. Generate 5 Titles, Description, and 13 Tags. Bilingual "English || Chinese". Return JSON.`;
    
    try {
        const result = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: { parts: [{ text: prompt }] },
            config: { tools: [{ googleSearch: {} }] },
        });
        const groundingUrls = result.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.filter((chunk: any) => chunk.web)
            ?.map((chunk: any) => ({ title: chunk.web.title, uri: chunk.web.uri })) || [];
        const json = extractJson((result.text || '').trim());
        return { ...json, groundingUrls };
    } catch (err: any) {
        if (err.message?.includes("API key not valid")) throw new Error("API_KEY_INVALID");
        throw err;
    }
};

export const generateFusedImage = async (
    imagePayloads: { base64Data: string; mimeType: string }[],
    prompt: string,
    size: ImageSize
): Promise<string> => {
    const ai = createAIClient();
    const imageParts = imagePayloads.map(image => ({ inlineData: { data: image.base64Data, mimeType: image.mimeType } }));
    
    try {
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: { parts: [...imageParts, { text: `Lifestyle scene with products from images: ${prompt}` }] },
        });
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                return await resizeImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, size);
            }
        }
        throw new Error('合成失败。');
    } catch (err: any) {
        if (err.message?.includes("API key not valid")) throw new Error("API_KEY_INVALID");
        throw err;
    }
};

export const generateModelScene = async (
    imagePayload: { base64Data: string; mimeType: string },
    prompt: string,
    size: ImageSize
): Promise<string> => {
    const ai = createAIClient();
    try {
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: { parts: [
                { inlineData: { data: imagePayload.base64Data, mimeType: imagePayload.mimeType } },
                { text: `Lifestyle photoshoot with model: ${prompt}` }
            ] },
        });
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                return await resizeImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, size);
            }
        }
        throw new Error('模特场景生成失败。');
    } catch (err: any) {
        if (err.message?.includes("API key not valid")) throw new Error("API_KEY_INVALID");
        throw err;
    }
};

export const generateDetailImage = async (
    imagePayload: { base64Data: string; mimeType: string },
    size: ImageSize
): Promise<string> => {
    const ai = createAIClient();
    try {
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: { parts: [
                { inlineData: { data: imagePayload.base64Data, mimeType: imagePayload.mimeType } },
                { text: `Macro closeup focus on texture.` }
            ] },
        });
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                return await resizeImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, size);
            }
        }
        throw new Error('增强失败。');
    } catch (err: any) {
        if (err.message?.includes("API key not valid")) throw new Error("API_KEY_INVALID");
        throw err;
    }
};

export const generateProductVideo = async (
    imageBase64: string,
    mimeType: string = 'image/png',
    customPrompt?: string,
    onStatus?: (status: string) => void
): Promise<string> => {
    const manualKey = localStorage.getItem('user_manual_api_key');
    const apiKey = (manualKey || process.env.API_KEY || '').trim();
    
    if (!apiKey) throw new Error("API_KEY_REQUIRE_BILLING");
    if (onStatus) onStatus("正在准备视频生成任务...");
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        let operation = await ai.models.generateVideos({
            model: VIDEO_MODEL,
            prompt: customPrompt || "Cinematic close-up product reveal with studio lighting.",
            image: { imageBytes: imageBase64, mimeType },
            config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9' }
        });

        while (!operation.done) {
            if (onStatus) onStatus("正在渲染每一帧画面的光影细节...");
            await new Promise(resolve => setTimeout(resolve, 10000));
            // 重新读取可能变化的密钥（虽然可能性低，但保持逻辑严谨）
            const pollingApiKey = localStorage.getItem('user_manual_api_key') || process.env.API_KEY;
            const pollingAi = new GoogleGenAI({ apiKey: pollingApiKey });
            operation = await pollingAi.operations.getVideosOperation({ operation });
        }

        if (operation.error) throw new Error("API_KEY_INVALID");

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("未获得视频连接。");

        const finalApiKey = localStorage.getItem('user_manual_api_key') || process.env.API_KEY;
        const videoResponse = await fetch(`${videoUri}&key=${finalApiKey}`);
        if (!videoResponse.ok) throw new Error("API_KEY_INVALID");
        
        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);
    } catch (err: any) {
        console.error(err);
        throw new Error("API_KEY_INVALID");
    }
};
