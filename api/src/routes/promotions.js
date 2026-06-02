// ─── Promotion Routes ────────────────────────────────────────────────
// Banners and offers associated with stores.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'

const router = new Hono()

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

router.delete('/:id', authenticate, async (c) => {
  await execute(c.env.DB, 'DELETE FROM promotion WHERE id = ?', [c.req.param('id')])
  return c.json({ ok: true })
})

export { router as promotionsRouter }
