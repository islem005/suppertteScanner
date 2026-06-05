# R2 File Storage

## Overview

Shelf Scanner uses Cloudflare R2 (`store-catalogs` bucket) for file storage — primarily promotion and discount item images uploaded via the admin and dashboard panels. File uploads replace the older base64 approach (`image_data` column) with a cleaner URL-based storage pattern (`image_url` column pointing to `/api/files/{key}`).

**Bucket:** `store-catalogs` (binding: `CATALOGS` on the `scanner-api` Worker)

---

## Endpoints

### Upload — `POST /api/upload`

Accepts multipart form data, stores file in R2, and returns a file serve URL.

**Authentication:** Required (`authenticate` middleware)

**Form fields:**
| Field | Required | Description |
|---|---|---|
| `file` | Yes | The file (File object from FormData) |
| `store_id` | Yes | Store UUID (owner of the file) |
| `type` | Yes | One of: `logo`, `promotion`, `discount`, `import` |
| `ref_id` | No | Optional reference ID (used in filename generation) |

**Validation:**
- Max file size: 10MB (`MAX_FILE_SIZE`)
- Image types allowed: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`
- Document types allowed: `text/csv`, `application/json`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.sqlite3`, `application/x-sqlite3`, `application/octet-stream`
- Store access check: user must be admin or belong to the store

**Response (200):**
```json
{
  "url": "/api/files/{storeId}/{type}s/{filename}",
  "key": "{storeId}/{type}s/{filename}",
  "filename": "promo-uuid.png",
  "size": 12345,
  "contentType": "image/png"
}
```

**Implementation:** `api/src/routes/upload.js` — `router.post('/')`

### File Serve — `GET /api/files/*`

Serves any file from R2 with proper Content-Type and caching headers. Uses wildcard route — the full path after `/api/files/` is the R2 key.

**Authentication:**
- **Public** for image files (paths containing `/promotions/` or `/discounts/` or `/logos/`)
- **Required** for import files (paths containing `/imports/`): user must be admin or belong to the owning store

**Content-Type resolution:**
1. First checks `object.httpMetadata.contentType` from R2 metadata
2. Falls back to extension-to-MIME map in `EXT_TO_MIME` (supports png, jpg, jpeg, webp, gif, svg, csv, json, xlsx, db, pdf)

**Cache headers:**
- Image files: `public, max-age=86400` (1 day)
- Document files: `private, max-age=300` (5 minutes)

**Implementation:** `api/src/routes/files.js` — `router.get('/*')`

### Route Mounting (in `api/src/index.js`)

```js
import { uploadRouter } from './routes/upload.js'
import { filesRouter } from './routes/files.js'

app.route('/api/upload', uploadRouter)
app.route('/api/files', filesRouter)
```

---

## File Path Convention

R2 keys follow this pattern:
```
{storeId}/{type}/{filename}
```

Where type is pluralized in the path:
| Upload `type` | R2 key folder | Example |
|---|---|---|
| `promotion` | `{storeId}/promotions/{filename}` | `uuid-abc/promotions/promo-1717500000.png` |
| `discount` | `{storeId}/discounts/{filename}` | `uuid-abc/discounts/disc-1717500000.png` |
| `logo` | `{storeId}/logos/{filename}` | `uuid-abc/logos/logo-1717500000.png` |
| `import` | `{storeId}/imports/original.{ext}` | `uuid-abc/imports/original.csv` |

**Filename generation** (`generateFilename` in `upload.js`):
| Type | Pattern |
|---|---|
| `logo` | `logo-{timestamp}.{ext}` |
| `promotion` | `{refId || 'promo-' + timestamp}.{ext}` |
| `discount` | `{refId || 'disc-' + timestamp}.{ext}` |
| `import` | `original.{ext}` |

**Extension resolution** (`getExtension`): tries filename dot-extension first, falls back to content-type mapping.

---

## Cache Strategy

