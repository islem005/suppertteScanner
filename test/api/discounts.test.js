// ─── Discount Item Route Tests ───────────────────────────────────────────
// Tests discount items CRUD.
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

describe('GET /api/discounts/:storeId (public)', () => {
  let storeId

  beforeAll(async () => {
    storeId = await getStoreIdBySlug(STORE_SLUG)
  })

  it('returns discount items for a store', async () => {
    const res = await fetch(`${API_BASE}/discounts/${storeId}`)
    expect(res.status).toBe(200)
    const items = await res.json()
    expect(Array.isArray(items)).toBe(true)
  })
})

describe('GET /api/discounts/featured/:storeId (public)', () => {
  let storeId

  beforeAll(async () => {
    storeId = await getStoreIdBySlug(STORE_SLUG)
  })

  it('returns featured discount items for a store', async () => {
    const res = await fetch(`${API_BASE}/discounts/featured/${storeId}`)
    expect(res.status).toBe(200)
    const items = await res.json()
    expect(Array.isArray(items)).toBe(true)
  })
})

// ─── Mutation tests (use test store) ────────────────────────────────────

describe('POST /api/discounts (authenticated)', () => {
  let createdId

  it('creates a discount item in the test store', async () => {
    const res = await authedPost(`${API_BASE}/discounts`, adminCookie, {
      store_id: testStoreId,
      name: 'Test Discount Item',
      barcode: `DISC${Date.now()}`,
      original_price: 19.99,
      new_price: 9.99,
      discount_percent: 50,
      featured: 1,
      active: 1,
      category: 'Test'
    })
    expect(res.status).toBe(200)
    const item = await res.json()
    expect(item).toHaveProperty('store_id', testStoreId)
    expect(item).toHaveProperty('name', 'Test Discount Item')
    expect(item).toHaveProperty('original_price')
    expect(item).toHaveProperty('new_price')
    if (item.discount_percent !== undefined) {
      expect(item.discount_percent).toBe(50)
    }
    createdId = item.id
  })

  it('rejects without store_id', async () => {
    const res = await authedPost(`${API_BASE}/discounts`, adminCookie, {})
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${API_BASE}/discounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: testStoreId, name: 'Test' })
    })
    expect(res.status).toBe(401)
  })

  afterAll(async () => {
    if (createdId) {
      await authedDelete(`${API_BASE}/discounts/${createdId}`, adminCookie)
    }
  })
})

describe('DELETE /api/discounts/:id', () => {
  let createdId

  beforeAll(async () => {
    const res = await authedPost(`${API_BASE}/discounts`, adminCookie, {
      store_id: testStoreId,
      name: 'Temp Delete Discount',
      barcode: `DELDISC${Date.now()}`
    })
    const item = await res.json()
    createdId = item.id
  })

  it('deletes a discount item', async () => {
    const res = await authedDelete(`${API_BASE}/discounts/${createdId}`, adminCookie)
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})
