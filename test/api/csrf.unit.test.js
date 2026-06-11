import { describe, it, expect, vi } from 'vitest'

const { csrfProtection } = await import('../../api/src/csrf.js')

function makeMockC(overrides = {}) {
  let nextCalled = false
  const c = {
    req: {
      method: 'POST',
      url: 'http://localhost/api/test',
      header: vi.fn((name) => {
        if (name === 'Origin') return overrides.origin || null
        if (name === 'Referer') return overrides.referer || null
        if (name === 'X-CSRF-Token') return overrides.csrfToken || null
        return null
      }),
      ...overrides.req
    },
    json: vi.fn((body, status) => ({ body, status })),
    ...overrides
  }
  const next = vi.fn(() => { nextCalled = true })
  return { c, next, nextCalled: () => nextCalled }
}

describe('CSRF Protection', () => {
  it('allows SAFE_METHODS (GET, HEAD, OPTIONS) without checks', async () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const { c, next, nextCalled } = makeMockC({ req: { method } })
      const mw = csrfProtection()
      await mw(c, next)
      expect(next).toHaveBeenCalled()
    }
  })

  it('rejects missing Origin and Referer', async () => {
    const { c, next } = makeMockC()
    const mw = csrfProtection()
    const res = await mw(c, next)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Missing Origin or Referer header')
  })

  it('rejects invalid origin', async () => {
    const { c, next } = makeMockC({ origin: 'https://evil.com' })
    const mw = csrfProtection()
    const res = await mw(c, next)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Invalid origin')
  })

  it('rejects invalid referer', async () => {
    const { c, next } = makeMockC({ referer: 'https://evil.com/page' })
    const mw = csrfProtection()
    const res = await mw(c, next)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Invalid referer')
  })

  it('rejects missing CSRF token', async () => {
    const { c, next } = makeMockC({ origin: 'https://ivond.com' })
    const mw = csrfProtection()
    const res = await mw(c, next)
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('CSRF token')
  })

  it('rejects wrong CSRF token', async () => {
    const { c, next } = makeMockC({ origin: 'https://ivond.com', csrfToken: 'wrong-token' })
    const mw = csrfProtection()
    const res = await mw(c, next)
    expect(res.status).toBe(403)
  })

  it('accepts valid origin and CSRF token', async () => {
    const { c, next } = makeMockC({ origin: 'https://ivond.com', csrfToken: 'skaner-csrf-token' })
    const mw = csrfProtection()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('accepts store subdomain origin', async () => {
    const { c, next } = makeMockC({ origin: 'https://my-store.ivond.com', csrfToken: 'skaner-csrf-token' })
    const mw = csrfProtection()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('accepts admin.ivond.com origin', async () => {
    const { c, next } = makeMockC({ origin: 'https://admin.ivond.com', csrfToken: 'skaner-csrf-token' })
    const mw = csrfProtection()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('falls back to referer when origin is missing', async () => {
    const { c, next } = makeMockC({ referer: 'https://ivond.com/dashboard', csrfToken: 'skaner-csrf-token' })
    const mw = csrfProtection()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
  })
})
