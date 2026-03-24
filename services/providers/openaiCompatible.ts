
import type { ImagePayload } from './types';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export async function openaiCompatibleChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: OpenAIMessage[],
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal
): Promise<string> {
  const url = `${baseUrl}/chat/completions`;
  const MAX_RETRIES = 3;
  let lastError: Error = new Error('未知错误');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body = { model, messages, temperature: 0.7, max_tokens: 4096 };
      const response = await window.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
        signal,   // 传入 AbortSignal，支持外部 60s 超时强制取消
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const errMsg = (() => { try { return JSON.parse(errText)?.error?.message || ''; } catch { return ''; } })();
        // 401/403：密钥错误，不重试
        if (response.status === 401 || response.status === 403) throw new Error('API 密钥无效或额度不足，请检查设置');
        // 4xx：客户端错误，不重试，直接抛出
        if (response.status < 500) {
          const err = new Error(errMsg || `API 错误 (${response.status}): ${errText.slice(0, 150)}`);
          (err as any).fatal = true;
          throw err;
        }
        // 5xx：服务端异常，允许重试
        throw new Error(errMsg || `服务端异常 (${response.status})`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';

    } catch (error: any) {
      lastError = error;
      // AbortError：外部主动取消（超时），不重试，直接上抛
      if (error.name === 'AbortError') throw error;
      // 不可重试的错误（4xx / 密钥无效）直接上抛，不消耗重试次数
      if (error.fatal || error.message.includes('密钥')) throw error;

      if (attempt >= MAX_RETRIES) break;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  throw new Error(
    `网络连接极度不稳定，连续重试 ${MAX_RETRIES} 次后依然失败，请检查网络代理或更换更快的模型。最后报错：${lastError.message}`
  );
}

export function buildImageContentParts(
  textPrompt: string,
  imagePayloads?: ImagePayload[]
): Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> {
  const parts: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [];

  // 严格遵循官方文档 4.5：image_url 在前（detail: high），text 在后
  if (imagePayloads && imagePayloads.length > 0) {
    for (const img of imagePayloads) {
      const url = img.base64Data.startsWith('data:')
        ? img.base64Data
        : `data:${img.mimeType || 'image/jpeg'};base64,${img.base64Data}`;
      parts.push({ type: 'image_url', image_url: { url, detail: 'high' } });
    }
  }

  parts.push({ type: 'text', text: textPrompt });

  return parts;
}

export function buildJsonInstructionPrompt(basePrompt: string, schemaDescription: string): string {
  return `${basePrompt}\n\nIMPORTANT: You MUST respond with valid JSON only, no markdown fences, no extra text. The JSON must match this schema:\n${schemaDescription}`;
}

const extractJson = (text: string): any => {
    // 第一步：剥离 Markdown 代码块（```json ... ``` 或 ``` ... ```）
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleaned = fenceMatch ? fenceMatch[1].trim() : text.trim();

    // 第二步：定位第一个 '{' 和最后一个 '}'，截取中间部分
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        try {
            return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
            // 截取后仍失败，继续尝试直接解析
        }
    }

    // 第三步：直接解析（兜底）
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        throw new Error('AI 返回内容格式异常，请重试。');
    }
};

export { extractJson };
