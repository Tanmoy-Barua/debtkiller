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
          const normalized = id.replace(/\\/g, '/');
          const match = chunkGroups.find(([, packages]) =>
            packages.some((pkg) => normalized.includes(`/node_modules/${pkg}/`))
          );
          return match ? match[0] : 'vendor';
        },
      },
    },
  },
});
