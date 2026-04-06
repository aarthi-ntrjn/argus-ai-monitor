import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:7411',
      '/ws': { target: 'ws://localhost:7411', ws: true },
      '/hooks': 'http://localhost:7411',
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('react-joyride') || id.includes('react-floater')) return 'vendor-tour';
        },
      },
    },
  },
});
