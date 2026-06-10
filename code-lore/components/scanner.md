# Scanner App Components & UX

## Overview

The scanner app (`js/app.js`, `js/scanner.js`, `scanner.html`) is a PWA that runs at `/{slug}` or `{store}.ivond.com`. It provides continuous barcode scanning using the `BarcodeDetector` API.

---

## Scanner Engine (`js/scanner.js`)

A singleton `Scanner` module that wraps the native `BarcodeDetector` API with a **zbar-wasm fallback** for Firefox.

### Init
```js
const result = await Scanner.init()
```
- If `'BarcodeDetector' in window` — creates native detector with formats: `qr_code, ean_13, ean_8, code_128, code_39, code_93, codabar, itf, upc_a, upc_e, data_matrix, aztec, pdf417`
- Otherwise — dynamically imports `zbar-wasm` from CDN, creates a hidden canvas for frame capture
- Requests camera via `getUserMedia` with `facingMode: 'environment'`, resolution `1280x720`
- Returns `{ ok: false, error }` if both decoder and camera fail

### Start / Stop
```js
Scanner.start(videoElement, onBarcodeCallback)
Scanner.stop()
```
- `start()` sets the video source, plays it, and begins the detection loop
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

### Promotion Carousels (Swiper.js)
- **Banner carousel:** `#banner-carousel` — Swiper with loop + autoplay (5s delay), pagination dots
- **Discount/offer carousel:** `#discount-track` — Swiper with `slidesPerView: 3`, loop if 5+ items, autoplay 5s
- Uses inline Swiper.js (loaded from CDN in HTML)

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
| State | `#cam-name` text | Class |
|---|---|---|
| Loading | "Starting camera…" | — |
| Camera available | "Camera ready" | — |
| Camera unavailable | "Camera unavailable" | `.hint` |
| Product found | Product name | — |
| Product not found | "Unknown product" | `.hint` |
| Restarting | "Restarting camera…" | — |

---

## Scanner HTML Structure (`scanner.html`)

Key elements referenced by the scanner app:
- `#camera-feed` — video element for camera preview
- `#scan-frame` — corner-bracket overlay
- `#scan-line` — animated scan line
- `#cam-name` / `#cam-price` — scan result text
- `#btn-torch` — torch toggle
- `#btn-install` — PWA install button
- `#btn-menu` / `#panel-overlay` / `#results-panel` — slide-up results panel
- `#profile-logo`, `#profile-name`, social link elements — store branding
- `#banner-carousel`, `#discount-track` — promotion carousels
- `#promo-content`, `#promo-image` — triggered offers
- `#toast` — notification
