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
            { name: "jspdf-vendor", test: /node_modules\/(jspdf|fflate)\// },
            { name: "canvas-vendor", test: /node_modules\/(html2canvas|canvg)\// },
            { name: "pdf-sanitize-vendor", test: /node_modules\/(dompurify|core-js)\// },
          ],
        },
      },
    },
  },
});
