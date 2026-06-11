// ─── In-memory rate limiter ─────────────────────────────────────────
// Simple sliding window rate limiter using a Map.
// Note: Each Worker isolate has its own memory, so this is not
// perfectly accurate across many instances, but it's sufficient
// for basic abuse protection on the Workers free plan.
// ───────────────────────────────────────────────────────────────────

const rateLimitMap = new Map()

/**
 * Check if a request should be rate limited.
 * @param {string} key - Identifier to rate limit by (e.g. IP, endpoint)
 * @param {number} maxRequests - Maximum requests allowed in the window
 * @param {number} windowMs - Window size in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
export function checkRateLimit(key, maxRequests = 20, windowMs = 60000) {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now - record.windowStart > windowMs) {
    // New window — lazy cleanup of stale entries
    if (rateLimitMap.size > 1000) {
      for (const [k, r] of rateLimitMap) {
        if (now - r.windowStart > 60000) rateLimitMap.delete(k)
      }
    }
    rateLimitMap.set(key, { windowStart: now, count: 1 })
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs }
  }

  if (record.count >= maxRequests) {
    const resetIn = windowMs - (now - record.windowStart)
    return { allowed: false, remaining: 0, resetIn }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.windowStart + windowMs - now }
}
