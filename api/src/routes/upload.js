// ─── R2 File Upload Route ──────────────────────────────────────────────
// Accepts file uploads (images, CSVs, etc.) and stores them in R2.
// Returns the file URL for persisting in the database.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { authenticate } from '../middleware.js'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
const ALLOWED_DOC_TYPES = [
  'text/csv', 'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.sqlite3', 'application/x-sqlite3',
  'application/octet-stream' // fallback for .db / .sqlite
]
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const router = new Hono()

/**
 * Generate a unique filename for the R2 key.
 */
function generateFilename(type, refId, ext) {
  const ts = Date.now()
  switch (type) {
    case 'logo':
      return `logo-${ts}.${ext}`
    case 'promotion':
      return `${refId || 'promo-' + ts}.${ext}`
    case 'discount':
      return `${refId || 'disc-' + ts}.${ext}`
    case 'import':
      return `original.${ext}`
    default:
      return `${type}-${ts}.${ext}`
  }
}

/**
 * Extract file extension from content type or filename.
 */
function getExtension(filename, contentType) {
  // Try filename first
  if (filename) {
    const dot = filename.lastIndexOf('.')
    if (dot >= 0) return filename.slice(dot + 1).toLowerCase()
  }
  // Fall back to content-type mapping
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.sqlite3': 'db',
    'application/x-sqlite3': 'db',
    'application/octet-stream': 'bin'
  }
  return map[contentType] || 'bin'
}

/**
 * POST /api/upload
 * Multipart form upload to R2.
 * Fields: file (required), store_id (required), type (required), ref_id (optional)
 */
router.post('/', authenticate, async (c) => {
  try {
    const contentType = c.req.header('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return c.json({ error: 'Content-Type must be multipart/form-data' }, 400)
    }

    const formData = await c.req.raw.formData()
    const file = formData.get('file')
    const storeId = formData.get('store_id')
    const type = formData.get('type')
    const refId = formData.get('ref_id')

    // ── Validation ──
    if (!file || !storeId || !type) {
      return c.json({ error: 'file, store_id, and type are required' }, 400)
    }

    if (!(file instanceof File)) {
      return c.json({ error: 'file must be a file upload' }, 400)
    }

    const validTypes = ['logo', 'promotion', 'discount', 'import']
    if (!validTypes.includes(type)) {
      return c.json({ error: `type must be one of: ${validTypes.join(', ')}` }, 400)
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({
        error: `Unsupported file type "${file.type}". Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` }, 400)
    }

    // ── Store access check ──
    const user = c.get('user')
    if (user.role !== 'admin' && user.store_id !== storeId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // ── Upload to R2 ──
    const ext = getExtension(file.name, file.type)
    const filename = generateFilename(type, refId, ext)
    const key = `${storeId}/${type === 'import' ? 'imports' : type + 's'}/${filename}`

    const arrayBuffer = await file.arrayBuffer()
    await c.env.CATALOGS.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        originalName: file.name,
        storeId,
        type,
        uploadedBy: user.id,
        refId: refId || ''
      }
    })

    // ── Response ──
    const url = `/api/files/${key}`
    return c.json({
      url,
      key,
      filename,
      size: file.size,
      contentType: file.type
    })
  } catch (err) {
    console.error('Upload error:', err)
    return c.json({ error: err.message || 'Upload failed' }, 500)
  }
})

export { router as uploadRouter }
