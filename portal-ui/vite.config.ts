import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// portal-ui/vite.config.ts
// Proxies /api/* and WebSocket connections to portal-backend during development
// In production, nginx handles this proxy — see ansible/roles/lab-portal/

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 3000,
    proxy: {
      // REST API
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // noVNC WebSocket proxy
      '/novnc-proxy': {
        target: 'ws://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
      // Real-time status WebSocket
      '/api/status/ws': {
        target: 'ws://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          query:   ['@tanstack/react-query'],
          novnc:   ['@novnc/novnc'],
          charts:  ['recharts'],
        },
      },
    },
  },
});
