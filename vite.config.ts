import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev only: serve the self-hosted onnxruntime-web loader (public/onnx-wasm/*.mjs) RAW. The Silero
// VAD's runtime `import()` of that .mjs otherwise gets `?import`-transformed by Vite and 500s. In a
// production build, public/ is copied out and served raw already, so this middleware is dev-only.
function serveOnnxMjsRaw(): Plugin {
  return {
    name: 'serve-onnx-mjs-raw',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (path.startsWith('/onnx-wasm/') && path.endsWith('.mjs')) {
          try {
            const body = readFileSync(join(process.cwd(), 'public', path))
            res.setHeader('Content-Type', 'text/javascript')
            res.end(body)
            return
          } catch {
            /* fall through to Vite's default handling */
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveOnnxMjsRaw()],
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
