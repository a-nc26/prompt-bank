import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Build one HTML file to paste into Apps Script (works with "Within my org")
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist-embed',
    emptyOutDir: true,
  },
  define: {
    'import.meta.env.VITE_EMBEDDED': JSON.stringify('true'),
  },
})
