import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      // xlsx.mjs (the package "module" entry) contains Flow type annotations
      // with an unterminated block comment that Rollup cannot parse. Alias
      // to the CommonJS build (xlsx.js) which Vite can transform cleanly.
      xlsx: fileURLToPath(new URL('./node_modules/xlsx/xlsx.js', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
      },
    },
  },
})