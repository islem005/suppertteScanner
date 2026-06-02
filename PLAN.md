# Shelf Scanner — Project Plan

## 1. Overview

**Shelf Scanner** is a SaaS platform that lets stores publish their product catalogs as scannable barcode lookups. Customers visit `/{store-slug}` on their phone, point the camera at a product barcode, and instantly see the name and price.

**Target users:**
- **Store owners** — create a store, upload products via CSV, customize branding, view scan analytics
- **Customers** — scan barcodes in-store to see product info
- **Platform admins** — manage all stores, users, branding, monitor activity

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (PWA)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Scanner   │  │ Dashboard│  │ Admin Panel      │   │
│  │ /{slug}   │  │ /dash-   │  │ /admin/          │   │
│  │ (Vite     │  │ board/   │  │ (Vite entry)     │   │
│  │ entry)    │  │ (Vite    │  │                  │   │
│  │           │  │  entry)  │  │                  │   │
│  └─────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│        │             │                 │              │
│        └─────────────┴─────────────────┘              │
│                        │ HTTPS proxy                  │
└────────────────────────┼─────────────────────────────┘
                         │ /api/*
                    ┌────┴────┐
                    │  Vite   │ (dev same as prod)
                    │  proxy  │
                    └────┬────┘
                         │
┌────────────────────────┼─────────────────────────────┐
│          Hono Workers API (port 3002)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───┐ │
│  │Auth  │ │Stores│ │Prods │ │Scans │ │Brand │ │Adm│ │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └─┬─┘ │
│     └────────┴────────┴────────┴────────┴───────┘    │
│                        │                              │
│              ┌─────────┴──────────┐                   │
│              │  D1 Database        │                   │
│              │  (Cloudflare D1)    │                   │
│              └────────────────────┘                   │
└───────────────────────────────────────────────────────┘
```

**Runtime modes:**
| Mode | When | DB | API Server |
|---|---|---|---|
| **Local dev** | Always | D1 local (`.wrangler/state`) | `wrangler dev` (workerd) |
| **Production** | `wrangler deploy` | D1 remote (Cloudflare) | Cloudflare Workers |

---

## 3. Directory Structure

```
D:\projects\suppertteScanner\
│
├── index.html                  # Scanner app HTML
├── scanner.html                # Scanner PWA entry (Vite)
├── js/
│   ├── app.js                  # Scanner app logic (boot, scan loop, result overlay)
│   ├── scanner.js              # BarcodeDetector wrapper (init, start, stop, torch)
│   ├── shared.js               # Shared UI utilities (toast, modal, escapeHtml)
│   └── storage.js              # IndexedDB wrapper for scan history
├── css/
│   ├── style.css               # Scanner app styles
│   └── tokens.css              # CSS custom properties (design tokens)
│
├── dashboard/
│   ├── index.html              # Store dashboard SPA
│   ├── css/style.css           # Dashboard styles
│   └── js/
│       ├── api.js              # API client
│       ├── app.js              # Dashboard logic (5 views)
│       └── i18n.js             # Internationalization helpers
│
├── admin/
│   ├── index.html              # Admin panel SPA
│   ├── css/style.css           # Admin styles
│   └── js/
│       ├── api.js              # API client (admin-only methods)
│       └── app.js              # Admin logic (6+ views)
│
├── auth/
│   ├── index.html              # Shared login page
│   ├── css/style.css           # Login styles
│   └── js/app.js               # Login logic
│
├── home/
│   ├── index.html              # Marketing homepage
│   └── css/style.css           # Marketing styles
│
├── api/                        # Backend (Hono Workers API) — ACTIVE
│   ├── src/
│   │   ├── index.js            # App entry, route mounting
│   │   ├── db.js               # D1 utility functions (queryAll, queryOne, execute)
│   │   ├── middleware.js        # Auth middleware (loadSession, authenticate, adminOnly)
│   │   ├── auth/
│   │   │   └── index.js        # Better Auth instance config
│   │   ├── routes/
│   │   │   ├── auth.js         # Better Auth Hono router
│   │   │   ├── stores.js       # CRUD stores (organizations)
│   │   │   ├── products.js     # CRUD products + upload
│   │   │   ├── lookup.js       # GET barcode lookup by slug
│   │   │   ├── scans.js        # POST scan event + GET stats
│   │   │   ├── branding.js     # GET/PUT store branding
│   │   │   ├── admin.js        # Admin-only endpoints
│   │   │   ├── imports.js      # File import + mapping API
│   │   │   ├── promotions.js   # Promotions CRUD
│   │   │   ├── discounts.js    # Discount items CRUD
│   │   │   └── cf-access.js    # Cloudflare Access auth exchange
│   │   ├── parser.js           # Multi-format file parser (CSV, XLSX, DB, JSON)
│   │   ├── admin-db.js         # Admin D1 bridge (cf-access)
│   │   └── db/                 # (empty — reserved for future schema)
│   ├── migrations/
│   │   └── 001_init.sql        # Initial D1 schema (Better Auth + app tables)
│   ├── scripts/
│   │   └── seed-d1.mjs         # D1 seed script (creates admin/manager/store/branding)
│   ├── .dev.vars               # Local env secrets (gitignored)
│   ├── wrangler.toml           # Dev Cloudflare Workers config
│   ├── wrangler.prod.toml      # Production Cloudflare Workers config
│   ├── start-backend.bat       # Windows backend launcher
│   ├── seed-admin.mjs          # Admin user seeder
│   └── package.json
│
├── functions/
│   └── _middleware.js          # Pages Function: admin URL rewrite
│
├── assets/icons/
│   └── icon-192.svg            # PWA icon
│
├── dist/                       # Vite build output (gitignore)
├── node_modules/               # Frontend deps (gitignore)
├── certs/                      # Local SSL certs (gitignore)
├── code-lore/                  # Permanent project memory (see code-lore-index.md)
├── project_handoffs/           # Versioned session handoffs
│
├── package.json                # Root: Vite dev deps, scripts
├── vite.config.js              # Vite config (SSL, proxy, multi-page)
├── start.mjs                   # Quick-start launcher (wrangler dev + Vite)
├── manifest.json               # Web manifest (PWA)
├── sw.js                       # Service Worker (cache-first)
├── deploy-pages.mjs            # Pages deployment script
├── copy-assets.mjs             # Asset copy for build output
├── sample-data/                # Multi-format sample files for testing imports
│   ├── README.md
│   ├── products-en.csv         # English (comma)
│   ├── products-fr.csv         # French (semicolon)
│   ├── products-es.csv         # Spanish (semicolon)
│   ├── products-de.csv         # German (semicolon, comma decimals)
│   ├── products-ar.csv         # Arabic (comma)
│   ├── products-legacy.csv     # Legacy uppercase columns (COD_BAR, etc.)
│   ├── products.json           # JSON under `products` key
│   ├── products.xlsx           # Excel, sheet "Produits"
│   ├── products-fr.xlsx        # Excel French columns
│   ├── products.db             # SQLite, table "inventory"
│   └── backup.db               # SQLite, table "stock" (different col names)
├── seed.csv                    # 50 demo products
└── PLAN.md                     # This file
```

---

## 4. Database Schema (D1)

All tables live in a single D1 database (`shelf-scanner-db-dev` local/dev, `shelf-scanner-db` planned for prod). Migration file: `api/migrations/001_init.sql`.

### Better Auth Core Tables

### `user`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | Display name |
| `email` | text | UNIQUE |
| `emailVerified` | integer | 0/1 |
| `image` | text | Nullable |
| `createdAt` | text (ISO) | |
| `updatedAt` | text (ISO) | |
| `role` | text | `'admin'`, `'manager'`, or `'staff'`, default `'staff'` |
| `banned` | integer | 0/1 |
| `banReason` | text | Nullable |
| `banExpires` | text | Nullable |
| `display_name` | text | Custom field |
| `store_id` | text | Nullable, FK → organization |

### `session`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `userId` | text | FK → user |
| `token` | text | UNIQUE |
| `expiresAt` | text (ISO) | |
| `ipAddress` | text | Nullable |
| `userAgent` | text | Nullable |
| `createdAt` | text (ISO) | |
| `updatedAt` | text (ISO) | |
| `activeOrganizationId` | text | Org plugin |
| `impersonatedBy` | text | Admin plugin |

### `account`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `userId` | text | FK → user |
| `accountId` | text | |
| `providerId` | text | |
| `accessToken` | text | Nullable |
| `refreshToken` | text | Nullable |
| `idToken` | text | Nullable |
| `accessTokenExpiresAt` | text | Nullable |
| `refreshTokenExpiresAt` | text | Nullable |
| `scope` | text | Nullable |
| `password` | text | Hashed password |
| `createdAt` | text (ISO) | |
| `updatedAt` | text (ISO) | |

### `verification`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `identifier` | text | |
| `value` | text | |
| `expiresAt` | text (ISO) | |
| `createdAt` | text (ISO) | |
| `updatedAt` | text (ISO) | |

### Organization Plugin Tables

### `organization` (replaces legacy `stores`)
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | Store display name |
| `slug` | text | UNIQUE, URL-friendly identifier |
| `logo` | text | Nullable |
| `metadata` | text | Nullable JSON |
| `createdAt` | text (ISO) | |
| `updatedAt` | text (ISO) | |

### `member`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `organizationId` | text | FK → organization |
| `userId` | text | FK → user |
| `role` | text | Default `'member'` |
| `createdAt` | text (ISO) | |
| | | UNIQUE(organizationId, userId) |

### `invitation`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `organizationId` | text | FK → organization |
| `email` | text | |
| `role` | text | |
| `status` | text | `'pending'` |
| `inviterId` | text | FK → user |
| `expiresAt` | text (ISO) | |
| `createdAt` | text (ISO) | |

### Application Tables

### `product`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text | FK → organization |
| `barcode` | text | |
| `name` | text | |
| `price` | real | |
| `category` | text | Nullable |
| `created_at` | text (ISO) | |
| `updated_at` | text (ISO) | |
| | | UNIQUE(store_id, barcode) |

### `scan_event`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text | FK → organization |
| `product_id` | text | Nullable, FK → product |
| `barcode` | text | |
| `scanned_at` | text (ISO) | |

### `store_branding`
| Column | Type | Notes |
|---|---|---|
| `store_id` | text (UUID) | PK, FK → organization |
| `logo_url` | text | Nullable |
| `primary_color` | text | Default `#6366f1` |
| `accent_color` | text | Default `#10b981` |
| `display_name` | text | Nullable |
| `contact_email` | text | Nullable |
| `contact_phone` | text | Nullable |
| `footer_text` | text | Nullable |
| `instagram_url` | text | Social link |
| `tiktok_url` | text | Social link |
| `website_url` | text | Social link |
| `facebook_url` | text | Social link |
| `twitter_url` | text | Social link |
| `youtube_url` | text | Social link |

### `promotion`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text | FK → organization |
| `type` | text | `'banner'` or `'offer'` |
| `title` | text | Nullable |
| `image_data` | text | Nullable (base64 data URL) |
| `trigger_type` | text | Nullable |
| `trigger_value` | text | Nullable |
| `active` | integer | Default 1 |
| `priority` | integer | Default 0 |
| `created_at` | text (ISO) | |
| `updated_at` | text (ISO) | |

### `discount_item`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text | FK → organization |
| `barcode` | text | Nullable |
| `name` | text | |
| `image_data` | text | Nullable |
| `category` | text | Nullable |
| `original_price` | real | Default 0 |
| `new_price` | real | Default 0 |
| `discount_percent` | real | Nullable |
| `featured` | integer | Default 0 |
| `active` | integer | Default 1 |
| `priority` | integer | Default 0 |
| `created_at` | text (ISO) | |
| `updated_at` | text (ISO) | |

### `import_mapping`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text | FK → organization, UNIQUE |
| `column_mapping` | json | `{"barcode":"...","name":"...","price":"..."}` |
| `parser_options` | json | Nullable: delimiter, table_name, sheet_name, header_row |
| `is_verified` | integer | 0/1 |
| `created_at` | text (ISO) | |
| `updated_at` | text (ISO) | |

### `pending_import`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text | FK → organization |
| `original_filename` | text | |
| `file_type` | text | csv, xlsx, sqlite, json |
| `raw_content` | text | Base64-encoded file content |
| `row_count` | integer | |
| `detected_columns` | json | Detected column names |
| `sample_rows` | json | First 3 rows of data |
| `mapping_id` | text | FK → import_mapping, nullable |
| `status` | text | pending / auto-mapped / imported / rejected |
| `created_at` | text (ISO) | |
| `imported_at` | text (ISO) | |

---

## 5. API Reference

All endpoints prefixed with `/api`.

### Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/sign-in/email` | — | `{ email, password }` | `{ user, session }` |
| POST | `/auth/sign-up/email` | — | `{ email, password, name }` | `{ user, session }` |
| GET | `/auth/user` | Cookie | — | `{ user, session }` or `null` |
| POST | `/auth/sign-out` | Cookie | — | `{ success: true }` |
| POST | `/auth/cf-access` | — | `{ email }` | Session set, redirect |

### Stores

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stores` | Required | List stores (admin: all, others: own) |
| POST | `/stores` | Admin | Create store `{ name, slug }` |
| GET | `/stores/:id` | Required | Get store by ID |
| GET | `/stores/slug/:slug` | Public | Get store by slug (id, name, slug) |

### Products

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | Required | List products for store |
| POST | `/products` | Required | Create/upsert product |
| POST | `/products/upload` | Required | Upload CSV `{ csv }` |
| DELETE | `/products/:id` | Required | Delete product |

### Lookup (public)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/lookup/:slug?barcode=...` | Public | Look up product by barcode for store |

### Scans

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/scans` | Public | Log a scan event `{ store_slug, barcode }` |
| GET | `/scans/stats` | Required | Get scan stats for store (total, today, top 10) |

### Branding

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/branding/:storeId` | Public | Get store branding (returns defaults if none set) |
| PUT | `/branding/:storeId` | Required | Update/create store branding |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats` | Admin | Platform-wide stats (stores, users, products, scans) |
| GET | `/admin/users` | Admin | List all users |
| POST | `/admin/users` | Admin | Create user `{ email, password, displayName, storeId?, role? }` |
| DELETE | `/admin/users/:id` | Admin | Delete user |
| GET | `/admin/activity` | Admin | Recent scan events across all stores |

### Imports (Store File Upload + Admin Mapping)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/imports/upload` | Manager | Upload file (base64 content + filename). Returns `{ id, status, preview?, requires_admin? }` |
| GET | `/imports/pending` | Admin | List all pending + auto-mapped imports |
| GET | `/imports/store/:storeId` | Manager/Admin | Import history + mapping status for a store |
| GET | `/imports/:id` | Both | Single import record |
| GET | `/imports/:id/preview` | Both | Re-parse file, return detected columns + sample rows + suggested mapping |
| POST | `/imports/:id/preview-mapped` | Both | Apply saved mapping, return mapped preview |
| POST | `/imports/:id/confirm` | Manager | Confirm auto-mapped import → upsert products |
| POST | `/imports/:id/map` | Admin | Create mapping + import products |
| POST | `/imports/:id/re-map` | Admin | Update mapping + re-import |
| POST | `/imports/:id/test` | Admin | Test mapping (no upsert), return valid/invalid counts |
| POST | `/imports/:id/verify` | Admin | Verify auto-mapped import |
| POST | `/imports/:id/reject` | Admin | Reject pending import |
| GET | `/imports/mapping/:storeId` | Both | Get saved mapping for a store |
| POST | `/imports/mapping/:storeId` | Admin | Save mapping only (no import) |
| DELETE | `/imports/mapping/:storeId` | Admin | Remove mapping |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok: true }` |

---

## 6. Frontend Pages

| Page | URL | Entry | Auth | Audience |
|---|---|---|---|---|
| **Scanner** | `/{slug}` | `index.html` | Public | Customers |
| **Store Dashboard** | `/dashboard/` | `dashboard/index.html` | Manager/Staff | Store operators |
| **Admin Panel** | `/admin/` | `admin/index.html` | Admin | Platform admins |
| **Homepage** | `/` | `home/index.html` | Public | Visitors (planned) |

### Scanner App (`/{slug}`)
- Continuous barcode scanning using `BarcodeDetector` API
- **Slug-scoped lookup (VERIFIED MUST):** `GET /api/lookup/{slug}?barcode=XXX` — always filters products by the store matching the URL slug. A customer at `/my-store` will only ever see products owned by that store. Unknown barcodes show "Unknown product" rather than falling back to other stores.
- Scan logging also stores `store_slug` so every scan is attributed to the correct store.
- Results: slide-up panel with scanned items, quantities, export CSV
- Store badge showing store name
- Torch toggle, scan counter, clear button
- Logs each scan: `POST /api/scans`

### Store Dashboard (`/dashboard/`)
- **Overview** — store stats (scans today, total, product count, top 10 scanned)
- **Products** — product table, file upload (CSV/XLSX/DB/JSON), delete products
- **Upload flow**: upload file → if mapping exists, auto-apply + show verification preview → store confirms → products imported. If no mapping, file sent to admin for review.
- **Branding** — edit own store's branding (colors, logo, contact)
- **Activity** — top scanned products for this store
- **Profile** — current user info

### Admin Panel (`/admin/`)
- **Overview** — platform-wide stats (stores, users, products, scans)
- **Stores** — create/delete stores. Each store has an **Explore** button → Store Detail view.
- **Store Detail** — drill-in view showing:
  - Stats cards (products, scans, users)
  - **Mapping card**: status (active/not mapped), column mapping summary, Edit/Test/Remove actions
  - **Pending imports table**: list of files awaiting action with Preview/Map & Import/Verify/Reject buttons
  - **Import history**: past imports
  - **Mapping editor modal**: file preview table + column selector dropdowns + live preview + Test Mapping button + Save & Import / Save Mapping Only
- **Users** — create/delete users (admin/manager/staff)
- **Branding** — per-store branding editor (store selector)
- **Activity** — recent scan events across all stores
- **Profile** — admin user info

---

## 7. Auth & Roles

**Auth mechanism:** Better Auth, cookie-based sessions. Session tokens stored in httpOnly cookies, validated server-side via D1 query.

**Session validation** (`api/src/middleware.js` — `loadSession`):
1. Parse `better-auth.session_token` cookie
2. Query `session` table in D1 for token validity + expiry
3. Load user from `user` table (role, store_id, display_name)
4. Attach user/session to Hono context (`c.get('user')`, `c.get('session')`)

**Role permissions:**

| Resource | Admin | Manager | Staff | Public |
|---|---|---|---|---|
| View all stores | ✅ | Own only | Own only | ❌ |
| Create store | ✅ | ❌ | ❌ | ❌ |
| Delete store | ✅ | ❌ | ❌ | ❌ |
| View products (any) | ✅ | Own store | Own store | ❌ |
| Upload CSV | ❌ | Own store | ❌ | ❌ |
| Lookup barcode | — | — | — | ✅ |
| Log scan | — | — | — | ✅ |
| Edit branding (any) | ✅ | Own store | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| View admin stats | ✅ | ❌ | ❌ | ❌ |

---

## 8. Setup & Commands

### Prerequisites
- Node.js 18+
- npm

### Quick start
```bash
npm run start
```
This runs `start.mjs` which:
1. Installs frontend & backend deps
2. Starts Hono Workers API (via `wrangler dev`) on `http://localhost:3002`
3. Starts Vite dev server on `https://localhost:5173`
4. Prints all URLs

> Note: Seeding is no longer automatic. Run `api/scripts/seed-d1.mjs` manually if needed.

### Manual commands
| Command | Description |
|---|---|
| `npm run dev` | Vite dev server only |
| `npm run dev:backend` | `wrangler dev` on port 3002 |
| `npm run dev:all` | Both concurrently |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

### Dev default credentials
- **Admin:** `admin@store.com` / `admin123` (also in seed script default)
- **Manager:** `manager@store.com` / `manager123`
- **Store:** `my-store` (slug)
> **Warning:** Default credentials must never be used in production. The `start.mjs` launcher accepts `ADMIN_EMAIL` and `ADMIN_PASS` env vars to override.

---

## 9. Current Status

### ✅ Done
- Scanner PWA with BarcodeDetector, scan logging, results panel
- **Slug-scoped product lookup (VERIFIED MUST):** scanner at `/{slug}` only searches products for that store. Verified at `api/src/lookup.js:18-23` and `js/app.js:68-78`.
- **Hono Workers API (ACTIVE):** auth, stores CRUD, products CRUD, CSV upload, barcode lookup, scan stats, branding CRUD, admin endpoints, promotions + discount items. Runs via `wrangler dev` locally, deploys to Cloudflare Workers.
- **Promotions & Discounts API:** banners with CTA, offer cards with images, discount items with percentage off, triggered by barcode/product.
- **Store file import system (VERIFIED):** multi-format parser (CSV, XLSX, SQLite DB, JSON), `import_mappings` + `pending_imports` tables, full import API router at `api/src/imports.js:1-444`, parser at `api/src/parser.js:1-120`. Verified routes: upload → preview → map → confirm → verify flow.
- **Admin Store Detail:** drill-in from Stores table → explore button → store detail with mapping card, pending imports table, mapping editor modal with column selectors + live preview + test button.
- **Store dashboard upload:** file picker → auto-map if mapping exists → verification preview with confirm → import. First-time uploads go to admin.
- **D1 database migration:** migrated from Supabase to Cloudflare D1, all 15 tables live (Better Auth core + org plugin + app tables)
- **Better Auth auth system:** cookie-based sessions, admin + organization plugins, role-based middleware (loadSession, authenticate, adminOnly, requireStoreAccess)
- **Seed system:** standalone `api/scripts/seed-d1.mjs` seeds store, admin/manager users, branding (logo, social links), promotions (2 banners + 3 offers), discount items (5), and 50+ products from `seed.csv`
- Store dashboard (overview, products, branding, activity, profile)
- Admin panel (overview, stores, users, branding, activity, profile)
- Better Auth with 3 roles (admin, manager, staff)
- Service Worker with cache-first strategy
- Vite MPA build (3 entry points)
- `start.mjs` launcher with Vite + wrangler dev
- 50 demo products in `seed.csv`
- `store_branding` table with social link columns + API
- Cloudflare Pages deployment (shelf-scanner with custom domains)
- Cloudflare Access integration for admin.ivond.com
- Code-lore & handoff documentation system

### 🔄 In Progress
_(none — all active work is committed as done)_

### 📅 Planned
- Sandbox mode for demo stores
- Multi-page CSR (separate dashboard views as sub-pages)
- Fix `wrangler.prod.toml` database ID (currently points to `admin-auth`)
- Set `BETTER_AUTH_SECRET` in Cloudflare secrets
- Apply D1 migrations to production database
- R2 catalog image storage
- Rate limiting
- CORS hardening
- Real password hashing (bcrypt)
- Email notifications
- Audit log for admin actions

---

## 10. Roadmap

### Phase 1 — Foundation (current)
- [x] Scanner app with live barcode detection
- [x] **Slug-scoped product lookup (VERIFIED MUST)** — scanner at `/{slug}` only searches/finds products belonging to that store
- [x] Hono Workers API with Supabase (replaces legacy Express + SQLite)
- [x] Store dashboard (manager focus)
- [x] Admin panel (platform management)
- [x] Branding system (logo, social links, colors)
- [x] Promotions & Discounts (banners, offers, discount items)
- [x] Marketing homepage at `/`
- [x] Scanner branding integration (logo, colors from `store_branding`)
- [x] Slug routing via Vite middleware (`/{slug}` → `scanner.html`)
- [x] **Multi-format file import system** — stores upload CSV/XLSX/DB/JSON, admin creates column mapping in store detail, auto-mapping with store verification preview
- [x] **Admin store detail** — drill-in from Stores to see mapping status, pending imports, import history, mapping editor with live preview + test

### Phase 2 — Production
- [x] D1 database migration (from Supabase)
- [x] Better Auth + cookie-based sessions
- [x] Cloudflare Pages deployment
- [x] Cloudflare Workers dev deployment (via `wrangler dev`)
- [ ] Fix `wrangler.prod.toml` database ID
- [ ] Set `BETTER_AUTH_SECRET` secret
- [ ] Apply D1 migrations to remote prod database
- [ ] Real password hashing (bcrypt — built into Better Auth)
- [ ] Rate limiting
- [ ] CORS hardening

### Phase 3 — Growth
- [ ] Multi-language support
- [ ] Barcode image upload fallback
- [ ] Bulk product editor
- [ ] Scan export reports (PDF/Excel)
- [ ] Store owner self-signup flow

### Phase 4 — Scale
- [ ] R2 catalog image hosting
- [ ] Real-time scan dashboard (WebSocket)
- [ ] API keys for third-party integration
- [ ] White-label option
- [ ] Mobile apps (React Native wrapper)
