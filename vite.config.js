import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const chunkGroups = [
  ['react', ['react', 'react-dom']],
  ['icons', ['lucide-react']],
  ['charts', ['recharts']],
  ['pdf', ['jspdf', 'html2canvas', 'dompurify']],
  ['cloud', ['@supabase/supabase-js']],
  ['three', ['three', '@react-three/fiber']],
];

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          for (const [chunkName, packages] of chunkGroups) {
            if (packages.some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
              return chunkName;
            }
          }

          return 'vendor';
        },
      },
    },
  },
});
