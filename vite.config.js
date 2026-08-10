import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react';
          if (id.includes('node_modules/lucide-react/')) return 'icons';
          if (id.includes('node_modules/recharts/')) return 'charts';
          if (id.includes('node_modules/jspdf/') || id.includes('node_modules/html2canvas/')) return 'pdf';
          if (id.includes('node_modules/@supabase/')) return 'cloud';
          if (id.includes('node_modules/three/') || id.includes('node_modules/@react-three/fiber/')) return 'three';
          if (id.includes('node_modules/')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
