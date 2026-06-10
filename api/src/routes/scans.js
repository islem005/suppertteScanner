// ─── Scan Event Routes ───────────────────────────────────────────────
// Log scan events and retrieve scan statistics.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid, upsertClientDevice } from '../db.js'
import { authenticate } from '../middleware.js'

const router = new Hono()

// Log a scan event (public)
router.post('/', async (c) => {
  const { store_slug, barcode, client_id, session_id, device_type } = await c.req.json()
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
    'INSERT INTO scan_event (id, store_id, product_id, barcode, client_id, session_id, scanned_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuid(), store.id, product?.id || null, barcode, client_id || null, session_id || null, new Date().toISOString()]
  )

  // Upsert client device
  if (client_id) {
    const userAgent = c.req.header('user-agent')
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')
    await upsertClientDevice(c.env.DB, {
      id: client_id,
      storeId: store.id,
      userAgent,
      ip,
      deviceType: device_type || null,
      incrementScans: true
    })
  }

  return c.json({ ok: true })
})

// Get scan stats (authenticated)
router.get('/stats', authenticate, async (c) => {
  const user = c.get('user')
  const storeId = c.req.query('store_id') || user.store_id

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStr = todayStart.toISOString()

  const [totalRow, todayRow, topProducts, visitRow, visitsTodayRow, deviceRow, hitRow] = await Promise.all([
    queryOne(c.env.DB, 'SELECT COUNT(*) as count FROM scan_event WHERE store_id = ?', [storeId]),
    queryOne(c.env.DB, 'SELECT COUNT(*) as count FROM scan_event WHERE store_id = ? AND scanned_at >= ?', [storeId, todayStr]),
    queryAll(c.env.DB, `SELECT barcode, COUNT(*) as count FROM scan_event WHERE store_id = ? GROUP BY barcode ORDER BY count DESC LIMIT 10`, [storeId]),
    queryOne(c.env.DB, 'SELECT COUNT(*) as count FROM page_view WHERE store_id = ?', [storeId]),
    queryOne(c.env.DB, 'SELECT COUNT(*) as count FROM page_view WHERE store_id = ? AND viewed_at >= ?', [storeId, todayStr]),
    queryOne(c.env.DB, 'SELECT COUNT(DISTINCT client_id) as count FROM page_view WHERE store_id = ? AND client_id IS NOT NULL', [storeId]),
    queryOne(c.env.DB, "SELECT COUNT(*) as count FROM scan_event WHERE store_id = ? AND product_id IS NOT NULL", [storeId])
  ])

  const total = totalRow?.count || 0
  const today = todayRow?.count || 0
  const totalHits = hitRow?.count || 0

  return c.json({
    total,
    today,
    topProducts,
    visits: visitRow?.count || 0,
    visitsToday: visitsTodayRow?.count || 0,
    devices: deviceRow?.count || 0,
    hitRate: total > 0 ? Math.round((totalHits / total) * 100) : 0,
    scansPerVisit: (visitRow?.count || 0) > 0 ? parseFloat((total / (visitRow?.count || 1)).toFixed(1)) : 0
  })
})

export { router as scansRouter }
