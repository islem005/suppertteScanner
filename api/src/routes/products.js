// ─── Product Routes ──────────────────────────────────────────────────
// CRUD for store products, including CSV upload.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'
import { parse } from 'csv-parse/sync'
import { logAudit } from './audit.js'

const router = new Hono()

router.get('/', authenticate, async (c) => {
  const user = c.get('user')
  const storeId = c.req.query('store_id') || user.store_id

  const products = await queryAll(c.env.DB,
    'SELECT * FROM product WHERE store_id = ? ORDER BY name',
    [storeId]
  )
  return c.json(products)
})

router.post('/', authenticate, async (c) => {
  const user = c.get('user')
  const { barcode, name, price, category, store_id } = await c.req.json()

  if (!barcode || !name || price === undefined) {
    return c.json({ error: 'Barcode, name, and price required' }, 400)
  }

  // Use store_id from body if provided (admins may manage multiple stores),
  // otherwise fall back to the user's own store_id
  const effectiveStoreId = store_id || user.store_id
  if (!effectiveStoreId) {
    return c.json({ error: 'No store_id specified and user has no store' }, 400)
  }

  const now = new Date().toISOString()

  const existing = await queryOne(c.env.DB,
    'SELECT id FROM product WHERE store_id = ? AND barcode = ?',
    [effectiveStoreId, barcode]
  )

  if (existing) {
    await execute(c.env.DB,
      'UPDATE product SET name = ?, price = ?, category = ?, updated_at = ? WHERE id = ?',
      [name, price, category || null, now, existing.id]
    )
  } else {
    await execute(c.env.DB,
      `INSERT INTO product (id, store_id, barcode, name, price, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), effectiveStoreId, barcode, name, price, category || null, now, now]
    )
  }

  const product = await queryOne(c.env.DB,
    'SELECT * FROM product WHERE store_id = ? AND barcode = ?',
    [effectiveStoreId, barcode]
  )

  logAudit(c.env, {
    storeId: effectiveStoreId, userId: user.id, userName: user.display_name || user.email,
    userRole: user.role, action: existing ? 'update' : 'create', entityType: 'product',
    entityId: product.id, details: { name, barcode, price, category }
  })

  return c.json(product)
})

router.post('/upload', authenticate, async (c) => {
  const user = c.get('user')
  const { csv } = await c.req.json()

  if (!csv) return c.json({ error: 'CSV content required' }, 400)

  let records
  try {
    records = parse(csv, { columns: true, skip_empty_lines: true, trim: true })
  } catch {
    return c.json({ error: 'Invalid CSV format' }, 400)
  }

  const now = new Date().toISOString()
  const products = records.map(r => ({
    id: uuid(),
    store_id: user.store_id,
    barcode: r.barcode || r.Barcode || r.BARCODE || '',
    name: r.name || r.Name || r.product_name || r.Product || '',
    price: parseFloat(r.price || r.Price || r.PRICE || 0),
    category: r.category || r.Category || r.CATEGORY || null,
    created_at: now,
    updated_at: now
  })).filter(p => p.barcode && p.name)

  if (products.length === 0) {
    return c.json({ error: 'No valid products found in CSV' }, 400)
  }

  // Batch insert with ON CONFLICT DO NOTHING for existing barcode+store combos
  // We'll do individual inserts for simplicity with D1
  let imported = 0
  for (const p of products) {
    const existing = await queryOne(c.env.DB,
      'SELECT id FROM product WHERE store_id = ? AND barcode = ?',
      [user.store_id, p.barcode]
    )
    if (existing) {
      await execute(c.env.DB,
        `UPDATE product SET name = ?, price = ?, category = ?, updated_at = ? WHERE id = ?`,
        [p.name, p.price, p.category, now, existing.id]
      )
    } else {
      await execute(c.env.DB,
        `INSERT INTO product (id, store_id, barcode, name, price, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.store_id, p.barcode, p.name, p.price, p.category, now, now]
      )
    }
    imported++
  }

  return c.json({ imported })
})

// Barcode lookup by store_id (authenticated — for dashboard/admin discount form)
router.get('/lookup/:storeId', authenticate, async (c) => {
  const barcode = c.req.query('barcode')
  if (!barcode) return c.json({ error: 'Barcode query param required' }, 400)

  const product = await queryOne(c.env.DB,
    'SELECT barcode, name, price, category FROM product WHERE store_id = ? AND barcode = ?',
    [c.req.param('storeId'), barcode]
  )

  if (product) {
    product.found = true
    return c.json(product)
  }
  return c.json({ found: false, barcode })
})

router.delete('/:id', authenticate, async (c) => {
  const user = c.get('user')

  const product = await queryOne(c.env.DB,
    'SELECT id, name, barcode, store_id FROM product WHERE id = ?',
    [c.req.param('id')]
  )

  if (!product) return c.json({ error: 'Not found' }, 404)
  if (user.role !== 'admin' && product.store_id !== user.store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await execute(c.env.DB,
    'DELETE FROM product WHERE id = ?',
    [c.req.param('id')]
  )

  logAudit(c.env, {
    storeId: product.store_id, userId: user.id, userName: user.display_name || user.email,
    userRole: user.role, action: 'delete', entityType: 'product',
    entityId: product.id, details: { name: product.name, barcode: product.barcode }
  })

  return c.json({ ok: true })
})

export { router as productsRouter }
