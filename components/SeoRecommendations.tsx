
import React, { useState, useEffect } from 'react';
import type { ImageGenSeoResult } from '../types';
import { ClipboardIcon, CheckIcon } from './Icons';

interface SeoRecommendationsProps {
  result: ImageGenSeoResult | null;
}

// Helper component for editable list items (titles)
const EditableTitle: React.FC<{ 
    value: string; 
    onChange: (val: string) => void;
}> = ({ value, onChange }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <li className="group relative flex items-start gap-2 bg-slate-800/40 hover:bg-slate-800/60 border border-white/5 hover:border-indigo-500/30 p-3 rounded-xl text-slate-300 transition-all duration-200 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={2}
                className="w-full bg-transparent border-none resize-none focus:ring-0 p-0 text-sm text-slate-300 placeholder-slate-500 focus:outline-none"
                placeholder="点击编辑标题..."
            />
            <button 
                onClick={handleCopy} 
                className="flex-shrink-0 mt-1 p-1.5 text-slate-500 group-hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" 
                aria-label="复制标题"
                title="复制到剪贴板"
            >
                {copied ? <CheckIcon /> : <ClipboardIcon />}
            </button>
        </li>
    );
};

// Helper component for editable chips (keywords)
const EditableKeyword: React.FC<{
    value: string;
    onChange: (val: string) => void;
}> = ({ value, onChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    const handleBlur = () => {
        setIsEditing(false);
        if (localValue.trim()) {
            onChange(localValue);
        } else {
            setLocalValue(value); // Revert if empty
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent newline
            handleBlur();
        }
    };

    if (isEditing) {
        return (
            <input
                autoFocus
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="bg-slate-700 border border-indigo-500 text-white text-xs font-medium px-2 py-1 rounded-full outline-none min-w-[80px] max-w-[200px]"
            />
        );
    }

    return (
        <span 
            onClick={() => setIsEditing(true)}
            className="bg-slate-800/60 border border-white/5 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full hover:border-indigo-500/50 hover:text-indigo-300 hover:bg-slate-800 transition-all cursor-pointer"
            title="点击编辑"
        >
            {value}
        </span>
    );
};

export const SeoRecommendations: React.FC<SeoRecommendationsProps> = ({ result }) => {
  const [data, setData] = useState<ImageGenSeoResult | null>(result);
  const [titlesCopied, setTitlesCopied] = useState(false);
  const [keywordsCopied, setKeywordsCopied] = useState(false);

  // Sync with props when new generation happens
  useEffect(() => {
      setData(result);
  }, [result]);

  if (!data) return null;
  
  const handleTitleChange = (index: number, newVal: string) => {
      const newData = { ...data, titles: [...data.titles] };
      newData.titles[index] = newVal;
      setData(newData);
  };

  const handleKeywordChange = (index: number, newVal: string) => {
      const newData = { ...data, keywords: [...data.keywords] };
      newData.keywords[index] = newVal;
      setData(newData);
  };

  const copyAllTitles = () => {
      navigator.clipboard.writeText(data.titles.join('\n'));
      setTitlesCopied(true);
      setTimeout(() => setTitlesCopied(false), 2000);
  };

  const copyAllKeywords = () => {
      navigator.clipboard.writeText(data.keywords.join(', '));
      setKeywordsCopied(true);
      setTimeout(() => setKeywordsCopied(false), 2000);
  };

  return (
    <div className="w-full bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
              SEO 优化建议
          </h2>
      </div>
      
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 pl-1">
             <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">标题建议 (双语)</h3>
                <span className="text-[10px] text-slate-500 italic">点击文字编辑</span>
             </div>
             <button onClick={copyAllTitles} className="text-[10px] text-indigo-300 hover:text-indigo-100 flex items-center gap-1">
                {titlesCopied ? <CheckIcon /> : <ClipboardIcon />} 复制全部
             </button>
        </div>
       
        <ul className="space-y-3">
            {data.titles.map((title, index) => (
                <EditableTitle 
                    key={index} 
                    value={title} 
                    onChange={(val) => handleTitleChange(index, val)} 
                />
            ))}
        </ul>
      </div>

      <div className="mt-auto">
        <div className="flex items-center justify-between mb-3 pl-1">
            <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">高频关键词</h3>
                <span className="text-[10px] text-slate-500 italic">点击标签编辑</span>
            </div>
            <button onClick={copyAllKeywords} className="text-[10px] text-indigo-300 hover:text-indigo-100 flex items-center gap-1">
                {keywordsCopied ? <CheckIcon /> : <ClipboardIcon />} 复制全部
             </button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {data.keywords.map((keyword, index) => (
            <EditableKeyword 
              key={index}
              value={keyword}
              onChange={(val) => handleKeywordChange(index, val)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};
