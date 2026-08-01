import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 40 },
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory-vendor)[\\/]/, priority: 30 },
            { name: 'pdf', test: /node_modules[\\/](jspdf|html2canvas|dompurify|canvg|rgbcolor|stackblur-canvas|core-js)[\\/]/, priority: 30 },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 25 },
            { name: 'cloud', test: /node_modules[\\/](@supabase|@scure|@noble)[\\/]/, priority: 25 },
            { name: 'three', test: /node_modules[\\/](three|@react-three)[\\/]/, priority: 25 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
