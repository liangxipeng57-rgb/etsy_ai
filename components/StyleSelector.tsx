import React from 'react';
import type { StyleOption } from '../types';
import { AutoIcon, HomeIcon, InstagramIcon, PencilIcon, PinterestIcon, UserIcon } from './Icons';

interface StyleSelectorProps {
  selectedStyle: StyleOption;
  onStyleChange: (style: StyleOption) => void;
  customStyle: string;
  onCustomStyleChange: (style: string) => void;
}

const STYLE_OPTIONS: Array<{ id: StyleOption; name: string; icon: React.ReactNode }> = [
  { id: 'auto', name: '智能匹配', icon: <AutoIcon /> },
  { id: 'auto-model', name: '真人模特', icon: <UserIcon /> },
  { id: 'home', name: '家居场景', icon: <HomeIcon /> },
  { id: 'pinterest', name: 'Pinterest', icon: <PinterestIcon /> },
  { id: 'instagram', name: 'Instagram', icon: <InstagramIcon /> },
  { id: 'custom', name: '自定义', icon: <PencilIcon /> },
];

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyle,
  onStyleChange,
  customStyle,
  onCustomStyleChange,
}) => {
  return (
    <div>
      <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
        视觉风格
      </label>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {STYLE_OPTIONS.map((style) => {
          const active = selectedStyle === style.id;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onStyleChange(style.id)}
              className={`rounded-[1.5rem] px-4 py-4 text-left transition ${
                active
                  ? 'bg-surface-container-lowest text-primary shadow-[0_16px_30px_rgba(85,67,54,0.08)]'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`${active ? 'text-primary' : 'text-outline'}`}>{style.icon}</span>
                <span className="text-sm font-bold">{style.name}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedStyle === 'custom' && (
        <div className="mt-4 rounded-[1.75rem] bg-surface-container-lowest p-4">
          <textarea
            value={customStyle}
            onChange={(event) => onCustomStyleChange(event.target.value)}
            placeholder="描述你想要的布光、材质氛围、场景陈列方式或参考品牌调性。"
            className="min-h-[120px] w-full resize-none border-none bg-transparent text-sm leading-7 text-on-surface outline-none placeholder:text-outline"
          />
        </div>
      )}
    </div>
  );
};
