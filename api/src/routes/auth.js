import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { createSupabase } from '../db.js'
import { getAdminByEmail } from '../admin-db.js'

const router = new Hono()
const SALT_ROUNDS = 10

function generateToken(user, secret) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, store_id: user.store_id },
    secret,
    { expiresIn: '7d' }
  )
}

router.post('/register', async (c) => {
  const { email, password, displayName, storeSlug, role } = await c.req.json()
  if (!email || !password || !displayName) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const supabase = createSupabase(c.env)
  let storeId = null

  if (storeSlug) {
    const { data: store } = await supabase
      .from('stores').select('id').eq('slug', storeSlug).single()
    if (!store) return c.json({ error: 'Store not found' }, 400)
    storeId = store.id
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
  const { data: user, error } = await supabase
    .from('store_users').insert({ email, password_hash, display_name: displayName, store_id: storeId, role: role || 'staff' }).select().single()

  if (error) return c.json({ error: error.message }, 400)

  const token = generateToken(user, c.env.JWT_SECRET)
  return c.json({ token, user: { ...user, password_hash: undefined } })
})

router.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400)
  }

  // ─── Check D1 admin store first ─────────────────────────────────────
  if (c.env.ADMIN_DB) {
    const admin = await getAdminByEmail(c.env.ADMIN_DB, email)
    if (admin) {
      if (!admin.password_hash) {
        return c.json({ error: 'This admin uses Cloudflare Access login. Go to admin.ivond.com.' }, 401)
      }
      const valid = await bcrypt.compare(password, admin.password_hash)
      if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

      const token = generateToken(
        { id: admin.id, email: admin.email, role: 'admin', store_id: null },
        c.env.JWT_SECRET
      )
      return c.json({
        token,
        user: {
          id: admin.id,
          email: admin.email,
          display_name: admin.display_name,
          role: 'admin',
          store_id: null
        }
      })
    }
  }

  // ─── Fall back to Supabase for manager/staff ────────────────────────
  const supabase = createSupabase(c.env)
  const { data: user, error } = await supabase
    .from('store_users').select('*').eq('email', email).single()

  if (error || !user) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const token = generateToken(user, c.env.JWT_SECRET)
  const { password_hash, ...safe } = user
  return c.json({ token, user: safe })
})

// ─── Seed Admin (D1) ─────────────────────────────────────────────────
// Creates the default admin user in D1. Only works if no admin exists yet.
// Called during initial setup or after `seed:force` drops the table.
router.post('/seed-admin', async (c) => {
  if (!c.env.ADMIN_DB) {
    return c.json({ error: 'Admin database not configured' }, 500)
  }

  const { email, password, displayName } = await c.req.json()
  if (!email || !password) {
    return c.json({ error: 'email and password required' }, 400)
  }

  // Only seed if no admin exists yet (idempotent)
  const { results } = await c.env.ADMIN_DB.prepare('SELECT COUNT(*) as count FROM admin_users').all()
  if (results && results[0]?.count > 0) {
    return c.json({ error: 'Admin already exists. Use --force to re-seed.' }, 409)
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
  const id = crypto.randomUUID()
  await c.env.ADMIN_DB.prepare(
    'INSERT INTO admin_users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
  ).bind(id, email, password_hash, displayName || 'Admin').run()

  const token = generateToken({ id, email, role: 'admin', store_id: null }, c.env.JWT_SECRET)
  return c.json({
    token,
    user: { id, email, display_name: displayName || 'Admin', role: 'admin', store_id: null }
  })
})

// ─── Force seed (drops existing, re-creates) ─────────────────────────
router.post('/seed-admin/force', async (c) => {
  if (!c.env.ADMIN_DB) {
    return c.json({ error: 'Admin database not configured' }, 500)
  }

  const { email, password, displayName } = await c.req.json()
  if (!email || !password) {
    return c.json({ error: 'email and password required' }, 400)
  }

  await c.env.ADMIN_DB.prepare('DELETE FROM admin_users').run()
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
  const id = crypto.randomUUID()
  await c.env.ADMIN_DB.prepare(
    'INSERT INTO admin_users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
  ).bind(id, email, password_hash, displayName || 'Admin').run()

  const token = generateToken({ id, email, role: 'admin', store_id: null }, c.env.JWT_SECRET)
  return c.json({
    token,
    user: { id, email, display_name: displayName || 'Admin', role: 'admin', store_id: null }
  })
})

export { router as authRouter }
