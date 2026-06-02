// ─── Barcode Lookup Routes (Public) ──────────────────────────────────
// Slug-scoped product lookup for scanner app.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryOne, queryAll } from '../db.js'

const router = new Hono()

router.get('/:slug', async (c) => {
  const barcode = c.req.query('barcode')
  if (!barcode) return c.json({ error: 'Barcode query param required' }, 400)

  // Find store by slug
  const store = await queryOne(c.env.DB,
    'SELECT id FROM organization WHERE slug = ?',
    [c.req.param('slug')]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)

  // Look up product by barcode for this store
  const product = await queryOne(c.env.DB,
    'SELECT barcode, name, price, category FROM product WHERE store_id = ? AND barcode = ?',
    [store.id, barcode]
  )

  // Find matching offer for this store
  const offer = await queryOne(c.env.DB,
    `SELECT title, image_data, trigger_type, trigger_value FROM promotion
     WHERE store_id = ? AND type = 'offer' AND active = 1 ORDER BY priority LIMIT 1`,
    [store.id]
  )

  if (product) {
    return c.json({ found: true, ...product, offer: offer || null })
  }
  return c.json({ found: false, barcode, offer: offer || null })
})

export { router as lookupRouter }
