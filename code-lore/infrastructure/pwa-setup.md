# PWA Setup

## Shared Service Worker (`sw.js`)

Used by both the scanner and dashboard apps. Single SW for the whole `ivond.com` domain.

- **Cache name:** `shelf-scanner-v5`
- **Strategy:** Network-first with cache fallback (navigate requests), cache-first with network update (static assets)

### Install
```js
self.skipWaiting()  // Activate immediately
```

### Activate
- Deletes all caches not matching the current `CACHE` name
- Calls `self.clients.claim()` to take control of all clients

### Fetch Interception
```
on GET request:
  if navigate mode:
    fetch from network → cache response (clone) → return response
    on network failure → serve cached offline page
  else (static asset):
    serve from cache first → if miss, fetch from network → cache response → return
```
- Non-GET requests pass through untouched
- Offline fallback page: `/offline.html`

---

## Scanner Web Manifest (`manifest.json`)

```json
{
  "name": "SKANER",
  "short_name": "SKANER",
  "description": "SKANER by ivond — instant in-store barcode scanning",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0c0c0d",
  "theme_color": "#0c0c0d",
  "icons": [
    { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icons/icon-192.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

---

## Dashboard Web Manifest (`dashboard/manifest.json`)

```json
{
  "name": "SKANER Dashboard",
  "short_name": "SKANER",
  "description": "SKANER Dashboard by ivond — Manage your store products, branding, analytics, and scan data.",
  "start_url": "/dashboard/",
  "display": "standalone",
  "background_color": "#0c0c0d",
  "theme_color": "#0c0c0d",
  "icons": [
    { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icons/icon-192.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

---

## Service Worker Registration

In **`scanner.html`** and **`dashboard/index.html`**:
```html
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
</script>
```

Scanner also dynamically loads a per-store manifest from `/api/manifest?slug=...` for subdomain support.

---

## PWA Install Flow

### Scanner (`js/app.js`)
1. **`beforeinstallprompt` listener** captures the event and prevents the default mini-infobar
2. **Install button** (`#btn-install`) handles four cases:
   - **iOS** (detected via userAgent): shows toast "Tap Share → Add to Home Screen"
   - **Already installed** (`display-mode: standalone`): toast "Already installed"
   - **No deferred prompt yet**: toast "Visit a few times, then install will be ready"
   - **Prompt available**: fires `deferredPrompt.prompt()`, waits for `userChoice`
3. **`appinstalled` listener**: clears deferredPrompt, shows "App installed!" toast

### Dashboard (`dashboard/js/app.js`)
- Same flow as scanner, but uses `#btn-install-dash` button in the sidebar (`#sidebar-user` section)
- Button is hidden (`display:none`) until `beforeinstallprompt` fires
- See `dashboard/js/app.js` for the implementation
