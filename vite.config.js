import { defineConfig } from 'vite';

export default defineConfig({
  base: '/GNSS2GIS/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
