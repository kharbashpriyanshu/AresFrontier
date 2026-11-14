import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (!res.headersSent && 'writeHead' in res) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: {
                    code: 'BACKEND_UNAVAILABLE',
                    message:
                      'Backend API server on port 5000 is not reachable. Start it with: npm run dev:backend',
                    details: err.message,
                  },
                })
              );
            }
          });
        },
      },
    },
  },
});
