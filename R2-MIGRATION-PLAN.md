# R2 Migration Plan — Move All Blobs Out of D1

## Rationale

D1 is a relational database — it's for structured data (products, users, scans, stores). Files and blobs don't belong there. Currently, several features store binary/file data as base64 in D1 columns, which:

| Problem | Impact |
|---|---|
| **1MB row limit** | Large import files or images hard-fail |
| **33% size bloat** | Base64 encoding inflates every file |
| **Slow queries** | Large rows make table scans expensive |
| **No CDN** | Files served through Worker, not at edge |
| **No caching** | Every request re-decodes base64 |

## What Moves to R2

| Current Location | Data | New R2 Path | Priority |
|---|---|---|---|
| `pending_imports.raw_content` | Uploaded import files (CSV, XLSX, DB, JSON) | `{storeId}/imports/{importId}/original.{ext}` | 🔴 High |
| `promotion.image_data` | Promotion banner/offer images | `{storeId}/promotions/{promoId}.{ext}` | 🔴 High |
| `discount_item.image_data` | Discount item images | `{storeId}/discounts/{discountId}.{ext}` | 🔴 High |
| `product` (new column) | Product catalog images | `{storeId}/products/{barcode}.{ext}` | 🟡 Medium |
| `store_branding.logo_url` | Store logo (currently external URL) | `{storeId}/logo/logo.{ext}` | 🟡 Medium |
| *(new)* Import mapping previews | Parsed preview JSON | `{storeId}/imports/{importId}/preview.json` | 🟢 Low |
| *(new)* Export reports | Generated PDF/Excel exports | `{storeId}/exports/{filename}` | 🟢 Low |
| *(new)* D1 backups | Automated DB snapshots | `backups/{date}.sql` | 🟢 Low |

## R2 Bucket Structure

```
store-catalogs/
├── {storeId}/
│   ├── logo/
│   │   └── logo-{timestamp}.{ext}
│   ├── products/
│   │   └── {barcode}.{ext}
│   ├── promotions/
│   │   └── {promoId}.{ext}
│   ├── discounts/
│   │   └── {discountId}.{ext}
│   ├── imports/
│   │   └── {importId}/
│   │       ├── original.{ext}
│   │       └── preview.json
│   └── exports/
│       └── report-{date}.{ext}
└── backups/
    └── {date}.sql
```

## API Endpoints

### Upload
```
POST /api/upload
  Auth: Required (manager+)
  Body: multipart/form-data
    - file: the file
    - store_id: "store-001"
    - type: "logo" | "product" | "promotion" | "discount" | "import"
    - ref_id: optional reference ID (product barcode, promo ID, etc.)
  Returns:
    { url: "/api/files/{storeId}/{type}/{filename}", key: "..." }
  Limits:
    - Max 10MB per file
    - Allowed types: images (png/jpg/webp), documents (csv/xlsx/json), sqlite (.db)
```

### Serve (proxy through Worker)
```
GET /api/files/{storeId}/{type}/{filename}
  Auth: Public for product/promotion/discount images
        Auth required for imports (admin only)
  Returns: File with correct Content-Type + Cache-Control headers
  Cache: Cache-Control public, max-age=86400 (1 day)
```

### Import upload (replaces current base64)
```
POST /imports/upload
  Auth: Manager+
  Body: multipart/form-data
    - file: CSV/XLSX/DB/JSON
  Changed behavior:
    - File → saved to R2 instead of base64 in D1
    - pending_imports.raw_content → stores R2 key instead
```

## Migration — Database Changes

### New columns (nullable, phased rollout)
```sql
-- Phase 1: Add new URL columns
ALTER TABLE product ADD COLUMN image_url TEXT;
ALTER TABLE promotion ADD COLUMN image_url TEXT;
ALTER TABLE discount_item ADD COLUMN image_url TEXT;

-- No change to pending_imports.raw_content — will store R2 key instead of base64
```

### Backfill strategy
Old base64 data stays in `image_data` columns forever — no migration needed.
Code reads `image_url` first, falls back to `image_data` for legacy records.

```
if (record.image_url)  → fetch from R2 via /api/files/...
if (record.image_data) → render base64 directly (legacy)
else                   → show placeholder
```

## Implementation Phases

### Phase 1 — Upload & Serve API (core)
- `api/src/routes/upload.js` — multipart upload handler (file validation, R2 put)
- `api/src/routes/files.js` — file serve handler (R2 get, Content-Type, caching)
- `api/src/index.js` — mount both routes
- Migration: add `image_url` columns

### Phase 2 — Import files to R2
- Modify `POST /imports/upload` to save file to R2
- Update `pending_imports.raw_content` → store R2 key
- Update preview/parse to fetch from R2 instead of decoding base64
- Admin import preview UI works unchanged (API returns same data shape)

### Phase 3 — Promotion & Discount images
- Admin/dashboard editor: file picker → upload to R2 → save `image_url`
- Display: use `image_url` with fallback to `image_data`
- Scanner app shows promotion/discount images from R2

### Phase 4 — Product catalog images
- Dashboard Products view: image upload per product
- Scanner result overlay: show product image
- Barcode lookup response includes `image_url`

### Phase 5 — Logo & polish
- Branding page: file upload for logo
- Export report generation to R2
- D1 backup automation

## Files to Create/Modify

```
NEW  api/src/routes/upload.js      — Upload endpoint
NEW  api/src/routes/files.js       — Serve endpoint
EDIT api/src/index.js              — Mount new routes
EDIT api/src/routes/imports.js     — Save file to R2 instead of base64
EDIT api/src/routes/promotions.js  — Accept image_url in create/update
EDIT api/src/routes/discounts.js   — Accept image_url in create/update
EDIT api/src/routes/products.js    — Accept image_url in create/update
NEW  api/migrations/002_r2.sql     — Add image_url columns

EDIT admin/js/app.js               — File pickers for promo/discount/logo
EDIT admin/js/api.js               — uploadImage() method
EDIT dashboard/js/app.js           — File pickers + product image upload
EDIT dashboard/js/api.js           — uploadImage() method
EDIT js/app.js                     — Scanner: show product image in results
```

## Rollback Safety

- All new columns are nullable — no data loss
- Old base64 data stays untouched
- Code checks `image_url` first, falls back to `image_data`
- R2 files can be deleted independently of DB records
