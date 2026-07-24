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
            { name: 'pdf-vendor', test: /[\\/]node_modules[\\/](jspdf|html2canvas|dompurify)[\\/]/, priority: 20 },
            { name: 'cloud-vendor', test: /[\\/]node_modules[\\/](@supabase|@gotrue|@realtime|@postgrest|@storage-js)/, priority: 15 },
            { name: 'icon-vendor', test: /[\\/]node_modules[\\/]lucide-react[\\/]/, priority: 10 },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
