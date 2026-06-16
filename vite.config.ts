import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'remove-crossorigin',
      transformIndexHtml: {
        order: 'post',
        handler: (html: string) => html.replace(/\s+crossorigin(=["\'][^"\']*["\'])?/g, ''),
      },
    },
  ],
  root: 'src/renderer',
  base: './',
  optimizeDeps: {
    exclude: ['@yume-chan/scrcpy-decoder-tinyh264'],
    include: [
      '@yume-chan/scrcpy-decoder-tinyh264 > yuv-buffer',
      '@yume-chan/scrcpy-decoder-tinyh264 > yuv-canvas',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer/src'),
    },
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
