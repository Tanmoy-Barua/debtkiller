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
          if (!id.includes('node_modules')) return;
          if (id.includes('/three/') || id.includes('@react-three/fiber')) return 'three';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
          if (id.includes('/recharts/')) return 'charts';
          if (id.includes('/jspdf/') || id.includes('/html2canvas/') || id.includes('/dompurify/')) {
            return 'pdf';
          }
          if (id.includes('@supabase/') || id.includes('/three-stdlib/')) {
            return 'cloud';
          }
          return 'vendor';
        },
      },
    },
  },
});
