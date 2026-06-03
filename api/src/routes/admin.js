// ─── Admin Routes ────────────────────────────────────────────────────
// Platform-wide admin endpoints: stats, users, activity.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate, adminOnly } from '../middleware.js'
import { createAuth } from '../auth/index.js'

const router = new Hono()
router.use('*', authenticate, adminOnly)

router.get('/stats', async (c) => {
  const db = c.env.DB

  const [stores, users, products, scans] = await Promise.all([
    queryAll(db, 'SELECT * FROM organization'),
    queryAll(db, 'SELECT id, email, display_name as display_name, role, store_id FROM user'),
    queryAll(db, 'SELECT id, store_id FROM product'),
    queryAll(db, 'SELECT * FROM scan_event')
  ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayScans = scans.filter(s => new Date(s.scanned_at) >= today).length

  const storeStats = stores.map(s => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    products: products.filter(p => p.store_id === s.id).length,
    scans: scans.filter(sc => sc.store_id === s.id).length,
    users: users.filter(u => u.store_id === s.id).length
  }))

  return c.json({
    totalStores: stores.length,
    totalUsers: users.length,
    totalProducts: products.length,
    totalScans: scans.length,
    todayScans,
    storeStats
  })
})

router.get('/users', async (c) => {
  const users = await queryAll(c.env.DB,
    'SELECT id, email, display_name, role, store_id, createdAt FROM user ORDER BY createdAt DESC'
  )
  return c.json(users)
})

router.post('/users', async (c) => {
  const { email, password, displayName, storeId, role } = await c.req.json()
  if (!email || !password || !displayName) {
    return c.json({ error: 'email, password, displayName required' }, 400)
  }

  // Use Better Auth to create user (role is input:false, set separately)
  const auth = createAuth(c.env)

  let result
  try {
    result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: displayName,
        display_name: displayName,
        store_id: storeId || null
      }
    })
  } catch (err) {
    // Better Auth may reject passwords that are too short (default min 8 chars)
    return c.json({ error: err.message || 'Password validation failed' }, 400)
  }

  // Set role directly in DB (can't set via signUpEmail due to input: false)
  if (role && role !== 'staff') {
    await execute(c.env.DB,
      'UPDATE user SET role = ? WHERE id = ?',
      [role, result.user.id]
    )
  }

  // Return the created user with role
  const created = await queryOne(c.env.DB,
    'SELECT id, email, name, display_name, role, store_id, createdAt FROM user WHERE id = ?',
    [result.user.id]
  )
  return c.json(created)
})

router.delete('/users/:id', async (c) => {
  // Remove user's sessions and accounts first
  await execute(c.env.DB, 'DELETE FROM session WHERE userId = ?', [c.req.param('id')])
  await execute(c.env.DB, 'DELETE FROM account WHERE userId = ?', [c.req.param('id')])
  await execute(c.env.DB, 'DELETE FROM member WHERE userId = ?', [c.req.param('id')])
  await execute(c.env.DB, 'DELETE FROM invitation WHERE inviterId = ?', [c.req.param('id')])
  await execute(c.env.DB, 'DELETE FROM user WHERE id = ?', [c.req.param('id')])

  return c.json({ ok: true })
})

router.get('/activity', async (c) => {
  const db = c.env.DB
  const limit = parseInt(c.req.query('limit')) || 30

  const [stores, users, allProducts, scans] = await Promise.all([
    queryAll(db, 'SELECT * FROM organization ORDER BY createdAt DESC'),
    queryAll(db, 'SELECT * FROM user'),
    queryAll(db, 'SELECT id, store_id FROM product'),
    queryAll(db, 'SELECT * FROM scan_event')
  ])

  const storeUserCounts = {}
  for (const u of users) {
    const key = u.store_id || '__none__'
    storeUserCounts[key] = (storeUserCounts[key] || 0) + 1
  }

  const storeProductCounts = {}
  for (const p of allProducts) {
    storeProductCounts[p.store_id] = (storeProductCounts[p.store_id] || 0) + 1
  }

  const storeScanCounts = {}
  for (const s of scans) {
    storeScanCounts[s.store_id] = (storeScanCounts[s.store_id] || 0) + 1
  }

  const activity = stores.slice(0, limit).map(s => ({
    store_id: s.id,
    store_name: s.name,
    store_slug: s.slug,
    created_at: s.createdAt,
    products: storeProductCounts[s.id] || 0,
    scans: storeScanCounts[s.id] || 0,
    users: storeUserCounts[s.id] || 0
  }))

  return c.json(activity)
})

export { router as adminRouter }
