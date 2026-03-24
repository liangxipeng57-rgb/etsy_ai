
export const fileToBase64 = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error('FileReader did not return a string.'));
      }
      // The result is a data URL like "data:image/jpeg;base64,..."
      // We need to extract the base64 part.
      const base64String = reader.result.split(',')[1];
      resolve({ base64Data: base64String, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * 压缩 ImagePayload 中的 base64 图片，确保单张图片体积 ≤ maxKB。
 * 通过 canvas 缩放 + JPEG 质量递降实现。
 * 输入：裸 base64（无 data: 前缀）+ mimeType
 * 输出：压缩后的裸 base64（无前缀），mimeType 统一为 image/jpeg
 */
export const compressImagePayload = (
  base64Data: string,
  mimeType: string,
  maxKB: number = 900,
  maxDimension: number = 1536,
): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve) => {
    // 已是 data URL 则直接用，否则补全前缀
    const src = base64Data.startsWith('data:')
      ? base64Data
      : `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

    const img = new Image();
    img.onload = () => {
      try {
        // 计算缩放尺寸（保持宽高比，最长边 ≤ maxDimension）
        let w = img.width;
        let h = img.height;
        if (w > maxDimension || h > maxDimension) {
          const ratio = Math.min(maxDimension / w, maxDimension / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ base64Data, mimeType });
        }
        ctx.drawImage(img, 0, 0, w, h);

        // 逐步降低 JPEG 质量直到满足体积要求
        let quality = 0.85;
        const MIN_QUALITY = 0.3;
        while (quality >= MIN_QUALITY) {
          let dataUrl: string;
          try {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          } catch {
            return resolve({ base64Data, mimeType });
          }
          const raw = dataUrl.split(',')[1];
          const sizeKB = (raw.length * 3) / 4 / 1024;
          if (sizeKB <= maxKB || quality <= MIN_QUALITY) {
            return resolve({ base64Data: raw, mimeType: 'image/jpeg' });
          }
          quality -= 0.1;
        }
        // 兜底：返回最低质量结果
        const fallback = canvas.toDataURL('image/jpeg', MIN_QUALITY).split(',')[1];
        resolve({ base64Data: fallback, mimeType: 'image/jpeg' });
      } catch {
        resolve({ base64Data, mimeType });
      }
    };
    img.onerror = () => resolve({ base64Data, mimeType });
    img.src = src;
  });
};

export const resizeImage = (
  base64Src: string,
  size: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const [targetWidth, targetHeight] = size.split('x').map(Number);
    if (!targetWidth || !targetHeight) {
        return reject(new Error('Invalid size format. Expected "widthxheight".'));
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          // canvas getContext 被浏览器安全策略阻止时，直接返回原始数据
          return resolve(base64Src);
        }

        const imgAspect = img.width / img.height;
        const canvasAspect = targetWidth / targetHeight;

        let sx = 0;
        let sy = 0;
        let sWidth = img.width;
        let sHeight = img.height;

        if (imgAspect > canvasAspect) {
          sWidth = img.height * canvasAspect;
          sx = (img.width - sWidth) / 2;
        } else if (imgAspect < canvasAspect) {
          sHeight = img.width / canvasAspect;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

        const mimeType = base64Src.substring(base64Src.indexOf(':') + 1, base64Src.indexOf(';'));
        let result: string;
        try {
          result = mimeType === 'image/jpeg'
            ? canvas.toDataURL(mimeType, 0.92)
            : canvas.toDataURL('image/png');
        } catch {
          // toDataURL 被追踪预防阻止时，降级返回原始数据
          return resolve(base64Src);
        }
        resolve(result);
      } catch (e) {
        // 所有其他 canvas 操作异常：降级返回原始数据
        resolve(base64Src);
      }
    };
    img.onerror = () => reject(new Error('图片数据加载失败，请检查图片格式是否正确。'));
    img.src = base64Src;
  });
};
