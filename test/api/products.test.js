// ─── Product Route Tests ─────────────────────────────────────────────────
// Tests product CRUD and CSV upload.
// Mutation tests use the disposable test store from setup.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, STORE_SLUG,
  loginAs, authedGet, authedPost, authedDelete,
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

describe('GET /api/products (list products)', () => {
  it('returns a list of products for the store', async () => {
    const res = await authedGet(`${API_BASE}/products?store_id=${testStoreId}`, adminCookie)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.products)).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${API_BASE}/products`)
    expect(res.status).toBe(401)
  })

  it('returns products with expected fields', async () => {
    const res = await authedGet(`${API_BASE}/products`, adminCookie)
    const data = await res.json()
    if (data.products && data.products.length > 0) {
      const p = data.products[0]
      expect(p).toHaveProperty('barcode')
      expect(p).toHaveProperty('name')
      expect(p).toHaveProperty('price')
      expect(p).toHaveProperty('store_id')
      expect(p).toHaveProperty('id')
    }
  })
})

describe('POST /api/products (create product)', () => {
  const testBarcode = `TEST${Date.now()}`

  it('creates a new product in the test store', async () => {
    const res = await authedPost(`${API_BASE}/products`, adminCookie, {
      barcode: testBarcode,
      name: 'Test Product',
      price: 9.99,
      category: 'Test',
      store_id: testStoreId
    })
    expect(res.status).toBe(200)
    const product = await res.json()
    expect(product).toHaveProperty('barcode', testBarcode)
    expect(product).toHaveProperty('name', 'Test Product')
    expect(product).toHaveProperty('price', 9.99)
  })

  it('rejects missing required fields', async () => {
    const res = await authedPost(`${API_BASE}/products`, adminCookie, {})
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('upserts product with same store_id + barcode', async () => {
    const res = await authedPost(`${API_BASE}/products`, adminCookie, {
      barcode: testBarcode,
      name: 'Updated Test Product',
      price: 14.99,
      store_id: testStoreId
    })
    expect(res.status).toBe(200)
    const product = await res.json()
    expect(product.name).toBe('Updated Test Product')
    expect(product.price).toBe(14.99)
  })

  afterAll(async () => {
    // Cleanup: delete test product
    const data = await (await authedGet(`${API_BASE}/products?store_id=${testStoreId}`, adminCookie)).json()
    const tp = (data.products || []).find(p => p.barcode === testBarcode)
    if (tp) {
      await authedDelete(`${API_BASE}/products/${tp.id}`, adminCookie)
    }
  })
})

describe('POST /api/products/upload (CSV upload)', () => {
  it('imports products from CSV content', async () => {
    const csv = `barcode,name,price,category\nCSVTEST1,CSV Product One,5.99,Imported\nCSVTEST2,CSV Product Two,12.49,Imported`
    const res = await authedPost(`${API_BASE}/products/upload`, adminCookie, { csv, store_id: testStoreId })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('imported')
    expect(body.imported).toBeGreaterThanOrEqual(2)
  })

  it('rejects empty CSV content', async () => {
    const res = await authedPost(`${API_BASE}/products/upload`, adminCookie, {})
    expect(res.status).toBe(400)
  })

  it('rejects invalid CSV', async () => {
    const res = await authedPost(`${API_BASE}/products/upload`, adminCookie, { csv: 'not,valid,csv\n' })
    expect(res.status).toBe(400)
  })

  afterAll(async () => {
    // Cleanup CSV test products
    const data = await (await authedGet(`${API_BASE}/products?store_id=${testStoreId}`, adminCookie)).json()
    for (const p of (data.products || [])) {
      if (p.barcode === 'CSVTEST1' || p.barcode === 'CSVTEST2') {
        await authedDelete(`${API_BASE}/products/${p.id}`, adminCookie)
      }
    }
  })
})

describe('DELETE /api/products/:id', () => {
  let productId

  beforeAll(async () => {
    // Create a temporary product to delete
    const res = await authedPost(`${API_BASE}/products`, adminCookie, {
      barcode: `DEL${Date.now()}`,
      name: 'Delete Me',
      price: 1.00,
      store_id: testStoreId
    })
    const product = await res.json()
    productId = product.id
  })

  it('deletes a product', async () => {
    const res = await authedDelete(`${API_BASE}/products/${productId}`, adminCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ok', true)
  })

  it('returns 200 even for already deleted product', async () => {
    const res = await authedDelete(`${API_BASE}/products/${productId}`, adminCookie)
    expect(res.status).toBe(200)
  })
})
