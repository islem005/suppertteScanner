// ─── Store Route Tests ───────────────────────────────────────────────────
// Tests store CRUD operations and public slug lookup.
// Mutation tests use a disposable test store (not the real "my-store").
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, STORE_SLUG,
  loginAs, authedGet, authedPost, authedDelete,
  getTestStoreId, destroyTestStore
} from './setup.js'

let adminCookie

beforeAll(async () => {
  const session = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
  adminCookie = session.cookie
})

afterAll(async () => {
  await destroyTestStore(adminCookie)
})

// ─── Read-only tests (safe against any store) ───────────────────────────

describe('GET /api/stores (list stores)', () => {
  it('returns a list of stores for admin', async () => {
    const res = await authedGet(`${API_BASE}/stores`, adminCookie)
    expect(res.status).toBe(200)
    const stores = await res.json()
    expect(Array.isArray(stores)).toBe(true)
    expect(stores.length).toBeGreaterThanOrEqual(1)

    const myStore = stores.find(s => s.slug === STORE_SLUG)
    expect(myStore).toBeTruthy()
    expect(myStore).toHaveProperty('id')
    expect(myStore).toHaveProperty('name')
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${API_BASE}/stores`)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/stores/slug/:slug (public lookup)', () => {
  it('returns store by slug', async () => {
    const res = await fetch(`${API_BASE}/stores/slug/${STORE_SLUG}`)
    expect(res.status).toBe(200)
    const store = await res.json()
    expect(store).toHaveProperty('slug', STORE_SLUG)
    expect(store).toHaveProperty('id')
    expect(store).toHaveProperty('name')
  })

  it('returns 404 for unknown slug', async () => {
    const res = await fetch(`${API_BASE}/stores/slug/nonexistent-store`)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })
})

describe('GET /api/stores/:id (get by id)', () => {
  let storeId

  beforeAll(async () => {
    const stores = await (await authedGet(`${API_BASE}/stores`, adminCookie)).json()
    storeId = stores.find(s => s.slug === STORE_SLUG)?.id
  })

  it('returns store by ID for admin', async () => {
    const res = await authedGet(`${API_BASE}/stores/${storeId}`, adminCookie)
    expect(res.status).toBe(200)
    const store = await res.json()
    expect(store).toHaveProperty('slug', STORE_SLUG)
  })

  it('returns 404 for non-existent ID', async () => {
    const res = await authedGet(`${API_BASE}/stores/non-existent-id`, adminCookie)
    expect(res.status).toBe(404)
  })
})

// ─── Mutation tests (operate on disposable test store) ───────────────────

describe('POST /api/stores — creation + delete lifecycle', () => {
  let createdStoreId

  it('creates a new store (admin only)', async () => {
    const slug = `test-create-${Date.now()}`
    const res = await authedPost(`${API_BASE}/stores`, adminCookie, {
      name: 'Store Creation Test',
      slug: slug
    })
    expect(res.status).toBe(200)
    const store = await res.json()
    expect(store).toHaveProperty('slug', slug)
    expect(store).toHaveProperty('name', 'Store Creation Test')
    expect(store).toHaveProperty('id')
    createdStoreId = store.id
  })

  it('rejects store creation for non-admin', async () => {
    const managerSession = await loginAs(
      process.env.MANAGER_EMAIL || 'manager@store.com',
      process.env.MANAGER_PASS || 'manager123'
    )
    const res = await authedPost(`${API_BASE}/stores`, managerSession.cookie, {
      name: 'Unauthorized Store',
      slug: 'unauth-store'
    })
    expect(res.status).toBe(403)
  })

  it('requires name and slug', async () => {
    const res = await authedPost(`${API_BASE}/stores`, adminCookie, {})
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('normalizes slug to lowercase with hyphens', async () => {
    const weirdSlug = `Weird Slug Test ${Date.now()}`
    const res = await authedPost(`${API_BASE}/stores`, adminCookie, {
      name: 'Weird Slug',
      slug: weirdSlug
    })
    expect(res.status).toBe(200)
    const store = await res.json()
    expect(store.slug).toBe(weirdSlug.toLowerCase().replace(/\s+/g, '-'))
    // Cleanup this extra store
    await authedDelete(`${API_BASE}/stores/${store.id}`, adminCookie)
  })

  it('deletes the created store', async () => {
    if (!createdStoreId) return
    const res = await authedDelete(`${API_BASE}/stores/${createdStoreId}`, adminCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ok', true)
  })
})

// ─── The test store lifecycle is managed by setup.js ─────────────────────
// getTestStoreId() creates it on first call.
// destroyTestStore() in afterAll removes it.
