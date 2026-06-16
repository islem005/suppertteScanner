import { Hono } from 'hono'
import { queryAll, queryOne } from '../db.js'

const router = new Hono()

router.get('/:slug', async (c) => {
  const barcode = c.req.query('barcode')
  if (!barcode) return c.json({ error: 'Barcode query param required' }, 400)

  const store = await queryOne(c.env.DB,
    'SELECT id, name FROM organization WHERE slug = ?',
    [c.req.param('slug')]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const storeId = store.id

  const product = await queryOne(c.env.DB,
    'SELECT barcode, name, price, category FROM product WHERE store_id = ? AND barcode = ?',
    [storeId, barcode]
  )

  const [discount, categoryDiscounts, offers] = await Promise.all([
    queryOne(c.env.DB,
      `SELECT * FROM discount_item
       WHERE store_id = ? AND active = 1 AND barcode = ?
       ORDER BY priority LIMIT 1`,
      [storeId, barcode]
    ),
    product?.category
      ? queryAll(c.env.DB,
          `SELECT * FROM discount_item
           WHERE store_id = ? AND active = 1 AND category = ?
           ORDER BY priority`,
          [storeId, product.category]
        )
      : Promise.resolve([]),
    product
      ? queryAll(c.env.DB,
          `SELECT title, image_url, image_data, trigger_type, trigger_value FROM promotion
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
          [storeId, barcode, product.category]
        )
      : queryAll(c.env.DB,
          `SELECT title, image_url, image_data FROM promotion
           WHERE store_id = ? AND type = 'offer' AND active = 1
             AND trigger_type IS NULL AND trigger_value IS NULL
           ORDER BY priority`,
          [storeId]
        )
  ])

  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  return c.json({
    product: product ? { found: true, ...product } : null,
    discount: discount || null,
    categoryDiscounts: categoryDiscounts || [],
    offers: offers
  })
})

export { router as scanRouter }
