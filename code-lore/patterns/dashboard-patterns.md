# Dashboard Patterns

## Overview

The dashboard SPA (`dashboard/index.html`, `dashboard/js/app.js`) is the store management interface for managers and staff. It runs at `/dashboard/` and requires a valid Better Auth session.

---

## App Structure

### Auth Flow (see `auth-flow.md` for full details)
- On load: checks `localStorage` for cached user, then verifies session via `GET /api/auth/user`
- If invalid: redirects to `/auth/`
- On logout: `POST /api/auth/sign-out`, clears localStorage, redirects to `/auth/`

### Sidebar Navigation
- Nav items depend on user role. **Managers/admins** see: Overview, Analytics, Products, Offers, Discounts, Branding, Activity, Profile, Team, Audit Log. **Associates** see: Overview, Products, Offers, Discounts, Activity, Profile (no Analytics, Branding, Team, Audit Log).
- Nav built dynamically from `navItems` array with Feather icons + i18n labels
- Active nav item highlighted via left border accent
- Sidebar toggle on mobile: `btn-toggle-sidebar` opens overlay, backdrop click closes
- Navigation closes sidebar on mobile automatically

### View Routing
- Hash-based routing (`location.hash`)
- Each view is a `.dash-view` element toggled by `showDashView(id)`
- Initial view from hash or defaults to `overview`
- `window.addEventListener('hashchange', ...)` for back/forward support

---

## Views

