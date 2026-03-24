import React, { useCallback, useState } from 'react';
import { DimensionInput } from './components/DimensionInput';
import { DimensionGenerator } from './components/DimensionGenerator';
import { DetailEnhancer } from './components/DetailEnhancer';
import { EtsySeoGenerator } from './components/EtsySeoGenerator';
import { EtsySeoResultDisplay } from './components/EtsySeoResultDisplay';
import { GeneratedImages } from './components/GeneratedImages';
import {
  DownloadIcon,
  HomeIcon,
  KeyIcon,
  LayersIcon,
  PhotoMergeIcon,
  SettingsIcon,
  SparklesIcon,
  VideoCameraIcon,
} from './components/Icons';
import { ImageFusion } from './components/ImageFusion';
import { ImageUploader } from './components/ImageUploader';
import { Loader } from './components/Loader';
import { ModelSceneGenerator } from './components/ModelSceneGenerator';
import { PromoImageGenerator } from './components/PromoImageGenerator';
import { ProviderSelector } from './components/ProviderSelector';
import { SizeSelector } from './components/SizeSelector';
import { StyleSelector } from './components/StyleSelector';
import { VideoGenerator } from './components/VideoGenerator';
import { VideoModal } from './components/VideoModal';
import {
  generateEcomAssets,
  generateFusedImage,
  generateProductVideo,
  regenerateDimensionImage,
} from './services/aiService';
import { getCapabilityVerified } from './services/providerRegistry';
import type { DimensionUnit, Dimensions, EtsySeoResult, ImageSize, StyleOption } from './types';
import { fileToBase64 } from './utils/fileUtils';

declare const JSZip: any;

type AppView = 'home' | 'main' | 'images' | 'video' | 'seo' | 'settings';
type ImageToolView = 'model' | 'detail' | 'dimension' | 'fusion' | 'promo';
type MainResultView = 'images' | 'seo';

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ReactNode;
}

interface RecentRecord {
  id: string;
  title: string;
  subtitle: string;
  view: AppView;
  imageToolView?: ImageToolView;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: '首页', icon: <HomeIcon /> },
  { id: 'main', label: '主生成器', icon: <SparklesIcon /> },
  { id: 'images', label: '图片工具', icon: <LayersIcon /> },
  { id: 'video', label: '视频工具', icon: <VideoCameraIcon /> },
  { id: 'seo', label: 'SEO 工具', icon: <KeyIcon /> },
  { id: 'settings', label: '设置', icon: <SettingsIcon /> },
];

const IMAGE_TOOL_ITEMS: Array<{ id: ImageToolView; label: string; description: string }> = [
  { id: 'model', label: '模特场景', description: '适合服饰、首饰与包袋展示' },
  { id: 'detail', label: '细节增强', description: '突出材质、做工与纹理细节' },
  { id: 'dimension', label: '尺寸标注', description: '生成技术说明图与标注图' },
  { id: 'fusion', label: '多图融合', description: '把多张素材整合到一个画面' },
  { id: 'promo', label: '宣传图生成', description: '快速产出社媒与广告素材' },
];

function normalizeError(message: string): string {
  if (!message) return '请求失败，请稍后再试。';
  if (message === 'API_KEY_REQUIRE_BILLING') return '当前模型需要可用额度，请前往设置页更换 API Key。';
  if (message.includes('401') || message.includes('403')) return 'API Key 无效，或当前额度不可用。';
  if (message.includes('429') || /quota|exhausted/i.test(message)) return '接口额度或频率已达到上限，请稍后再试。';
  if (/network|fetch|failed to fetch|ERR_CONNECTION/i.test(message)) return '网络连接失败，请检查网络与接口地址。';
  return message;
}

function isSettingsRelatedError(message: string | null): boolean {
  if (!message) return false;
  return /api|密钥|401|403|额度|billing|unauthorized|invalid/i.test(message);
}

const NavButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
      active
        ? 'bg-surface-container-highest text-primary'
        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
    }`}
  >
    <span className={active ? 'text-primary' : 'text-outline'}>{icon}</span>
    <span>{label}</span>
  </button>
);

const PageIntro: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
  <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-on-surface-variant">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.04em] text-on-surface sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-base">{description}</p>
    </div>
    {actions}
  </div>
);

const HomeFeatureCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  wide?: boolean;
}> = ({ title, description, icon, onClick, wide }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-[2rem] bg-surface-container-low p-6 text-left transition hover:bg-surface-container-lowest ${
      wide ? 'md:col-span-2 md:row-span-2' : ''
    }`}
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">{icon}</div>
    <h3 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-on-surface">{title}</h3>
    <p className="mt-3 text-sm leading-7 text-on-surface-variant">{description}</p>
    {wide ? (
      <div className="mt-8 overflow-hidden rounded-[1.5rem] bg-[radial-gradient(circle_at_top,#1f2937,transparent_60%),#111827] p-6 text-white">
        <div className="flex h-40 items-end rounded-[1.25rem] bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.16),transparent_34%),#111827] p-5">
          <div>
            <p className="text-sm font-bold">一站式生成工作区</p>
            <p className="mt-2 text-xs leading-6 text-white/65">上传商品图、生成场景图、导出 SEO 文案与视频素材。</p>
          </div>
        </div>
      </div>
    ) : null}
  </button>
);

const HomeRecordCard: React.FC<{
  index: number;
  title: string;
  subtitle: string;
  onClick: () => void;
}> = ({ index, title, subtitle, onClick }) => (
  <button type="button" onClick={onClick} className="group text-left">
    <div className="flex aspect-square items-center justify-center rounded-[2rem] bg-surface-container-highest text-5xl font-extrabold text-on-surface transition group-hover:bg-surface-container-high">
      {index + 1}
    </div>
    <p className="mt-3 text-sm font-bold text-on-surface">{title}</p>
    <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
  </button>
);

