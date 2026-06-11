// ─── Admin Routes ────────────────────────────────────────────────────
// Platform-wide admin endpoints: stats, users, activity.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate, adminOnly } from '../middleware.js'
import { createAuth } from '../auth/index.js'
import { validateBody, validateName, validateEmail } from '../validate.js'

const router = new Hono()
router.use('*', authenticate, adminOnly)

router.get('/stats', async (c) => {
  const db = c.env.DB

  const [stores, users, products, scans, pendingRegs, pendingImps, noBranding, noMapping, totalDevices, totalVisits] = await Promise.all([
    queryAll(db, 'SELECT * FROM organization'),
    queryAll(db, 'SELECT id, email, display_name as display_name, role, store_id FROM user'),
    queryAll(db, 'SELECT id, store_id FROM product'),
    queryAll(db, 'SELECT * FROM scan_event'),
    db.prepare("SELECT COUNT(*) as c FROM store_registration WHERE status='pending'").first(),
    db.prepare("SELECT COUNT(*) as c FROM pending_import WHERE status IN ('pending','auto-mapped')").first(),
    db.prepare("SELECT COUNT(*) as c FROM organization o LEFT JOIN store_branding b ON o.id=b.store_id WHERE b.store_id IS NULL OR b.display_name IS NULL OR b.display_name=''").first(),
    db.prepare("SELECT COUNT(*) as c FROM organization o LEFT JOIN import_mapping m ON o.id=m.store_id WHERE m.store_id IS NULL").first(),
    db.prepare("SELECT COUNT(*) as c FROM client_device").first(),
    db.prepare("SELECT COUNT(*) as c FROM page_view").first(),
  ])

  const storesWithZeroProducts = stores.filter(s =>
    products.filter(p => p.store_id === s.id).length === 0
  ).length

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
    totalDevices: totalDevices?.c || 0,
    totalVisits: totalVisits?.c || 0,
    storeStats,
    pendingRegistrations: pendingRegs?.c || 0,
    pendingImports: pendingImps?.c || 0,
    storesWithoutBranding: noBranding?.c || 0,
    storesWithoutMapping: noMapping?.c || 0,
    storesWithZeroProducts
  })
})

router.get('/users', async (c) => {
  const db = c.env.DB
  const page = parseInt(c.req.query('page')) || null
  const perPage = parseInt(c.req.query('per_page')) || 20

  if (page) {
    const offset = (page - 1) * perPage
    const total = (await queryOne(db, 'SELECT COUNT(*) as total FROM user')).total
    const users = await queryAll(db,
      'SELECT id, email, display_name, role, store_id, createdAt FROM user ORDER BY createdAt DESC LIMIT ? OFFSET ?',
      [perPage, offset]
    )
    return c.json({ data: users, total, page, perPage })
  }

  const users = await queryAll(db,
    'SELECT id, email, display_name, role, store_id, createdAt FROM user ORDER BY createdAt DESC'
  )
  return c.json(users)
})

router.post('/users', async (c) => {
  const body = await c.req.json()
  const { email, password, displayName, storeId, role } = body

  const { valid, errors } = validateBody(body, {
    email: { required: true, validate: v => validateEmail(v) },
    displayName: { required: true, validate: v => validateName(v, 'Display name') }
  })
  if (!valid) return c.json({ error: errors.join(', ') }, 400)
  if (!password) return c.json({ error: 'password is required' }, 400)

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

router.put('/users/:id', async (c) => {
  const body = await c.req.json()
  const { displayName, role, storeId } = body

  const { valid, errors } = validateBody(body, {
    displayName: { required: false, validate: v => validateName(v, 'Display name') },
    email: { required: false, validate: v => validateEmail(v) }
  })
  if (!valid) return c.json({ error: errors.join(', ') }, 400)
  if (!displayName && !role && storeId === undefined) {
    return c.json({ error: 'At least one field required' }, 400)
  }

  const user = await queryOne(c.env.DB, 'SELECT id FROM user WHERE id = ?', [c.req.param('id')])
  if (!user) return c.json({ error: 'User not found' }, 404)

  const updates = {}
  if (displayName) updates.display_name = displayName
  if (role) updates.role = role
  if (storeId !== undefined) updates.store_id = storeId || null
  updates.updatedAt = new Date().toISOString()

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  await execute(c.env.DB,
    `UPDATE user SET ${setClauses} WHERE id = ?`,
    [...Object.values(updates), c.req.param('id')]
  )

  const updated = await queryOne(c.env.DB,
    'SELECT id, email, name, display_name, role, store_id FROM user WHERE id = ?',
    [c.req.param('id')]
  )
  return c.json(updated)
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

router.post('/users/:id/password', async (c) => {
  const { password } = await c.req.json()
  if (!password || password.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400)
  }
  const auth = createAuth(c.env)
  try {
    await auth.api.setUserPassword({
      body: { userId: c.req.param('id'), newPassword: password },
      headers: c.req.raw.headers
    })
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: err.message || 'Failed to set password' }, 400)
  }
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
