import { Hono } from 'hono'
import { authenticate } from '../middleware.js'
import { createAuth } from '../auth/index.js'

const router = new Hono()

router.post('/', authenticate, async (c) => {
  const user = c.get('user')
  const { currentPassword, newPassword } = await c.req.json()

  if (!currentPassword || !newPassword) {
    return c.json({ error: 'Current password and new password required' }, 400)
  }
  if (newPassword.length < 6) {
    return c.json({ error: 'New password must be at least 6 characters' }, 400)
  }

  const auth = createAuth(c.env)
  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: c.req.raw.headers
    })
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: err.message || 'Failed to change password' }, 400)
  }
})

export { router as changePasswordRouter }
