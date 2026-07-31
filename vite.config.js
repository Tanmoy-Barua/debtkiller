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
            { name: 'react', test: /node_modules\/(?:react|react-dom)\// },
            { name: 'charts', test: /node_modules\/(?:recharts|d3-|victory-vendor)\// },
            { name: 'pdf', test: /node_modules\/(?:jspdf|fflate|canvg|rgbcolor|svg-pathdata)\// },
            { name: 'canvas', test: /node_modules\/html2canvas\// },
            { name: 'icons', test: /node_modules\/lucide-react\// },
            { name: 'cloud', test: /node_modules\/(?:@supabase|@aws-sdk|@smithy)\// },
            { name: 'three', test: /node_modules\/(?:three|@react-three)\// },
            { name: 'vendor', test: /node_modules\// },
          ],
        },
      },
    },
  },
});
