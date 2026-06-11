import { describe, it, expect } from 'vitest'

const API = process.env.API_BASE || 'http://localhost:8787'

describe('Rate Limiting', () => {
  it('should return rate limit headers', async () => {
    const res = await fetch(`${API}/api/page-views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeSlug: 'my-store', path: '/' })
    })
    expect(res.headers.has('X-RateLimit-Remaining')).toBe(true)
    expect(res.headers.has('X-RateLimit-Reset')).toBe(true)
  })
})
