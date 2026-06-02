// ─── Promotion Route Tests ──────────────────────────────────────────────
// Tests banners and offers CRUD.
// Mutation tests use the disposable test store from setup.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, STORE_SLUG,
  loginAs, authedGet, authedPost, authedDelete, getStoreIdBySlug,
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

// ─── Read-only public tests (use real store) ────────────────────────────

describe('GET /api/promotions/banners/:storeId (public)', () => {
  let storeId

  beforeAll(async () => {
    storeId = await getStoreIdBySlug(STORE_SLUG)
  })

  it('returns banners for a store', async () => {
    const res = await fetch(`${API_BASE}/promotions/banners/${storeId}`)
    expect(res.status).toBe(200)
    const banners = await res.json()
    expect(Array.isArray(banners)).toBe(true)
  })
})

describe('GET /api/promotions/offers/:storeId (public)', () => {
  let storeId

  beforeAll(async () => {
    storeId = await getStoreIdBySlug(STORE_SLUG)
  })

  it('returns offers for a store', async () => {
    const res = await fetch(`${API_BASE}/promotions/offers/${storeId}`)
    expect(res.status).toBe(200)
    const offers = await res.json()
    expect(Array.isArray(offers)).toBe(true)
  })
})

// ─── Mutation tests (use test store) ────────────────────────────────────

describe('POST /api/promotions (authenticated)', () => {
  it('creates a banner promotion in the test store', async () => {
    const res = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId,
      type: 'banner',
      title: 'Test Banner - Summer Sale!',
      active: 1,
      priority: 1
    })
    expect(res.status).toBe(200)
    const promo = await res.json()
    expect(promo).toHaveProperty('store_id', testStoreId)
    expect(promo).toHaveProperty('type', 'banner')
    expect(promo).toHaveProperty('title', 'Test Banner - Summer Sale!')
  })

  it('creates an offer promotion in the test store', async () => {
    const res = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId,
      type: 'offer',
      title: '2 for 1 Special',
      active: 1,
      priority: 2
    })
    expect(res.status).toBe(200)
    const promo = await res.json()
    expect(promo.type).toBe('offer')
  })

  it('rejects without store_id', async () => {
    const res = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      type: 'banner'
    })
    expect(res.status).toBe(400)
  })

  it('rejects without type', async () => {
    const res = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${API_BASE}/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: testStoreId, type: 'banner' })
    })
    expect(res.status).toBe(401)
  })

  afterAll(async () => {
    // Cleanup - delete test promotions
    const banners = await (await fetch(`${API_BASE}/promotions/banners/${testStoreId}`)).json()
    for (const b of banners) {
      if (b.title && b.title.includes('Test Banner')) {
        await authedDelete(`${API_BASE}/promotions/${b.id}`, adminCookie)
      }
    }
    const offers = await (await fetch(`${API_BASE}/promotions/offers/${testStoreId}`)).json()
    for (const o of offers) {
      if (o.title && o.title.includes('2 for 1')) {
        await authedDelete(`${API_BASE}/promotions/${o.id}`, adminCookie)
      }
    }
  })
})

describe('DELETE /api/promotions/:id', () => {
  let createdId

  beforeAll(async () => {
    const res = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId,
      type: 'banner',
      title: 'Temp Delete Banner'
    })
    const promo = await res.json()
    createdId = promo.id
  })

  it('deletes a promotion', async () => {
    const res = await authedDelete(`${API_BASE}/promotions/${createdId}`, adminCookie)
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})
