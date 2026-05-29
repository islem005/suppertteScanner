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
                    │  Vite   │ (dev) or nginx (prod)
                    │  proxy  │
                    └────┬────┘
                         │
┌────────────────────────┼─────────────────────────────┐
│                Express API (port 3001)                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───┐ │
│  │Auth  │ │Stores│ │Prods │ │Scans │ │Brand │ │Adm│ │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └─┬─┘ │
│     └────────┴────────┴────────┴────────┴───────┘    │
│                        │                              │
│              ┌─────────┴──────────┐                   │
│              │  Supabase client    │                   │
│              │  (SQLite mock or    │                   │
│              │   real Supabase)    │                   │
│              └────────────────────┘                   │
└───────────────────────────────────────────────────────┘
```

**Runtime modes:**
| Mode | When | DB |
|---|---|---|
| **Local dev** | No `SUPABASE_URL` or URL includes `localhost` | SQLite via `better-sqlite3` |
| **Production** | `SUPABASE_URL` set to a `supabase.co` project | Supabase PostgreSQL |

---

## 3. Directory Structure

```
E:\projects\suppertteScanner\
│
├── index.html                  # Scanner app HTML
├── scanner.html                # (planned) Scanner moved here for marketing homepage
├── js/
│   ├── app.js                  # Scanner app logic (boot, scan loop, result overlay)
│   ├── scanner.js              # BarcodeDetector wrapper (init, start, stop, torch)
│   └── storage.js              # IndexedDB wrapper for scan history
├── css/
│   └── style.css               # Scanner app styles
│
├── dashboard/
│   ├── index.html              # Store dashboard SPA
│   ├── css/style.css           # Dashboard styles
│   └── js/
│       ├── api.js              # API client
│       └── app.js              # Dashboard logic (5 views)
│
├── admin/
│   ├── index.html              # Admin panel SPA
│   ├── css/style.css           # Admin styles
│   └── js/
│       ├── api.js              # API client
│       └── app.js              # Admin logic (6 views)
│
├── home/
│   ├── index.html              # (planned) Marketing homepage
│   ├── css/style.css           # (planned) Marketing styles
│   └── js/app.js               # (planned) Marketing interactions
│
├── worker/                     # Backend (Express API)
│   ├── src/
│   │   ├── index.js            # App entry, route mounting
│   │   ├── db.js               # DB client (SQLite mock | Supabase)
│   │   ├── middleware.js        # JWT auth middleware
│   │   ├── auth.js             # POST /login, POST /register
│   │   ├── stores.js           # CRUD stores
│   │   ├── products.js         # CRUD products + CSV upload
│   │   ├── lookup.js           # GET barcode lookup by slug
│   │   ├── scans.js            # POST scan event + GET stats
│   │   ├── branding.js         # GET/PUT store branding
│   │   ├── admin.js            # Admin-only endpoints
│   │   ├── imports.js          # File import + mapping API
│   │   ├── parser.js           # Multi-format file parser (CSV, XLSX, DB, JSON)
│   │   └── seed.mjs            # Product seeder from CSV
│   ├── .env                    # Local env config
│   ├── .env.example            # Env documentation
│   ├── wrangler.toml           # Cloudflare Workers config
│   └── package.json
│
├── supabase/
│   └── schema.sql              # Supabase SQL schema + RLS policies
│
├── assets/icons/
│   └── icon-192.svg            # PWA icon
│
├── dist/                       # Vite build output (gitignore)
├── node_modules/               # Frontend deps (gitignore)
│
├── package.json                # Root: Vite dev deps, scripts
├── vite.config.js              # Vite config (SSL, proxy, multi-page)
├── start.mjs                   # Quick-start launcher
├── manifest.json               # Web manifest (PWA)
├── sw.js                       # Service Worker (cache-first)
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

## 4. Database Schema

### `stores`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | Store display name |
| `slug` | text | UNIQUE, URL-friendly identifier |
| `created_at` | text (ISO datetime) | |

### `store_users`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `email` | text | UNIQUE |
| `password_hash` | text | Plaintext (dev only) |
| `display_name` | text | |
| `store_id` | text (UUID) | FK → stores, nullable (admins have no store) |
| `role` | text | `'admin'`, `'manager'`, or `'staff'` |
| `created_at` | text (ISO datetime) | |

### `products`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text (UUID) | FK → stores, NOT NULL |
| `barcode` | text | |
| `name` | text | |
| `price` | real | |
| `category` | text | Nullable |
| `created_at` | text (ISO datetime) | |
| `updated_at` | text (ISO datetime) | |
| | | UNIQUE(store_id, barcode) |

### `scan_events`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text (UUID) | FK → stores, NOT NULL |
| `product_id` | text (UUID) | FK → products, nullable |
| `barcode` | text | |
| `scanned_at` | text (ISO datetime) | |

### `store_branding`
| Column | Type | Notes |
|---|---|---|
| `store_id` | text (UUID) | PK, FK → stores |
| `logo_url` | text | Nullable |
| `primary_color` | text | Default `#00c8ff` |
| `accent_color` | text | Default `#00c875` |
| `display_name` | text | Nullable |
| `contact_email` | text | Nullable |
| `contact_phone` | text | Nullable |
| `footer_text` | text | Nullable |

