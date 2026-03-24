import React, { useState } from 'react';
import { CloseIcon, DownloadIcon, UploadIcon, VideoCameraIcon } from './Icons';
import { generateProductVideo } from '../services/aiService';
import { fileToBase64 } from '../utils/fileUtils';
import { Loader } from './Loader';

const DURATION_OPTIONS = [5, 10] as const;

export const VideoGenerator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<(typeof DURATION_OPTIONS)[number]>(5);
  const [status, setStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setVideoUrl(null);
    setError(null);
    setStatus('');

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
    setVideoUrl(null);
    setStatus('正在上传图片并创建视频任务...');

    try {
      const { base64Data, mimeType } = await fileToBase64(file);
      const result = await generateProductVideo(base64Data, mimeType, prompt.trim(), setStatus, duration);
      setVideoUrl(result);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : String(generationError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
      <section className="rounded-[2rem] bg-surface-container-low p-6">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-secondary/10 text-secondary">
          <VideoCameraIcon />
        </div>
        <h2 className="text-3xl font-extrabold tracking-[-0.03em] text-on-surface">视频生成</h2>
        <p className="mt-3 text-sm leading-7 text-on-surface-variant">
          基于单张产品图生成动态展示视频，适合详情页或社媒推广场景。
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              上传产品图
            </p>
            <label className="block cursor-pointer overflow-hidden rounded-[1.75rem] bg-surface-container-lowest">
              {previewUrl ? (
                <div className="group relative aspect-[4/3]">
                  <img src={previewUrl} alt="视频参考图" className="h-full w-full object-contain p-3" />
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
                  <p className="text-sm font-bold text-on-surface">点击上传或拖入产品图</p>
                  <p className="mt-2 text-xs leading-6 text-on-surface-variant">建议使用主体清晰、边缘完整的图片。</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              镜头提示
            </span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：镜头缓慢环绕产品，突出材质细节，灯光温暖柔和。"
              className="min-h-[140px] w-full resize-none rounded-[1.5rem] border-none bg-surface-container-lowest p-4 text-sm leading-7 text-on-surface outline-none placeholder:text-outline"
            />
          </label>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">视频时长</p>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((option) => {
                const active = duration === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDuration(option)}
                    className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                      active
                        ? 'bg-surface-container-lowest text-primary shadow-[0_10px_25px_rgba(85,67,54,0.08)]'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {option}s
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!file || loading}
            className="primary-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '正在生成视频' : '开始生成视频'}
          </button>

          {error && <div className="rounded-[1.5rem] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        </div>
      </section>

      <section className="rounded-[2rem] bg-surface-container-low p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">输出预览</p>
            <h3 className="mt-2 text-xl font-bold text-on-surface">视频工作区</h3>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-surface-container-lowest">
          <div className="aspect-video flex items-center justify-center bg-[radial-gradient(circle_at_top,#f6f3ee,transparent_58%),#ebe8e3]">
            {loading ? (
              <Loader className="h-full min-h-0 px-6" message={status || '正在生成视频帧...'} />
            ) : videoUrl ? (
              <video src={videoUrl} controls autoPlay className="h-full w-full bg-black object-contain" />
            ) : (
              <div className="text-center">
                <p className="text-lg font-bold text-on-surface">生成完成后会显示在这里</p>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">可直接预览并下载 MP4 成品。</p>
              </div>
            )}
          </div>
        </div>

        {videoUrl && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                const link = document.createElement('a');
                link.href = videoUrl;
                link.download = 'etsy-ai-video.mp4';
                link.click();
              }}
              className="inline-flex items-center gap-3 rounded-full bg-secondary px-6 py-3 text-sm font-bold text-white transition hover:opacity-95"
            >
              <DownloadIcon />
              下载视频
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
