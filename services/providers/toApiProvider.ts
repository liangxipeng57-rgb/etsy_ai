import type { ImageGenSeoResult, EtsySeoResult, ImageSize, StyleOption, GenerationOptions } from '../../types';
import type { TextProvider, ImageProvider, VideoProvider, ImagePayload } from './types';
import { getApiKey } from '../providerRegistry';
import { openaiCompatibleChat, buildJsonInstructionPrompt, extractJson } from './openaiCompatible';
import { resizeImage } from '../../utils/fileUtils';

const IMAGE_DATA_URL_PREFIX_REGEX = /^data:image\/[a-zA-Z+]+;base64,/;

function stripImageDataUrlPrefix(base64: string): string {
  return (base64 || '').replace(IMAGE_DATA_URL_PREFIX_REGEX, '').trim();
}

function getSafeImageMimeType(mimeType: string): string {
  const rawMime = (mimeType || '').trim();
  if (rawMime.startsWith('image/') && rawMime !== 'image/jpg') {
    return rawMime;
  }
  return 'image/jpeg';
}

function normalizeKlingDuration(duration: number): 5 | 10 {
  return Number(duration) === 10 ? 10 : 5;
}

// jiekou.ai 标准 OpenAI 兼容接口
function normalizeImagePrompt(prompt: unknown): string {
  return String(prompt ?? '').replace(/\s+/g, ' ').trim();
}

function ensureIdentityPrompt(prompt: string): string {
  const normalized = prompt.toLowerCase();
  if (
    normalized.includes('maintain the original product design and colors exactly') ||
    normalized.includes('do not alter or redesign the product') ||
    normalized.includes('highly detailed fabric preservation')
  ) {
    return prompt;
  }

  return `${prompt}, maintain the original product design and colors exactly, highly detailed fabric preservation, do not redesign or alter the product, photorealistic commercial photography`;
}

const BASE_URL = 'https://api.jiekou.ai/openai/v1';
const TOAPIS_IMAGE_BASE_URL = 'https://api.jiekou.ai/v1';
// 图片生成端点使用 /v1 前缀（不含 /openai）
const IMAGE_BASE_URL = 'https://api.jiekou.ai/v1';

function getKey(): string {
  const key = getApiKey('toapis');
  if (!key) throw new Error('请先在右上角设置中配置您的专属 API 密钥');
  return key;
}

