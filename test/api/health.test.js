// ─── Health Check Tests ──────────────────────────────────────────────────
// Tests the /api/health endpoint.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { API_BASE } from './setup.js'

describe('GET /api/health', () => {
  it('returns ok: true with 200 status', async () => {
    const res = await fetch(`${API_BASE}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ok', true)
  })

  it('returns a JSON content-type', async () => {
    const res = await fetch(`${API_BASE}/health`)
    expect(res.headers.get('content-type')).toMatch(/json/)
  })
})

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`${API_BASE}/nonexistent-route-xyz`)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })
})
