import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { HttpsProxyAgent } from 'https-proxy-agent';

// ── 本地科学上网代理（区分开发 / 生产）──────────────────────────────────
//
// 优先级：环境变量 > 开发环境 fallback > 无代理（生产直连）
//
// 本地开发：
//   方式 A（推荐）：启动前设置环境变量
//     set HTTPS_PROXY=http://127.0.0.1:7890 && npm run dev
//   方式 B：直接修改下方 DEV_FALLBACK_PROXY 的端口号
//
// ⚠️  请把下面的端口号改成你本地 Clash / V2Ray 实际的 HTTP 代理端口：
const DEV_FALLBACK_PROXY = 'http://127.0.0.1:7897';

// 生产服务器部署时，不要设置 HTTPS_PROXY / HTTP_PROXY 环境变量，
// agent 会自动为 undefined，所有 API 请求直连目标服务器，无需任何修改。
const PROXY_URL =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY  ||
  process.env.ALL_PROXY   ||
  (process.env.NODE_ENV !== 'production' ? DEV_FALLBACK_PROXY : '');

const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

if (agent) {
  console.log(`[vite] ✓ 本地代理已启用: ${PROXY_URL}  (Clash 负责智能分流)`);
} else {
  console.log('[vite] ○ 未检测到代理配置，API 请求将直连目标服务器（生产模式）');
}

// ── 错误处理 ──────────────────────────────────────────────────────────
// 注意：必须通过 configure → proxy.on('error') 注册；
//       直接写 onError: fn 是无效属性，Vite 会静默忽略。
const makeOnError = (target: string) => (err: Error, _req: any, res: any) => {
  console.error(`[Proxy Error] → ${target}:`, err.message);
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `代理网络错误: ${err.message}`, type: 'proxy_error' } }));
  }
};

// ── 统一代理规则工厂 ──────────────────────────────────────────────────
// 本地有 agent → 所有请求走 Clash，由 Clash 规则决定直连还是翻墙
// 生产无 agent → 直连目标服务器（服务器本身具备访问能力）
const makeProxy = (prefix: string, target: string, strip?: string) => ({
  [prefix]: {
    target,
    changeOrigin: true,
    secure: false,   // 跳过 Node.js OpenSSL 证书链校验（开发环境兼容用）
    rewrite: (p: string) => p.replace(new RegExp(`^${strip ?? prefix}`), ''),
    ...(agent ? { agent } : {}),
    configure: (proxy: any) => {
      proxy.on('error', makeOnError(target));
    },
  },
});

const proxyEntries = {
  ...makeProxy('/proxy/gemini',      'https://generativelanguage.googleapis.com'),
  ...makeProxy('/proxy/openai',      'https://api.openai.com'),
  ...makeProxy('/proxy/anthropic',   'https://api.anthropic.com'),
  ...makeProxy('/proxy/runway',      'https://api.dev.runwayml.com'),
  ...makeProxy('/proxy/stability',   'https://api.stability.ai'),
  ...makeProxy('/proxy/toapis',      'https://api.jiekou.ai/openai'),
  ...makeProxy('/proxy/deepseek',    'https://api.deepseek.com'),
  ...makeProxy('/proxy/qwen',        'https://dashscope.aliyuncs.com'),
  ...makeProxy('/proxy/siliconflow', 'https://api.siliconflow.cn'),
  ...makeProxy('/proxy/kling',       'https://api.klingai.com'),
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: proxyEntries,
    },
    preview: {
      port: 3000,
      proxy: proxyEntries,
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
