# Build Tooling — Vite Config

## Overview

The project uses Vite for MPA (multi-page application) builds. Vite is NOT used for serving in the deployed-only workflow — only for the production build (`npm run build` → `dist/`).

## Multi-Page Entry Points (`vite.config.js`)

```js
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),
      scanner: resolve(__dirname, 'scanner.html'),
      scannerTest: resolve(__dirname, 'scanner-test.html'),
      dashboard: resolve(__dirname, 'dashboard/index.html'),
      admin: resolve(__dirname, 'admin/index.html'),
      auth: resolve(__dirname, 'auth/index.html')
    }
  }
}
```

Six entry points: home/index, scanner, scanner-test (debug page for wasm fallback), dashboard, admin, auth.

## Slug Router Plugin

A custom Vite plugin runs only in `configureServer` (dev mode). It intercepts all non-GET/non-HEAD requests and unknown paths, serving `scanner.html` for store subdomain paths like `/{slug}`.

**Known paths** (passed through to normal Vite handling):
- `/`, `/index.html`, `/scanner.html`
- `/home/*`, `/dashboard/*`, `/admin/*`
- `/assets/*`, `/js/*`, `/css/*`
- `/auth/*`, `/api/*`
- `/favicon.ico`, `/manifest.json`, `/sw.js`
- Vite internal paths: `/@vite/*`, `/@fs/*`, `/node_modules/*`

**All other paths** → serve `scanner.html` (for store slug routes).

## SSL (Dev Only)

```js
server: {
  https: {
    key: readFileSync(resolve(__dirname, 'certs/localhost-key.pem')),
    cert: readFileSync(resolve(__dirname, 'certs/localhost.pem'))
  }
}
```
- Requires local SSL certs in `certs/` directory
- Generated via `npm run certs` or equivalent

## API Proxy (Dev Only)

```js
proxy: {
  '/api': {
    target: 'http://localhost:3002',
    changeOrigin: true
  }
}
```
- Proxies all `/api/*` requests to the local `wrangler dev` instance on port 3002
- Not used in production (Cloudflare's Worker route handles `/api/*`)

## sw.js Exclusion

`/sw.js` is listed in `isKnownPath()` so Vite doesn't hash its filename or apply transforms. This ensures the service Worker filename remains stable across builds.

## Build Output

`npm run build` outputs to `dist/`:
```
dist/
├── index.html
├── scanner.html
├── scanner-test.html
├── dashboard/
│   └── index.html
├── admin/
│   └── index.html
├── auth/
│   └── index.html
├── assets/          # hashed JS/CSS/other assets
├── js/              # copied static JS
├── css/             # copied static CSS
└── sw.js            # copied as-is
```

## npm Dependencies Bundled by Vite

Some previously CDN-loaded libraries are now npm dependencies bundled by Vite:

| Package | Version | Used In |
|---------|---------|---------|
| `swiper` | ^12.2.0 | Scanner app carousels (banners, offers, discounts) |
| `zxing-wasm` | ^3.1.0 | Scanner fallback (BarcodeDetector alternative) |

### Swiper Import Pattern
```js
import Swiper from 'swiper';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
```

### zxing-wasm Import Pattern
```js
import { readBarcodesFromImageData, prepareZXingModule } from 'zxing-wasm/reader';
```
