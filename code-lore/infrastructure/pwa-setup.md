# PWA Setup

## Service Worker (`sw.js`)

- **Cache name:** `shelf-scanner-v3`
- **Strategy:** Cache-first with network update (stale-while-revalidate pattern)

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
  fetch from network → cache response (clone) → return response
  on network failure → serve from cache
```
- Non-GET requests pass through untouched
- No pre-caching of assets — cache is populated on first visit

---

## Web Manifest (`manifest.json`)

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

## Service Worker Registration

In `scanner.html`:
```html
<script>
// Manifest is loaded dynamically from /api/manifest?slug=... for subdomain support
fetch(`/api/manifest?slug=${storeSlug}`).then(...)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
</script>
```

---

## PWA Install Flow (in `js/app.js`)

1. **`beforeinstallprompt` listener** captures the event and prevents the default mini-infobar
2. **Install button** (`#btn-install`) handles four cases:
   - **iOS** (detected via userAgent): shows toast "Tap Share → Add to Home Screen"
   - **Already installed** (`display-mode: standalone`): toast "Already installed"
   - **No deferred prompt yet**: toast "Visit a few times, then install will be ready"
   - **Prompt available**: fires `deferredPrompt.prompt()`, waits for `userChoice`
3. **`appinstalled` listener**: clears deferredPrompt, shows "App installed!" toast
