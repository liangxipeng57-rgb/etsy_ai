import React, { useState } from 'react';
import { CloseIcon, DownloadIcon, PhotoMergeIcon, UploadIcon, ZoomInIcon } from './Icons';
import { Loader } from './Loader';
import type { ImageSize } from '../types';
import { SizeSelector } from './SizeSelector';
import { generatePromoImages, generatePromoTextToImages } from '../services/aiService';
import { fileToBase64 } from '../utils/fileUtils';

type PromoMode = 'text2img' | 'img2img';

const PROMO_STYLES = [
  '平铺展示',
  '生活场景',
  '极简陈列',
  '广告主视觉',
];

export const PromoImageGenerator: React.FC = () => {
  const [mode, setMode] = useState<PromoMode>('img2img');
  const [textPrompt, setTextPrompt] = useState('');
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [size, setSize] = useState<ImageSize>('1200x1600');
  const [count, setCount] = useState(4);
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const readPreview = (file: File | null, setter: (value: string | null) => void) => {
    if (!file) {
      setter(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      if (mode === 'text2img') {
        if (!textPrompt.trim()) {
          throw new Error('请输入宣传图文案描述。');
        }
        setResults(await generatePromoTextToImages(textPrompt.trim(), size, count));
      } else {
        if (!bgFile || !productFile) {
          throw new Error('请先上传背景图和产品图。');
        }

        const [bgPayload, productPayload] = await Promise.all([fileToBase64(bgFile), fileToBase64(productFile)]);
        setResults(await generatePromoImages(bgPayload, productPayload, size, count));
      }
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : String(generationError));
    } finally {
      setLoading(false);
    }
  };

  const ready = mode === 'text2img' ? Boolean(textPrompt.trim()) : Boolean(bgFile && productFile);

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-secondary/10 text-secondary">
            <PhotoMergeIcon />
          </div>
          <h3 className="text-2xl font-bold text-on-surface">宣传图生成</h3>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            支持文生图和图生图两种方式，快速产出社媒或广告宣传素材。
          </p>

          <div className="mt-6 inline-flex rounded-full bg-surface-container p-1">
            {([
              { id: 'img2img', label: '图生图' },
              { id: 'text2img', label: '文生图' },
            ] as const).map((item) => {
              const active = mode === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMode(item.id);
                    setError(null);
                    setResults([]);
                  }}
                  className={`rounded-full px-4 py-2.5 text-xs font-bold transition ${
                    active ? 'bg-white text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-5">
            {mode === 'img2img' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block overflow-hidden rounded-[1.5rem] bg-surface-container-lowest cursor-pointer">
                  {bgPreview ? (
                    <div className="group relative aspect-square">
                      <img src={bgPreview} alt="背景图" className="h-full w-full object-contain p-3" />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setBgFile(null);
                          setBgPreview(null);
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
                      <p className="text-sm font-bold text-on-surface">背景图</p>
                      <p className="mt-2 text-xs leading-6 text-on-surface-variant">场景环境素材</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setBgFile(file);
                      readPreview(file, setBgPreview);
                    }}
                  />
                </label>

                <label className="block overflow-hidden rounded-[1.5rem] bg-surface-container-lowest cursor-pointer">
                  {productPreview ? (
                    <div className="group relative aspect-square">
                      <img src={productPreview} alt="产品图" className="h-full w-full object-contain p-3" />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setProductFile(null);
                          setProductPreview(null);
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
                      <p className="text-sm font-bold text-on-surface">产品图</p>
                      <p className="mt-2 text-xs leading-6 text-on-surface-variant">主体商品素材</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setProductFile(file);
                      readPreview(file, setProductPreview);
                    }}
                  />
                </label>
              </div>
            ) : (
              <label className="block">
                <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  宣传文案描述
                </span>
                <textarea
                  value={textPrompt}
                  onChange={(event) => setTextPrompt(event.target.value)}
                  placeholder="例如：清晨阳光洒在木桌上，陶瓷杯旁有书本和咖啡蒸汽，适合 Instagram 宣传图。"
                  className="min-h-[160px] w-full resize-none rounded-[1.5rem] border-none bg-surface-container-lowest p-4 text-sm leading-7 text-on-surface outline-none"
                />
              </label>
            )}

            <SizeSelector selectedSize={size} onSizeChange={setSize} />

            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">生成数量</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((value) => {
                  const active = count === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCount(value)}
                      className={`rounded-full px-4 py-3 text-sm font-bold transition ${
                        active ? 'bg-white text-primary' : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {value} 张
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!ready || loading}
              className="primary-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '正在生成宣传图' : `生成 ${count} 张宣传图`}
            </button>

            {error && <div className="rounded-[1.5rem] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          </div>
        </section>

        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="rounded-[1.75rem] bg-surface-container-lowest p-4 min-h-[560px]">
            {loading ? (
              <Loader className="min-h-[520px] px-6" message={`正在生成 ${count} 张宣传图，请稍候...`} />
            ) : results.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map((image, index) => (
                  <div key={`${image}-${index}`} className="group relative overflow-hidden rounded-[1.5rem]">
                    <img src={image} alt={`宣传图 ${index + 1}`} className="aspect-square w-full object-cover" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/86 px-3 py-1 text-[11px] font-bold text-on-surface">
                      {PROMO_STYLES[index] || `方案 ${index + 1}`}
                    </div>
                    <div className="absolute inset-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[rgba(28,28,25,0.66)] via-transparent to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(image)}
                        className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-surface"
                      >
                        <ZoomInIcon />
                        预览
                      </button>
                      <a
                        href={image}
                        download={`etsy-promo-${index + 1}.png`}
                        className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-on-surface"
                      >
                        <DownloadIcon />
                        下载
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center text-center">
                <div>
                  <p className="text-lg font-bold text-on-surface">宣传图结果将在这里显示</p>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                    适合 Instagram、Pinterest 或站外广告投放素材。
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
          <img src={previewImage} alt="宣传图预览" className="max-h-[88vh] max-w-full rounded-[2rem] bg-white p-3" />
        </div>
      )}
    </>
  );
};