### `import_mappings`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text (UUID) | FK → stores, UNIQUE |
| `column_mapping` | json | `{"barcode":"...","name":"...","price":"..."}` |
| `parser_options` | json | Nullable: delimiter, table_name, sheet_name, header_row |
| `is_verified` | integer | 0/1 |
| `created_at` | text | |
| `updated_at` | text | |

### `pending_imports`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `store_id` | text (UUID) | FK → stores |
| `original_filename` | text | |
| `file_type` | text | csv, xlsx, sqlite, json |
| `raw_content` | text | Base64-encoded file content |
| `row_count` | integer | |
| `detected_columns` | json | Detected column names |
| `sample_rows` | json | First 3 rows of data |
| `mapping_id` | text (UUID) | FK → import_mappings, nullable |
| `status` | text | pending / auto-mapped / imported / rejected |
| `created_at` | text | |
| `imported_at` | text | |

---

## 5. API Reference

All endpoints prefixed with `/api`.

### Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` | `{ token, user }` |
| POST | `/auth/register` | — | `{ email, password, displayName, storeSlug?, role? }` | `{ token, user }` |
| POST | `/setup` | — | `{ email, password, displayName, storeName?, storeSlug? }` | `{ token, user }` |

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

**Auth mechanism:** JWT tokens, 7-day expiry. Stored in `localStorage`.

**Token payload:**
```json
{
  "id": "user-uuid",
  "email": "user@store.com",
  "role": "admin|manager|staff",
  "store_id": "uuid-or-null"
}
```

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
2. Frees port 3001
3. Starts Express API on `http://localhost:3001`
4. Runs setup (creates admin user + default store)
5. Seeds 50 demo products
6. Starts Vite dev server on `https://localhost:5173`
7. Prints all URLs

### Manual commands
| Command | Description |
|---|---|
| `npm run dev` | Vite dev server only |
| `npm run dev:backend` | Express API only |
| `npm run dev:all` | Both concurrently |
| `npm run build` | Production build to `dist/` |
| `npm run seed` | Seed products (skip if exist) |
| `npm run seed:force` | Force re-seed (delete + insert) |
| `npm run preview` | Preview production build |

### Default credentials
- **Admin:** `admin@store.com` / `admin123`
- **Store:** `my-store` (slug)

---

## 9. Current Status

### ✅ Done
- Scanner PWA with BarcodeDetector, scan logging, results panel
- **Slug-scoped product lookup (VERIFIED MUST):** scanner at `/{slug}` only searches products for that store. Verified at `worker/src/lookup.js:18-23` and `js/app.js:68-78`.
- Express API: auth, stores CRUD, products CRUD, CSV upload, barcode lookup, scan stats, branding CRUD, admin endpoints
- **Store file import system (VERIFIED):** multi-format parser (CSV, XLSX, SQLite DB, JSON), `import_mappings` + `pending_imports` tables, full import API router at `worker/src/imports.js:1-444`, parser at `worker/src/parser.js:1-120`. Verified routes: upload → preview → map → confirm → verify flow.
- **Admin Store Detail:** drill-in from Stores table → explore button → store detail with mapping card, pending imports table, mapping editor modal with column selectors + live preview + test button.
- **Store dashboard upload:** file picker → auto-map if mapping exists → verification preview with confirm → import. First-time uploads go to admin.
- SQLite mock client with Supabase-compatible interface
- Store dashboard (overview, products, branding, activity, profile)
- Admin panel (overview, stores, users, branding, activity, profile)
- JWT auth with 3 roles (admin, manager, staff)
- Service Worker with cache-first strategy
- Vite MPA build (3 entry points)
- `start.mjs` launcher with auto-setup + seed
- 50 demo products in `seed.csv`
- `store_branding` table + API

### 🔄 In Progress
_(none — all active work is committed as done)_

### 📅 Planned
- Sandbox mode for demo stores
- Multi-page CSR (separate dashboard views as sub-pages)
- Cloudflare Workers deployment with wrangler
- Real Supabase project setup
- R2 catalog image storage
- Email notifications
- Audit log for admin actions

---

## 10. Roadmap

### Phase 1 — Foundation (current)
- [x] Scanner app with live barcode detection
- [x] **Slug-scoped product lookup (VERIFIED MUST)** — scanner at `/{slug}` only searches/finds products belonging to that store
- [x] Express API with SQLite
- [x] Store dashboard (manager focus)
- [x] Admin panel (platform management)
- [x] Branding system
- [x] Marketing homepage at `/`
- [x] Scanner branding integration (logo, colors from `store_branding`)
- [x] Slug routing via Vite middleware (`/{slug}` → `scanner.html`)
- [x] **Multi-format file import system** — stores upload CSV/XLSX/DB/JSON, admin creates column mapping in store detail, auto-mapping with store verification preview
- [x] **Admin store detail** — drill-in from Stores to see mapping status, pending imports, import history, mapping editor with live preview + test

### Phase 2 — Production
- [ ] Supabase PostgreSQL deployment
- [ ] Cloudflare Workers deployment
- [ ] Real password hashing (bcrypt)
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
