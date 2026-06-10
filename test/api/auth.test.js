// ─── Auth Route Tests ────────────────────────────────────────────────────
// Tests login, session, error handling.
// All creds overridable via env vars for post-deploy runs.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, MANAGER_EMAIL, MANAGER_PASS, ORIGIN,
  loginAs
} from './setup.js'

describe('POST /api/auth/sign-in/email', () => {
  it('logs in with valid admin credentials and returns a session cookie', async () => {
    const res = await fetch(`${API_BASE}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS })
    })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toHaveProperty('user')
    expect(data.user).toHaveProperty('id')
    expect(data.user.email).toBe(ADMIN_EMAIL)

    const cookie = res.headers.get('set-cookie')
    expect(cookie).toBeTruthy()
    expect(cookie).toContain('better-auth')
  })

  it('rejects invalid password with 401', async () => {
    const res = await fetch(`${API_BASE}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: 'wrong-password' })
    })
    expect(res.status).toBe(401)
  })

  it('rejects unknown email with 401', async () => {
    const res = await fetch(`${API_BASE}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify({ email: 'unknown@test.com', password: 'anything' })
    })
    expect(res.status).toBe(401)
  })

  it('rejects missing body fields with 400', async () => {
    const res = await fetch(`${API_BASE}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN
      },
      body: JSON.stringify({})
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/auth/get-session (get current session)', () => {
  let adminCookie

  beforeAll(async () => {
    const session = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
    adminCookie = session.cookie
  })

  it('returns session + user for authenticated user', async () => {
    const res = await fetch(`${API_BASE}/auth/get-session`, {
      headers: { Cookie: adminCookie }
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('user')
    expect(data.user).toHaveProperty('email', ADMIN_EMAIL)
    expect(data.user).toHaveProperty('id')
    expect(data).toHaveProperty('session')
  })

  it('returns 200 with null body for unauthenticated', async () => {
    const res = await fetch(`${API_BASE}/auth/get-session`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeNull()
  })
})

describe('Login as manager', () => {
  it('can sign in with manager credentials', async () => {
    const { user } = await loginAs(MANAGER_EMAIL, MANAGER_PASS)
    expect(user.email).toBe(MANAGER_EMAIL)
    expect(user).toHaveProperty('store_id')
  })
})
