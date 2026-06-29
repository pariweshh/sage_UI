import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The browser talks only to this same origin; Vite proxies /api to the
    // loopback backend, so there are no CORS holes and no provider keys here.
    // Port mirrors `apiPort` in ../sage/sage.config.json (default 8787).
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      // the Phase 2 voice channel; ws:true upgrades the proxied connection
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
})
