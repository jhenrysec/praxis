import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// portal-ui/vite.config.ts
// Proxies /api/* and WebSocket connections to portal-backend during development
// In production, nginx handles this proxy — see ansible/roles/lab-portal/

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // noVNC's CJS build uses top-level await — ensure esbuild handles it during dev
  optimizeDeps: {
    include: ['@novnc/novnc/lib/rfb'],
    esbuildOptions: {
      supported: { 'top-level-await': true },
    },
  },

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
    target: 'es2022', // Required for noVNC's top-level await
    commonjsOptions: {
      // noVNC's CJS build uses top-level await which the commonjs plugin
      // can't handle. Exclude it so Vite pre-bundles it with esbuild instead.
      exclude: [/novnc/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          query:   ['@tanstack/react-query'],
          charts:  ['recharts'],
        },
      },
    },
  },
});
