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
            { name: "react-vendor", test: /node_modules\/(react|react-dom)\// },
            { name: "chart-vendor", test: /node_modules\/(recharts|d3-|lodash-es|react-smooth)\// },
            { name: "icons-vendor", test: /node_modules\/lucide-react\// },
            { name: "supabase-vendor", test: /node_modules\/@supabase\// },
            { name: "pdf-vendor", test: /node_modules\/(jspdf|html2canvas|dompurify|fflate|canvg|core-js)\// },
          ],
        },
      },
    },
  },
});
