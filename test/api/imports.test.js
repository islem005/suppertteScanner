// ─── Import Route Tests ──────────────────────────────────────────────────
// Tests the multi-format file import flow.
// Uses the disposable test store for all mutation operations.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, MANAGER_EMAIL, MANAGER_PASS, ORIGIN,
  loginAs, authedGet, authedPost, authedDelete,
  getTestStoreId, destroyTestStore
} from './setup.js'

function b64(str) {
  return Buffer.from(str, 'utf-8').toString('base64')
}

let adminCookie, managerCookie, testStoreId

beforeAll(async () => {
  const as = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
  adminCookie = as.cookie
  const ms = await loginAs(MANAGER_EMAIL, MANAGER_PASS)
  managerCookie = ms.cookie
  testStoreId = await getTestStoreId(adminCookie)
})

afterAll(async () => {
  await destroyTestStore(adminCookie)
})

describe('POST /api/imports/upload (manager: file upload)', () => {
  it('uploads a CSV file and returns pending status (no mapping)', async () => {
    const csv = 'barcode,name,price\nIMP001,Import Product One,5.99\nIMP002,Import Product Two,12.49'
    const res = await authedPost(`${API_BASE}/imports/upload`, managerCookie, {
      content: b64(csv),
      filename: 'test-products.csv'
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('preview')
    expect(body.preview).toHaveProperty('columns')
    expect(body.preview).toHaveProperty('sample_rows')
  })

  it('rejects upload without content', async () => {
    const res = await authedPost(`${API_BASE}/imports/upload`, managerCookie, {
      filename: 'test.csv'
    })
    expect(res.status).toBe(400)
  })

  it('rejects upload without filename', async () => {
    const res = await authedPost(`${API_BASE}/imports/upload`, managerCookie, {
      content: b64('a,b,c\n1,2,3')
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${API_BASE}/imports/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'skaner-csrf-token', 'Origin': ORIGIN },
      body: JSON.stringify({ content: b64('a,b,c\n1,2,3'), filename: 'test.csv' })
    })
    expect(res.status).toBe(401)
  })

  afterAll(async () => {
    // Clean up any pending imports
    const pending = await (await authedGet(`${API_BASE}/imports/pending`, adminCookie)).json()
    for (const imp of pending) {
      await authedPost(`${API_BASE}/imports/${imp.id}/reject`, adminCookie, {}).catch(() => {})
    }
  })
})

describe('GET /api/imports/pending (admin: pending list)', () => {
  it('returns pending imports for admin', async () => {
    const res = await authedGet(`${API_BASE}/imports/pending`, adminCookie)
    expect(res.status).toBe(200)
    const imports = await res.json()
    expect(Array.isArray(imports)).toBe(true)
    if (imports.length > 0) {
      expect(imports[0]).toHaveProperty('id')
      expect(imports[0]).toHaveProperty('store_name')
      expect(imports[0]).toHaveProperty('status')
    }
  })

  it('returns 403 for non-admin', async () => {
    const res = await authedGet(`${API_BASE}/imports/pending`, managerCookie)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/imports/store/:storeId (store imports)', () => {
  it('returns import history and mapping for a store', async () => {
    const res = await authedGet(`${API_BASE}/imports/store/${testStoreId}`, adminCookie)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('imports')
    expect(data).toHaveProperty('mapping')
    expect(data).toHaveProperty('product_count')
    expect(Array.isArray(data.imports)).toBe(true)
  })
})

describe('Import mapping management (admin, on test store)', () => {
  it('GET /api/imports/mapping/:storeId returns mapping or null', async () => {
    const res = await authedGet(`${API_BASE}/imports/mapping/${testStoreId}`, adminCookie)
    expect(res.status).toBe(200)
    const data = await res.json()
    if (data) {
      expect(data).toHaveProperty('column_mapping')
    }
  })

  it('POST /api/imports/mapping/:storeId saves a mapping', async () => {
    const res = await authedPost(`${API_BASE}/imports/mapping/${testStoreId}`, adminCookie, {
      column_mapping: { barcode: 'barcode', name: 'name', price: 'price' }
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('column_mapping')
    expect(data.column_mapping).toHaveProperty('barcode', 'barcode')
    expect(data.column_mapping).toHaveProperty('name', 'name')
    expect(data.column_mapping).toHaveProperty('price', 'price')
  })

  it('DELETE /api/imports/mapping/:storeId removes mapping', async () => {
    const res = await authedDelete(`${API_BASE}/imports/mapping/${testStoreId}`, adminCookie)
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)

    const check = await authedGet(`${API_BASE}/imports/mapping/${testStoreId}`, adminCookie)
    const data = await check.json()
    expect(data).toBeNull()
  })
})

describe('Import test endpoint (admin)', () => {
  let pendingId

  beforeAll(async () => {
    const csv = 'barcode,name,price\nTEST001,Test One,9.99\nTEST002,Test Two,19.99'
    const uploadRes = await authedPost(`${API_BASE}/imports/upload`, managerCookie, {
      content: b64(csv),
      filename: 'test-mapping.csv'
    })
    const upload = await uploadRes.json()
    pendingId = upload.id
  })

  it('POST /api/imports/:id/test tests a mapping', async () => {
    const res = await authedPost(`${API_BASE}/imports/${pendingId}/test`, adminCookie, {
      column_mapping: { barcode: 'barcode', name: 'name', price: 'price' }
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('valid_rows')
    expect(data).toHaveProperty('total_rows')
    expect(data).toHaveProperty('preview')
    expect(Array.isArray(data.preview)).toBe(true)
  })

  afterAll(async () => {
    // Clean up the pending import
    const imports = await (await authedGet(`${API_BASE}/imports/pending`, adminCookie)).json()
    for (const imp of imports) {
      if (imp.id === pendingId) {
        await authedPost(`${API_BASE}/imports/${imp.id}/reject`, adminCookie, {}).catch(() => {})
      }
    }
  })
})
