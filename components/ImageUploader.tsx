import React, { useState } from 'react';
import { CloseIcon, UploadIcon, ZoomInIcon } from './Icons';

interface ImageUploaderProps {
  onFileChange: (file: File | null, index: number) => void;
  previewUrls: (string | null)[];
}

interface UploadSlot {
  label: string;
  hint: string;
  required: boolean;
}

const UPLOAD_SLOTS: UploadSlot[] = [
  { label: '主图', hint: '必须', required: true },
  { label: '侧面图', hint: '可选', required: false },
  { label: '细节图', hint: '可选', required: false },
];

const SlotCard: React.FC<{
  index: number;
  slot: UploadSlot;
  previewUrl: string | null;
  onFileChange: (file: File | null, index: number) => void;
  onPreview: (url: string) => void;
}> = ({ index, slot, previewUrl, onFileChange, onPreview }) => {
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | null) => {
    onFileChange(file, index);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          {slot.label}
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${slot.required ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
          {slot.hint}
        </span>
      </div>

      <label
        htmlFor={`upload-slot-${index}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className={`group relative flex h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.75rem] px-5 transition ${
          dragging
            ? 'bg-primary/10'
            : previewUrl
              ? 'bg-surface-container-lowest'
              : 'bg-surface-container hover:bg-surface-container-lowest'
        }`}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt={slot.label} className="h-full w-full object-contain p-3" />
            <div className="absolute inset-0 flex items-center justify-center gap-3 bg-[rgba(28,28,25,0.3)] opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPreview(previewUrl);
                }}
                className="glass-panel flex h-12 w-12 items-center justify-center rounded-full text-on-surface"
              >
                <ZoomInIcon />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleFile(null);
                }}
                className="glass-panel flex h-12 w-12 items-center justify-center rounded-full text-on-surface"
              >
                <CloseIcon />
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadIcon />
            </div>
            <p className="text-sm font-bold text-on-surface">点击或拖拽上传</p>
            <p className="mt-2 text-xs leading-6 text-on-surface-variant">支持 PNG、JPG、WEBP，建议使用白底图。</p>
          </div>
        )}

        <input
          id={`upload-slot-${index}`}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            handleFile(file);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
};

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onFileChange, previewUrls }) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {UPLOAD_SLOTS.map((slot, index) => (
          <SlotCard
            key={slot.label}
            index={index}
            slot={slot}
            previewUrl={previewUrls[index]}
            onFileChange={onFileChange}
            onPreview={setPreviewImage}
          />
        ))}
      </div>

      <p className="mt-5 text-sm leading-7 text-on-surface-variant">
        上传多角度图片可以让 AI 更稳定地识别产品材质、结构和边缘细节。
      </p>

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(28,28,25,0.8)] p-6 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-full max-w-5xl">
            <img
              src={previewImage}
              alt="预览"
              className="max-h-[88vh] max-w-full rounded-[2rem] bg-surface-container-lowest object-contain p-3 shadow-[0_24px_48px_rgba(0,0,0,0.2)]"
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-on-surface"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
