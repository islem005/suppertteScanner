// ─── Scan Event Tests ────────────────────────────────────────────────────
// Tests scan event logging (public) and scan stats (authenticated).
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect, beforeAll } from 'vitest'
import {
  API_BASE, ADMIN_EMAIL, ADMIN_PASS, STORE_SLUG,
  loginAs, authedGet } from './setup.js'

describe('POST /api/scans (public scan logging)', () => {
  const testBarcode = `SCAN_TEST_${Date.now()}`

  it('logs a scan event successfully', async () => {
    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_slug: STORE_SLUG, barcode: testBarcode })
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ok', true)
  })

  it('logs a scan for a product that exists', async () => {
    // First find any product barcode
    const adminSession = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
    const productsRes = await authedGet(`${API_BASE}/products`, adminSession.cookie)
    const products = await productsRes.json()
    const barcode = products.length > 0 ? products[0].barcode : '5901234123457'

    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_slug: STORE_SLUG, barcode })
    })
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('rejects missing store_slug', async () => {
    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: '123' })
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing barcode', async () => {
    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_slug: STORE_SLUG })
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent store slug', async () => {
    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_slug: 'nonexistent-slug', barcode: '123' })
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/scans/stats (authenticated)', () => {
  let adminCookie

  beforeAll(async () => {
    const session = await loginAs(ADMIN_EMAIL, ADMIN_PASS)
    adminCookie = session.cookie
  })

  it('returns scan stats', async () => {
    const res = await authedGet(`${API_BASE}/scans/stats`, adminCookie)
    expect(res.status).toBe(200)
    const stats = await res.json()
    expect(stats).toHaveProperty('total')
    expect(stats).toHaveProperty('today')
    expect(stats).toHaveProperty('topProducts')
    expect(Array.isArray(stats.topProducts)).toBe(true)
    expect(typeof stats.total).toBe('number')
    expect(typeof stats.today).toBe('number')
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${API_BASE}/scans/stats`)
    expect(res.status).toBe(401)
  })
})
