# SKANER by ivond — Complete Project Overview

## What It Is

SKANER is a SaaS barcode scanning platform on Cloudflare's free tier. Stores publish product catalogs; customers visit `{store}.ivond.com` on their phone, point at a barcode, and see the name and price instantly.

**Three apps in one:**
- **Scanner PWA** (`{store}.ivond.com`) — Public-facing, continuous barcode scanning via `BarcodeDetector` API
- **Dashboard** (`ivond.com/dashboard/`) — Store management for managers/staff (products, branding, promotions, discounts, activity)
- **Admin Panel** (`admin.ivond.com`) — Platform administration (stores, users, all stores' branding/promotions/discounts, file import mapping)

## Architecture

```
*.ivond.com       ─┐
ivond.com         ─┼─→  Cloudflare Worker (scanner-frontend)  ─→  Workers Assets
www.ivond.com     ─┘
admin.ivond.com   ─┤
                    │
*.ivond.com/api/* ─┐
ivond.com/api/*   ─┼─→  Cloudflare Worker (scanner-api)  ─→  Hono + D1
www.ivond.com/api/*─┘
```

- **Frontend:** Workers Assets (deployed as `scanner-frontend` Worker) — Vite MPA build of 5 entry points: `index.html`, `scanner.html`, `dashboard/index.html`, `admin/index.html`, `auth/index.html`
- **Backend:** Hono Workers API (`scanner-api` Worker) with Better Auth + D1 + R2
- **Storage:** Cloudflare D1 (relational DB), R2 `store-catalogs` bucket (images/uploaded files)
- **Auth:** Better Auth — cookie-based sessions (`sameSite: 'none'` + `secure: true` for cross-subdomain), 4 roles (admin, manager, associate, staff)
- **Deployment:** CI/CD via GitHub Actions (push to main → build → deploy → test against production). No local dev.
- **Free tier:** Workers 100K req/day, D1 5M rows read/day, R2 10GB free

## All Features

### Scanner PWA (`scanner.html` + `js/app.js` + `js/scanner.js`)
- Continuous barcode detection via native `BarcodeDetector` API (QR, EAN-13/8, Code 128/39/93, UPC-A/E, Data Matrix, Aztec, PDF417, Codabar, ITF)
- Camera feed with corner-bracket scan frame overlay + animated scan line
- Torch/flashlight toggle (where supported)
- Front/back camera switch
- Per-store branding: logo, display name, primary/accent colors, social links (Instagram, TikTok, Website, Email, Phone, Facebook, Twitter, YouTube)
- **Slug-scoped lookup:** `GET /api/lookup/{slug}?barcode=XXX` — products filtered by store; never cross-store fallback
- Promotion carousels (Swiper.js): banners (full-width, autoplay loop) + discount/offer cards (3-per-view, autoplay)
- Discount matching on scan: barcode-matched + category-matched discounts, shows strikethrough original + discounted price
- Scan result display: product name + price overlay, or "Unknown product" hint for unmatched barcodes
- Scan history persisted in IndexedDB (`shelf-scanner` DB, `items` store) with localStorage fallback
- Slide-up results panel with item list
- PWA: Service Worker (cache-first), web manifest, install prompt with iOS/standalone/deferred handling
- Idle detection: refreshes featured discounts every 30s of inactivity
- Device vibration on scan (`navigator.vibrate(30)`)
- Tap camera to restart feed if frozen

### Dashboard (`dashboard/index.html` + `dashboard/js/app.js`)
- **Auth:** Better Auth cookie sessions; redirects to `/auth/` on 401
- **Overview:** Date display, stat cards (total scans, today's scans, product count), top scanned products table, public store link
- **Products:** Product table (barcode monospace, name, price in DA, category, delete), search filter, data from `API.getProducts()`
- **Upload/Import:** File picker (CSV, XLSX, XLS, DB/SQLite/SQLite3, JSON) → base64 upload → auto-map if mapping exists (verification preview + confirm) or submit to admin for mapping
- **Offers (Promotions):** CRUD table with image crop (400x200, 2:1), title, trigger type (category/product/default), active toggle
- **Discounts:** CRUD table with image crop (300x400, 3:4), barcode, category, discount type (percent/fixed), live price preview, featured/active toggles
- **Branding:** Phone mockup with live preview, display name, logo, primary/accent colors, contact info, footer text, 7 social links
- **Activity:** Top scanned products for this store
- **Profile:** User email, display name, role tag, store name, language switcher (English/French)
- **i18n:** `I18N` singleton with ~106 keys each for English and French, `[data-i18n]` attribute binding, `localStorage.lang` persistence

### Admin Panel (`admin/index.html` + `admin/js/app.js`)
- **Auth:** Inline login (not redirect to `/auth/`), role gate requiring `admin`, Cloudflare Access at network level
- **Overview:** Platform-wide stats (stores, users, products, today's scans, all scans), store stats table
- **Stores:** Create/delete stores, live URL preview, Explore button → Store Detail drill-in
- **Store Detail:** Stats cards, mapping card (active mapping with column summary vs not mapped), pending imports table (Preview/Map & Import/Verify/Reject buttons), import history, mapping editor modal with file preview + column selectors + live preview + test mapping
- **Users:** User table with role tags, create user (email/password/name/store/role), delete user (non-admin only)
- **Promotions (Banners + Offers):** Store selection → per-store editor: banners table (800x300 crop, GIF support, title, active), offers table (400x200 crop, title, trigger type/value, active)
- **Discounts:** Store selection → per-store editor: discount table with strikethrough price preview, image crop 300x400, discount type, featured/active
- **Branding:** Store selection → per-store branding editor (same as dashboard, admin can edit any store)
- **Activity:** Recent scan events across all stores
- **Profile:** User email, display name, role, store name

### Auth System
- **Better Auth library** with `admin` + `organization` plugins
- **Cookie-based sessions** (httpOnly `better-auth.session_token` cookie)
- **Cross-subdomain:** `sameSite: 'none'` + `secure: true` so `{store}.ivond.com` can auth against `ivond.com/api/*`
- **Dynamic CORS:** Echoes back trusted origins (`*.ivond.com`, `ivond.com`, `localhost:*`, `*.pages.dev`)
- **Middleware chain:** `loadSession` (sets user/session on context) → `authenticate` (401 if no session) → `adminOnly` (403 if not admin) → `requireStoreAccess` (admin bypass, others must match store_id)
- **Login page:** `/auth/` — shared login for dashboard, integrates with Cloudflare Access admin subdomain

### API Endpoints (all under `/api/`)
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/sign-in/email`, `POST /auth/sign-up/email`, `GET /auth/user`, `POST /auth/sign-out`, `POST /auth/cf-access` |
| Stores | `GET /stores`, `POST /stores`, `GET /stores/:id`, `GET /stores/slug/:slug` |
| Products | `GET /products`, `POST /products`, `POST /products/upload`, `DELETE /products/:id` |
| Lookup | `GET /lookup/:slug?barcode=` (public) |
| Scans | `POST /scans`, `GET /scans/stats` |
| Branding | `GET /branding/:storeId` (public), `PUT /branding/:storeId` |
| Imports | `POST /imports/upload`, `GET /imports/pending`, `GET /imports/store/:storeId`, `GET /imports/:id`, `GET /imports/:id/preview`, `POST /imports/:id/preview-mapped`, `POST /imports/:id/confirm`, `POST /imports/:id/map`, `POST /imports/:id/re-map`, `POST /imports/:id/test`, `POST /imports/:id/verify`, `POST /imports/:id/reject`, `GET /imports/mapping/:storeId`, `POST /imports/mapping/:storeId`, `DELETE /imports/mapping/:storeId` |
| Upload | `POST /upload` (multipart to R2) |
| Files | `GET /files/*` (serve from R2) |
| Admin | `GET /admin/stats`, `GET /admin/users`, `POST /admin/users`, `DELETE /admin/users/:id`, `GET /admin/activity` |
| Promotions | `GET /promotions/:storeId`, `POST /promotions/:storeId`, `PUT /promotions/:storeId/:id`, `DELETE /promotions/:storeId/:id`, `GET /promotions/:storeId/banners`, `GET /promotions/:storeId/offers` |
| Discounts | `GET /discounts/:storeId`, `POST /discounts/:storeId`, `PUT /discounts/:storeId/:id`, `DELETE /discounts/:storeId/:id` |
| Health | `GET /health` |

### D1 Database (17 tables)
Better Auth core: `user`, `session`, `account`, `verification`
Organization plugin: `organization`, `member`, `invitation`
App tables: `product`, `scan_event`, `store_branding`, `promotion`, `discount_item`, `import_mapping`, `pending_import`, `store_registration`
Internal: `_cf_KV`

### Import System
Stores upload product files (CSV/XLSX/DB/JSON) via dashboard. A multi-format parser (`api/src/parser.js`) auto-detects columns. If a saved mapping exists, the import is auto-mapped and the store sees a verification preview. If no mapping, the file goes to admin for mapping in the Store Detail view's mapping editor (column selectors, live preview, test mapping, save & import).

### File Storage (R2)
All images (logos, promotions, discounts, banners) and import files stored in `store-catalogs` R2 bucket. Path convention: `{storeId}/{type}s/{filename}`. Upload via `POST /api/upload` (multipart), serve via `GET /api/files/*` with caching (1 day for images, 5 min for documents).

### UI Design System
- **Colors:** Dark slate theme via CSS custom properties in `css/tokens.css` (backgrounds: `#0c0c0d` base → `#27272a` hover, brand: `#6366f1` indigo)
- **Typography:** Inter sans-serif, JetBrains Mono for code/barcodes, 7-step type scale (12px–32px)
- **Spacing:** 9-step scale (4px–48px), border radii (4px–12px), shadows, transitions
- **Components:** Buttons (primary/secondary/ghost/danger/sm), form inputs, cards, tables, modals, toasts, stat cards, icon buttons, empty states, barcode tags
- **Icons:** Feather Icons CDN (no emojis), mapped 20+ common purposes
- **Accessibility:** `aria-label` on icon buttons, `:focus-visible` outlines, WCAG AA contrast, `prefers-reduced-motion` support
- **Defensive JS:** `$` helper that warns on missing elements, null guards on all `addEventListener` calls, `typeof feather !== 'undefined'` guard, IIFE wrappers

### Test Credentials
| User | Email | Password | Role |
|---|---|---|---|
| Admin | `admin@store.com` | `admin123` | admin |
| Manager | `manager@store.com` | `manager123` | manager |
| Store slug | `my-store` | — | — |

### Key Files
- `api/src/index.js` — API entry, route mounting
- `api/src/middleware.js` — Auth middleware (loadSession, authenticate, adminOnly, requireStoreAccess)
- `api/src/auth/index.js` — Better Auth config
- `api/migrations/001_init.sql` — Full D1 schema
- `api/wrangler.prod.toml` — Worker production config
- `scanner.html` / `js/app.js` / `js/scanner.js` — Scanner PWA
- `dashboard/index.html` / `dashboard/js/app.js` — Dashboard SPA
- `admin/index.html` / `admin/js/app.js` — Admin SPA
- `auth/index.html` / `auth/js/app.js` — Login page
- `vite.config.js` — MPA build config
- `sw.js` — Service Worker
- `.github/workflows/deploy.yml` — CI/CD pipeline
- `code-lore/` — Permanent project memory (styles, components, patterns, security, infrastructure)
- `project_handoffs/latest_handoff.md` — Current session status
