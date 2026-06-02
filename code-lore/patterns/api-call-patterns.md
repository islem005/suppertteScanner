# API Call Patterns

## API Client Structure

Both dashboard and admin use a shared module pattern: `const API = (() => { ... })()`.

### Base URL

```js
const BASE = localStorage.getItem('api_base') || '/api'
```

This allows overriding the base URL via `localStorage` for testing with a different backend.

### Request Function

Every request flows through a single `req()` function:

```js
async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'     // ← cookie-based auth via Better Auth
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)

  // Auto-redirect on 401
  if (res.status === 401) {
    localStorage.removeItem('user')
    window.location.href = '/auth/'  // or '/admin/' for admin API
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
```

### Convenience Methods

```js
function get(path)   { return req('GET', path) }
function post(path, body) { return req('POST', path, body) }
function put(path, body)  { return req('PUT', path, body) }
function del(path)   { return req('DELETE', path) }
```

### Endpoint Categories

Endpoints are grouped by resource:
- **Auth**: `signIn`, `signUp`, `signOut`, `getSession`
- **Stores**: `getStores`, `createStore`, `getStore`, `getStoreBySlug`
- **Products**: `getProducts`, `deleteProduct`
- **Scans**: `getScanStats`
- **Branding**: `getBranding`, `updateBranding`
- **Admin**: `getAdminStats`, `getAdminUsers`, `createUser`, `deleteUser`, `getAdminActivity`
- **Imports**: `uploadImport`, `getStoreImports`, `getImportPreview`, `confirmImport`, `getMapping`, `saveMapping`, `deleteMapping`, `mapImport`, `testImport`, `verifyImport`, `rejectImport`
- **Promotions**: `getStorePromotions`, `getPromotion`, `createPromotion`, `updatePromotion`, `deletePromotion`, `getBanner`, `getOffers`
- **Discounts**: `getDiscounts`, `getDiscount`, `createDiscount`, `updateDiscount`, `deleteDiscount`
- **Cf-Access**: `cfAccessLogin` (admin only, behind Cloudflare Access)

### Differences Between API Clients

The **admin** API client (`admin/js/api.js`) has additional methods not in the dashboard:
- `getPendingImports()`
- `mapImport()`, `remapImport()`, `testImport()`, `verifyImport()`, `rejectImport()`
- `saveMapping()`, `deleteMapping()`
- `del()` — direct DELETE passthrough for custom paths
- `getOffers()`
- `cfAccessLogin()`

## Scanner App API Calls

The scanner app (`js/app.js`) uses direct `fetch()` calls rather than a shared API module:

```js
// Pattern: try/catch around every fetch, silent catch on non-critical calls
try {
  const res = await fetch(`${apiBase}/stores/slug/${storeSlug}`)
  const store = await res.json()
  // use store...
} catch {
  showToast('Store not found')
}
```

## Key Conventions

1. **Always use `credentials: 'include'`** for authenticated requests (Better Auth uses cookies)
2. **Always wrap in try/catch** with user-facing error messages via `showToast()` or inline error elements
3. **Never use inline `fetch()` in dashboard/admin** — always go through the `API` module
4. **The `del` method name** avoids conflict with the `delete` keyword; it's `del` in both API clients
