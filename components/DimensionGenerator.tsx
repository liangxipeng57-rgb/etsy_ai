import React, { useState } from 'react';
import { CheckIcon, CloseIcon, DownloadIcon, RulerIcon, UploadIcon, ZoomInIcon } from './Icons';
import { generateDimensionDiagram, getDimensionPrompt } from '../services/aiService';
import { fileToBase64 } from '../utils/fileUtils';
import { Loader } from './Loader';
import { SizeSelector } from './SizeSelector';
import type { Dimensions, DimensionUnit, ImageSize } from '../types';

const DIMENSION_FIELDS: Array<keyof Dimensions> = ['height', 'width', 'depth'];

const LABELS: Record<keyof Dimensions, string> = {
  height: '高度',
  width: '宽度',
  depth: '长度',
};

export const DimensionGenerator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({ width: '', height: '', depth: '' });
  const [activeDims, setActiveDims] = useState({ width: true, height: true, depth: true });
  const [unit, setUnit] = useState<DimensionUnit>('cm');
  const [selectedSize, setSelectedSize] = useState<ImageSize>('1200x1600');
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
      const prompt = getDimensionPrompt(dimensions, unit, activeDims);
      if (!prompt) {
        throw new Error('请至少填写一项有效尺寸。');
      }

      const payload = await fileToBase64(file);
      const image = await generateDimensionDiagram([payload], prompt, selectedSize);
      setResultImage(image);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : String(generationError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-secondary/10 text-secondary">
            <RulerIcon />
          </div>
          <h3 className="text-2xl font-bold text-on-surface">尺寸标注图</h3>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">把尺寸信息直接转成适合商品详情页使用的技术标注图。</p>

          <div className="mt-6 space-y-5">
            <label className="block overflow-hidden rounded-[1.75rem] bg-surface-container-lowest cursor-pointer">
              {previewUrl ? (
                <div className="group relative aspect-[4/3]">
                  <img src={previewUrl} alt="尺寸标注参考图" className="h-full w-full object-contain p-3" />
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
                  <p className="text-sm font-bold text-on-surface">上传参考产品图</p>
                  <p className="mt-2 text-xs leading-6 text-on-surface-variant">用于定位标注线与尺寸方向。</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              />
            </label>

            <div className="rounded-[1.75rem] bg-surface-container-lowest p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">尺寸单位</p>
                <div className="inline-flex rounded-full bg-surface-container p-1">
                  {(['cm', 'in'] as const).map((value) => {
                    const active = unit === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setUnit(value)}
                        className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                          active ? 'bg-white text-primary' : 'text-on-surface-variant'
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                {DIMENSION_FIELDS.map((field) => {
                  const enabled = activeDims[field];
                  return (
                    <div key={field} className="flex items-center gap-3 rounded-[1.25rem] bg-surface-container px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setActiveDims((current) => ({ ...current, [field]: !current[field] }))}
                        className={`flex h-6 w-6 items-center justify-center rounded-md ${
                          enabled ? 'bg-secondary text-white' : 'bg-white text-transparent'
                        }`}
                      >
                        {enabled ? <CheckIcon /> : null}
                      </button>
                      <span className="w-14 text-sm font-bold text-on-surface">{LABELS[field]}</span>
                      <input
                        type="number"
                        value={dimensions[field]}
                        disabled={!enabled}
                        onChange={(event) =>
                          setDimensions((current) => ({ ...current, [field]: event.target.value }))
                        }
                        className="w-full border-none bg-transparent text-base font-bold text-on-surface outline-none disabled:text-outline"
                        placeholder="0"
                      />
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-outline">{unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <SizeSelector selectedSize={selectedSize} onSizeChange={setSelectedSize} />

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!file || loading}
              className="primary-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '正在生成尺寸图' : '生成尺寸图'}
            </button>

            {error && <div className="rounded-[1.5rem] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          </div>
        </section>

        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="rounded-[1.75rem] bg-surface-container-lowest p-4 min-h-[560px]">
            {loading ? (
              <Loader className="min-h-[520px]" message="AI 正在计算透视方向与尺寸标注位置..." />
            ) : resultImage ? (
              <div className="group relative overflow-hidden rounded-[1.5rem]">
                <img src={resultImage} alt="尺寸标注结果" className="w-full rounded-[1.5rem] object-cover" />
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
                    download="etsy-dimension-image.png"
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
                  <p className="text-lg font-bold text-on-surface">尺寸图结果将在这里显示</p>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                    适合商品详情页、说明卡或包装附件图。
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
          <img src={previewImage} alt="尺寸图预览" className="max-h-[88vh] max-w-full rounded-[2rem] bg-white p-3" />
        </div>
      )}
    </>
  );
};
