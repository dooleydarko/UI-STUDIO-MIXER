import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built app loads from file:// inside Electron
  base: './',
  optimizeDeps: { include: ['xatlas-wasm'] },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          lucide: ['lucide-react'],
        },
      },
    },
  },
});
