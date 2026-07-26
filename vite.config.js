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
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 30 },
            { name: 'charts', test: /node_modules[\\/]recharts[\\/]/, priority: 25 },
            { name: 'pdf-core', test: /node_modules[\\/](jspdf|fflate)[\\/]/, priority: 24 },
            { name: 'canvas', test: /node_modules[\\/]html2canvas[\\/]/, priority: 23 },
            { name: 'sanitize', test: /node_modules[\\/]dompurify[\\/]/, priority: 22 },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 21 },
            { name: 'cloud', test: /node_modules[\\/](@supabase|@plaidhq|react-plaid-link)[\\/]/, priority: 20 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1, maxSize: 450 * 1024 }
          ]
        }
      }
    }
  }
});
