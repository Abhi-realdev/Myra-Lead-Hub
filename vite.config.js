import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('error', (error, _request, response) => {
        console.error('API proxy error:', error.message);
        if (!response.headersSent) {
          response.writeHead(503, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({
            message: 'API server is not running. Start it with npm run dev or npm run api.'
          }));
        }
      });
    }
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: apiProxy
  },
  preview: {
    proxy: apiProxy
  }
});
