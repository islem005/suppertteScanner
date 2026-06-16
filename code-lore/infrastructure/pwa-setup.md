# PWA Setup

## Shared Service Worker (`sw.js`)

Used by both the scanner and dashboard apps. Single SW for the whole `ivond.com` domain.

- **Cache name:** `shelf-scanner-{buildTimestamp}` (auto-injected by `build-frontend.mjs` — unique per deploy)
- **Strategy:** Network-first with cache fallback (navigate requests), cache-first with network update (static assets)
- **No-cache:** The frontend Worker serves `sw.js` with `Cache-Control: no-store, no-cache` headers to prevent edge cache staleness. The SW is excluded from Workers Assets cache in the Worker fetch handler.

### Install
- Pre-caches offline fallback page only
- Does NOT call `skipWaiting()` — waits for a `SKIP_WAITING` message from the client

### Activate
- Deletes all caches not matching the current `CACHE` name
- Calls `self.clients.claim()` to take control of all clients
- Broadcasts `{type: 'RELOAD'}` to all clients via `postMessage` — triggers a page reload with a toast notification

### Message Handler
- `{type: 'SKIP_WAITING'}` — calls `self.skipWaiting()` (sent by client when a new SW is detected)

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
- **Cache version auto-bumping:** `build-frontend.mjs` injects `Date.now()` into the `__BUILD_TS__` placeholder. Every deploy creates a unique cache name; the activate handler deletes all caches not matching the current version.

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
  navigator.serviceWorker.register('/sw.js').then(reg => {
    // Force update check on every page load
    reg.update();
    // When a new SW is found, ask it to skip waiting
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (sw) {
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });
  }).catch(() => {});
  // Listen for reload signals from the SW
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'RELOAD') {
      window.showToast('App updated');
      setTimeout(() => window.location.reload(), 500);
    }
  });
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

---

## Auto-Update Flow

When a new version is deployed:

1. User loads any page — `registration.update()` forces SW byte-check
2. If `sw.js` changed (even 1 byte diff), a new SW installs
3. New SW reaches `installed` state — client sends `SKIP_WAITING` message
4. New SW activates → claims all clients → deletes old caches → broadcasts `RELOAD`
5. Each client shows "App updated" toast, then reloads after 500ms
6. Reloaded page uses fresh SW + fresh assets (Vite content-hashed filenames ensure no stale cache hits)

No user intervention required at any step. The entire cycle takes ~1-2 seconds after the first page load post-deploy.
