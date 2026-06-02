// ─── Scan Event Routes ───────────────────────────────────────────────
// Log scan events and retrieve scan statistics.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'

const router = new Hono()

// Log a scan event (public)
router.post('/', async (c) => {
  const { store_slug, barcode } = await c.req.json()
  if (!store_slug || !barcode) {
    return c.json({ error: 'store_slug and barcode required' }, 400)
  }

  // Find store
  const store = await queryOne(c.env.DB,
    'SELECT id FROM organization WHERE slug = ?',
    [store_slug]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)

  // Find product (if exists)
  const product = await queryOne(c.env.DB,
    'SELECT id FROM product WHERE store_id = ? AND barcode = ?',
    [store.id, barcode]
  )

  // Insert scan event
  await execute(c.env.DB,
    'INSERT INTO scan_event (id, store_id, product_id, barcode, scanned_at) VALUES (?, ?, ?, ?, ?)',
    [uuid(), store.id, product?.id || null, barcode, new Date().toISOString()]
  )

  return c.json({ ok: true })
})

// Get scan stats (authenticated)
router.get('/stats', authenticate, async (c) => {
  const user = c.get('user')
  const storeId = c.req.query('store_id') || user.store_id

  // Total scans
  const totalRow = await queryOne(c.env.DB,
    'SELECT COUNT(*) as count FROM scan_event WHERE store_id = ?',
    [storeId]
  )
  const total = totalRow?.count || 0

  // Today's scans
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayRow = await queryOne(c.env.DB,
    'SELECT COUNT(*) as count FROM scan_event WHERE store_id = ? AND scanned_at >= ?',
    [storeId, todayStart.toISOString()]
  )
  const today = todayRow?.count || 0

  // Top 10 scanned products
  const topProducts = await queryAll(c.env.DB,
    `SELECT barcode, COUNT(*) as count FROM scan_event
     WHERE store_id = ? GROUP BY barcode ORDER BY count DESC LIMIT 10`,
    [storeId]
  )

  return c.json({ total, today, topProducts })
})

export { router as scansRouter }
