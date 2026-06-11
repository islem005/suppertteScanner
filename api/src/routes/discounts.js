// ─── Discount Item Routes ────────────────────────────────────────────
// Discounted/sale items for stores.
// Follows promotions router pattern: specific routes before generic.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'
import { logAudit } from './audit.js'
import { validateBody, validateBarcode, validateName, validatePrice } from '../validate.js'

const router = new Hono()

// ── Admin/dashboard: list all discounts for a store ──
router.get('/store/:storeId', authenticate, async (c) => {
  const storeId = c.req.param('storeId')
  const page = Math.max(1, parseInt(c.req.query('page')) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('per_page')) || 20))
  const offset = (page - 1) * perPage

  const discounts = await queryAll(c.env.DB,
    'SELECT * FROM discount_item WHERE store_id = ? ORDER BY priority LIMIT ? OFFSET ?',
    [storeId, perPage, offset]
  )

  const totalRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as c FROM discount_item WHERE store_id = ?'
  ).bind(storeId).first()

  return c.json({
    discounts: discounts || [],
    total: totalRow?.c || 0,
    page,
    perPage
  })
})

// ── Admin/dashboard: get single discount item ──
router.get('/item/:id', authenticate, async (c) => {
  const data = await queryOne(c.env.DB, 'SELECT * FROM discount_item WHERE id = ?', [c.req.param('id')])
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// ── Public routes (used by scanner app) ──

// GET /featured/:storeId — only featured discounts
router.get('/featured/:storeId', async (c) => {
  const data = await queryAll(c.env.DB,
    'SELECT * FROM discount_item WHERE store_id = ? AND active = 1 AND featured = 1 ORDER BY priority',
    [c.req.param('storeId')]
  )
  return c.json(data)
})

// GET /:storeId — active discounts, with optional query filters
//   ?featured=1     — only featured items (backward compat with scanner)
//   ?barcode=XXX    — filter by barcode
//   ?category=XXX   — filter by category
// Must be defined LAST among GET routes to avoid swallowing /store/:storeId and /item/:id
router.get('/:storeId', async (c) => {
  const storeId = c.req.param('storeId')
  const { featured, barcode, category } = c.req.query()

  let sql = 'SELECT * FROM discount_item WHERE store_id = ? AND active = 1'
  const params = [storeId]

  if (featured === '1' || featured === 'true') {
    sql += ' AND featured = 1'
  }
  if (barcode) {
    sql += ' AND barcode = ?'
    params.push(barcode)
  }
  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }

  sql += ' ORDER BY priority'

  const data = await queryAll(c.env.DB, sql, params)
  return c.json(data)
})

// ── Admin/dashboard: create discount item ──
router.post('/', authenticate, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.store_id || !body.name) {
    return c.json({ error: 'store_id and name required' }, 400)
  }

  const { valid, errors } = validateBody(body, {
    barcode: { required: false, validate: v => validateBarcode(v) },
    name: { required: true, validate: v => validateName(v) },
    original_price: { required: false, validate: v => validatePrice(v) },
    new_price: { required: false, validate: v => validatePrice(v) }
  })
  if (!valid) return c.json({ error: errors.join(', ') }, 400)

  const id = uuid()
  await execute(c.env.DB,
    `INSERT INTO discount_item (id, store_id, barcode, name, image_data, image_url, category,
     original_price, new_price, discount_percent, featured, active, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, body.store_id, body.barcode || null, body.name, body.image_data || null,
     body.image_url || null, body.category || null, body.original_price || 0, body.new_price || 0,
     body.discount_percent || null, body.featured || 0,
     body.active !== undefined ? body.active : 1, body.priority || 0]
  )

  const data = await queryOne(c.env.DB, 'SELECT * FROM discount_item WHERE id = ?', [id])

  logAudit(c.env, {
    storeId: body.store_id, userId: user.id, userName: user.display_name || user.email,
    userRole: user.role, action: 'create', entityType: 'discount',
    entityId: id, details: { name: body.name, barcode: body.barcode }
  })

  return c.json(data)
})

// ── Admin/dashboard: update discount item ──
router.put('/:id', authenticate, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const id = c.req.param('id')

  const { valid, errors } = validateBody(body, {
    barcode: { required: false, validate: v => validateBarcode(v) },
    name: { required: false, validate: v => validateName(v) },
    original_price: { required: false, validate: v => validatePrice(v) },
    new_price: { required: false, validate: v => validatePrice(v) }
  })
  if (!valid) return c.json({ error: errors.join(', ') }, 400)

  const allowed = ['store_id', 'barcode', 'name', 'image_data', 'image_url', 'category',
    'original_price', 'new_price', 'discount_percent', 'featured', 'active', 'priority']
  const sets = []
  const vals = []
  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`)
      vals.push(body[key])
    }
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400)

  vals.push(id)
  await execute(c.env.DB,
    `UPDATE discount_item SET ${sets.join(', ')} WHERE id = ?`,
    vals
  )

  const data = await queryOne(c.env.DB, 'SELECT * FROM discount_item WHERE id = ?', [id])
  if (!data) return c.json({ error: 'Not found' }, 404)

  logAudit(c.env, {
    storeId: data.store_id, userId: user.id, userName: user.display_name || user.email,
    userRole: user.role, action: 'update', entityType: 'discount',
    entityId: id, details: { name: data.name, changes: Object.keys(body).filter(k => k !== 'store_id') }
  })

  return c.json(data)
})

router.delete('/:id', authenticate, async (c) => {
  const user = c.get('user')
  const existing = await queryOne(c.env.DB, 'SELECT * FROM discount_item WHERE id = ?', [c.req.param('id')])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await execute(c.env.DB, 'DELETE FROM discount_item WHERE id = ?', [c.req.param('id')])

  logAudit(c.env, {
    storeId: existing.store_id, userId: user.id, userName: user.display_name || user.email,
    userRole: user.role, action: 'delete', entityType: 'discount',
    entityId: existing.id, details: { name: existing.name, barcode: existing.barcode }
  })

  return c.json({ ok: true })
})

export { router as discountsRouter }