// 通用连接测试：调用 /v1/models 接口，不依赖具体模型是否开通
// 只要服务器有响应且不是 401/403（密钥被明确拒绝），就视为连接成功
async function testToAPIsConnection(): Promise<boolean> {
  // BASE_URL 已包含 /v1，直接拼 /models 即可
  const response = await fetch(`${BASE_URL}/models`, {
    headers: { 'Authorization': `Bearer ${getKey()}` },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('API 密钥无效或额度不足，请检查设置');
  }
  // 服务器有响应（包括 404、500 等）说明密钥已通过认证，连接正常
  return true;
}

// ── Base64 → data URL 工具 ────────────────────────────────────────────────
// fileToBase64 返回的 base64Data 是裸 base64（无前缀）。
// 必须强制补全完整的 data:image/...;base64,... 前缀后才能传给 OpenAI Vision。
function toDataUrl(img: ImagePayload): string {
  // 已是完整 data:image URI → 直接使用（防止重复编码）
  const rawBase64 = stripImageDataUrlPrefix(img.base64Data);
  // 规范化 MIME：只接受 image/* 类型（image/jpg 非标准，统一降级为 image/jpeg）
  const rawMime = img.mimeType || '';
  const mime = rawMime.startsWith('image/') && rawMime !== 'image/jpg'
    ? rawMime
    : 'image/jpeg';
  return `data:${mime};base64,${rawBase64}`;
}

/**
 * 构建多模态 content parts。
 * 严格遵循官方文档 4.5：image_url 在前（detail: high），text 在后。
 * 图片以 data URL 形式传递（data:image/jpeg;base64,...）。
 */
function buildUrlContentParts(
  textPrompt: string,
  imageUrls: string[]
): Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> {
  const parts: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [];
  for (const url of imageUrls) {
    parts.push({ type: 'image_url', image_url: { url, detail: 'high' } });
  }
  parts.push({ type: 'text', text: textPrompt });
  return parts;
}

// ── 文本供应商 ────────────────────────────────────────────────────────
export class ToAPIsTextProvider implements TextProvider {
  constructor(private modelId: string) {}

  /**
   * 第一阶段：多模态预处理——提取商品详细特征。
   * 将图片直接以 Base64 data URL 内联传递，符合标准 OpenAI 视觉接口规范。
   */
  async generateEcomAnalysis(
    imagePayloads: ImagePayload[],
    style: StyleOption,
    customStyle: string,
    options: GenerationOptions
  ): Promise<{ prompts?: string[]; seo?: ImageGenSeoResult }> {
    // 将 Base64 图片直接转为 data URL，无需上传步骤
    const dataUrls = imagePayloads.map(img => toDataUrl({ ...img, base64Data: stripImageDataUrlPrefix(img.base64Data) }));

    const fastStyleInstruction = style === 'custom' && customStyle.trim() !== ''
      ? `user-specified style: "${customStyle.trim()}"`
      : style === 'auto-model'
        ? 'lifestyle scene featuring a human model wearing/using the exact product'
        : `style: "${style}"`;

    const fastPromptParts: string[] = [];
    if (options.includeImages) {
      fastPromptParts.push(
        `Inspect the uploaded product images first and identify the exact physical product with high fidelity.\n` +
        `Generate exactly ${options.imageCount} image generation prompts for a professional e-commerce photoshoot.\n` +
        `Each prompt MUST:\n` +
        `- Begin by clearly restating the detected product's type, materials, colors, silhouette, and visible design details so the image model knows exactly what to draw.\n` +
        `- Describe the scene / background / environment using ${fastStyleInstruction}.\n` +
        `- Explicitly instruct the image model that the product must be worn or displayed EXACTLY as described, with zero modifications to design, color, or silhouette.\n` +
        `- Include these identity-preservation keywords verbatim: "highly detailed fabric preservation", "maintain the original product design and colors exactly", "do not alter or redesign the product", "photorealistic commercial photography", "8K resolution".\n` +
        `- Be self-contained and usable as a standalone image generation prompt (60-130 words each).\n` +
        `- Do not say "same as above", "the product", or use shorthand references to prior text.`
      );
    }
    if (options.includeSeo) {
      fastPromptParts.push(
        `Generate SEO content for the detected physical product: 5 Titles and 10 Keywords. Bilingual (English || Chinese).\n` +
        `For SEO fields only, do NOT use photography jargon like background, studio, photorealistic, 8K, lighting, render, or camera terms.`
      );
    }

    const fastSchema = `{ "prompts": ["string array of scene prompts"], "seo": { "titles": ["string array"], "keywords": ["string array"] } }`;
    const fastFullPrompt = buildJsonInstructionPrompt(fastPromptParts.join('\n\n'), fastSchema);
    const fastSystemPrompt =
      `ROLE: You are an expert e-commerce merchandiser and Etsy SEO strategist.\n` +
      `TASK: Inspect the uploaded product images and return valid JSON only.\n\n` +
      `STRICT RULES:\n` +
      `1. Identify the exact product from the images before writing anything.\n` +
      `2. Scene prompts may contain image-generation wording such as background, photorealistic, or 8K when explicitly required by the instructions.\n` +
      `3. SEO titles and keywords must describe only the physical product and must not contain photography jargon, rendering jargon, or meta commentary.\n` +
      `4. Never hallucinate missing major attributes when the image is unclear; prefer conservative wording.\n` +
      `5. Return valid JSON only with the requested schema.`;

    const fastResult = await openaiCompatibleChat(BASE_URL, getKey(), this.modelId, [
      { role: 'system', content: fastSystemPrompt },
      { role: 'user', content: buildUrlContentParts(fastFullPrompt, dataUrls) },
    ]);
    return extractJson(fastResult);

    // ── 第一阶段：多模态预处理（仅在需要生成图片时执行）────────────────
    // ── 第二阶段：生成场景提示词 & SEO ──────────────────────────────
    let styleInstruction = '';
    if (style === 'custom' && customStyle.trim() !== '') {
      styleInstruction = `user-specified style: "${customStyle.trim()}"`;
    } else if (style === 'auto-model') {
      styleInstruction = 'lifestyle scene featuring a human model wearing/using the exact product';
    } else {
      styleInstruction = `style: "${style}"`;
    }

    const promptParts: string[] = [];
    if (options.includeImages) {
      promptParts.push(
        `Inspect the uploaded product images first and identify the exact physical product with high fidelity.\n` +
        `Generate exactly ${options.imageCount} image generation prompts for a professional e-commerce photoshoot.\n` +
        `Each prompt MUST:\n` +
        `• Begin by fully re-stating the product description above so the image model knows exactly what to draw.\n` +
        `• Describe the scene / background / environment using ${styleInstruction}.\n` +
        `• Explicitly instruct the image model that the product must be worn or displayed EXACTLY as described, with zero modifications to design, color, or silhouette.\n` +
        `• Include these identity-preservation keywords verbatim: "highly detailed fabric preservation", "maintain the original product design and colors exactly", "do not alter or redesign the product", "photorealistic commercial photography", "8K resolution".\n` +
        `• Be self-contained and usable as a standalone image generation prompt (60–130 words each).`
      );
    }
    if (options.includeSeo) {
      promptParts.push(`Generate SEO content: 5 Titles and 10 Keywords. Bilingual (English || Chinese).`);
    }

    const schema = `{ "prompts": ["string array of scene prompts"], "seo": { "titles": ["string array"], "keywords": ["string array"] } }`;
    const fullPrompt = buildJsonInstructionPrompt(promptParts.join('\n\n'), schema);

    // 系统角色约束：通过 system message 强制锁定 LLM 的身份和行为边界，
    // 优先级高于 user prompt，彻底防止输出摄影术语或元评论广告词。
    const systemPrompt =
      `ROLE: You are an expert Etsy Top-Seller and E-commerce SEO Copywriter.\n` +
      `TASK: Look closely at the uploaded product image and write the ACTUAL, ready-to-publish listing content to sell THIS EXACT PHYSICAL ITEM to everyday retail buyers.\n\n` +
      `STRICT CONSTRAINTS (READ CAREFULLY):\n` +
      `1. NO PHOTOGRAPHY JARGON: DO NOT output any photography, lighting, or rendering terminology. NEVER use words like "8k", "photorealistic", "natural light", "studio", or "background". You are selling the physical bag/item, NOT the photograph.\n` +
      `2. NO META-COMMENTARY: DO NOT advertise your copywriting services. NEVER write phrases like "I write descriptions", "What you get:", or "Etsy listing description writer". Just output the actual product description directly.\n` +
      `3. TITLES: Must be highly clickable, SEO-optimized Etsy product titles focusing on the item's features, style, and material (e.g., "Cute Bear Canvas Tote Bag, Large Capacity Shopper, Kawaii Aesthetic").\n` +
      `4. KEYWORDS (TAGS): Must be exactly what a buyer would type into the search bar (e.g., "canvas tote", "bear bag", "gift for her").\n` +
      `5. DESCRIPTION: Must be a genuine, appealing product description covering the item's material, dimensions (visually estimated), design details, and ideal use cases.`;

    // 第二阶段为纯文本请求：productDesc 已将图片内容以文字形式注入 fullPrompt，
    // 无需再次传图，避免视觉路由触发 400 及超大 payload。
    const result = await openaiCompatibleChat(BASE_URL, getKey(), this.modelId, [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: fullPrompt },
    ]);
    return extractJson(result);
  }

  async generateSeoFromKeywords(keywords: string, dimensionsText?: string): Promise<EtsySeoResult> {
    const prompt = buildJsonInstructionPrompt(
      `Based on keywords: "${keywords}". ${dimensionsText ? 'Include: ' + dimensionsText : ''}. Generate 5 Titles, Description, and 13 Tags. Bilingual format "English || Chinese".`,
      `{ "titles": ["string"], "description": "string", "tags": ["string"] }`
    );
    const result = await openaiCompatibleChat(BASE_URL, getKey(), this.modelId, [
      { role: 'user', content: prompt }
    ]);
    return extractJson(result);
  }

  async generateSeoFromUrl(url: string): Promise<EtsySeoResult> {
    const prompt = buildJsonInstructionPrompt(
      `Analyze this product URL: ${url}. Generate 5 Titles, Description, and 13 Tags. Bilingual "English || Chinese".`,
      `{ "titles": ["string"], "description": "string", "tags": ["string"] }`
    );
    const result = await openaiCompatibleChat(BASE_URL, getKey(), this.modelId, [
      { role: 'user', content: prompt }
    ]);
    return extractJson(result);
  }

  /**
   * 多图融合 Prompt 增强：调用 VLM 简短描述各张图片的主要商品。
   * 返回格式示例："一个格子手提包和一件米色外套"
   * 调用方应自行处理 timeout 和 try-catch 降级。
   */
  async describeImages(imagePayloads: ImagePayload[], signal?: AbortSignal): Promise<string> {
    const systemPrompt =
      '你是一个电商商品识别专家。请极其简短地分别描述用户上传的这几张图片里的主要商品是什么。' +
      '格式如：一个XX和一个XX。不要任何多余废话。';
    const dataUrls = imagePayloads.map(img => toDataUrl({ ...img, base64Data: stripImageDataUrlPrefix(img.base64Data) }));
    const content = buildUrlContentParts(systemPrompt, dataUrls);
    return openaiCompatibleChat(BASE_URL, getKey(), this.modelId, [
      { role: 'user', content },
    ], undefined, signal);
  }

  async testConnection(): Promise<boolean> {
    return testToAPIsConnection();
  }
}

