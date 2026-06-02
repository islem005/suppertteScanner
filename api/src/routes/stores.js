// ─── Store Routes (Organizations) ────────────────────────────────────
// Uses Better Auth's organization plugin for multi-tenant stores.
// Each store is an organization in Better Auth.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'

const router = new Hono()

// Public routes (before auth middleware)
router.get('/slug/:slug', async (c) => {
  const store = await queryOne(c.env.DB,
    'SELECT id, name, slug FROM organization WHERE slug = ?',
    [c.req.param('slug')]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)
  return c.json(store)
})

// Store routes require authentication
router.use('*', authenticate)

router.get('/', async (c) => {
  const user = c.get('user')

  if (user.role === 'admin') {
    // Admin sees all stores (organizations)
    const stores = await queryAll(c.env.DB,
      'SELECT id, name, slug, createdAt as created_at FROM organization ORDER BY name'
    )
    return c.json(stores)
  }

  // Non-admin sees their own store
  const store = await queryOne(c.env.DB,
    'SELECT id, name, slug, createdAt as created_at FROM organization WHERE id = ?',
    [user.store_id]
  )
  return c.json(store ? [store] : [])
})

router.post('/', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  const { name, slug } = await c.req.json()
  if (!name || !slug) return c.json({ error: 'Name and slug required' }, 400)

  const id = uuid()
  const cleanSlug = slug.toLowerCase().replace(/\s+/g, '-')

  await execute(c.env.DB,
    'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
    [id, name, cleanSlug]
  )

  const store = await queryOne(c.env.DB,
    'SELECT * FROM organization WHERE id = ?', [id]
  )
  return c.json(store)
})

router.get('/:id', async (c) => {
  const user = c.get('user')
  const store = await queryOne(c.env.DB,
    'SELECT * FROM organization WHERE id = ?',
    [c.req.param('id')]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)
  if (user.role !== 'admin' && store.id !== user.store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  return c.json(store)
})

router.delete('/:id', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  await execute(c.env.DB,
    'DELETE FROM organization WHERE id = ?',
    [c.req.param('id')]
  )
  return c.json({ ok: true })
})

export { router as storesRouter }
