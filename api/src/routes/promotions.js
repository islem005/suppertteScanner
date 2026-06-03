// ─── Promotion Routes ────────────────────────────────────────────────
// Banners and offers associated with stores.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'

const router = new Hono()

// Public read endpoints (used by scanner)
router.get('/banners/:storeId', async (c) => {
  const data = await queryAll(c.env.DB,
    "SELECT * FROM promotion WHERE store_id = ? AND type = 'banner' AND active = 1 ORDER BY priority",
    [c.req.param('storeId')]
  )
  return c.json(data)
})

router.get('/offers/:storeId', async (c) => {
  const data = await queryAll(c.env.DB,
    "SELECT * FROM promotion WHERE store_id = ? AND type = 'offer' AND active = 1 ORDER BY priority",
    [c.req.param('storeId')]
  )
  return c.json(data)
})

// Admin/dashboard: get all promotions for a store
router.get('/store/:storeId', authenticate, async (c) => {
  const data = await queryAll(c.env.DB,
    'SELECT * FROM promotion WHERE store_id = ? ORDER BY type, priority',
    [c.req.param('storeId')]
  )
  return c.json(data)
})

// Admin/dashboard: get single promotion by ID
router.get('/single/:id', authenticate, async (c) => {
  const data = await queryOne(c.env.DB,
    'SELECT * FROM promotion WHERE id = ?',
    [c.req.param('id')]
  )
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// Create promotion
router.post('/', authenticate, async (c) => {
  const body = await c.req.json()

  if (!body.store_id || !body.type) {
    return c.json({ error: 'store_id and type required' }, 400)
  }

  const id = uuid()
  await execute(c.env.DB,
    `INSERT INTO promotion (id, store_id, type, title, image_data, trigger_type, trigger_value, active, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, body.store_id, body.type, body.title || '', body.image_data || null,
     body.trigger_type || null, body.trigger_value || null,
     body.active !== undefined ? body.active : 1, body.priority || 0]
  )

  const data = await queryOne(c.env.DB, 'SELECT * FROM promotion WHERE id = ?', [id])
  return c.json(data)
})

// Update promotion
router.put('/:id', authenticate, async (c) => {
  const body = await c.req.json()
  const id = c.req.param('id')

  const allowed = ['store_id', 'type', 'title', 'image_data', 'trigger_type', 'trigger_value', 'active', 'priority']
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
    `UPDATE promotion SET ${sets.join(', ')} WHERE id = ?`,
    vals
  )

  const data = await queryOne(c.env.DB, 'SELECT * FROM promotion WHERE id = ?', [id])
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// Delete promotion
router.delete('/:id', authenticate, async (c) => {
  await execute(c.env.DB, 'DELETE FROM promotion WHERE id = ?', [c.req.param('id')])
  return c.json({ ok: true })
})

export { router as promotionsRouter }
