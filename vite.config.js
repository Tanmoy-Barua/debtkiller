import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const chunkGroups = [
  ['react', ['react', 'react-dom', 'scheduler']],
  ['three', ['three', '@react-three/fiber']],
  ['charts', ['recharts']],
  ['pdf', ['jspdf', 'dompurify', 'html2canvas']],
  ['supabase', ['@supabase']],
  ['icons', ['lucide-react']],
];

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined;

          for (const [name, packages] of chunkGroups) {
            if (packages.some((pkg) => id.includes(`/node_modules/${pkg}`))) {
              return name;
            }
          }

          return 'vendor';
        },
      },
    },
  },
});
