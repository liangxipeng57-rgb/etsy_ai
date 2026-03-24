import React, { useState } from 'react';
import { CloseIcon, DownloadIcon, LayersIcon, UploadIcon, ZoomInIcon } from './Icons';
import { Loader } from './Loader';
import { SizeSelector } from './SizeSelector';
import type { ImageSize } from '../types';

interface ImageFusionProps {
  onGenerate: (prompt: string, size: ImageSize) => void;
  onFileChange: (file: File | null, index: number) => void;
  previewUrls: (string | null)[];
  resultImage: string | null;
  isLoading: boolean;
  error: string | null;
  isKeySaved: boolean;
}

export const ImageFusion: React.FC<ImageFusionProps> = ({
  onGenerate,
  onFileChange,
  previewUrls,
  resultImage,
  isLoading,
  error,
}) => {
  const [prompt, setPrompt] = useState('把多张产品图融合到同一组商业画面中，保持统一光线与透视。');
  const [selectedSize, setSelectedSize] = useState<ImageSize>('1200x1600');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const uploadedCount = previewUrls.filter(Boolean).length;

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-secondary/10 text-secondary">
            <LayersIcon />
          </div>
          <h3 className="text-2xl font-bold text-on-surface">多图融合</h3>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">适合组合套装、场景合成或多商品联动展示。</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {previewUrls.map((previewUrl, index) => (
              <label
                key={index}
                className="block overflow-hidden rounded-[1.5rem] bg-surface-container-lowest cursor-pointer"
              >
                {previewUrl ? (
                  <div className="group relative aspect-square">
                    <img src={previewUrl} alt={`融合素材 ${index + 1}`} className="h-full w-full object-contain p-3" />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onFileChange(null, index);
                      }}
                      className="absolute right-3 top-3 hidden h-9 w-9 items-center justify-center rounded-full bg-white/90 text-on-surface group-hover:flex"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center px-4 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UploadIcon />
                    </div>
                    <p className="text-sm font-bold text-on-surface">素材 {index + 1}</p>
                    <p className="mt-2 text-xs leading-6 text-on-surface-variant">点击上传图片</p>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => onFileChange(event.target.files?.[0] || null, index)}
                />
              </label>
            ))}
          </div>

          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                合成说明
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
              onClick={() => onGenerate(prompt, selectedSize)}
              disabled={uploadedCount < 2 || isLoading}
              className="primary-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? '正在合成画面' : `生成融合图 (${uploadedCount}/4)`}
            </button>

            {error && <div className="rounded-[1.5rem] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          </div>
        </section>

        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="rounded-[1.75rem] bg-surface-container-lowest p-4 min-h-[560px]">
            {isLoading ? (
              <Loader className="min-h-[520px]" message="AI 正在统一透视、阴影与布景关系..." />
            ) : resultImage ? (
              <div className="group relative overflow-hidden rounded-[1.5rem]">
                <img src={resultImage} alt="融合结果" className="w-full rounded-[1.5rem] object-cover" />
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
                    download="etsy-fusion-image.png"
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
                  <p className="text-lg font-bold text-on-surface">融合结果将在这里显示</p>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                    至少上传两张素材图，AI 才会开始统一构图。
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
          <img src={previewImage} alt="融合图预览" className="max-h-[88vh] max-w-full rounded-[2rem] bg-white p-3" />
        </div>
      )}
    </>
  );
};
