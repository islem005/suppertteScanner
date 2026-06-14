// ─── Promotion Routes ────────────────────────────────────────────────
// Banners and offers associated with stores.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'
import { logAudit } from './audit.js'
import { validateBody, validateName } from '../validate.js'
import { getStoreLimits, countActiveOffers, countAlwaysShowOffers } from '../limits.js'

const router = new Hono()

// Public read endpoints (used by scanner)
router.get('/banners/:storeId', async (c) => {
  const data = await queryAll(c.env.DB,
    "SELECT * FROM promotion WHERE store_id = ? AND type = 'banner' AND active = 1 ORDER BY priority",
    [c.req.param('storeId')]
  )
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  return c.json(data)
})

router.get('/offers/:storeId', async (c) => {
  const data = await queryAll(c.env.DB,
    "SELECT * FROM promotion WHERE store_id = ? AND type = 'offer' AND active = 1 ORDER BY priority",
    [c.req.param('storeId')]
  )
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  return c.json(data)
})

// Admin/dashboard: get all promotions for a store
router.get('/store/:storeId', authenticate, async (c) => {
  const storeId = c.req.param('storeId')
  const page = Math.max(1, parseInt(c.req.query('page')) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('per_page')) || 20))
  const offset = (page - 1) * perPage

  const promotions = await queryAll(c.env.DB,
    'SELECT * FROM promotion WHERE store_id = ? ORDER BY type, priority LIMIT ? OFFSET ?',
    [storeId, perPage, offset]
  )

  const totalRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as c FROM promotion WHERE store_id = ?'
  ).bind(storeId).first()

  return c.json({
    promotions: promotions || [],
    total: totalRow?.c || 0,
    page,
    perPage
  })
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
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.store_id || !body.type) {
    return c.json({ error: 'store_id and type required' }, 400)
  }

  const { valid, errors } = validateBody(body, {
    title: { required: false, validate: v => validateName(v, 'Title') }
  })
  if (!valid) return c.json({ error: errors.join(', ') }, 400)

  if (body.type === 'offer' && body.active !== 0) {
    const limits = await getStoreLimits(c.env.DB, body.store_id)
    if (!body.trigger_type) {
      const alwaysShow = await countAlwaysShowOffers(c.env.DB, body.store_id)
      if (alwaysShow >= limits.offersAlwaysShow) {
        return c.json({ error: `Always-showing offer limit reached (max ${limits.offersAlwaysShow})` }, 400)
      }
    }
    const total = await countActiveOffers(c.env.DB, body.store_id)
    if (total >= limits.offersActive) {
      return c.json({ error: `Active offer limit reached (max ${limits.offersActive})` }, 400)
    }
  }

  const id = uuid()
  await execute(c.env.DB,
    `INSERT INTO promotion (id, store_id, type, title, image_data, image_url, trigger_type, trigger_value, active, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, body.store_id, body.type, body.title || '', body.image_data || null,
     body.image_url || null, body.trigger_type || null, body.trigger_value || null,
     body.active !== undefined ? body.active : 1, body.priority || 0]
  )

  const data = await queryOne(c.env.DB, 'SELECT * FROM promotion WHERE id = ?', [id])

  logAudit(c.env, {
    storeId: body.store_id, userId: user.id, userName: user.display_name || user.email,
    userRole: user.role, action: 'create', entityType: 'promotion',
    entityId: id, details: { type: body.type, title: body.title }
  })

  return c.json(data)
})

// Update promotion
router.put('/:id', authenticate, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const id = c.req.param('id')

  const existing = await queryOne(c.env.DB, 'SELECT * FROM promotion WHERE id = ?', [id])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  if (existing.type === 'offer') {
    const newActive = body.active !== undefined ? body.active : existing.active
    const newTrigger = body.trigger_type !== undefined ? body.trigger_type : existing.trigger_type
    if (newActive !== 0) {
      const limits = await getStoreLimits(c.env.DB, existing.store_id)
      if (!newTrigger) {
        const alwaysShow = await countAlwaysShowOffers(c.env.DB, existing.store_id, id)
        if (alwaysShow >= limits.offersAlwaysShow) {
          return c.json({ error: `Always-showing offer limit reached (max ${limits.offersAlwaysShow})` }, 400)
        }
      }
      const total = await countActiveOffers(c.env.DB, existing.store_id, id)
      if (total >= limits.offersActive) {
        return c.json({ error: `Active offer limit reached (max ${limits.offersActive})` }, 400)
      }
    }
  }

  const allowed = ['store_id', 'type', 'title', 'image_data', 'image_url', 'trigger_type', 'trigger_value', 'active', 'priority']
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

  logAudit(c.env, {
    storeId: data.store_id, userId: user.id, userName: user.display_name || user.email,
    userRole: user.role, action: 'update', entityType: 'promotion',
    entityId: id, details: { title: data.title, changes: Object.keys(body).filter(k => k !== 'store_id') }
  })

  return c.json(data)
})

// Delete promotion
router.delete('/:id', authenticate, async (c) => {
  const user = c.get('user')
  const existing = await queryOne(c.env.DB, 'SELECT * FROM promotion WHERE id = ?', [c.req.param('id')])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await execute(c.env.DB, 'DELETE FROM promotion WHERE id = ?', [c.req.param('id')])

  logAudit(c.env, {
    storeId: existing.store_id, userId: user.id, userName: user.display_name || user.email,
    userRole: user.role, action: 'delete', entityType: 'promotion',
    entityId: existing.id, details: { title: existing.title, type: existing.type }
  })

  return c.json({ ok: true })
})

export { router as promotionsRouter }
