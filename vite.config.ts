import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 750 },
  server: { port: 5188, strictPort: true }
});