### Overview
- Date display, stat cards (total scans, today's scans, product count)
- Top scanned products table
- Public store link
- Data from: `API.getStore()`, `API.getScanStats()`, `API.getProducts()`

### Products
- Product table: barcode (monospace), name, price (DA), category, delete button
- Search filter: filters by barcode or name on input
- Delete with inline `deleteProduct(id)` function
- Data from: `API.getProducts()`

### Upload / Import Flow
1. User clicks "Upload Data" → file picker opens
2. Supported formats: `.csv`, `.xlsx`, `.xls`, `.db`, `.sqlite`, `.sqlite3`, `.json`
3. File is read as base64 and uploaded via `API.uploadImport(content, filename)`
4. **If auto-mapped** (mapping exists): shows verification preview modal with mapping details + first product preview + confirm button
5. **If pending** (no mapping): toast "File submitted to admin for mapping review"
6. On confirm: `API.confirmImport(id)` → imports products → refreshes product list

### Offers (Promotions)
- Table of offers (type: `offer`) for the store
- Each offer: image thumbnail, title, trigger (category/product/default), active status
- CRUD via modal: New/Edit offer with image crop, title, trigger type/value, active toggle
- Delete with confirmation modal
- Image cropped via `cropImage()` at 400x200 (2:1 ratio)

### Discounts
- Table of discount items: image, name, barcode, category, price (strikethrough + new), discount %, featured star, active
- CRUD modal with:
  - Image picker + crop at 300x400 (3:4 ratio) with camera capture support
  - Discount type: percentage off or fixed price (toggle fields dynamically)
  - Live price preview showing strikethrough + new price + % badge
  - Barcode (optional) and category for scan matching
  - Featured + Active checkboxes
- Delete with confirmation modal

### Branding
- Phone mockup preview that updates live on input changes
- Fields: display name, logo (file picker with resize to 300px max), primary color, accent color, contact email/phone, footer text
- Social links: Instagram, TikTok, Website, Facebook, Twitter, YouTube
- Preview updates: logo, name, social links visibility, primary/accent colors on the mockup
- Save: `API.updateBranding()`, shows success/error message

### Activity
- Top scanned products for the store
- Each item: barcode + scan count
- Data from: `API.getScanStats()`

### Analytics
- Chart area with scan trend data (last 7/30/90 days)
- Date range picker + Export CSV button
- Data from: `API.getAnalytics()`, `API.exportAnalytics()`
- Only visible to managers/admins (blocked for associates)

### Team
- Associate user table: display name, email, delete button
- **New Associate** modal: email, password, display name
- **Delete Associate** modal: confirmation
- Data from: `API.getTeam()`, `API.createAssociate()`, `API.deleteAssociate()`
- Only visible to managers/admins

### Audit Log
- Action history table: user, action, entity, timestamp
- Paginated (50 per page) with load-more button
- Data from: `API.getAuditLog()`
- Only visible to managers/admins

### Profile
- Shows user email, display name, role (styled tag), store name
- Language switcher: English / French / Arabic buttons stored in `localStorage.lang`

---

## i18n System (`js/i18n.js`)

The `I18N` singleton handles internationalization (shared across all apps):
- **Language storage:** `localStorage.getItem('lang')` or `navigator.language` — falls back to `'en'`
- **Languages:** English (`en`), French (`fr`), Arabic (`ar`) — ~200+ keys each
- **`I18N.t(key)`** — returns translated string for current language, falls back to key
- **`I18N.setLang(l)`** — sets language and saves to localStorage
- **`I18N.applyHtml()`** — processes all `[data-i18n]` elements on the page
- Language switcher buttons call `I18N.setLang()` then `location.reload()`
- Arabic layout uses RTL (right-to-left) direction via `rtlLangs` map

### Key i18n categories
| Category | Keys |
|---|---|
| Navigation | `navOverview`, `navProducts`, `navBranding`, `navActivity`, `navProfile`, `navOffers`, `navDiscounts`, `signOut` |
| Products | `noProducts`, `uploadData`, `supportedFormats`, `dropFile` |
| Scans | `totalScans`, `todayScans`, `scanCount`, `productCount`, `topProducts` |
| Branding | `saveBranding`, `brandingSaved` |
| Import | `uploading`, `uploadSuccess`, `confirmImport`, `importConfirmed`, `mappingRequired`, `verifyImport`, `looksGoodImport`, `fileSubmittedToAdmin` |
| Offers | `newOffer`, `editOffer`, `deleteOffer`, `saveOffer`, `offerSaved`, `noOffers` |
| Discounts | `newDiscount`, `editDiscount`, `deleteDiscount`, `saveDiscount`, `discSaved`, `noDiscounts`, `discBarcode`, `discName`, `discPercent`, `discFixed` |
| General | `delete`, `cancel`, `confirm`, `edit`, `errorPrefix` |

---

## Shared Utilities

### API Client (`dashboard/js/api.js`)
- Singleton `API` object with typed methods for every endpoint
- Base URL: `localStorage.getItem('api_base') || '/api'`
- Auto-redirects to `/auth/` on 401
- Methods: `login`, `register`, `getStores`, `createStore`, `getStore`, `getProducts`, `getProductByBarcode`, `uploadCsv`, `deleteProduct`, `getScanStats`, `getAnalytics`, `exportAnalytics`, `getBranding`, `updateBranding`, `getAdminStats`, `getAdminUsers`, `createUser`, `deleteUser`, `getAdminActivity`, `uploadImport`, `getStoreImports`, `getImport`, `getImportPreview`, `previewMappedImport`, `confirmImport`, `getMapping`, `getStorePromotions`, `getPromotion`, `createPromotion`, `updatePromotion`, `deletePromotion`, `getBanner`, `getDiscounts`, `getDiscount`, `createDiscount`, `updateDiscount`, `deleteDiscount`, `getTeam`, `createAssociate`, `deleteAssociate`, `getAuditLog`, `uploadImage`

### Modal (`window.showModal`)
- Shared modal overlay with title, body HTML, and optional confirm callback
- Danger mode: "Delete" button with `.btn-danger` styling
- Close on overlay click

### Toast (`showToast`)
- Creates `#toast` element if not present
- Shows message for 2s, then fades

### Helpers
- `esc(str)` — HTML entity escape via `document.createElement('div').textContent`
- `$(id)` — `document.getElementById()` shorthand with console warning
