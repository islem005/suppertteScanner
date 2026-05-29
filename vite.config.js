import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function isKnownPath(url) {
  const path = url.split('?')[0]
  return (
    path === '/' || path === '' ||
    path === '/scanner.html' ||
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
    basicSsl(),
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
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        scanner: resolve(__dirname, 'scanner.html'),
        dashboard: resolve(__dirname, 'dashboard/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        auth: resolve(__dirname, 'auth/index.html')
      }
    }
  }
})
