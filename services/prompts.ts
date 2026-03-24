
/**
 * 统一管理各功能模块的图片生成提示词模板。
 * 每个模板都是一个函数，接收业务参数并返回完整的英文提示词字符串。
 */

/**
 * 模特场景生成提示词。
 *
 * 核心约束：强制要求 AI 完整保留参考图中的商品外观，
 * 彻底防止模型"自由发挥"或替换掉原商品款式。
 *
 * @param scene - 用户输入的场景描述（背景、环境、风格等）
 */
export const MODEL_SCENE_PROMPT_TEMPLATE = (scene: string): string =>
  `Professional high-end e-commerce model photography. ` +
  `CRITICAL REQUIREMENT: Strictly maintain the EXACT same clothing/product identity, color, texture, and details as the provided reference image. ` +
  `Do not redesign or hallucinate the clothing. The model MUST wear the provided product — ` +
  `same garment, same color, same fabric texture, same pattern, same cut, same silhouette, same every design detail. ` +
  `Any deviation from the reference product is strictly forbidden. ` +
  `Scene context: ${scene}. ` +
  `Photorealistic, 8K resolution, professional studio lighting, commercial advertising quality, highly detailed fabric preservation.`;

/**
 * 细节增强提示词。
 */
export const DETAIL_ENHANCE_PROMPT = `Macro close-up product photography. ` +
  `Focus sharply on the product's surface texture, material details, stitching, and craftsmanship. ` +
  `Studio lighting that reveals fine detail. Photorealistic, 8K resolution, commercial product photography.`;

/**
 * 图片融合场景提示词。
 *
 * 核心思路：明确告知模型这是"多产品合成创作"任务，而非单图编辑，
 * 要求它创作一张全新的、所有产品自然出现在同一场景中的商业摄影图。
 *
 * @param userPrompt - 用户输入的融合场景描述
 */
export const IMAGE_FUSION_PROMPT_TEMPLATE = (userPrompt: string): string =>
  `You are a professional commercial product photographer and photo compositor. ` +
  `I am providing you with reference images of SEPARATE products that need to appear together in a single unified scene. ` +
  `Your task: create ONE new, stunning, cohesive e-commerce lifestyle photograph that naturally incorporates ALL of the products shown in the reference images. ` +
  `Requirements: ` +
  `(1) All products MUST appear in the final image — do not omit any. ` +
  `(2) Arrange them naturally as they would look in a real professional photo shoot — consistent light direction, realistic drop shadows, matching perspective. ` +
  `(3) Do NOT produce a flat collage, grid, or side-by-side layout — compose them as a single integrated scene. ` +
  `(4) Scene context: ${userPrompt}. ` +
  `Ultra-high quality commercial photography, photorealistic, 8K resolution.`;
