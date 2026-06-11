// ─── R2 File Serve Route ───────────────────────────────────────────────
// Serves files from R2 bucket with proper Content-Type and caching.
// Public access for images; auth required for import files.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { generateStoreQR } from '../qr.js'

const router = new Hono()

// Content-type map for common extensions (fallback when R2 metadata is missing)
const EXT_TO_MIME = {
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'webp': 'image/webp',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'csv': 'text/csv',
  'json': 'application/json',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'db': 'application/vnd.sqlite3',
  'pdf': 'application/pdf'
}

/**
 * GET /api/files/{storeId}/{type}/{filename}
 * The wildcard catches the full path after /api/files/.
 */
router.get('/*', async (c) => {
  // Extract path from the URL after /api/files/
  const url = new URL(c.req.url)
  const key = url.pathname.replace(/^\/api\/files\//, '')
  if (!key) {
    return c.json({ error: 'File path required' }, 400)
  }

  // ── Auth check for import files ──
  if (key.includes('/imports/')) {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required for import files' }, 401)
    }
    // Extract storeId from key: {storeId}/imports/...
    const storeId = key.split('/')[0]
    if (user.role !== 'admin' && user.store_id !== storeId) {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  try {
    let object = await c.env.CATALOGS.get(key)
    if (!object && key.startsWith('qr/') && key.endsWith('.svg')) {
      const slug = key.replace('qr/', '').replace('.svg', '')
      if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        try {
          await generateStoreQR(c.env, slug)
          object = await c.env.CATALOGS.get(key)
        } catch {}
      }
    }
    if (!object) {
      return c.json({ error: 'File not found' }, 404)
    }

    // Determine Content-Type
    let contentType = object.httpMetadata?.contentType
    if (!contentType) {
      const ext = key.split('.').pop()?.toLowerCase()
      contentType = EXT_TO_MIME[ext] || 'application/octet-stream'
    }

    // Cache images for 1 day, documents for 5 minutes
    const isImage = contentType.startsWith('image/')
    const cacheControl = isImage
      ? 'public, max-age=86400'
      : 'private, max-age=300'

    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'Content-Length': object.size.toString()
    })

    return new Response(object.body, { headers })
  } catch (err) {
    console.error('File serve error:', err)
    return c.json({ error: 'Failed to serve file' }, 500)
  }
})

export { router as filesRouter }

// ─── Notes ─────────────────────────────────────────────────────────
// The `/*` wildcard in a Hono sub-router captures the path correctly,
// but `c.req.param('*')` may return empty in some Worker environments
// (the `*` is treated as a catch-all route pattern, but the param name
// may differ). We use URL pathname extraction instead.
// ────────────────────────────────────────────────────────────────────
