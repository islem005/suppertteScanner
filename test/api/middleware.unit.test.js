import { describe, it, expect, vi } from 'vitest'

const {
  authenticate,
  adminOnly,
  requireManagerOrAbove,
  requireStoreAccess
} = await import('../../api/src/middleware.js')

function makeC(userOverrides = {}, paramOverrides = {}) {
  const c = {
    get: vi.fn((key) => {
      if (key === 'user') return userOverrides.user || null
      if (key === 'session') return userOverrides.session || null
      return null
    }),
    json: vi.fn((body, status) => ({ body, status })),
    req: {
      param: vi.fn((name) => paramOverrides[name] || null),
      query: vi.fn((name) => null)
    }
  }
  return c
}

describe('authenticate', () => {
  it('passes when user exists', async () => {
    const c = makeC({ user: { id: '1', role: 'admin' } })
    const next = vi.fn()
    await authenticate(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('returns 401 when no user', async () => {
    const c = makeC({ user: null })
    const next = vi.fn()
    const res = await authenticate(c, next)
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Authentication required')
    expect(next).not.toHaveBeenCalled()
  })
})

describe('adminOnly', () => {
  it('passes for admin user', async () => {
    const c = makeC({ user: { id: '1', role: 'admin' } })
    const next = vi.fn()
    await adminOnly(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('blocks manager', async () => {
    const c = makeC({ user: { id: '2', role: 'manager' } })
    const next = vi.fn()
    const res = await adminOnly(c, next)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Admin only')
  })

  it('blocks staff', async () => {
    const c = makeC({ user: { id: '3', role: 'staff' } })
    const next = vi.fn()
    const res = await adminOnly(c, next)
    expect(res.status).toBe(403)
  })

  it('blocks null user', async () => {
    const c = makeC({ user: null })
    const next = vi.fn()
    const res = await adminOnly(c, next)
    expect(res.status).toBe(403)
  })
})

describe('requireManagerOrAbove', () => {
  it('passes for admin', async () => {
    const c = makeC({ user: { id: '1', role: 'admin' } })
    const next = vi.fn()
    await requireManagerOrAbove(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('passes for manager', async () => {
    const c = makeC({ user: { id: '2', role: 'manager' } })
    const next = vi.fn()
    await requireManagerOrAbove(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('blocks associate', async () => {
    const c = makeC({ user: { id: '3', role: 'associate' } })
    const next = vi.fn()
    const res = await requireManagerOrAbove(c, next)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Manager or admin required')
  })

  it('blocks staff', async () => {
    const c = makeC({ user: { id: '4', role: 'staff' } })
    const next = vi.fn()
    await requireManagerOrAbove(c, next)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when null user', async () => {
    const c = makeC({ user: null })
    const next = vi.fn()
    const res = await requireManagerOrAbove(c, next)
    expect(res.status).toBe(401)
  })
})

describe('requireStoreAccess', () => {
  it('passes admin for any store', async () => {
    const c = makeC({ user: { id: '1', role: 'admin', store_id: 'store-a' } })
    const next = vi.fn()
    await requireStoreAccess(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('passes manager for their own store', async () => {
    const c = makeC(
      { user: { id: '2', role: 'manager', store_id: 'store-b' } },
      { storeId: 'store-b' }
    )
    const next = vi.fn()
    await requireStoreAccess(c, next)
    expect(next).toHaveBeenCalled()
  })

  it('blocks manager for another store', async () => {
    const c = makeC(
      { user: { id: '3', role: 'manager', store_id: 'store-b' } },
      { storeId: 'store-c' }
    )
    const next = vi.fn()
    const res = await requireStoreAccess(c, next)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Forbidden')
  })

  it('returns 401 when null user', async () => {
    const c = makeC({ user: null })
    const next = vi.fn()
    const res = await requireStoreAccess(c, next)
    expect(res.status).toBe(401)
  })
})
