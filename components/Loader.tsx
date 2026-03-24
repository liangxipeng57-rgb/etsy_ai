import React from 'react';

interface LoaderProps {
  message?: string;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ message, className = '' }) => {
  return (
    <div className={`flex w-full flex-col items-center justify-center text-center ${className}`.trim()}>
      <div className="relative h-16 w-16">
        <span className="absolute inset-0 rounded-full border-4 border-primary/15" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary" />
      </div>
      <p className="mt-5 max-w-md text-sm font-medium leading-7 text-on-surface-variant">
        {message || 'AI 正在整理结果，请稍候。'}
      </p>
    </div>
  );
};
