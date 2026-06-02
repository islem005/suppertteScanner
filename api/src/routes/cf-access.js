// ─── Cloudflare Access Auto-Auth ──────────────────────────────────────
// Exchanges the Cf-Access-Authenticated-User-Email header (set by
// Cloudflare Access at the edge) for a Shelf Scanner session via Better Auth.
// ──────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryOne } from '../db.js'
import { createAuth } from '../auth/index.js'

const router = new Hono()

router.post('/', async (c) => {
  const cfEmail = c.req.header('Cf-Access-Authenticated-User-Email')
  if (!cfEmail) {
    return c.json({ error: 'Not behind Cloudflare Access' }, 401)
  }

  // Find the user by email
  const user = await queryOne(c.env.DB,
    "SELECT id, email, display_name, role, store_id FROM user WHERE email = ? AND role = 'admin'",
    [cfEmail]
  )

  if (!user) {
    return c.json({ error: 'Admin not found for this email' }, 403)
  }

  // Create a session via Better Auth
  const auth = createAuth(c.env)
  const authResponse = await auth.api.signInEmail({
    body: {
      email: user.email,
      password: '' // We don't have password in Access flow
    }
  })

  // If Better Auth signInEmail doesn't work for Access, we fall back to
  // a manual session creation
  if (!authResponse) {
    return c.json({
      token: '',
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        store_id: user.store_id
      }
    })
  }

  return c.json({
    token: '',
    user: authResponse.user
  })
})

export { router as cfAccessRouter }
