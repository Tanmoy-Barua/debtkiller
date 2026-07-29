import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const moduleGroup = (packages) => new RegExp(`node_modules[\\\\/](${packages.join("|")})([\\\\/]|$)`);

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
              test: moduleGroup(['react', 'react-dom', 'scheduler']),
              priority: 60,
            },
            {
              name: 'charts',
              test: moduleGroup(['recharts', 'd3-[^\\\\/]+', 'decimal.js-light', 'eventemitter3', 'victory-vendor']),
              priority: 50,
            },
            {
              name: 'pdf',
              test: moduleGroup(['jspdf', 'fflate', 'canvg', 'core-js', 'rgbcolor', 'raf']),
              priority: 40,
            },
            {
              name: 'html-render',
              test: moduleGroup(['html2canvas', 'dompurify']),
              priority: 35,
            },
            {
              name: 'cloud',
              test: moduleGroup(['@supabase']),
              priority: 30,
            },
            {
              name: 'icons',
              test: moduleGroup(['lucide-react', 'lucide']),
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
});
