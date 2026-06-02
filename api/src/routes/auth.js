// ─── Auth Routes ──────────────────────────────────────────────────────
// Forwards all auth requests to Better Auth.
// Better Auth handles: sign-in/email, sign-up/email, get-session, user, etc.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { createAuth } from '../auth/index.js'

const router = new Hono()

// Forward everything to Better Auth
// Pass the request Origin so createAuth can dynamically trust store subdomains
router.all('/*', async (c) => {
  const origin = c.req.raw.headers.get('Origin') || c.req.raw.headers.get('origin')
  return createAuth(c.env, origin).handler(c.req.raw)
})

export { router as authRouter }