// ── 图片供应商 ────────────────────────────────────────────────────────
export class ToAPIsImageProvider implements ImageProvider {
  constructor(private modelId: string) {}

  async generateImage(imagePayloads: ImagePayload[], prompt: string, size: ImageSize): Promise<string> {
    const apiKey = getKey();
    const normalizedPrompt = normalizeImagePrompt(prompt);
    if (!normalizedPrompt) {
      throw new Error('Image generation failed: prompt is empty.');
    }

    // 将内部像素尺寸映射为 API 支持的比例字符串
    const [w, h] = size.split('x').map(Number);
    const apiSize: string = !w || !h ? '1:1' : w === h ? '1:1' : w > h ? '3:2' : '2:3';

    // 追加商品一致性保护关键词（已含时不重复）
    const finalPrompt = ensureIdentityPrompt(normalizedPrompt);

    // 有参考图 → 图生图；无参考图 → 文生图
    const validPayloads = imagePayloads.filter(p => stripImageDataUrlPrefix(p.base64Data));
    if (validPayloads.length > 0) {
      return this.generateImageToImage(validPayloads, finalPrompt, apiKey, size);
    }
    return this.generateTextToImage(finalPrompt, apiSize, apiKey, size);
  }

  /**
   * 图生图：按模型前缀动态路由，支持三种协议：
   *
   * 1. nano-banana  → 同步接口 /v3/{modelId}，Body: { images: [base64], prompt }
   * 2. grok-imagine-image-edit → 异步接口 /v3/async/{modelId}，Body: { image: base64, prompt }
   *    返回 { task_id }，轮询 /v3/async/task-result，成功从 images[0].image_url 取链接
   * 3. gemini-3-pro-image-edit（默认）→ 同步接口，Body: { model, prompt, image_base64s: [...], size, aspect_ratio }
   *    支持多图识别：正面图/侧面图/细节图同时传入 image_base64s 数组
   */
  private async generateImageToImage(
    refs: ImagePayload[],
    prompt: string,
    apiKey: string,
    size: ImageSize
  ): Promise<string> {
    // 剥离 data:image/xxx;base64, 前缀，只保留裸 base64 数据（所有分支共用）
    const allRawBase64 = refs.map(r => stripImageDataUrlPrefix(r.base64Data)).filter(Boolean);
    const rawBase64 = allRawBase64[0]; // 兼容单图分支

    // ── 分支 1：nano-banana 同步图生图 ──────────────────────────────
    if (allRawBase64.length === 0) {
      throw new Error('鍥剧墖鐢熸垚澶辫触锛氭湭鑾峰彇鍒版湁鏁堢殑鍥剧墖鏁版嵁');
    }

    if (this.modelId.includes('nano-banana')) {
      const ENDPOINT = `https://api.jiekou.ai/v3/${this.modelId}`;
      const payload = { images: allRawBase64, prompt };
      const res = await window.fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const rawText = await res.text().catch(() => '');
        const apiMsg = (() => { try { return JSON.parse(rawText)?.error?.message || ''; } catch { return ''; } })();
        if (res.status === 401 || res.status === 403) throw new Error('API 密钥无效或额度不足，请检查设置');
        throw new Error(apiMsg || `图片生成失败 (${res.status})`);
      }
      const data = await res.json();
      return this.parseImageResponse(data, apiKey, size);
    }

