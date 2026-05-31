// ─── Cloudflare Access Auto-Auth ──────────────────────────────────────
// Exchanges the Cf-Access-Authenticated-User-Email header (set by
// Cloudflare Access at the edge) for a Shelf Scanner JWT.
// This allows admins to bypass the password login form when behind Access.
// ──────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import { getAdminByEmail } from '../admin-db.js'

const router = new Hono()

router.post('/', async (c) => {
  const cfEmail = c.req.header('Cf-Access-Authenticated-User-Email')
  if (!cfEmail) {
    return c.json({ error: 'Not behind Cloudflare Access' }, 401)
  }

  if (!c.env.ADMIN_DB) {
    return c.json({ error: 'Admin database not available' }, 500)
  }

  const admin = await getAdminByEmail(c.env.ADMIN_DB, cfEmail)
  if (!admin) {
    return c.json({ error: 'Admin not found for this email' }, 403)
  }

  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: 'admin', store_id: null },
    c.env.JWT_SECRET,
    { expiresIn: '7d' }
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
})

export { router as cfAccessRouter }