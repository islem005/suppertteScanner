const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']
const ALLOWED_ORIGINS = [
  'https://ivond.com',
  'https://admin.ivond.com',
  /^https:\/\/[a-z0-9-]+\.ivond\.com$/
]

function isOriginAllowed(origin) {
  if (!origin) return false
  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') return origin === allowed
    return allowed.test(origin)
  })
}

export function csrfProtection() {
  return async function csrfMiddleware(c, next) {
    if (SAFE_METHODS.includes(c.req.method)) {
      await next()
      return
    }

    const origin = c.req.header('Origin')
    const referer = c.req.header('Referer')

    if (!origin && !referer) {
      return c.json({ error: 'Missing Origin or Referer header' }, 403)
    }

    if (origin && !isOriginAllowed(origin)) {
      return c.json({ error: 'Invalid origin' }, 403)
    }

    if (!origin && referer) {
      try {
        const refererUrl = new URL(referer)
        if (!isOriginAllowed(refererUrl.origin)) {
          return c.json({ error: 'Invalid referer' }, 403)
        }
      } catch {
        return c.json({ error: 'Invalid referer' }, 403)
      }
    }

    const csrfToken = c.req.header('X-CSRF-Token')
    if (!csrfToken || csrfToken !== 'skaner-csrf-token') {
      return c.json({ error: 'Missing or invalid CSRF token. Include X-CSRF-Token header.' }, 403)
    }

    await next()
  }
}
