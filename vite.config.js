import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 60,
            },
            {
              name: 'charts-vendor',
              test: /[\\/]node_modules[\\/](recharts|d3-|victory-vendor|decimal\.js-light|clsx|es-toolkit)[\\/]/,
              priority: 50,
            },
            {
              name: 'jspdf-vendor',
              test: /[\\/]node_modules[\\/](jspdf|@babel)[\\/]/,
              priority: 40,
            },
            {
              name: 'canvas-vendor',
              test: /[\\/]node_modules[\\/](html2canvas|dompurify)[\\/]/,
              priority: 35,
            },
            {
              name: 'icons-vendor',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              priority: 30,
            },
            {
              name: 'cloud-vendor',
              test: /[\\/]node_modules[\\/](@supabase|@stablelib)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