    // ── 分支 2：grok-imagine-image-edit 异步图生图 + 轮询 ──────────
    if (this.modelId.includes('grok-imagine-image-edit')) {
      const ENDPOINT = `https://api.jiekou.ai/v3/async/${this.modelId}`;
      const payload = { image: rawBase64, prompt };
      const res = await window.fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const rawText = await res.text().catch(() => '');
        const apiMsg = (() => { try { return JSON.parse(rawText)?.error?.message || ''; } catch { return ''; } })();
        if (res.status === 401 || res.status === 403) throw new Error('API 密钥无效或额度不足，请检查设置');
        throw new Error(apiMsg || `图片生成失败 (${res.status})`);
      }
      const submitData = await res.json();
      const taskId: string = submitData.task_id || submitData.id;
      if (!taskId) throw new Error('图片生成失败：未获得任务 ID，请稍后重试。');
      return this.pollGrokImageTaskStatus(taskId, apiKey);
    }

    // ── 分支 3：gemini-3-pro-image-edit（默认）多图同步图生图 ──────
    // 统一使用 jiekou.ai 官方 Gemini 3 Pro 图片编辑接口
    // image_base64s 支持多图数组：正面图、侧面图、细节图同时传入
    const ENDPOINT = 'https://api.jiekou.ai/v3/gemini-3-pro-image-edit';
    const payload = {
      model: this.modelId,
      prompt,
      image_base64s: allRawBase64,
    };
    const res = await window.fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const rawText = await res.text().catch(() => '');
      const apiMsg = (() => { try { return JSON.parse(rawText)?.error?.message || ''; } catch { return ''; } })();
      if (res.status === 401 || res.status === 403) throw new Error('API 密钥无效或额度不足，请检查设置');
      throw new Error(apiMsg || `图片生成失败 (${res.status})`);
    }
    const data = await res.json();
    // 私有协议响应：{ "image_urls": ["url1", ...] }
    const imageUrl = data.image_urls?.[0];
    if (imageUrl) return imageUrl;
    // 兜底：标准格式走通用解析
    return this.parseImageResponse(data, apiKey, size);
  }

  /**
   * 文生图：Gemini 3 Pro 专属 V3 接口
   * POST https://api.jiekou.ai/v3/gemini-3-pro-image-text-to-image
   * 返回 { image_urls: ["url1", ...] }
   */
  private async generateTextToImage(
    prompt: string,
    apiSize: string,
    apiKey: string,
    _size: ImageSize
  ): Promise<string> {
    const payload = {
      prompt,
      size: '2K',
      aspect_ratio: apiSize,
      google: { web_search: true },
    };
    const res = await window.fetch('https://api.jiekou.ai/v3/gemini-3-pro-image-text-to-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const rawText = await res.text().catch(() => '');
      const apiMsg = (() => { try { return JSON.parse(rawText)?.error?.message || ''; } catch { return ''; } })();
      if (res.status === 401 || res.status === 403) throw new Error('API 密钥无效或额度不足，请检查设置');
      throw new Error(apiMsg || `图片生成失败 (${res.status})`);
    }

    const data = await res.json();
    const imageUrl = data.image_urls?.[0];
    if (imageUrl) return imageUrl;
    // 兜底：尝试通用解析
    return this.parseImageResponse(data, apiKey, _size);
  }

  /**
   * 统一解析图片 API 响应（edits 和 generations 共用）。
   * 支持：同步 URL、同步 Base64、异步任务轮询。
   */
  private async parseImageResponse(data: any, apiKey: string, size: ImageSize): Promise<string> {
    // 同步：直接返回 URL
    const imgUrl = data.data?.[0]?.url;
    if (imgUrl) return imgUrl;

    // 同步：Base64 → 转换尺寸
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return resizeImage(`data:image/png;base64,${b64}`, size);

    // 异步任务（如 gpt-4o-image 返回 { id, status: "queued" }）
    const taskId: string | undefined = data.id;
    const taskStatus: string | undefined = data.status;
    if (taskId && taskStatus !== undefined) {
      const syncUrl = this.extractUrlFromTaskData(data);
      if (syncUrl) return syncUrl;
      return this.pollTaskStatus(taskId, apiKey, size);
    }

    throw new Error('图片生成失败：API 未返回图片数据，请确认图片模型名称是否正确。');
  }

  /** 从任务结果数据中提取图片 URL（兼容多种响应格式） */
  private extractUrlFromTaskData(taskData: any): string | null {
    return (
      taskData.result?.data?.[0]?.url ??  // completed 任务标准路径
      taskData.data?.[0]?.url         ??
      taskData.result?.url            ??
      taskData.output?.url            ??
      taskData.output?.[0]?.url       ??
      null
    );
  }

  /**
   * 轮询异步任务直到完成，每 3 秒请求一次。
   * MAX_NET_ERRORS=5：允许连续 5 次网络抖动后才熔断，保留重试容错。
   */
  private pollTaskStatus(taskId: string, apiKey: string, size: ImageSize): Promise<string> {
    const taskUrl = `${TOAPIS_IMAGE_BASE_URL}/images/generations/${taskId}`;

    const POLL_INTERVAL_MS = 3000;
    const MAX_POLLS = 100;           // 最多 100 次 × 3 秒 = 5 分钟超时
    const MAX_NET_ERRORS = 5;        // 连续网络抖动熔断阈值

    return new Promise((resolve, reject) => {
      let polls = 0;
      let consecutiveNetErrors = 0;

      const poll = async () => {
        polls++;
        if (polls > MAX_POLLS) {
          reject(new Error('图片生成超时（等待超过 5 分钟），请稍后重试。'));
          return;
        }

        let res: Response;
        try {
          res = await window.fetch(taskUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          consecutiveNetErrors = 0;
        } catch (netErr) {
          consecutiveNetErrors++;
          if (consecutiveNetErrors >= MAX_NET_ERRORS) {
            reject(new Error(
              `轮询连续网络错误 ${consecutiveNetErrors} 次，已终止。最后错误：${(netErr as Error).message}`
            ));
            return;
          }
          setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          const errMsg = (() => { try { return JSON.parse(errText)?.error?.message || ''; } catch { return ''; } })();
          reject(new Error(errMsg || `任务状态查询失败 (${res.status})，请检查接口路径是否正确。`));
          return;
        }

        const taskData = await res.json();
        const status: string = taskData.status ?? '';

        if (status === 'completed' || status === 'succeeded' || status === 'success') {
          const url = this.extractUrlFromTaskData(taskData);
          if (url) { resolve(url); return; }

          const b64 =
            taskData.result?.data?.[0]?.b64_json ??
            taskData.data?.[0]?.b64_json;
          if (b64) {
            const resized = await resizeImage(`data:image/png;base64,${b64}`, size).catch(() => `data:image/png;base64,${b64}`);
            resolve(resized);
            return;
          }
          reject(new Error('任务已完成，但未能从响应中获取图片 URL，请检查接口返回格式。'));
          return;
        }

        if (status === 'failed' || status === 'error' || status === 'cancelled') {
          const errMsg = taskData.error?.message ?? taskData.message ?? `任务以状态 "${status}" 结束`;
          reject(new Error(`图片生成任务失败：${errMsg}`));
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      };

      setTimeout(poll, POLL_INTERVAL_MS);
    });
  }

  /**
   * 轮询 Grok 图生图异步任务。
   * 端点：GET /v3/async/task-result?task_id=xxx（与视频轮询相同）
   * 成功时从 pollData.images[0].image_url 提取图片链接。
   */
  private pollGrokImageTaskStatus(taskId: string, apiKey: string): Promise<string> {
    const taskUrl = `https://api.jiekou.ai/v3/async/task-result?task_id=${taskId}`;
    const POLL_INTERVAL_MS = 5000;
    const MAX_POLLS = 60;         // 60 次 × 5 秒 = 5 分钟超时
    const MAX_NET_ERRORS = 5;

    return new Promise((resolve, reject) => {
      let polls = 0;
      let consecutiveNetErrors = 0;

      const poll = async () => {
        polls++;
        if (polls > MAX_POLLS) {
          reject(new Error('Grok 图片生成超时（等待超过 5 分钟），请稍后重试。'));
          return;
        }
        let res: Response;
        try {
          res = await window.fetch(taskUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          consecutiveNetErrors = 0;
        } catch (netErr) {
          consecutiveNetErrors++;
          if (consecutiveNetErrors >= MAX_NET_ERRORS) {
            reject(new Error(
              `Grok 图片轮询连续网络错误 ${consecutiveNetErrors} 次，已终止。最后错误：${(netErr as Error).message}`
            ));
            return;
          }
          setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          const errMsg = (() => { try { return JSON.parse(errText)?.error?.message || ''; } catch { return ''; } })();
          reject(new Error(errMsg || `Grok 图片轮询失败 (${res.status})`));
          return;
        }

        const pollData = await res.json();
        const status: string = pollData.task?.status ?? '';

        if (status === 'TASK_STATUS_SUCCEED') {
          const url = pollData.images?.[0]?.image_url;
          if (!url) {
            reject(new Error('图片生成完成但未获得链接，请稍后重试。'));
            return;
          }
          resolve(url);
          return;
        }

        if (status === 'TASK_STATUS_FAILED') {
          const reason = pollData.task?.reason ?? '未知原因';
          reject(new Error(`图片生成任务失败：${reason}`));
          return;
        }

        // TASK_STATUS_QUEUED / TASK_STATUS_PROCESSING → 继续轮询
        setTimeout(poll, POLL_INTERVAL_MS);
      };

      setTimeout(poll, POLL_INTERVAL_MS);
    });
  }

  async testConnection(): Promise<boolean> {
    return testToAPIsConnection();
  }
}

// ── 视频供应商 ────────────────────────────────────────────────────────
export class ToAPIsVideoProvider implements VideoProvider {
  constructor(private modelId: string) {}

  async generateVideo(
    imageBase64: string,
    mimeType: string,
    prompt: string,
    onStatus?: (status: string) => void,
    duration: number = 5
  ): Promise<string> {
    const apiKey = getKey();

    if (onStatus) onStatus("正在提交视频生成任务...");

    // 防御校验：确保图片数据有效
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error("视频生成失败：未获取到有效的图片数据");
    }
    const rawBase64 = stripImageDataUrlPrefix(imageBase64);
    if (!rawBase64) {
      throw new Error("视频生成失败：未获取到有效的图片数据");
    }

    const modelId = this.modelId;
    const defaultPrompt = prompt || "Cinematic close-up product reveal with smooth camera movement.";

    // ── 按模型严格映射 Endpoint + Payload ───────────────────────────
    let V3_SUBMIT_URL: string;
    let payload: Record<string, unknown>;

    if (modelId.includes('sora')) {
      V3_SUBMIT_URL = 'https://api.jiekou.ai/v3/async/sora-2-img2video';
      payload = { prompt: defaultPrompt, image: rawBase64, duration: Number(duration) };

    } else if (modelId.includes('kling-v2.1')) {
      V3_SUBMIT_URL = 'https://api.jiekou.ai/v3/async/kling-v2.1-i2v';
      payload = { prompt: defaultPrompt, image: rawBase64, duration: String(duration) };

    } else if (modelId.includes('kling-v2.6')) {
      // Kling V2.6 Pro：仅 model + prompt + image + duration
      V3_SUBMIT_URL = 'https://api.jiekou.ai/v3/async/kling-v2.6-pro-i2v';
      payload = {
        model: this.modelId,
        prompt: defaultPrompt,
        image: rawBase64,
        duration: normalizeKlingDuration(duration),
      };

    } else if (modelId.includes('kling-v3.0')) {
      V3_SUBMIT_URL = 'https://api.jiekou.ai/v3/async/kling-v3.0-pro-i2v';
      payload = { prompt: defaultPrompt, image: rawBase64, duration: Number(duration) };

    } else if (modelId.includes('veo')) {
      V3_SUBMIT_URL = 'https://api.jiekou.ai/v3/async/veo-3.0-generate-preview-img2video';
      payload = { prompt: defaultPrompt, image_base64: rawBase64, generate_audio: true, duration_seconds: Number(duration) };

    } else {
      V3_SUBMIT_URL = `https://api.jiekou.ai/v3/async/${modelId}`;
      payload = { prompt: defaultPrompt, image: rawBase64 };
    }

    const submitResponse = await window.fetch(V3_SUBMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!submitResponse.ok) {
      if (submitResponse.status === 401 || submitResponse.status === 403) throw new Error('API 密钥无效或额度不足，请检查设置');
      const rawText = await submitResponse.text().catch(() => '');
      const errMsg = (() => { try { return JSON.parse(rawText)?.error?.message || ''; } catch { return ''; } })();
      throw new Error(errMsg || `视频提交失败 (${submitResponse.status})`);
    }

    const submitData = await submitResponse.json();

    // 同步：直接返回视频 URL
    const directUrl = submitData.data?.[0]?.url || submitData.video_url || submitData.url;
    if (directUrl) {
      const blob = await window.fetch(directUrl).then(r => r.blob());
      return URL.createObjectURL(blob);
    }

    // 异步：轮询任务状态
    const taskId = submitData.task_id || submitData.id;
    if (!taskId) throw new Error('视频生成失败：未获得任务 ID，请稍后重试。');

    return this.pollVideoTaskStatus(taskId, apiKey, onStatus);
  }

  /**
   * 视频任务轮询——含 try-catch 熔断机制，防止网络抖动导致任务中断。
   * MAX_NET_ERRORS=5：允许连续 5 次网络抖动后才熔断，保留重试容错。
   */
  private pollVideoTaskStatus(
    taskId: string,
    apiKey: string,
    onStatus?: (status: string) => void,
  ): Promise<string> {
    // jiekou.ai 官方异步任务查询协议
    const taskUrl_ = `https://api.jiekou.ai/v3/async/task-result?task_id=${taskId}`;

    const POLL_INTERVAL_MS = 10000;
    const MAX_POLLS = 36;        // 36 次 × 10 秒 = 6 分钟超时
    const MAX_NET_ERRORS = 5;    // 连续网络抖动熔断阈值

    return new Promise((resolve, reject) => {
      let polls = 0;
      let consecutiveNetErrors = 0;

      const poll = async () => {
        polls++;
        if (polls > MAX_POLLS) {
          reject(new Error('视频生成超时（等待超过 6 分钟），请稍后重试。'));
          return;
        }

        if (onStatus) onStatus(`正在渲染视频画面（第 ${polls} 次轮询）...`);

        let res: Response;
        try {
          res = await window.fetch(taskUrl_, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          consecutiveNetErrors = 0;
        } catch (netErr) {
          consecutiveNetErrors++;
          if (consecutiveNetErrors >= MAX_NET_ERRORS) {
            reject(new Error(
              `视频轮询连续网络错误 ${consecutiveNetErrors} 次，已终止。最后错误：${(netErr as Error).message}`
            ));
            return;
          }
          setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          const errMsg = (() => { try { return JSON.parse(errText)?.error?.message || ''; } catch { return ''; } })();
          reject(new Error(errMsg || `视频轮询失败 (${res.status})`));
          return;
        }

        const pollData = await res.json();
        const status: string = pollData.task?.status ?? '';

        if (status === 'TASK_STATUS_SUCCEED') {
          const url = pollData.videos?.[0]?.video_url;
          if (!url) { reject(new Error('视频生成完成但未获得链接，请稍后重试。')); return; }
          const blob = await window.fetch(url).then(r => r.blob());
          resolve(URL.createObjectURL(blob));
          return;
        }

        if (status === 'TASK_STATUS_FAILED') {
          const reason = pollData.task?.reason ?? '未知原因';
          reject(new Error(`视频生成任务失败：${reason}`));
          return;
        }

        // TASK_STATUS_QUEUED / TASK_STATUS_PROCESSING → 继续轮询
        setTimeout(poll, POLL_INTERVAL_MS);
      };

      setTimeout(poll, POLL_INTERVAL_MS);
    });
  }

  async testConnection(): Promise<boolean> {
    return testToAPIsConnection();
  }
}
