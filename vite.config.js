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
              name: "react-vendor",
              test: /node_modules\/(react|react-dom|scheduler)\//,
            },
            {
              name: "charts",
              test: /node_modules\/(recharts|d3-|victory-vendor)\//,
            },
            {
              name: "pdf-core",
              test: /node_modules\/(jspdf|fflate)\//,
            },
            {
              name: "canvas",
              test: /node_modules\/(html2canvas|stackblur-canvas)\//,
            },
            {
              name: "svg-render",
              test: /node_modules\/(canvg|rgbcolor)\//,
            },
            {
              name: "sanitize-polyfills",
              test: /node_modules\/(dompurify|core-js)\//,
            },
            {
              name: "icons",
              test: /node_modules\/lucide-react\//,
            },
            {
              name: "cloud",
              test: /node_modules\/(@supabase|@smithy|aws-sdk|@aws-crypto)\//,
            },
            {
              name: "vendor",
              test: /node_modules\//,
            },
          ],
        },
      },
    },
  },
});
