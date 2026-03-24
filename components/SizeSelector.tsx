import React from 'react';
import type { ImageSize } from '../types';

interface SizeSelectorProps {
  selectedSize: ImageSize;
  onSizeChange: (size: ImageSize) => void;
}

const SIZE_OPTIONS: Array<{ id: ImageSize; name: string; desc: string }> = [
  { id: '800x800', name: '正方形', desc: '1:1' },
  { id: '1440x1920', name: '竖版', desc: '9:16' },
  { id: '1200x1600', name: '竖版', desc: '3:4' },
  { id: '1600x1200', name: '横版', desc: '4:3' },
  { id: '1500x1200', name: '横版', desc: '5:4' },
];

export const SizeSelector: React.FC<SizeSelectorProps> = ({ selectedSize, onSizeChange }) => {
  return (
    <div>
      <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
        画布尺寸
      </label>

      <div className="flex flex-wrap gap-2">
        {SIZE_OPTIONS.map((size) => {
          const active = selectedSize === size.id;

          return (
            <button
              key={size.id}
              type="button"
              onClick={() => onSizeChange(size.id)}
              className={`min-w-[86px] rounded-full px-4 py-3 text-left transition ${
                active
                  ? 'bg-surface-container-lowest text-primary shadow-[0_10px_25px_rgba(85,67,54,0.08)]'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-lowest'
              }`}
            >
              <p className="text-xs font-bold">{size.name}</p>
              <p className={`mt-1 text-[10px] font-medium ${active ? 'text-primary/70' : 'text-outline'}`}>
                {size.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
