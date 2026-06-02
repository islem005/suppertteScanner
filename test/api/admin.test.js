// ─── Admin Route Tests ───────────────────────────────────────────────────
// Tests admin-only endpoints: stats, users, activity.
// Creates a test user and cleans it up.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, MANAGER_EMAIL, MANAGER_PASS,
  loginAs, authedGet, authedPost, authedDelete
} from './setup.js'

describe('GET /api/admin/stats (platform stats)', () => {
  let adminCookie, managerCookie

  beforeAll(async () => {
    const adminSession = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
    adminCookie = adminSession.cookie
    const managerSession = await loginAs(MANAGER_EMAIL, MANAGER_PASS)
    managerCookie = managerSession.cookie
  })

  it('returns platform-wide stats for admin', async () => {
    const res = await authedGet(`${API_BASE}/admin/stats`, adminCookie)
    expect(res.status).toBe(200)
    const stats = await res.json()
    expect(stats).toHaveProperty('totalStores')
    expect(stats).toHaveProperty('totalUsers')
    expect(stats).toHaveProperty('totalProducts')
    expect(stats).toHaveProperty('totalScans')
    expect(stats).toHaveProperty('todayScans')
    expect(stats).toHaveProperty('storeStats')
    expect(Array.isArray(stats.storeStats)).toBe(true)
    expect(typeof stats.totalStores).toBe('number')
    expect(typeof stats.totalUsers).toBe('number')
  })

  it('returns 403 for non-admin (manager)', async () => {
    const res = await authedGet(`${API_BASE}/admin/stats`, managerCookie)
    expect(res.status).toBe(403)
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${API_BASE}/admin/stats`)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/admin/users (list all users)', () => {
  let adminCookie, managerCookie

  beforeAll(async () => {
    const adminSession = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
    adminCookie = adminSession.cookie
    const managerSession = await loginAs(MANAGER_EMAIL, MANAGER_PASS)
    managerCookie = managerSession.cookie
  })

  it('returns all users for admin', async () => {
    const res = await authedGet(`${API_BASE}/admin/users`, adminCookie)
    expect(res.status).toBe(200)
    const users = await res.json()
    expect(Array.isArray(users)).toBe(true)
    expect(users.length).toBeGreaterThanOrEqual(2)
  })

  it('returns 403 for non-admin', async () => {
    const res = await authedGet(`${API_BASE}/admin/users`, managerCookie)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/users (create user)', () => {
  let adminCookie
  const testEmail = `testuser-${Date.now()}@test.com`

  beforeAll(async () => {
    const session = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
    adminCookie = session.cookie
  })

  it('creates a new user', async () => {
    const res = await authedPost(`${API_BASE}/admin/users`, adminCookie, {
      email: testEmail,
      password: 'testpass123',
      displayName: 'Test User',
      role: 'staff'
    })
    expect(res.status).toBe(200)
    const user = await res.json()
    expect(user).toHaveProperty('email', testEmail)
    expect(user).toHaveProperty('role', 'staff')
    expect(user).toHaveProperty('id')
  })

  it('rejects missing required fields', async () => {
    const res = await authedPost(`${API_BASE}/admin/users`, adminCookie, {})
    expect(res.status).toBe(400)
  })

  afterAll(async () => {
    // Cleanup - delete the created user
    const users = await (await authedGet(`${API_BASE}/admin/users`, adminCookie)).json()
    const testUser = users.find(u => u.email === testEmail)
    if (testUser) {
      await authedDelete(`${API_BASE}/admin/users/${testUser.id}`, adminCookie)
    }
  })
})

describe('GET /api/admin/activity (platform activity)', () => {
  let adminCookie

  beforeAll(async () => {
    const session = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
    adminCookie = session.cookie
  })

  it('returns activity data for admin', async () => {
    const res = await authedGet(`${API_BASE}/admin/activity`, adminCookie)
    expect(res.status).toBe(200)
    const activity = await res.json()
    expect(Array.isArray(activity)).toBe(true)
    if (activity.length > 0) {
      const entry = activity[0]
      expect(entry).toHaveProperty('store_id')
      expect(entry).toHaveProperty('store_name')
      expect(entry).toHaveProperty('products')
      expect(entry).toHaveProperty('scans')
      expect(entry).toHaveProperty('users')
    }
  })

  it('returns 403 for non-admin', async () => {
    const managerSession = await loginAs(MANAGER_EMAIL, MANAGER_PASS)
    const res = await authedGet(`${API_BASE}/admin/activity`, managerSession.cookie)
    expect(res.status).toBe(403)
  })
})
