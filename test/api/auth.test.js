import { describe, it, expect } from 'vitest'

const API = process.env.API_BASE || 'http://localhost:8787'

describe('Auth API', () => {
  it('POST /api/auth/login - rejects missing credentials', async () => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    // Should fail with 400 or 401
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/auth/login - rejects wrong password', async () => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@store.com', password: 'wrongpassword' })
    })
    // Should fail with 401
    expect([401, 403]).toContain(res.status)
  })
})
