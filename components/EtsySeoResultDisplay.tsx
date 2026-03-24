import React, { useEffect, useState } from 'react';
import type { EtsySeoResult } from '../types';
import { ClipboardIcon, DocumentTextIcon, LinkIcon, TagIcon } from './Icons';

interface EtsySeoResultDisplayProps {
  result: EtsySeoResult;
}

function extractEnglish(text: string): string {
  return text.split(/\|\||\|/)[0]?.trim() || text.trim();
}

const SectionHeader: React.FC<{
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, icon, action }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <span className="text-primary">{icon}</span>
      <h3 className="text-lg font-bold text-on-surface">{title}</h3>
    </div>
    {action}
  </div>
);

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-xs font-bold text-on-surface-variant transition hover:bg-surface-container-high"
    >
      <ClipboardIcon />
      {copied ? '已复制' : '复制'}
    </button>
  );
};

export const EtsySeoResultDisplay: React.FC<EtsySeoResultDisplayProps> = ({ result }) => {
  const [data, setData] = useState(result);

  useEffect(() => {
    setData(result);
  }, [result]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-surface-container-low p-6">
        <SectionHeader title="标题建议" icon={<DocumentTextIcon />} />
        <div className="mt-5 space-y-3">
          {data.titles.map((title, index) => (
            <div key={`${title}-${index}`} className="rounded-[1.5rem] bg-surface-container-lowest p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <textarea
                  value={title}
                  onChange={(event) => {
                    const next = [...data.titles];
                    next[index] = event.target.value;
                    setData({ ...data, titles: next });
                  }}
                  className="min-h-[92px] flex-1 resize-none border-none bg-transparent text-base font-semibold leading-7 text-on-surface outline-none"
                />
                <CopyButton text={extractEnglish(title)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <SectionHeader
            title="商品描述"
            icon={<DocumentTextIcon />}
            action={<CopyButton text={data.description} />}
          />

          <div className="mt-5 rounded-[1.5rem] bg-surface-container-lowest p-4">
            <textarea
              value={data.description}
              onChange={(event) => setData({ ...data, description: event.target.value })}
              className="min-h-[360px] w-full resize-y border-none bg-transparent text-sm leading-8 text-on-surface outline-none"
            />
          </div>
        </section>

        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <SectionHeader
            title={`标签建议 (${data.tags.length})`}
            icon={<TagIcon />}
            action={<CopyButton text={data.tags.map(extractEnglish).join(',')} />}
          />

          <div className="mt-5 flex flex-wrap gap-3">
            {data.tags.map((tag, index) => (
              <input
                key={`${tag}-${index}`}
                value={tag}
                onChange={(event) => {
                  const next = [...data.tags];
                  next[index] = event.target.value;
                  setData({ ...data, tags: next });
                }}
                className="min-w-[140px] rounded-full bg-surface-container-lowest px-4 py-3 text-sm font-medium text-on-surface outline-none"
              />
            ))}
          </div>
        </section>
      </div>

      {data.groundingUrls?.length ? (
        <section className="rounded-[2rem] bg-surface-container-low p-6">
          <SectionHeader title="参考链接" icon={<LinkIcon />} />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {data.groundingUrls.map((link, index) => (
              <a
                key={`${link.uri}-${index}`}
                href={link.uri}
                target="_blank"
                rel="noreferrer"
                className="rounded-[1.5rem] bg-surface-container-lowest p-4 transition hover:bg-white"
              >
                <p className="text-sm font-bold text-on-surface">{link.title || `参考来源 ${index + 1}`}</p>
                <p className="mt-2 truncate text-xs text-on-surface-variant">{link.uri}</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};
