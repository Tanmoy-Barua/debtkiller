import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 50 },
            { name: "charts", test: /node_modules[\\/](recharts|d3-|victory-vendor)[\\/]/, priority: 40 },
            { name: "pdf", test: /node_modules[\\/](jspdf|fflate)[\\/]/, priority: 35 },
            { name: "canvas", test: /node_modules[\\/]html2canvas[\\/]/, priority: 34 },
            { name: "sanitize", test: /node_modules[\\/]dompurify[\\/]/, priority: 33 },
            { name: "icons", test: /node_modules[\\/]lucide-react[\\/]/, priority: 32 },
            { name: "cloud", test: /node_modules[\\/](@supabase|@supabase[\\/]supabase-js)[\\/]/, priority: 31 },
            { name: "vendor", test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
