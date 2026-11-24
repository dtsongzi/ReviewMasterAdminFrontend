import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 管理后台与主站分离部署；接口统一带 /reviewmaster 前缀，本地代理原样转发到后端
// （默认 3002，后端 lib/api-prefix.js 负责剥前缀，不需要 rewrite）。
// 后端不在 3002 时用 VITE_PROXY_TARGET 指定，与主站 vite.config.ts 口径一致。
// 本仓未装 @types/node，做最小声明即可，避免为一个环境变量引入新依赖。
declare const process: { env: Record<string, string | undefined> };
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3002';
const apiProxy = { target: proxyTarget, changeOrigin: true };

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) return 'echarts';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/reviewmaster/api': apiProxy,
      '/reviewmaster/health': apiProxy,
      // 测试环境前缀（develop 构建），同样透传到本机后端
      '/reviewmaster-test/api': apiProxy,
      '/reviewmaster-test/health': apiProxy,
      // 保留裸 /api 代理，仅供本地 curl 与老工具排查
      '/api': apiProxy,
    },
  },
});
