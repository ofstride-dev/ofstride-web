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
        // Local development must use the local Functions host by default. Do
        // not silently send localhost authentication/data requests to a
        // potentially stale deployed API. Set VITE_DEV_API_PROXY_TARGET to a
        // remote host explicitly when remote verification is intended.
        target: process.env.VITE_DEV_API_PROXY_TARGET
          || 'http://127.0.0.1:7071',
        changeOrigin: true,
      },
    },
  },
})