import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function manualChunks(id) {
  const normalizedId = id.replace(/\\/g, '/');

  if (!normalizedId.includes('/node_modules/')) return undefined;
  if (normalizedId.includes('/node_modules/react/') || normalizedId.includes('/node_modules/react-dom/')) {
    return 'react';
  }
  if (normalizedId.includes('/node_modules/@react-three/fiber/') || normalizedId.includes('/node_modules/three/')) {
    return 'three';
  }
  if (normalizedId.includes('/node_modules/recharts/') || normalizedId.includes('/node_modules/d3-')) {
    return 'charts';
  }
  if (
    normalizedId.includes('/node_modules/jspdf/') ||
    normalizedId.includes('/node_modules/html2canvas/') ||
    normalizedId.includes('/node_modules/dompurify/')
  ) {
    return 'pdf';
  }
  if (normalizedId.includes('/node_modules/@supabase/')) return 'supabase';
  if (normalizedId.includes('/node_modules/lucide-react/')) return 'icons';

  return 'vendor';
}

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
