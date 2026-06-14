// ─── Promotion Route Tests ──────────────────────────────────────────────
// Tests banners and offers CRUD, including trigger type tests for
// category and product (barcode) targeting on offers.
// Mutation tests use the disposable test store from setup.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, STORE_SLUG, ORIGIN,
  loginAs, authedGet, authedPost, authedPut, authedDelete, getStoreIdBySlug,
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

  it('creates an offer with category trigger type', async () => {
    const res = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId,
      type: 'offer',
      title: 'Category Offer - Beverages',
      trigger_type: 'category',
      trigger_value: 'Beverages',
      active: 1
    })
    expect(res.status).toBe(200)
    const promo = await res.json()
    expect(promo.type).toBe('offer')
    expect(promo.trigger_type).toBe('category')
    expect(promo.trigger_value).toBe('Beverages')
  })

  it('creates an offer with product (barcode) trigger type', async () => {
    const res = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId,
      type: 'offer',
      title: 'Product Offer - 5901234123457',
      trigger_type: 'product',
      trigger_value: '5901234123457',
      active: 1
    })
    expect(res.status).toBe(200)
    const promo = await res.json()
    expect(promo.type).toBe('offer')
    expect(promo.trigger_type).toBe('product')
    expect(promo.trigger_value).toBe('5901234123457')
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
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'skaner-csrf-token', 'Origin': ORIGIN },
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
      if (o.title && (o.title.includes('2 for 1') || o.title.includes('Category Offer') || o.title.includes('Product Offer'))) {
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

// ─── Offer trigger type integrity tests ─────────────────────────────────

describe('Offer trigger type integrity', () => {
  let createdIds = []

  afterAll(async () => {
    for (const id of createdIds) {
      await authedDelete(`${API_BASE}/promotions/${id}`, adminCookie).catch(() => {})
    }
  })

  it('persists trigger_type and trigger_value in public offers endpoint', async () => {
    // Create offers with different trigger types
    const catRes = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId,
      type: 'offer',
      title: 'Trigger Test Category',
      trigger_type: 'category',
      trigger_value: 'Snacks',
      active: 1
    })
    expect(catRes.status).toBe(200)
    const catOffer = await catRes.json()
    createdIds.push(catOffer.id)

    const prodRes = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId,
      type: 'offer',
      title: 'Trigger Test Product',
      trigger_type: 'product',
      trigger_value: '1234567890128',
      active: 1
    })
    expect(prodRes.status).toBe(200)
    const prodOffer = await prodRes.json()
    createdIds.push(prodOffer.id)

    // Fetch public offers endpoint and verify both exist with correct fields
    const pubRes = await fetch(`${API_BASE}/promotions/offers/${testStoreId}`)
    expect(pubRes.status).toBe(200)
    const offers = await pubRes.json()
    const catFound = offers.find(o => o.id === catOffer.id)
    const prodFound = offers.find(o => o.id === prodOffer.id)

    expect(catFound).toBeTruthy()
    expect(catFound.trigger_type).toBe('category')
    expect(catFound.trigger_value).toBe('Snacks')

    expect(prodFound).toBeTruthy()
    expect(prodFound.trigger_type).toBe('product')
    expect(prodFound.trigger_value).toBe('1234567890128')
  })

  it('updates offer trigger_type and trigger_value', async () => {
    const createRes = await authedPost(`${API_BASE}/promotions`, adminCookie, {
      store_id: testStoreId,
      type: 'offer',
      title: 'Updatable Trigger Offer',
      trigger_type: 'category',
      trigger_value: 'Drinks',
      active: 1
    })
    expect(createRes.status).toBe(200)
    const offer = await createRes.json()
    createdIds.push(offer.id)

    // Update to product trigger type
    const updateRes = await authedPut(`${API_BASE}/promotions/${offer.id}`, adminCookie, {
      trigger_type: 'product',
      trigger_value: '9876543210987'
    })
    expect(updateRes.status).toBe(200)

    // Verify via single-get
    const getRes = await authedGet(`${API_BASE}/promotions/single/${offer.id}`, adminCookie)
    expect(getRes.status).toBe(200)
    const updated = await getRes.json()
    expect(updated.trigger_type).toBe('product')
    expect(updated.trigger_value).toBe('9876543210987')
  })
})
