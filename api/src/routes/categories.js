import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'

const router = new Hono()

router.get('/', authenticate, async (c) => {
  const storeId = c.req.query('store_id')
  if (!storeId) return c.json({ error: 'store_id query param required' }, 400)

  const rows = await queryAll(c.env.DB,
    `SELECT * FROM category WHERE store_id IS NULL OR store_id = ? ORDER BY sort_order, name`,
    [storeId]
  )

  const result = rows.map(r => ({
    ...r,
    global: r.store_id === null
  }))

  return c.json(result)
})

router.post('/', authenticate, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { store_id, name, name_en, name_fr, name_ar, sort_order } = body

  if (!store_id) return c.json({ error: 'store_id required' }, 400)
  if (!name || !name.trim()) return c.json({ error: 'name required' }, 400)

  if (user.role !== 'admin' && user.store_id !== store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const existing = await queryOne(c.env.DB,
    'SELECT id FROM category WHERE store_id = ? AND name = ?',
    [store_id, name.trim()]
  )
  if (existing) return c.json({ error: 'Category already exists for this store' }, 409)

  const now = new Date().toISOString()
  const id = uuid()
  await execute(c.env.DB,
    `INSERT INTO category (id, store_id, name, name_en, name_fr, name_ar, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, store_id, name.trim(), name_en || null, name_fr || null, name_ar || null, sort_order || 0, now, now]
  )

  const cat = await queryOne(c.env.DB, 'SELECT * FROM category WHERE id = ?', [id])
  return c.json({ ...cat, global: false })
})

router.put('/:id', authenticate, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = await queryOne(c.env.DB, 'SELECT * FROM category WHERE id = ?', [id])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  if (existing.store_id === null) {
    if (user.role !== 'admin') return c.json({ error: 'Only admins can edit base categories' }, 403)
  } else if (user.role !== 'admin' && user.store_id !== existing.store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const now = new Date().toISOString()
  const name = body.name !== undefined ? body.name.trim() : existing.name
  const name_en = body.name_en !== undefined ? body.name_en : existing.name_en
  const name_fr = body.name_fr !== undefined ? body.name_fr : existing.name_fr
  const name_ar = body.name_ar !== undefined ? body.name_ar : existing.name_ar
  const sort_order = body.sort_order !== undefined ? body.sort_order : existing.sort_order

  await execute(c.env.DB,
    `UPDATE category SET name = ?, name_en = ?, name_fr = ?, name_ar = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
    [name, name_en, name_fr, name_ar, sort_order, now, id]
  )

  const cat = await queryOne(c.env.DB, 'SELECT * FROM category WHERE id = ?', [id])
  return c.json({ ...cat, global: cat.store_id === null })
})

router.delete('/:id', authenticate, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const existing = await queryOne(c.env.DB, 'SELECT * FROM category WHERE id = ?', [id])
  if (!existing) return c.json({ ok: true })

  if (existing.store_id === null) {
    return c.json({ error: 'Cannot delete base category' }, 400)
  }

  if (user.role !== 'admin' && user.store_id !== existing.store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await execute(c.env.DB, 'DELETE FROM category WHERE id = ?', [id])
  return c.json({ ok: true })
})

export { router as categoriesRouter }
