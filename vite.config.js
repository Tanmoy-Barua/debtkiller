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
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react';
          if (id.includes('/lucide-react/')) return 'icons';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts';
          if (id.includes('/jspdf/') || id.includes('/dompurify/') || id.includes('/html2canvas/')) return 'pdf';
          if (id.includes('/@supabase/') || id.includes('/@supabase-js/')) return 'cloud';
          if (id.includes('/three/') || id.includes('/@react-three/fiber/')) return 'three';
          return 'vendor';
        },
      },
    },
  },
});
