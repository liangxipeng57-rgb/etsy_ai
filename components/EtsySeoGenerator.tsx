import React, { useState } from 'react';
import { generateSeoFromKeywords, generateSeoFromUrl } from '../services/aiService';
import type { EtsySeoResult } from '../types';
import { KeyIcon, LinkIcon } from './Icons';
import { EtsySeoResultDisplay } from './EtsySeoResultDisplay';
import { Loader } from './Loader';

type ActiveMode = 'keywords' | 'url';

export const EtsySeoGenerator: React.FC = () => {
  const [activeMode, setActiveMode] = useState<ActiveMode>('keywords');
  const [keywords, setKeywords] = useState('');
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<EtsySeoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (activeMode === 'keywords') {
        if (!keywords.trim()) {
          throw new Error('请先输入关键词。');
        }
        setResult(await generateSeoFromKeywords(keywords.trim()));
      } else {
        if (!url.trim()) {
          throw new Error('请先输入 Etsy 商品链接。');
        }
        setResult(await generateSeoFromUrl(url.trim()));
      }
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : String(generationError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <div className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
            <KeyIcon />
          </div>
          <h2 className="text-3xl font-extrabold tracking-[-0.03em] text-on-surface">优化商品曝光</h2>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            利用关键词或 Etsy 链接，快速生成标题、标签和长描述。
          </p>

          <div className="mt-6 inline-flex rounded-full bg-surface-container p-1">
            {([
              { id: 'keywords', label: '关键词生成', icon: <KeyIcon /> },
              { id: 'url', label: '链接分析', icon: <LinkIcon /> },
            ] as const).map((item) => {
              const active = activeMode === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMode(item.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition ${
                    active
                      ? 'bg-surface-container-lowest text-primary shadow-[0_8px_20px_rgba(85,67,54,0.08)]'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                {activeMode === 'keywords' ? '产品关键词 / 卖点' : 'Etsy 商品链接'}
              </span>
              {activeMode === 'keywords' ? (
                <textarea
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  placeholder="例如：陶瓷咖啡杯、侘寂风、手工制作、礼物场景。"
                  className="min-h-[180px] w-full resize-none rounded-[1.5rem] border-none bg-surface-container-lowest p-4 text-sm leading-7 text-on-surface outline-none placeholder:text-outline"
                />
              ) : (
                <textarea
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.etsy.com/listing/..."
                  className="min-h-[180px] w-full resize-none rounded-[1.5rem] border-none bg-surface-container-lowest p-4 text-sm leading-7 text-on-surface outline-none placeholder:text-outline"
                />
              )}
            </label>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="primary-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '正在分析并生成 SEO' : '分析并生成 SEO'}
            </button>

            {error && <div className="rounded-[1.5rem] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          </div>
        </div>

        <div className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">生成结果</p>
              <h3 className="mt-2 text-xl font-bold text-on-surface">优化方案工作区</h3>
            </div>
          </div>

          <div className="mt-6 rounded-[1.75rem] bg-surface-container-lowest p-4 min-h-[320px]">
            {loading ? (
              <Loader className="min-h-[280px]" message="正在抓取关键词意图与 Etsy 语义结构..." />
            ) : result ? (
              <EtsySeoResultDisplay result={result} />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center text-center">
                <div>
                  <p className="text-lg font-bold text-on-surface">结果将在这里展开</p>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                    你可以先从关键词模式开始，快速验证标题方向和标签覆盖度。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
