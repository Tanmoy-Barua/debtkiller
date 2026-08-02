import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber'],
        },
      },
    },
  },
});
