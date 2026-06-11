import { describe, it, expect } from 'vitest'
import { API_BASE } from './setup.js'

describe('Rate Limiting', () => {
  it('should return rate limit headers', async () => {
    const res = await fetch(`${API_BASE}/page-views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeSlug: 'my-store', path: '/' })
    })
    expect(res.headers.has('X-RateLimit-Remaining')).toBe(true)
    expect(res.headers.has('X-RateLimit-Reset')).toBe(true)
  })
})
