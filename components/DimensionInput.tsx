import React from 'react';
import type { Dimensions, DimensionUnit } from '../types';

interface DimensionInputProps {
  dimensions: Dimensions;
  onDimensionsChange: (dimensions: Dimensions) => void;
  unit: DimensionUnit;
  onUnitChange: (unit: DimensionUnit) => void;
}

const LABELS: Record<keyof Dimensions, string> = {
  width: '宽度',
  height: '高度',
  depth: '长度',
};

export const DimensionInput: React.FC<DimensionInputProps> = ({
  dimensions,
  onDimensionsChange,
  unit,
  onUnitChange,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onDimensionsChange({
      ...dimensions,
      [event.target.name]: event.target.value,
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
          产品尺寸
        </label>

        <div className="inline-flex rounded-full bg-surface-container p-1">
          {(['cm', 'in'] as const).map((value) => {
            const active = unit === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onUnitChange(value)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                  active
                    ? 'bg-surface-container-lowest text-primary shadow-[0_8px_16px_rgba(85,67,54,0.08)]'
                    : 'text-on-surface-variant'
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['width', 'height', 'depth'] as const).map((key) => (
          <label key={key} className="rounded-[1.5rem] bg-surface-container-lowest px-4 py-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
              {LABELS[key]}
            </span>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                name={key}
                value={dimensions[key]}
                onChange={handleChange}
                placeholder="0"
                className="w-full border-none bg-transparent p-0 text-lg font-bold text-on-surface outline-none placeholder:text-outline"
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-outline">{unit}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};
