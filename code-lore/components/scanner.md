# Scanner App Components & UX

## Overview

The scanner app (`js/app.js`, `js/scanner.js`, `js/scanner-core.js`, `scanner.html`) is a PWA that runs at `/{slug}` or `{store}.ivond.com`. It provides continuous barcode scanning.

- `js/scanner-core.js` — Shared camera + barcode detection logic (exposed as `window.scannerCore`)
- `js/scanner.js` — Scanner UI module wrapping scannerCore with app-specific behavior
- `offline.html` — Fallback page shown when the device is offline

---

## zxing-wasm Fallback (`js/zxing-module.js`)

When `BarcodeDetector` is unavailable, the scanner dynamically imports zxing-wasm:

```js
// In js/scanner.js — fallback initialization
const { detectFromCanvas } = await import('./zxing-module.js');
fallbackCanvas = document.createElement('canvas');
fallbackDetect = async (video) => {
  const scale = Math.min(640 / video.videoWidth, 480 / video.videoHeight, 1);
  fallbackCanvas.width = Math.round(video.videoWidth * scale) || 1;
  fallbackCanvas.height = Math.round(video.videoHeight * scale) || 1;
  const ctx = fallbackCanvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(video, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
  return detectFromCanvas(fallbackCanvas);
};
```

### Module API (`js/zxing-module.js`)
```js
// Initialize with wasm file location
prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => {
      if (path.endsWith('.wasm')) return '/wasm/zxing_reader.wasm';
      return prefix + path;
    }
  }
});

export async function detectFromCanvas(canvas)      // Canvas → ImageData → detect
export async function detectFromImageData(imageData, opts?)  // Raw ImageData, for test pages
```

- Wasm file: `public/wasm/zxing_reader.wasm` (served at `/wasm/zxing_reader.wasm`)
- npm package: `zxing-wasm@^3.1.0`
- Fallback runs at 3 FPS with scaled canvas (max 640×480, maintaining aspect ratio)

## Scanner Engine (`js/scanner.js`)

A singleton `Scanner` module with multi-layer fallback:
1. **Native `BarcodeDetector`** (Chrome, Edge, Samsung, Safari 16.4+)
2. **zxing-wasm fallback** (local npm module, bundled via Vite)
3. **Manual barcode input** — always available as a fallback in the UI

### Init
```js
const result = await Scanner.init()
// => { ok: bool, hasDecoder: bool, error?: string }
```
- Tries native `BarcodeDetector` first
- If not available, dynamically imports `./zxing-module.js` (zxing-wasm npm package)
- Creates a reusable off-screen canvas for frame capture
- If both decoders fail, `hasDecoder: false` — camera still starts for preview
- Always requests camera via `getUserMedia` (facingMode: environment, 1280x720)
- Returns `{ ok: false, error }` only if camera itself fails

### Start / Stop
```js
Scanner.start(videoElement, onBarcodeCallback)
Scanner.stop()
```
- `start()` sets the video source, plays it; only begins the detection loop if a decoder exists
- Without a decoder, `start()` shows the camera feed but never calls `scheduleDetect()`
- `stop()` clears the timeout, stops all tracks, resets state

### Detection Loop (`scheduleDetect`)
- Target: 3 FPS (`FRAME_INTERVAL = 333ms`)
- Calls `detector.detect(videoEl)` in a loop via `setTimeout`
- Dynamically adjusts delay based on actual detection time: `Math.max(0, FRAME_INTERVAL - elapsed)`

### Throttling
- `SCAN_THROTTLE = 1200ms` — same barcode won't fire again within 1.2s
- `lastResults` array (max 20 entries) tracks recent barcodes
- Also gates on `lastResultTime` to prevent repeated scans

### Torch Control
```js
const isOn = await Scanner.toggleTorch()
const supported = Scanner.isTorchSupported()
```
- `toggleTorch()` checks `track.getCapabilities().torch` first
- Applies `{ advanced: [{ torch: bool }] }` constraint
- Returns new torch state (`true`/`false`)

