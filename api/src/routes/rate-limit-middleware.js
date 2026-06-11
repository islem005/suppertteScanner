import { checkRateLimit } from '../rate-limit.js'

/**
 * Rate limiting middleware.
 * @param {object} options
 * @param {number} options.maxRequests - Max requests in the window
 * @param {number} options.windowMs - Window size in ms
 * @param {boolean} options.authenticated - If true, rate limit by user ID instead of IP
 */
export function rateLimit(options = {}) {
  const { maxRequests = 20, windowMs = 60000, authenticated = false } = options

  return async function rateLimitMiddleware(c, next) {
    const key = authenticated && c.get('user')
      ? `user:${c.get('user').id}`
      : `ip:${c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'}`

    const result = checkRateLimit(key, maxRequests, windowMs)

    c.header('X-RateLimit-Remaining', String(result.remaining))
    c.header('X-RateLimit-Reset', String(Math.ceil(result.resetIn / 1000)))

    if (!result.allowed) {
      c.header('Retry-After', String(Math.ceil(result.resetIn / 1000)))
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    await next()
  }
}
