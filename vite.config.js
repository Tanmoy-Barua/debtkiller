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
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/, priority: 30 },
            { name: 'chart-vendor', test: /[\\/]node_modules[\\/](recharts|d3-|victory-vendor)/, priority: 25 },
            { name: 'canvas-vendor', test: /[\\/]node_modules[\\/]html2canvas[\\/]/, priority: 22 },
            { name: 'pdf-vendor', test: /[\\/]node_modules[\\/]jspdf[\\/]/, priority: 20 },
            { name: 'sanitize-vendor', test: /[\\/]node_modules[\\/]dompurify[\\/]/, priority: 18 },
            { name: 'cloud-vendor', test: /[\\/]node_modules[\\/](@supabase|@gotrue|@realtime|@postgrest|@storage-js)/, priority: 15 },
            { name: 'icon-vendor', test: /[\\/]node_modules[\\/]lucide-react[\\/]/, priority: 10 },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
