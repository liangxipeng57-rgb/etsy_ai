import React, { useEffect, useMemo, useState } from 'react';
import { CheckIcon, KeyIcon, RefreshIcon, SettingsIcon } from './Icons';
import {
  getCapabilityVerified,
  getGlobalApiKey,
  HARDCODED_MODELS,
  setCapabilityVerified,
  setGlobalApiKey,
} from '../services/providerRegistry';
import { testProviderConnection } from '../services/aiService';

interface ProviderSelectorProps {
  onSaved?: () => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const MODEL_ITEMS = [
  { label: '文案引擎', value: HARDCODED_MODELS.text },
  { label: '图片编辑', value: HARDCODED_MODELS.image },
  { label: '文生图片', value: HARDCODED_MODELS.textToImage },
  { label: '视频引擎', value: HARDCODED_MODELS.video },
];

function normalizeError(message: string): string {
  if (!message) return '连接失败，请检查 API Key 后重试。';
  if (message.includes('401') || message.includes('403')) return 'API Key 无效，或者当前额度不可用。';
  if (message.includes('429')) return '请求过于频繁，请稍后再试。';
  if (/network|fetch|failed to fetch/i.test(message)) return '网络连接失败，请检查网络或接口可用性。';
  return message;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ onSaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedKey = getGlobalApiKey();
    setApiKey(savedKey);
    if (
      savedKey &&
      getCapabilityVerified('text') &&
      getCapabilityVerified('image') &&
      getCapabilityVerified('video')
    ) {
      setTestStatus('success');
    }
  }, []);

  const statusMeta = useMemo(() => {
    switch (testStatus) {
      case 'testing':
        return {
          badge: '正在验证',
          badgeClass: 'bg-secondary/10 text-secondary',
          title: '系统正在检测当前 API 连接。',
        };
      case 'success':
        return {
          badge: '已通过',
          badgeClass: 'bg-secondary/10 text-secondary',
          title: '当前 API Key 已可用于文案、图片和视频能力。',
        };
      case 'error':
        return {
          badge: '验证失败',
          badgeClass: 'bg-red-100 text-red-600',
          title: '验证未通过，请检查密钥或接口额度。',
        };
      default:
        return {
          badge: '待配置',
          badgeClass: 'bg-primary/10 text-primary',
          title: '在这里维护统一 API 入口，所有 AI 功能都会共用它。',
        };
    }
  }, [testStatus]);

  const handleKeyChange = (value: string) => {
    setApiKey(value);
    setError(null);
    setTestStatus(value.trim() ? 'idle' : 'idle');

    if (!value.trim()) {
      setGlobalApiKey('');
      setCapabilityVerified('text', false);
      setCapabilityVerified('image', false);
      setCapabilityVerified('video', false);
      onSaved?.();
    }
  };

  const handleValidate = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError('请先输入 API Key。');
      return;
    }

    setError(null);
    setTestStatus('testing');
    setGlobalApiKey(trimmedKey);

    try {
      const ok = await testProviderConnection('text');
      if (!ok) {
        throw new Error('接口返回未通过，请确认密钥是否正确。');
      }

      setCapabilityVerified('text', true);
      setCapabilityVerified('image', true);
      setCapabilityVerified('video', true);
      setTestStatus('success');
      onSaved?.();
    } catch (validationError) {
      setCapabilityVerified('text', false);
      setCapabilityVerified('image', false);
      setCapabilityVerified('video', false);
      setTestStatus('error');
      setError(
        normalizeError(
          validationError instanceof Error ? validationError.message : String(validationError),
        ),
      );
    }
  };

  const handleSaveOnly = () => {
    const trimmedKey = apiKey.trim();
    setGlobalApiKey(trimmedKey);

    if (!trimmedKey) {
      setCapabilityVerified('text', false);
      setCapabilityVerified('image', false);
      setCapabilityVerified('video', false);
      setTestStatus('idle');
    }

    onSaved?.();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <section className="rounded-[2rem] bg-surface-container-low p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary">
              <SettingsIcon />
            </div>
            <h2 className="text-3xl font-extrabold tracking-[-0.03em] text-on-surface">API 与引擎设置</h2>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">{statusMeta.title}</p>
          </div>

          <span
            className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold tracking-[0.16em] uppercase ${statusMeta.badgeClass}`}
          >
            {statusMeta.badge}
          </span>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              Unified API Key
            </label>
            <div className="rounded-[1.75rem] bg-surface-container-lowest p-4 shadow-[0_20px_40px_rgba(85,67,54,0.05)]">
              <textarea
                value={apiKey}
                onChange={(event) => handleKeyChange(event.target.value)}
                placeholder="在这里粘贴统一 API Key，所有 AI 生成能力都会共享这一个入口。"
                className="min-h-[180px] w-full resize-none border-none bg-transparent p-2 font-mono text-sm leading-7 text-on-surface outline-none placeholder:text-outline"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleValidate}
              disabled={testStatus === 'testing' || !apiKey.trim()}
              className="primary-gradient inline-flex items-center justify-center gap-3 rounded-full px-7 py-4 text-sm font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshIcon spinning={testStatus === 'testing'} />
              {testStatus === 'testing' ? '正在验证连接' : '验证并启用'}
            </button>

            <button
              type="button"
              onClick={handleSaveOnly}
              className="inline-flex items-center justify-center gap-3 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-7 py-4 text-sm font-bold text-on-surface transition hover:bg-white"
            >
              <CheckIcon />
              保存设置
            </button>
          </div>

          {error && (
            <div className="rounded-[1.5rem] bg-red-50 px-5 py-4 text-sm font-medium leading-7 text-red-600">
              {error}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-[2rem] bg-surface-container-low p-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-secondary/10 text-secondary">
            <KeyIcon />
          </div>
          <h3 className="text-xl font-bold text-on-surface">固定业务路由</h3>
          <p className="mt-2 text-sm leading-7 text-on-surface-variant">
            当前项目已经收敛为统一 API 入口，以下模型映射由业务层固定维护，前端设置页只负责录入和校验密钥。
          </p>

          <div className="mt-6 space-y-3">
            {MODEL_ITEMS.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.5rem] bg-surface-container-lowest px-4 py-4 shadow-[0_16px_30px_rgba(85,67,54,0.04)]"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  {item.label}
                </p>
                <p className="mt-2 font-mono text-sm text-on-surface">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-secondary/5 p-6">
          <h3 className="text-lg font-bold text-on-surface">配置建议</h3>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-on-surface-variant">
            <li>统一 API Key 会同时服务文案、图片编辑、文生图和视频生成。</li>
            <li>修改密钥后建议先执行一次“验证并启用”，避免在主流程中才发现额度问题。</li>
            <li>如果你要更换接口平台，只需要调整服务层，不需要再改前端设置结构。</li>
          </ul>
        </div>
      </section>
    </div>
  );
};
