import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const vdev2Proxy = {
  target: 'http://127.0.0.1:9091',
  changeOrigin: false,
  secure: false,
};

const mainProxy = {
  target: 'http://127.0.0.1:8888',
  changeOrigin: false,
  secure: false,
  rewrite: (path: string) => path.replace(/^\/api\/main/, ''),
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5181,
    strictPort: true,
    proxy: {
      '/api/vdev2': vdev2Proxy,
      '/api/main': mainProxy,
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['telemedicine-front-production.up.railway.app'],
    proxy: {
      '/api/vdev2': vdev2Proxy,
      '/api/main': mainProxy,
    },
  },
});
