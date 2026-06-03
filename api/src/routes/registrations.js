// ─── Store Registration Routes ──────────────────────────────────────
// Public: Submit a new store registration request.
// Admin: List, approve, or reject pending registrations.
// ──────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate, adminOnly } from '../middleware.js'
import { createAuth } from '../auth/index.js'

const router = new Hono()

// ─── Public: Submit a registration request ───────────────────────────
router.post('/', async (c) => {
  const { store_name, store_slug, contact_name, contact_email, contact_phone, message } = await c.req.json()

  // Validate required fields
  if (!store_name || !store_slug || !contact_name || !contact_email) {
    return c.json({ error: 'store_name, store_slug, contact_name, and contact_email are required' }, 400)
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(contact_email)) {
    return c.json({ error: 'Invalid email format' }, 400)
  }

  // Validate slug format (alphanumeric + hyphens)
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
  if (!slugRegex.test(store_slug)) {
    return c.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, 400)
  }

  const db = c.env.DB

  // Check if slug is already taken
  const existingSlug = await queryOne(db,
    'SELECT id FROM organization WHERE slug = ?',
    [store_slug]
  )
  if (existingSlug) {
    return c.json({ error: 'This store slug is already taken. Please choose another.' }, 409)
  }

  // Check if there's already a pending registration with this email or slug
  const existingReg = await queryOne(db,
    'SELECT id FROM store_registration WHERE (contact_email = ? OR store_slug = ?) AND status = ?',
    [contact_email, store_slug, 'pending']
  )
  if (existingReg) {
    return c.json({ error: 'A pending registration already exists for this email or store slug.' }, 409)
  }

  // Check if email is already a user
  const existingUser = await queryOne(db,
    'SELECT id FROM user WHERE email = ?',
    [contact_email]
  )
  if (existingUser) {
    return c.json({ error: 'This email is already registered. Please sign in instead.' }, 409)
  }

  const id = uuid()
  await execute(db,
    `INSERT INTO store_registration (id, store_name, store_slug, contact_name, contact_email, contact_phone, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, store_name, store_slug, contact_name, contact_email, contact_phone || null, message || null]
  )

  const created = await queryOne(db, 'SELECT * FROM store_registration WHERE id = ?', [id])
  return c.json(created, 201)
})

// ─── Admin: List all registrations ───────────────────────────────────
router.get('/', authenticate, adminOnly, async (c) => {
  const status = c.req.query('status') // optional filter: pending, approved, rejected
  let rows
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    rows = await queryAll(c.env.DB,
      'SELECT * FROM store_registration WHERE status = ? ORDER BY created_at DESC',
      [status]
    )
  } else {
    rows = await queryAll(c.env.DB,
      'SELECT * FROM store_registration ORDER BY created_at DESC'
    )
  }
  return c.json(rows)
})

// ─── Admin: Get single registration ─────────────────────────────────
router.get('/:id', authenticate, adminOnly, async (c) => {
  const reg = await queryOne(c.env.DB,
    'SELECT * FROM store_registration WHERE id = ?',
    [c.req.param('id')]
  )
  if (!reg) return c.json({ error: 'Registration not found' }, 404)
  return c.json(reg)
})

// ─── Admin: Approve a registration — creates store + manager user ───
router.post('/:id/approve', authenticate, adminOnly, async (c) => {
  const db = c.env.DB
  const { password, admin_notes } = await c.req.json()

  const reg = await queryOne(db,
    'SELECT * FROM store_registration WHERE id = ?',
    [c.req.param('id')]
  )
  if (!reg) return c.json({ error: 'Registration not found' }, 404)
  if (reg.status !== 'pending') {
    return c.json({ error: `Registration is already ${reg.status}` }, 400)
  }

  // Generate a random password if not provided
  const userPassword = password || generatePassword()

  // Create the organization (store)
  const storeId = uuid()
  const slug = reg.store_slug // already validated unique

  await execute(db,
    'INSERT INTO organization (id, name, slug, createdAt, updatedAt) VALUES (?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
    [storeId, reg.store_name, slug]
  )

  // Create the manager user via Better Auth
  const auth = createAuth(c.env)
  let result
  try {
    result = await auth.api.signUpEmail({
      body: {
        email: reg.contact_email,
        password: userPassword,
        name: reg.contact_name,
        display_name: reg.contact_name,
        store_id: storeId
      }
    })
  } catch (err) {
    // Rollback the store creation
    await execute(db, 'DELETE FROM organization WHERE id = ?', [storeId])
    return c.json({ error: 'Failed to create user: ' + (err.message || 'Unknown error') }, 400)
  }

  // Set role to manager
  await execute(db,
    'UPDATE user SET role = ? WHERE id = ?',
    ['manager', result.user.id]
  )

  // Add user as member of the organization
  await execute(db,
    'INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\'))',
    [uuid(), storeId, result.user.id, 'manager']
  )

  // Create default branding
  await execute(db,
    `INSERT INTO store_branding (store_id, display_name, primary_color, accent_color)
     VALUES (?, ?, '#6366f1', '#10b981')`,
    [storeId, reg.store_name]
  )

  // Update registration status
  await execute(db,
    'UPDATE store_registration SET status = ?, admin_notes = ?, updated_at = datetime(\'now\') WHERE id = ?',
    ['approved', admin_notes || null, reg.id]
  )

  const updated = await queryOne(db, 'SELECT * FROM store_registration WHERE id = ?', [reg.id])

  return c.json({
    registration: updated,
    store: { id: storeId, name: reg.store_name, slug },
    user: {
      email: reg.contact_email,
      name: reg.contact_name,
      role: 'manager',
      password: userPassword
    }
  })
})

// ─── Admin: Reject a registration ───────────────────────────────────
router.post('/:id/reject', authenticate, adminOnly, async (c) => {
  const db = c.env.DB
  const { admin_notes } = await c.req.json()

  const reg = await queryOne(db,
    'SELECT * FROM store_registration WHERE id = ?',
    [c.req.param('id')]
  )
  if (!reg) return c.json({ error: 'Registration not found' }, 404)
  if (reg.status !== 'pending') {
    return c.json({ error: `Registration is already ${reg.status}` }, 400)
  }

  await execute(db,
    'UPDATE store_registration SET status = ?, admin_notes = ?, updated_at = datetime(\'now\') WHERE id = ?',
    ['rejected', admin_notes || null, reg.id]
  )

  const updated = await queryOne(db, 'SELECT * FROM store_registration WHERE id = ?', [reg.id])
  return c.json(updated)
})

// ─── Helper: Generate a random 12-char password ─────────────────────
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export { router as registrationsRouter }
