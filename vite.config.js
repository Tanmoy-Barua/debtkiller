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
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20
            },
            {
              name: 'chart-vendor',
              test: /node_modules[\\/](recharts|d3-|decimal\.js|eventemitter3|lodash|react-is|tiny-invariant)[\\/]/,
              priority: 15
            },
            {
              name: 'pdf-core-vendor',
              test: /node_modules[\\/](jspdf|fflate)[\\/]/,
              priority: 16
            },
            {
              name: 'canvas-vendor',
              test: /node_modules[\\/](html2canvas|css-line-break|text-segmentation)[\\/]/,
              priority: 16
            },
            {
              name: 'svg-vendor',
              test: /node_modules[\\/](canvg|raf|rgbcolor)[\\/]/,
              priority: 16
            },
            {
              name: 'polyfill-vendor',
              test: /node_modules[\\/](@babel|core-js|dompurify)[\\/]/,
              priority: 15
            },
            {
              name: 'cloud-vendor',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 10
            },
            {
              name: 'icon-vendor',
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 10
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 1,
              maxSize: 350 * 1024
            }
          ]
        }
      }
    }
  }
});
