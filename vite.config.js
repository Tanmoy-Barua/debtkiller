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
              name: 'pdf-vendor',
              test: /node_modules[\\/](jspdf|@babel|canvg|core-js|css-line-break|dompurify|fflate|html2canvas|raf|rgbcolor|text-segmentation)[\\/]/,
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
