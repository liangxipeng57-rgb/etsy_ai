import React from 'react';
import { CloseIcon, DownloadIcon } from './Icons';
import { Loader } from './Loader';

interface VideoModalProps {
  isGenerating: boolean;
  status?: string;
  videoUrl: string | null;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ isGenerating, status, videoUrl, onClose }) => {
  const handleDownload = () => {
    if (!videoUrl) return;

    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = 'etsy-ai-video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(28,28,25,0.72)] p-5 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[2rem] bg-surface-container-low p-5 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Video Preview</p>
            <h3 className="mt-2 text-2xl font-bold text-on-surface">
              {isGenerating ? '正在生成视频' : '视频结果'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] bg-surface-container-lowest">
          <div className="aspect-video flex items-center justify-center bg-[radial-gradient(circle_at_top,#f6f3ee,transparent_58%),#ebe8e3]">
            {isGenerating ? (
              <Loader
                className="h-full min-h-0 max-w-md px-6"
                message={`${status || 'AI 正在渲染视频帧...'} 通常需要 1 到 3 分钟，请保持当前页面打开。`}
              />
            ) : videoUrl ? (
              <video src={videoUrl} controls autoPlay className="h-full w-full bg-black object-contain" />
            ) : (
              <div className="text-center">
                <p className="text-lg font-bold text-on-surface">暂未获得视频结果</p>
                <p className="mt-2 text-sm text-on-surface-variant">请重新尝试，或者先检查设置页中的 API 配置。</p>
              </div>
            )}
          </div>
        </div>

        {videoUrl && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-3 rounded-full bg-secondary px-6 py-3 text-sm font-bold text-white transition hover:opacity-95"
            >
              <DownloadIcon />
              下载视频
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
