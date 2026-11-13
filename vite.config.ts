import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 管理后台与主站分离部署；本地开发把 /api 代理到后端（默认 3002）。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
});
