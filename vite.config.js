import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    viteSingleFile(),
    VitePWA({
      injectRegister: 'inline',
      registerType: 'autoUpdate',
      manifest: {
        name: 'GNSS2GIS',
        short_name: 'GNSS2GIS',
        description: '測量データからGIS/CADデータを作成するアプリ',
        theme_color: '#355E8B',
        icons: [
          {
            src: 'favicon.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp}']
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
