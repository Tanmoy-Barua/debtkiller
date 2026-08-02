import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react';
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/lucide')) {
            return 'icons';
          }
          if (id.includes('node_modules/recharts')) {
            return 'charts';
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
            return 'pdf';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'cloud';
          }
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three/fiber')) {
            return 'three';
          }
          return 'vendor';
        },
      },
    },
  },
});
