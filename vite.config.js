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
        // Keep local Functions development opt-in. When the Functions host is
        // not running, proxying to localhost produces ECONNREFUSED for every
        // Cashflow request. The deployed API is a usable default for the
        // frontend dev server; set VITE_DEV_API_PROXY_TARGET to localhost:7071
        // when running `func start` locally.
        target: process.env.VITE_DEV_API_PROXY_TARGET
          || 'https://func-ofs-carrer-001-dzd4h9andncbhfha.southindia-01.azurewebsites.net',
        changeOrigin: true,
      },
    },
  },
})