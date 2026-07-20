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
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/
            },
            {
              name: 'chart-vendor',
              test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|tiny-invariant)[\\/]/
            },
            {
              name: 'jspdf-vendor',
              test: /[\\/]node_modules[\\/](jspdf|fflate)[\\/]/
            },
            {
              name: 'canvas-vendor',
              test: /[\\/]node_modules[\\/](html2canvas)[\\/]/
            },
            {
              name: 'svg-vendor',
              test: /[\\/]node_modules[\\/](canvg|rgbcolor|svg-pathdata)[\\/]/
            },
            {
              name: 'sanitize-vendor',
              test: /[\\/]node_modules[\\/](dompurify)[\\/]/
            },
            {
              name: 'icons-vendor',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/
            },
            {
              name: 'cloud-vendor',
              test: /[\\/]node_modules[\\/](@supabase|@plaidhq)[\\/]/
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/
            }
          ]
        }
      }
    }
  }
});