const ToggleRow: React.FC<{
  label: string;
  active: boolean;
  onChange: (value: boolean) => void;
  extra?: React.ReactNode;
}> = ({ label, active, onChange, extra }) => (
  <div className="rounded-[1.5rem] bg-surface-container-lowest p-4">
    <div className="flex items-center justify-between gap-4">
      <button type="button" onClick={() => onChange(!active)} className="flex items-center gap-3 text-left">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${active ? 'bg-secondary text-white' : 'bg-surface-container text-transparent'}`}>
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
        </span>
        <span className="text-sm font-bold text-on-surface">{label}</span>
      </button>
      {extra}
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [activeImageTool, setActiveImageTool] = useState<ImageToolView>('model');
  const [mainResultView, setMainResultView] = useState<MainResultView>('images');
  const [providerVersion, setProviderVersion] = useState(0);
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);

  const [uploadedFiles, setUploadedFiles] = useState<(File | null)[]>([null, null, null]);
  const [uploadedImagePreviews, setUploadedImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [etsySeoResult, setEtsySeoResult] = useState<EtsySeoResult | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleOption>('auto');
  const [customStyle, setCustomStyle] = useState('');
  const [selectedSize, setSelectedSize] = useState<ImageSize>('800x800');
  const [dimensions, setDimensions] = useState<Dimensions>({ width: '', height: '', depth: '' });
  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>('cm');
  const [includeImages, setIncludeImages] = useState(true);
  const [includeSeo, setIncludeSeo] = useState(true);
  const [imageCount, setImageCount] = useState(3);
  const [editableDimensions, setEditableDimensions] = useState<Dimensions>({ width: '', height: '', depth: '' });
  const [dimensionImageIndex, setDimensionImageIndex] = useState<number | null>(null);

  const [fusionFiles, setFusionFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [fusionImagePreviews, setFusionImagePreviews] = useState<(string | null)[]>([null, null, null, null]);
  const [fusedImage, setFusedImage] = useState<string | null>(null);
  const [fusionError, setFusionError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isFusing, setIsFusing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState('');

  const apiReady =
    getCapabilityVerified('text') && getCapabilityVerified('image') && getCapabilityVerified('video');

  const addRecentRecord = useCallback((record: Omit<RecentRecord, 'id'>) => {
    setRecentRecords((current) => [
      { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      ...current,
    ].slice(0, 5));
  }, []);

  const navigateTo = useCallback((view: AppView, imageToolView?: ImageToolView) => {
    setActiveView(view);
    if (imageToolView) {
      setActiveImageTool(imageToolView);
    }
  }, []);

  const handleApiError = useCallback((value: unknown) => {
    const rawMessage = value instanceof Error ? value.message : String(value);
    setError(normalizeError(rawMessage));
    setIsLoading(false);
    setIsFusing(false);
    setIsVideoGenerating(false);
  }, []);

  const handleFileChange = (file: File | null, index: number) => {
    setUploadedFiles((current) => {
      const next = [...current];
      next[index] = file;
      return next;
    });

    if (!file) {
      setUploadedImagePreviews((current) => {
        const next = [...current];
        next[index] = null;
        return next;
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImagePreviews((current) => {
        const next = [...current];
        next[index] = reader.result as string;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFusionFileChange = (file: File | null, index: number) => {
    setFusionFiles((current) => {
      const next = [...current];
      next[index] = file;
      return next;
    });

    if (!file) {
      setFusionImagePreviews((current) => {
        const next = [...current];
        next[index] = null;
        return next;
      });
      setFusedImage(null);
      setFusionError(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFusionImagePreviews((current) => {
        const next = [...current];
        next[index] = reader.result as string;
        return next;
      });
    };
    reader.readAsDataURL(file);

    setFusedImage(null);
    setFusionError(null);
  };

  const handleGenerate = useCallback(async () => {
    if (!includeImages && !includeSeo) {
      setError('请至少选择一种输出内容。');
      return;
    }

    const files = uploadedFiles.filter(Boolean) as File[];
    if (!uploadedFiles[0] || files.length === 0) {
      setError('请至少上传一张主图。');
      return;
    }

    setActiveView('main');
    setMainResultView(includeSeo && !includeImages ? 'seo' : 'images');
    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);
    setEtsySeoResult(null);
    setDimensionImageIndex(null);

    try {
      setLoadingMessage(
        includeImages && includeSeo
          ? '正在同时生成场景图与 SEO 文案...'
          : includeImages
            ? '正在生成主图场景方案...'
            : '正在生成 SEO 文案...'
      );

      const imagePayloads = await Promise.all(files.map((file) => fileToBase64(file)));
      const results = await generateEcomAssets(
        imagePayloads,
        selectedStyle,
        dimensions,
        selectedSize,
        customStyle,
        {
          includeImages,
          includeSeo,
          dimensionUnit,
          imageCount,
        },
      );

      if (includeImages) {
        setGeneratedImages(results.images);
        if ((dimensions.width || dimensions.height || dimensions.depth) && results.images.length > 0) {
          setDimensionImageIndex(results.images.length - 1);
          setEditableDimensions(dimensions);
        }
      }

      if (includeSeo && results.etsySeo) {
        setEtsySeoResult(results.etsySeo);
      }

      if (results.seoError) {
        setError(normalizeError(results.seoError.message));
      }

      addRecentRecord({
        title: '主生成器',
        subtitle: [
          includeImages && results.images.length ? `${results.images.length} 张图片` : null,
          includeSeo && results.etsySeo ? 'SEO 文案' : null,
        ]
          .filter(Boolean)
          .join(' + ') || '已完成生成',
        view: 'main',
      });
    } catch (generationError) {
      handleApiError(generationError);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [
    addRecentRecord,
    customStyle,
    dimensionUnit,
    dimensions,
    handleApiError,
    imageCount,
    includeImages,
    includeSeo,
    selectedSize,
    selectedStyle,
    uploadedFiles,
  ]);

  const handleRegenerateDimensionImage = useCallback(async () => {
    const files = uploadedFiles.filter(Boolean) as File[];
    if (!files.length || dimensionImageIndex === null) return;

    setIsRegenerating(true);
    setError(null);

    try {
      const payloads = await Promise.all(files.map((file) => fileToBase64(file)));
      const image = await regenerateDimensionImage(payloads, editableDimensions, selectedSize, dimensionUnit);
      setGeneratedImages((current) => {
        const next = [...current];
        next[dimensionImageIndex] = image;
        return next;
      });
    } catch (generationError) {
      handleApiError(generationError);
    } finally {
      setIsRegenerating(false);
    }
  }, [dimensionImageIndex, dimensionUnit, editableDimensions, handleApiError, selectedSize, uploadedFiles]);

  const handleDownloadPackage = useCallback(async () => {
    if ((generatedImages.length === 0 && !etsySeoResult) || typeof JSZip === 'undefined') {
      setError('当前没有可打包的结果。');
      return;
    }

    setIsZipping(true);

    try {
      const zip = new JSZip();

      if (etsySeoResult) {
        const content = [
          'TITLE SUGGESTIONS',
          ...etsySeoResult.titles,
          '',
          'DESCRIPTION',
          etsySeoResult.description,
          '',
          'TAGS',
          etsySeoResult.tags.join(', '),
        ].join('\n');
        zip.file('etsy-seo.txt', content);
      }

      await Promise.all(
        generatedImages.map(async (image, index) => {
          const response = await fetch(image);
          const blob = await response.blob();
          zip.file(`image-${index + 1}.png`, blob);
        }),
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'etsy-ai-assets.zip';
      link.click();
    } catch (zipError) {
      setError(zipError instanceof Error ? zipError.message : '打包下载失败。');
    } finally {
      setIsZipping(false);
    }
  }, [etsySeoResult, generatedImages]);

  const handleGenerateFusedImage = useCallback(async (prompt: string, size: ImageSize) => {
    const files = fusionFiles.filter(Boolean) as File[];
    if (files.length < 2) {
      setFusionError('请至少上传两张图片再开始合成。');
      return;
    }

    setIsFusing(true);
    setFusionError(null);
    setFusedImage(null);

    try {
      const payloads = await Promise.all(files.map((file) => fileToBase64(file)));
      const image = await generateFusedImage(payloads, prompt, size);
      setFusedImage(image);
      addRecentRecord({
        title: '图片工具 · 多图融合',
        subtitle: `${files.length} 张素材已合成`,
        view: 'images',
        imageToolView: 'fusion',
      });
    } catch (fusionGenerationError) {
      const message = fusionGenerationError instanceof Error ? fusionGenerationError.message : String(fusionGenerationError);
      setFusionError(normalizeError(message));
    } finally {
      setIsFusing(false);
    }
  }, [addRecentRecord, fusionFiles]);

  const handleGenerateVideo = useCallback(async (imageUrl: string) => {
    setIsVideoModalOpen(true);
    setIsVideoGenerating(true);
    setVideoUrl(null);
    setVideoStatus('正在准备视频任务...');
    setError(null);

    try {
      let base64Data = '';
      let mimeType = 'image/png';

      if (imageUrl.startsWith('data:')) {
        const [prefix, encoded] = imageUrl.split(',');
        base64Data = encoded || '';
        mimeType = prefix.split(';')[0]?.replace('data:', '') || mimeType;
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`无法读取图片数据 (${response.status})`);
        }

        const blob = await response.blob();
        mimeType = blob.type || mimeType;
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      if (!base64Data) {
        throw new Error('未获取到有效的图片数据。');
      }

      const url = await generateProductVideo(base64Data, mimeType, '', setVideoStatus, 5);
      setVideoUrl(url);
      addRecentRecord({
        title: '主生成器 · 视频衍生',
        subtitle: '已从主图生成产品视频',
        view: 'video',
      });
    } catch (videoGenerationError) {
      handleApiError(videoGenerationError);
    } finally {
      setIsVideoGenerating(false);
    }
  }, [addRecentRecord, handleApiError]);

  const renderHome = () => {
    const displayRecords = recentRecords.length
      ? recentRecords
      : [
          { id: 'starter-1', title: '主生成器', subtitle: '进入主图与 SEO 一站式生成', view: 'main' as const },
          { id: 'starter-2', title: '图片工具', subtitle: '模特图、细节图、尺寸图', view: 'images' as const, imageToolView: 'model' as const },
          { id: 'starter-3', title: '视频工具', subtitle: '从单图生成产品短视频', view: 'video' as const },
          { id: 'starter-4', title: 'SEO 工具', subtitle: '关键词与 Etsy 链接优化', view: 'seo' as const },
          { id: 'starter-5', title: '设置', subtitle: '配置统一 API Key', view: 'settings' as const },
        ];

    return (
      <>
        <PageIntro
          eyebrow="Dashboard"
          title="Etsy AI Studio"
          description="按你的 UI 设计稿重建后的工作台首页。所有能力被收拢到更清晰的流转里，设置页负责统一 API 入口。"
          actions={
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateTo('main')}
                className="primary-gradient rounded-full px-6 py-3 text-sm font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)]"
              >
                进入主生成器
              </button>
              <button
                type="button"
                onClick={() => navigateTo('settings')}
                className="rounded-full border border-outline-variant/40 bg-surface-container-low px-6 py-3 text-sm font-bold text-on-surface"
              >
                打开设置
              </button>
            </div>
          }
        />

        <section className="grid gap-5 md:grid-cols-4">
          <HomeFeatureCard
            title="主图生成"
            description="上传商品图，直接生成场景主图、尺寸图与 SEO 文案。"
            icon={<SparklesIcon />}
            onClick={() => navigateTo('main')}
            wide
          />
          <HomeFeatureCard
            title="SEO 文案"
            description="关键词或链接两种模式，快速拿到标题、标签和长描述。"
            icon={<KeyIcon />}
            onClick={() => navigateTo('seo')}
          />
          <HomeFeatureCard
            title="视频生成"
            description="从产品图直接衍生动态展示视频。"
            icon={<VideoCameraIcon />}
            onClick={() => navigateTo('video')}
          />
          <HomeFeatureCard
            title="宣传图生成"
            description="适合社媒、广告位与站外引流素材。"
            icon={<PhotoMergeIcon />}
            onClick={() => navigateTo('images', 'promo')}
          />
        </section>

        <section className="mt-14">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-on-surface-variant">Recent</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-on-surface">最近生成记录</h2>
            </div>
            <button type="button" onClick={() => navigateTo('main')} className="text-sm font-bold text-primary">
              新建项目
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {displayRecords.map((record, index) => (
              <HomeRecordCard
                key={record.id}
                index={index}
                title={record.title}
                subtitle={record.subtitle}
                onClick={() => navigateTo(record.view, record.imageToolView)}
              />
            ))}
          </div>
        </section>
      </>
    );
  };

  const renderMain = () => {
    const hasImageResults = generatedImages.length > 0;
    const hasSeoResults = !!etsySeoResult;

    return (
      <>
        <PageIntro
          eyebrow="Main Generator"
          title="主生成器"
          description="按设计稿重构后的主工作区，保持现有业务能力，并把上传、参数、结果拆成更清晰的两栏流。"
          actions={
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownloadPackage}
                disabled={(!hasImageResults && !hasSeoResults) || isZipping}
                className="inline-flex items-center gap-3 rounded-full bg-secondary px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <DownloadIcon />
                {isZipping ? '正在打包' : '下载全部'}
              </button>
            </div>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
          <section className="rounded-[2rem] bg-surface-container-high p-6">
            <div className="space-y-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Step 01</p>
                <h2 className="mt-2 text-xl font-bold text-on-surface">上传商品图</h2>
                <div className="mt-4">
                  <ImageUploader onFileChange={handleFileChange} previewUrls={uploadedImagePreviews} />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Step 02</p>
                <h2 className="mt-2 text-xl font-bold text-on-surface">设置风格与尺寸</h2>
                <div className="mt-4 space-y-5">
                  <StyleSelector
                    selectedStyle={selectedStyle}
                    onStyleChange={setSelectedStyle}
                    customStyle={customStyle}
                    onCustomStyleChange={setCustomStyle}
                  />
                  <SizeSelector selectedSize={selectedSize} onSizeChange={setSelectedSize} />
                  <DimensionInput
                    dimensions={dimensions}
                    onDimensionsChange={setDimensions}
                    unit={dimensionUnit}
                    onUnitChange={setDimensionUnit}
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Step 03</p>
                <h2 className="mt-2 text-xl font-bold text-on-surface">选择输出内容</h2>
                <div className="mt-4 space-y-3">
                  <ToggleRow
                    label="生成场景图片"
                    active={includeImages}
                    onChange={setIncludeImages}
                    extra={
                      includeImages ? (
                        <div className="flex gap-2">
                          {[1, 2, 3, 4].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setImageCount(value)}
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                                imageCount === value ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  <ToggleRow label="生成 SEO 文案" active={includeSeo} onChange={setIncludeSeo} />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!uploadedFiles[0] || isLoading}
                className="primary-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-base font-bold text-on-primary shadow-[0_20px_40px_rgba(141,75,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? '正在生成结果' : '开始生成'}
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] bg-surface-container-low p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="inline-flex rounded-full bg-surface-container p-1">
                <button
                  type="button"
                  onClick={() => setMainResultView('images')}
                  className={`rounded-full px-4 py-2.5 text-sm font-bold transition ${
                    mainResultView === 'images' ? 'bg-white text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  图片结果
                </button>
                <button
                  type="button"
                  onClick={() => setMainResultView('seo')}
                  className={`rounded-full px-4 py-2.5 text-sm font-bold transition ${
                    mainResultView === 'seo' ? 'bg-white text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  SEO 文案
                </button>
              </div>

              {isLoading ? <p className="text-sm text-secondary">{loadingMessage || 'AI 正在处理...'}</p> : null}
            </div>

            <div className="mt-6 rounded-[1.75rem] bg-surface-container-lowest p-4 min-h-[640px]">
              {isLoading && !hasImageResults && !hasSeoResults ? (
                <Loader className="min-h-[600px]" message={loadingMessage || '正在生成结果...'} />
              ) : mainResultView === 'images' ? (
                hasImageResults ? (
                  <GeneratedImages
                    images={generatedImages}
                    dimensionImageIndex={dimensionImageIndex}
                    editableDimensions={editableDimensions}
                    onDimensionsChange={setEditableDimensions}
                    onRegenerate={handleRegenerateDimensionImage}
                    isRegenerating={isRegenerating}
                    onGenerateVideo={handleGenerateVideo}
                    dimensionUnit={dimensionUnit}
                  />
                ) : (
                  <div className="flex min-h-[600px] items-center justify-center text-center">
                    <div>
                      <p className="text-lg font-bold text-on-surface">图片结果将在这里显示</p>
                      <p className="mt-3 text-sm leading-7 text-on-surface-variant">上传商品图并点击“开始生成”，工作区会在这里展示场景图与尺寸图。</p>
                    </div>
                  </div>
                )
              ) : hasSeoResults ? (
                <EtsySeoResultDisplay result={etsySeoResult as EtsySeoResult} />
              ) : (
                <div className="flex min-h-[600px] items-center justify-center text-center">
                  <div>
                    <p className="text-lg font-bold text-on-surface">SEO 文案将在这里显示</p>
                    <p className="mt-3 text-sm leading-7 text-on-surface-variant">你可以只开启 SEO 文案，也可以和图片一起生成。</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </>
    );
  };

  const renderImageTools = () => (
    <>
      <PageIntro
        eyebrow="Image Tools"
        title="图片工具"
        description="把原先分散的模特图、细节图、尺寸图、多图融合和宣传图入口整合到一个统一工作台中。"
      />

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {IMAGE_TOOL_ITEMS.map((item) => {
          const active = activeImageTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveImageTool(item.id)}
              className={`shrink-0 rounded-full px-4 py-3 text-left transition ${
                active ? 'bg-surface-container-highest text-primary' : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              <p className="text-sm font-bold">{item.label}</p>
              <p className="mt-1 text-[11px]">{item.description}</p>
            </button>
          );
        })}
      </div>

      {activeImageTool === 'model' && <ModelSceneGenerator />}
      {activeImageTool === 'detail' && <DetailEnhancer />}
      {activeImageTool === 'dimension' && <DimensionGenerator />}
      {activeImageTool === 'fusion' && (
        <ImageFusion
          onGenerate={handleGenerateFusedImage}
          onFileChange={handleFusionFileChange}
          previewUrls={fusionImagePreviews}
          resultImage={fusedImage}
          isLoading={isFusing}
          error={fusionError}
          isKeySaved={apiReady}
        />
      )}
      {activeImageTool === 'promo' && <PromoImageGenerator />}
    </>
  );

  const renderCurrentView = () => {
    switch (activeView) {
      case 'home':
        return renderHome();
      case 'main':
        return renderMain();
      case 'images':
        return renderImageTools();
      case 'video':
        return (
          <>
            <PageIntro
              eyebrow="Video Tools"
              title="视频工具"
              description="从静态图片衍生动态展示视频，适合社媒种草、详情页增强和广告测试。"
            />
            <VideoGenerator />
          </>
        );
      case 'seo':
        return (
          <>
            <PageIntro
              eyebrow="SEO Workspace"
              title="SEO 工具"
              description="保留原有后端 SEO 能力，并按新设计稿重构为更清晰的分析工作区。"
            />
            <EtsySeoGenerator />
          </>
        );
      case 'settings':
        return (
          <>
            <PageIntro
              eyebrow="Settings"
              title="设置"
              description="API 入口已经迁移到这里，后续所有图片、视频和 SEO 请求都会走这一个统一配置。"
            />
            <ProviderSelector onSaved={() => setProviderVersion((value) => value + 1)} />
          </>
        );
      default:
        return null;
    }
  };

  const workspaceLabel =
    activeView === 'images'
      ? IMAGE_TOOL_ITEMS.find((item) => item.id === activeImageTool)?.label || '图片工具'
      : NAV_ITEMS.find((item) => item.id === activeView)?.label || '工作台';

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {isVideoModalOpen && (
        <VideoModal
          isGenerating={isVideoGenerating}
          status={videoStatus}
          videoUrl={videoUrl}
          onClose={() => setIsVideoModalOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col bg-surface-container-high p-5 lg:flex">
          <div className="px-3 py-4">
            <p className="text-xl font-extrabold tracking-[-0.03em] text-primary">Artisanal Workbench</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.24em] text-on-surface-variant">AI Studio</p>
          </div>

          <nav className="mt-5 grid gap-2">
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                active={activeView === item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => navigateTo(item.id)}
              />
            ))}
          </nav>

          <div className="mt-auto space-y-4 rounded-[1.75rem] bg-surface-container-low p-4">
            <button type="button" onClick={() => navigateTo('main')} className="primary-gradient w-full rounded-full px-4 py-3 text-sm font-bold text-on-primary">
              新建项目
            </button>

            <div className="rounded-[1.5rem] bg-surface-container-lowest p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">API Status</p>
              <p className="mt-3 text-sm font-bold text-on-surface">{apiReady ? 'API 已就绪' : '待配置 API Key'}</p>
              <button type="button" onClick={() => navigateTo('settings')} className="mt-3 text-sm font-bold text-primary">
                打开设置
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-outline-variant/20 bg-surface/85 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div>
                <p className="text-lg font-extrabold tracking-[-0.03em] text-on-surface">Etsy AI Studio</p>
                <p className="mt-1 text-xs font-medium text-on-surface-variant">{workspaceLabel}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigateTo('settings')}
                  className={`rounded-full px-4 py-2 text-xs font-bold tracking-[0.16em] uppercase ${
                    apiReady ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {apiReady ? 'API Ready' : 'API Setup'}
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('settings')}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface"
                >
                  <SettingsIcon />
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto px-4 pb-4 lg:hidden sm:px-6">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                    activeView === item.id ? 'bg-surface-container-highest text-primary' : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 lg:px-8">
            {error && (
              <div className="mb-6 flex flex-col gap-3 rounded-[1.75rem] bg-red-50 p-4 text-red-600 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7">{error}</p>
                {isSettingsRelatedError(error) ? (
                  <button type="button" onClick={() => navigateTo('settings')} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-red-600">
                    前往设置
                  </button>
                ) : null}
              </div>
            )}

            <div key={providerVersion}>{renderCurrentView()}</div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;
