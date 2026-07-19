import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react';
          if (id.includes('/node_modules/recharts/')) {
            const match = id.match(/\/node_modules\/recharts\/(?:es6|lib)\/([^/]+)/);
            return match ? `charts-${match[1]}` : 'charts';
          }
          if (id.includes('/node_modules/lucide-react/')) return 'icons';
          if (id.includes('/node_modules/jspdf/')) return 'pdf';
          if (id.includes('/node_modules/')) return 'vendor';
        },
      },
    },
  },
});
