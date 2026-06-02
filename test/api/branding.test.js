// ─── Branding Route Tests ────────────────────────────────────────────────
// Tests store branding get (public) and update (authenticated).
// Mutation tests use the disposable test store — not the real store.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, STORE_SLUG,
  loginAs, authedGet, authedPut, getStoreIdBySlug,
  getTestStoreId, destroyTestStore
} from './setup.js'

let adminCookie, testStoreId

beforeAll(async () => {
  const session = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
  adminCookie = session.cookie
  testStoreId = await getTestStoreId(adminCookie)
})

afterAll(async () => {
  await destroyTestStore(adminCookie)
})

// ─── Read-only public test (uses real store — safe) ─────────────────────

describe('GET /api/branding/:storeId (public)', () => {
  let storeId

  beforeAll(async () => {
    storeId = await getStoreIdBySlug(STORE_SLUG)
  })

  it('returns branding for a store (with defaults if none set)', async () => {
    const res = await fetch(`${API_BASE}/branding/${storeId}`)
    expect(res.status).toBe(200)
    const branding = await res.json()
    expect(branding).toHaveProperty('store_id', storeId)
    if (branding.primary_color) {
      expect(branding.primary_color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

// ─── Mutation tests (use test store) ────────────────────────────────────

describe('PUT /api/branding/:storeId (authenticated, on test store)', () => {
  it('updates branding for the test store', async () => {
    const res = await authedPut(`${API_BASE}/branding/${testStoreId}`, adminCookie, {
      primary_color: '#ff6600',
      accent_color: '#00cc88',
      display_name: 'Test Store Branding',
      contact_email: 'test-store@test.com',
      footer_text: 'Thanks for testing!'
    })
    expect(res.status).toBe(200)
    const branding = await res.json()
    expect(branding).toHaveProperty('store_id', testStoreId)
    expect(branding).toHaveProperty('primary_color', '#ff6600')
    expect(branding).toHaveProperty('accent_color', '#00cc88')
    expect(branding).toHaveProperty('display_name', 'Test Store Branding')
    expect(branding).toHaveProperty('contact_email', 'test-store@test.com')
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${API_BASE}/branding/${testStoreId}`, { method: 'PUT' })
    expect(res.status).toBe(401)
  })

  it('merges partial updates', async () => {
    const res = await authedPut(`${API_BASE}/branding/${testStoreId}`, adminCookie, {
      primary_color: '#ff0000'
    })
    expect(res.status).toBe(200)
    const branding = await res.json()
    expect(branding.primary_color).toBe('#ff0000')
    expect(branding).toHaveProperty('display_name')
    expect(branding).toHaveProperty('contact_email', 'test-store@test.com')
  })
})