### Restart (Tap to Refresh)
```js
const result = await Scanner.restart(video, onBarcode)
```
- Stops current camera + loop
- Re-acquires camera stream
- Restarts detection
- Used by the "tap camera to refresh" feature when the feed freezes

---

## Scanner App UX (`js/app.js`)

### Boot Sequence
1. Replace Feather icons
2. Detect store slug from hostname (priority) or path (fallback)
3. Fetch store info + branding
4. Apply branding colors via CSS custom properties on `document.documentElement`
5. Load promotions (banners, offers, discounts)
6. Initialize and start scanner

### Store Slug Detection
- **Priority 1:** If hostname is `*.ivond.com` (not `ivond.com`, `admin.`, `www.`), slug is `hostname.split('.')[0]`
- **Priority 2:** Extract from URL path (backward compat)

### Branding Application
- Fetches `GET /api/branding/{storeId}`
- Sets `--color-primary` and `--color-success` on `<html>` style
- Shows logo (`profile-logo`), display name, social links (Instagram, TikTok, Website, Email, Phone, Facebook, Twitter, YouTube)

### Promotion Carousels (Swiper.js — bundled locally)
- Imported as ES module via npm (`swiper` package, bundled by Vite):
```js
import Swiper from 'swiper';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
```
- **Banner carousel:** `#banner-carousel` — Swiper with loop + autoplay (5s delay), pagination dots
- **Discount/offer carousel:** `#discount-track` — Swiper with `slidesPerView: 3`, loop if 5+ items, autoplay 5s
- Carousels are destroyed and recreated when data changes (e.g., after idle refresh)

### Idle Detection
- `checkIdle()` runs every 10s via `setInterval`
- If no scan in 30s and discounts exist, refreshes featured discounts from API
- Keeps the discount carousel fresh during idle periods

### Barcode Result Display
When a barcode is detected:
1. Fetches `GET /api/lookup/{slug}?barcode=...` for product info
2. Posts scan event: `POST /api/scans` with `{ store_slug, barcode }`
3. Vibrates device: `navigator.vibrate(30)`
4. Shows result in `#cam-name` and `#cam-price`:
   - **Found:** product name + price (with discount strikethrough if applicable)
   - **Not found:** "Unknown product" hint + raw barcode
   - **No store:** toast with "Scanned: {code}"

### Discount Matching on Scan
- After finding a product, checks for barcode-matched discounts: `GET /api/discounts/{storeId}?barcode=...`
- Also checks category-matched discounts: `GET /api/discounts/{storeId}?category=...`
- If matched, shows strikethrough original price + discounted price

### Tap to Refresh Camera
- Clicking `#camera-feed` calls `Scanner.restart()`
- Shows "Restarting camera…" then "Camera ready" or "Camera unavailable"
- Shows "Camera refreshed" toast on success

### PWA Install Flow
See `code-lore/infrastructure/pwa-setup.md` for full details.
- `beforeinstallprompt` listener captures deferred prompt
- `btnInstall` click handler:
  - **iOS detected:** toast "Tap Share → Add to Home Screen"
  - **Already standalone:** toast "Already installed"
  - **No prompt yet:** toast "Visit a few times, then install will be ready"
  - **Prompt available:** fires `deferredPrompt.prompt()`

### Camera View States
| State | `#cam-name` text | `#camera-feed` | `#manual-entry` |
|---|---|---|---|
| Camera + decoder OK | "Point camera at barcode" | visible | hidden |
| Camera OK, no decoder | "Auto-scan unavailable — enter barcode below" | visible | visible |
| Camera unavailable | `result.error` (e.g. "Camera not available.") | hidden | visible |
| Product found | Product name | visible | hidden |
| Product not found | "Unknown product" | visible | hidden |
| Restarting | "Restarting camera…" | visible | — |

---

---

## Browser Detection & Routing (`frontend-worker/src/index.js`)

The frontend Worker handles three cases for store subdomains:

