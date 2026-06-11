---
marp: true
theme: uncover
class:
  - lead
  - invert
paginate: true
---

# SKANER by ivond

## SaaS Barcode Scanning Platform

---

# What It Is

A SaaS barcode scanning platform on **Cloudflare's free tier**.

- Stores publish product catalogs
- Customers visit `{store}.ivond.com` on their phone
- Point camera at a barcode → see name & price instantly

---

# Three Apps in One

| App | URL | Purpose |
|-----|-----|---------|
| **Scanner PWA** | `{store}.ivond.com` | Public barcode scanning for customers |
| **Dashboard** | `ivond.com/dashboard/` | Store management for managers/staff |
| **Admin Panel** | `admin.ivond.com` | Platform administration |

---

# Architecture

```
*.ivond.com      ─┐
ivond.com        ─┼→  Cloudflare Worker (scanner-frontend) → Workers Assets
www.ivond.com    ─┘
admin.ivond.com  ─┤

*.ivond.com/api/* ─┐
ivond.com/api/*   ─┼→  Cloudflare Worker (scanner-api) → Hono + D1
www.ivond.com/api/*┘
```

---

# Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Workers Assets — Vite MPA build (5 entry points) |
| **Backend** | Hono Workers API + Better Auth |
| **Database** | Cloudflare D1 (17 tables) |
| **File Storage** | R2 bucket (`store-catalogs`) |
| **Auth** | Better Auth — cookie sessions, 4 roles |
| **Deployment** | CI/CD via GitHub Actions |

---

# Scanner PWA — Features

- Continuous barcode detection via native **`BarcodeDetector` API**
- Supports: QR, EAN-13/8, Code 128/39/93, UPC-A/E, Data Matrix, Aztec, PDF417, Codabar, ITF
- Camera feed with corner-bracket scan frame + animated scan line
- Torch/flashlight toggle & front/back camera switch
- Device vibration on scan (`navigator.vibrate(30)`)

---

# Scanner PWA — Store Features

- **Slug-scoped lookup:** `GET /api/lookup/{slug}?barcode=XXX`
- Per-store branding: logo, display name, colors, social links
- Promotion carousels (Swiper.js): banners + discount/offer cards
- Discount matching: barcode-matched + category-matched
- Scan history persisted in **IndexedDB** with localStorage fallback
- PWA: Service Worker (cache-first), web manifest, install prompt

---

# Dashboard — Overview

- **Auth:** Better Auth cookie sessions; redirects to `/auth/` on 401
- **Overview:** Date display, stat cards (total scans, today's, product count), top scanned products
- **Products:** Table (barcode, name, price in DA, category, delete), search filter
- **Upload/Import:** CSV, XLSX, XLS, DB/SQLite, JSON support

---

# Dashboard — Management

| Section | Description |
|---------|-------------|
| **Offers** | CRUD with image crop (400x200, 2:1), trigger type, active toggle |
| **Discounts** | CRUD with image crop (300x400, 3:4), percent/fixed, live preview |
| **Branding** | Phone mockup live preview, logo, colors, social links |
| **Activity** | Top scanned products for this store |
| **Profile** | User email, name, role tag, language switcher (EN/FR) |
| **i18n** | ~106 keys each for English and French |

---

# Admin Panel

- **Auth:** Inline login, role gate (admin only), Cloudflare Access at network level
- **Overview:** Platform-wide stats (stores, users, products, scans)
- **Stores:** Create/delete, live URL preview, Store Detail drill-in
- **Store Detail:** Stats, mapping card, pending imports, mapping editor

---

# Admin Panel — Management

| Section | Description |
|---------|-------------|
| **Users** | Table with role tags, create/delete users |
| **Promotions** | Per-store banners (800x300, GIF) & offers (400x200) |
| **Discounts** | Per-store editor with strikethrough price preview |
| **Branding** | Edit any store's branding |
| **Activity** | Recent scan events across all stores |

---

# Auth System

- **Better Auth** with `admin` + `organization` plugins
- **Cookie-based sessions** (`better-auth.session_token`)
- **Cross-subdomain:** `sameSite: 'none'` + `secure: true`
- **Dynamic CORS:** Echoes trusted origins (`*.ivond.com`, `localhost:*`)
- **Middleware chain:** `loadSession` → `authenticate` → `adminOnly` → `requireStoreAccess`

---

# API Endpoints

| Area | Endpoints |
|------|-----------|
| Auth | sign-in, sign-up, user, sign-out, cf-access |
| Stores | CRUD + slug lookup |
| Products | CRUD + upload + delete |
| Lookup | Public barcode lookup by slug |
| Scans | POST scan, GET stats |
| Branding | GET/PUT by store |
| Imports | Upload, pending, preview, map, confirm, verify |
| Promotions | CRUD by store |
| Discounts | CRUD by store |
| Admin | Stats, users CRUD, activity |

---

# D1 Database — 17 Tables

| Category | Tables |
|----------|--------|
| **Better Auth core** | `user`, `session`, `account`, `verification` |
| **Organization plugin** | `organization`, `member`, `invitation` |
| **App tables** | `product`, `scan_event`, `store_branding`, `promotion`, `discount_item`, `import_mapping`, `pending_import`, `store_registration` |
| **Internal** | `_cf_KV` |

---

# Import System

1. Stores upload product files (CSV/XLSX/DB/JSON)
2. Multi-format parser auto-detects columns
3. If saved mapping exists → auto-map + verification preview
4. If no mapping → admin maps it in Store Detail view
5. Mapping editor: column selectors, live preview, test, save & import

---

# File Storage — R2

- **Bucket:** `store-catalogs`
- **Path:** `{storeId}/{type}s/{filename}`
- **Upload:** `POST /api/upload` (multipart)
- **Serve:** `GET /api/files/*` (1 day cache images, 5 min documents)
- **Stores:** logos, promotion/discount/banner images, import files

---

# UI Design System

| Aspect | Details |
|--------|---------|
| **Colors** | Dark slate theme — `#0c0c0d` base, `#6366f1` indigo brand |
| **Typography** | Inter sans-serif, JetBrains Mono for code/barcodes |
| **Spacing** | 9-step scale (4px–48px), radii (4px–12px) |
| **Components** | Buttons, inputs, cards, tables, modals, toasts, stat cards |
| **Icons** | Feather Icons CDN (no emojis) |
| **Accessibility** | `aria-label`, `:focus-visible`, WCAG AA, `prefers-reduced-motion` |

---

# Test Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | `admin@store.com` | `admin123` | admin |
| Manager | `manager@store.com` | `manager123` | manager |
| Store slug | `my-store` | — | — |

---

# Key Files

| File | Purpose |
|------|---------|
| `api/src/index.js` | API entry, route mounting |
| `api/src/middleware.js` | Auth middleware chain |
| `api/src/auth/index.js` | Better Auth config |
| `api/migrations/001_init.sql` | Full D1 schema |
| `scanner.html` + `js/` | Scanner PWA |
| `dashboard/` | Dashboard SPA |
| `admin/` | Admin SPA |
| `auth/` | Login page |
| `vite.config.js` | MPA build config |
| `sw.js` | Service Worker |
| `code-lore/` | Permanent project memory |

---

# Free Tier Limits

| Service | Limit |
|---------|-------|
| **Workers** | 100K requests/day |
| **D1** | 5M rows read/day |
| **R2** | 10GB storage free |

**No paid upgrades — hard-blocked at free tier caps.**

---

# Thank You

## SKANER by ivond

*SaaS Barcode Scanning — Cloudflare Free Tier*
