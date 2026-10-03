import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Keeps the browser on one origin in development — no CORS surprises.
    proxy: {
      '/api': { target: 'http://localhost:5055', changeOrigin: true },
    },
  },
});