### 1. Chrome-Only Enforcement for Android
Non-Chrome Android browsers get a Chrome-required interstitial:

```js
if (/android/.test(ua) && !/chrome/.test(ua)) {
  // Returns inline HTML with "Open in Chrome" prompt
  // Uses Android intent:// scheme for deep link to Chrome
}
```

- Rationale: zbar-wasm fallback was unreliable; zxing-wasm requires modern Chrome on Android
- Shows a styled interstitial with Chrome logo, explanation text, and `intent://` deep link button
- Manual URL copy fallback text included

### 2. Desktop → QR Interstitial (`scanner-qr.html`)
When a store subdomain is opened on a desktop/laptop:

```js
const ua = (request.headers.get('User-Agent') || '').toLowerCase()
const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua)
const page = isMobile ? '/scanner.html' : '/scanner-qr.html'
```

- Tablets (iPad) are treated as mobile — the scanner works on them
- Desktop/laptop users see a QR code they can scan with their phone

### 3. Mobile → Scanner PWA
Mobile Chrome users get `scanner.html` with full barcode scanning capability.

### Page Structure

- Minimal page (~5.6 kB built, ~2 kB gzipped)
- No camera init, no Swiper, no feather-icons, no service worker, no CDN dependencies
- QR code is generated server-side (via `api/src/qr.js` using the `qrcode` npm package), stored in R2 at `qr/{slug}.svg`
- The page loads the QR from `<img src="/api/files/qr/{slug}.svg">` — the API Worker auto-generates it on first request if missing
- Fetches store branding (`/api/stores/slug/{slug}` + `/api/branding/{id}`) to display store name + logo
- Shows a centered QR image wrapped in a white card, with "Scan this QR code with your phone to visit our store" instruction text
- Clickable "SKANER by ivond" branding link at the bottom

### QR Generation (`api/src/qr.js`)

```js
import QRCode from 'qrcode'
export async function generateStoreQR(env, slug) /* -> R2 at qr/{slug}.svg */
export async function deleteStoreQR(env, slug)   /* -> deletes from R2 */
```

Triggered automatically:
- On store creation (`POST /api/stores` in `stores.js`, registration approval in `registrations.js`)
- On slug change (`PUT /api/stores/:id` in `stores.js` — old QR deleted, new one generated)
- On first request via files route fallback (`api/src/routes/files.js` — if `qr/{slug}.svg` not found in R2, generates it on the fly)
- Admin can bulk backfill via `POST /api/admin/qr/backfill`

### Key Files

- `scanner-qr.html` — the QR interstitial page
- `scanner-test.html` — standalone debug page for wasm fallback pipeline (see `patterns/debugging.md`)
- `frontend-worker/src/index.js` — handles desktop/mobile routing + Chrome enforcement for store subdomains
- `api/src/qr.js` — QR generation helper (SVG → R2)
- `api/src/routes/files.js` — on-the-fly QR generation fallback
- `api/src/routes/stores.js` — QR gen on store create/slug change
- `api/src/routes/registrations.js` — QR gen on registration approval
- `api/src/routes/admin.js` — QR backfill endpoint

## Scanner HTML Structure (`scanner.html`)

Key elements referenced by the scanner app:
- `#camera-feed` — video element for camera preview
- `#cam-name` / `#cam-price` — scan result text
- `#manual-entry` — manual barcode input bar (shown when camera/decoder unavailable)
- `#manual-barcode` — text input for manual barcode entry
- `#btn-manual-submit` — submit button for manual entry
- `#scan-frame` — corner-bracket overlay
- `#scan-line` — animated scan line
- `#btn-torch` — torch toggle
- `#btn-install` — PWA install button
- `#btn-menu` / `#panel-overlay` / `#results-panel` — slide-up results panel
- `#profile-logo`, `#profile-name`, social link elements — store branding
- `#banner-carousel`, `#promo-carousel`, `#discount-track` — promotion carousels
- `#promo-content`, `#promo-image` — triggered offers
- `#toast` — notification
