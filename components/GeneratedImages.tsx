import React, { useState } from 'react';
import { DimensionInput } from './DimensionInput';
import { DownloadIcon, RefreshIcon, VideoCameraIcon, ZoomInIcon } from './Icons';
import type { DimensionUnit, Dimensions } from '../types';

interface GeneratedImagesProps {
  images: string[];
  dimensionImageIndex: number | null;
  editableDimensions: Dimensions;
  onDimensionsChange: (dimensions: Dimensions) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onGenerateVideo?: (imageUrl: string) => void;
  dimensionUnit?: DimensionUnit;
}

function downloadImage(src: string, filename: string) {
  const link = document.createElement('a');
  link.href = src;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const GeneratedImages: React.FC<GeneratedImagesProps> = ({
  images,
  dimensionImageIndex,
  editableDimensions,
  onDimensionsChange,
  onRegenerate,
  isRegenerating,
  onGenerateVideo,
  dimensionUnit = 'cm',
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!images.length) return null;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {images.map((image, index) => {
          const isDimensionCard = index === dimensionImageIndex;

          return (
            <article
              key={`${image}-${index}`}
              className={`overflow-hidden rounded-[2rem] ${
                isDimensionCard ? 'bg-surface-container-low xl:col-span-2' : 'bg-surface-container-lowest'
              }`}
            >
              <div className="group relative">
                <img
                  src={image}
                  alt={`生成结果 ${index + 1}`}
                  className={`w-full object-cover ${isDimensionCard ? 'aspect-[1.4/1]' : 'aspect-square'}`}
                />

                <div className="absolute inset-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[rgba(28,28,25,0.66)] via-transparent to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setPreviewImage(image)}
                    className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-surface"
                  >
                    <ZoomInIcon />
                    预览
                  </button>

                  <div className="flex items-center gap-2">
                    {onGenerateVideo && !isDimensionCard && (
                      <button
                        type="button"
                        onClick={() => onGenerateVideo(image)}
                        className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-surface"
                      >
                        <VideoCameraIcon />
                        视频
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => downloadImage(image, `etsy-ai-image-${index + 1}.png`)}
                      className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-surface"
                    >
                      <DownloadIcon />
                      下载
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                      {isDimensionCard ? '尺寸标注图' : `结果 ${index + 1}`}
                    </p>
                    <p className="mt-1 text-sm font-bold text-on-surface">
                      {isDimensionCard ? '可直接微调尺寸并重新生成' : '适合下载、打包或继续生成视频'}
                    </p>
                  </div>
                </div>

                {isDimensionCard && (
                  <div className="rounded-[1.75rem] bg-surface-container-lowest p-4">
                    <DimensionInput
                      dimensions={editableDimensions}
                      onDimensionsChange={onDimensionsChange}
                      unit={dimensionUnit}
                      onUnitChange={() => {}}
                    />
                    <button
                      type="button"
                      onClick={onRegenerate}
                      disabled={isRegenerating}
                      className="mt-4 inline-flex items-center gap-3 rounded-full bg-secondary px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshIcon spinning={isRegenerating} />
                      {isRegenerating ? '正在更新标注' : '重新生成尺寸图'}
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(28,28,25,0.82)] p-6 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="生成结果预览"
            className="max-h-[88vh] max-w-full rounded-[2rem] bg-surface-container-lowest p-3 shadow-[0_28px_56px_rgba(0,0,0,0.24)]"
          />
        </div>
      )}
    </>
  );
};
