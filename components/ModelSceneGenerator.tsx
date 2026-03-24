import React, { useState } from 'react';
import { CloseIcon, DownloadIcon, UploadIcon, UserIcon, ZoomInIcon } from './Icons';
import { generateModelScene } from '../services/aiService';
import { fileToBase64 } from '../utils/fileUtils';
import { Loader } from './Loader';
import { SizeSelector } from './SizeSelector';
import type { ImageSize } from '../types';

export const ModelSceneGenerator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('专业模特在高端棚拍场景中展示产品，保留产品原始款式和质感。');
  const [selectedSize, setSelectedSize] = useState<ImageSize>('1440x1920');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setResultImage(null);
    setError(null);

    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleGenerate = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const payload = await fileToBase64(file);
      const image = await generateModelScene(payload, prompt, selectedSize);
      setResultImage(image);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : String(generationError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-secondary/10 text-secondary">
            <UserIcon />
          </div>
          <h3 className="text-2xl font-bold text-on-surface">模特场景</h3>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">适合服饰、饰品、包袋等需要真人展示的商品。</p>

          <div className="mt-6 space-y-5">
            <label className="block overflow-hidden rounded-[1.75rem] bg-surface-container-lowest cursor-pointer">
              {previewUrl ? (
                <div className="group relative aspect-[4/3]">
                  <img src={previewUrl} alt="模特参考图" className="h-full w-full object-contain p-3" />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleFileChange(null);
                    }}
                    className="absolute right-4 top-4 hidden h-10 w-10 items-center justify-center rounded-full bg-white/90 text-on-surface group-hover:flex"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UploadIcon />
                  </div>
                  <p className="text-sm font-bold text-on-surface">上传产品图</p>
                  <p className="mt-2 text-xs leading-6 text-on-surface-variant">用于生成真人展示效果。</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              />
            </label>

            <label className="block">
              <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                场景说明
              </span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-[140px] w-full resize-none rounded-[1.5rem] border-none bg-surface-container-lowest p-4 text-sm leading-7 text-on-surface outline-none"
              />
            </label>

            <SizeSelector selectedSize={selectedSize} onSizeChange={setSelectedSize} />

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!file || loading}
              className="primary-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '正在生成模特图' : '生成模特图'}
            </button>

            {error && <div className="rounded-[1.5rem] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          </div>
        </section>

        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="rounded-[1.75rem] bg-surface-container-lowest p-4 min-h-[560px]">
            {loading ? (
              <Loader className="min-h-[520px]" message="AI 正在匹配模特姿态与棚拍布光..." />
            ) : resultImage ? (
              <div className="group relative overflow-hidden rounded-[1.5rem]">
                <img src={resultImage} alt="模特场景结果" className="w-full rounded-[1.5rem] object-cover" />
                <div className="absolute inset-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[rgba(28,28,25,0.66)] via-transparent to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setPreviewImage(resultImage)}
                    className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-surface"
                  >
                    <ZoomInIcon />
                    预览
                  </button>
                  <a
                    href={resultImage}
                    download="etsy-model-scene.png"
                    className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-surface"
                  >
                    <DownloadIcon />
                    下载
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center text-center">
                <div>
                  <p className="text-lg font-bold text-on-surface">模特图结果将在这里显示</p>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                    适合上新图、Lookbook 和社媒展示图。
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(28,28,25,0.82)] p-6 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="模特图预览" className="max-h-[88vh] max-w-full rounded-[2rem] bg-white p-3" />
        </div>
      )}
    </>
  );
};