| File type | Cache-Control | Rationale |
|---|---|---|
| Images (promotions, discounts, logos) | `public, max-age=86400` (1 day) | Images change infrequently; CDN cache reduces Worker invocations |
| Documents (imports) | `private, max-age=300` (5 min) | Sensitive store data; private cache, short TTL for fresh access |

Determined by checking `contentType.startsWith('image/')` in `files.js`.

---

## Frontend Upload Pattern

### `dataUrlToFile()` Helper

Converts a data URL (e.g., from canvas/cropper) to a `File` object for multipart upload. Defined identically in both `admin/js/api.js` and `dashboard/js/api.js`.

```js
function dataUrlToFile(dataUrl, filename) {
  const [meta, b64] = dataUrl.split(',', 2)
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/png'
  const byteStr = atob(b64)
  const ab = new ArrayBuffer(byteStr.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i)
  return new File([ab], filename, { type: mime })
}
```

### `uploadImage()` API Method

Signature (same in both admin and dashboard API clients):

```js
/**
 * Upload a data URL (cropped image) to R2 storage.
 * @param {string} dataUrl — cropped image as data:image/...;base64,...
 * @param {string} storeId — store UUID
 * @param {string} type — 'promotion', 'discount', 'banner'
 * @param {string} [refId] — optional reference ID
 * @returns {Promise<{url:string, key:string, filename:string, size:number, contentType:string}>}
 */
uploadImage: async (dataUrl, storeId, type, refId) => {
  const mime = dataUrl.match(/:(.*?);/)?.[1] || 'image/png'
  const ext = mime.split('/')[1] || 'png'
  const filename = `${type}-${Date.now()}.${ext}`
  const file = dataUrlToFile(dataUrl, filename)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('store_id', storeId)
  formData.append('type', type === 'banner' ? 'promotion' : type)
  if (refId) formData.append('ref_id', refId)

  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}
```

**Important:** When the frontend `type` is `'banner'`, it is converted to `'promotion'` before sending to the API — banners and offers are both stored with type `promotion` in R2.

---

## Database Columns

### Migration: `api/migrations/002_r2.sql`

```sql
-- Add image_url columns to promotion and discount_item tables
ALTER TABLE promotion ADD COLUMN image_url TEXT;
ALTER TABLE discount_item ADD COLUMN image_url TEXT;
```

### Display Priority

Across all three apps (scanner, dashboard, admin), images are displayed by preferring `image_url` (R2) over `image_data` (base64):

```js
const src = record.image_url || record.image_data || ''
```

This pattern is used in:
- **Scanner** (`js/app.js`): promotion banners, offer images, discount item images
- **Dashboard** (`dashboard/js/app.js`): promotion/offer editor, discount item editor
- **Admin** (`admin/js/app.js`): promotion/offer editor, discount item editor, banners table thumbnail

When saving, if an R2 upload was performed, the `image_url` is set to the returned URL and `image_data` is set to `null`. If no image change, the existing `image_url` or `image_data` is preserved.

---

## Metadata on R2 Objects

Files uploaded to R2 include custom metadata:
| Key | Source | Description |
|---|---|---|
| `originalName` | `file.name` from FormData | Original filename |
| `storeId` | `store_id` field | Owning store UUID |
| `type` | `type` field | Upload type (`promotion`, `discount`, `logo`, `import`) |
| `uploadedBy` | `user.id` from session | User who uploaded |
| `refId` | `ref_id` field (optional) | Reference ID if provided |

Set via `customMetadata` in the `CATALOGS.put()` call in `upload.js`.

---

## Allowed Upload Types

| `type` value | Used for | Image/Doc |
|---|---|---|
| `logo` | Store logo in branding | Image |
| `promotion` | Banner/offer images (type `'banner'` is converted to `'promotion'`) | Image |
| `discount` | Discount item images | Image |
| `import` | Imported product files (CSV, XLSX, DB, JSON) | Document |
