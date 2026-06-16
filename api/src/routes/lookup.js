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

  // Find all matching offers for this store and scanned product
  // Priority: product-triggered > category-triggered > always-show
  let offers = []
  if (product) {
    offers = await queryAll(c.env.DB,
      `SELECT title, image_data, image_url, trigger_type, trigger_value FROM promotion
       WHERE store_id = ? AND type = 'offer' AND active = 1
         AND (
           (trigger_type = 'product' AND trigger_value = ?)
           OR (trigger_type = 'category' AND trigger_value = ?)
           OR (trigger_type IS NULL AND trigger_value IS NULL)
         )
       ORDER BY
         CASE
           WHEN trigger_type = 'product' THEN 0
           WHEN trigger_type = 'category' THEN 1
           ELSE 2
         END,
         priority`,
      [store.id, barcode, product.category]
    )
  } else {
    offers = await queryAll(c.env.DB,
      `SELECT title, image_data, image_url FROM promotion
       WHERE store_id = ? AND type = 'offer' AND active = 1
         AND trigger_type IS NULL AND trigger_value IS NULL
       ORDER BY priority`,
      [store.id]
    )
  }

  if (product) {
    return c.json({ found: true, ...product, offers })
  }
  return c.json({ found: false, barcode, offers })
})

export { router as lookupRouter }
