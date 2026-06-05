// ─── Auth Middleware ──────────────────────────────────────────────────
// Validates Better Auth sessions by directly querying the D1 database.
// This is more reliable in Workers than calling auth.api.getSession(),
// which can have compatibility issues with Hono's header passing.
// ────────────────────────────────────────────────────────────────────────

/**
 * Load the current user and session from the database.
 * Called once per request to populate c.get('user') and c.get('session').
 */
export async function loadSession(c, next) {
  // Use Hono's header() method for reliable cookie access
  const cookie = c.req.header('cookie') || c.req.header('Cookie') || ''
  const match = cookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/)
  let token = null
  if (match) {
    const raw = decodeURIComponent(match[1])
    const dotIdx = raw.indexOf('.')
    token = dotIdx > 0 ? raw.substring(0, dotIdx) : raw
  }

  if (token) {
    try {
      // Look up the session directly in the DB
      const sessionRow = await c.env.DB.prepare(
        'SELECT id, userId, token, expiresAt, activeOrganizationId, impersonatedBy FROM session WHERE token = ?'
      ).bind(token).first()

      if (sessionRow) {
        // Check expiry
        const expiresAt = new Date(sessionRow.expiresAt)
        if (expiresAt > new Date()) {
          // Session is valid — load the user
          const userRow = await c.env.DB.prepare(
            'SELECT id, name, email, role, display_name, store_id, image FROM user WHERE id = ?'
          ).bind(sessionRow.userId).first()

          if (userRow) {
            c.set('user', {
              id: userRow.id,
              email: userRow.email,
              name: userRow.name,
              display_name: userRow.display_name,
              role: userRow.role || 'staff',
              store_id: userRow.store_id
            })
            c.set('session', {
              id: sessionRow.id,
              userId: sessionRow.userId,
              token: sessionRow.token,
              expiresAt: sessionRow.expiresAt,
              activeOrganizationId: sessionRow.activeOrganizationId
            })
            await next()
            return
          }
        }
      }
    } catch (err) {
      console.error('Session lookup error:', err)
    }
  }

  // No valid session
  c.set('user', null)
  c.set('session', null)
  await next()
}

/**
 * Require an authenticated user. Returns 401 if not logged in.
 */
export async function authenticate(c, next) {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  await next()
}

/**
 * Require admin role. Must come after authenticate or loadSession.
 */
export async function adminOnly(c, next) {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin only' }, 403)
  }
  await next()
}

/**
 * Require manager or admin for a given store.
 * If user is platform admin, they pass. Otherwise checks store_id match.
 */
export async function requireStoreAccess(c, next) {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const storeId = c.req.param('storeId') || c.req.query('store_id') || user.store_id
  if (user.role === 'admin' || user.store_id === storeId) {
    await next()
  } else {
    return c.json({ error: 'Forbidden' }, 403)
  }
}
