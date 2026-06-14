import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function isKnownPath(url) {
  const path = url.split('?')[0]
  return (
    path === '/' || path === '' ||
    path === '/scanner.html' ||
    path === '/scanner-qr.html' ||
    path === '/scanner-test.html' ||
    path === '/index.html' ||
    path.startsWith('/home/') ||
    path.startsWith('/dashboard') ||
    path.startsWith('/admin') ||
    path.startsWith('/assets/') ||
    path.startsWith('/@vite/') ||
    path.startsWith('/@fs/') ||
    path.startsWith('/node_modules/') ||
    path.startsWith('/js/') ||
    path.startsWith('/css/') ||
    path === '/favicon.ico' ||
    path === '/manifest.json' ||
    path === '/sw.js' ||
    path.startsWith('/auth/') ||
    path.startsWith('/api/')
  )
}

export default defineConfig({
  plugins: [
    {
      name: 'slug-router',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()
          if (isKnownPath(req.url)) return next()
          try {
            const html = readFileSync(resolve(__dirname, 'scanner.html'), 'utf-8')
            res.setHeader('Content-Type', 'text/html')
            res.end(html)
          } catch (e) { next(e) }
        })
      }
    }
  ],
  server: {
    host: true,
    https: {
      key: readFileSync(resolve(__dirname, 'certs/localhost-key.pem')),
      cert: readFileSync(resolve(__dirname, 'certs/localhost.pem'))
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3002',     // DEV: proxies API to wrangler dev (Workers + D1)
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        scanner: resolve(__dirname, 'scanner.html'),
        scannerQr: resolve(__dirname, 'scanner-qr.html'),
        scannerTest: resolve(__dirname, 'scanner-test.html'),
        dashboard: resolve(__dirname, 'dashboard/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        auth: resolve(__dirname, 'auth/index.html')
      }
    }
  }
})
