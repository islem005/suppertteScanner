import { describe, it, expect } from 'vitest'

const API = process.env.API_BASE || 'http://localhost:8787'

describe('Page Views API', () => {
  it('POST /api/page-views - should record a page view', async () => {
    const res = await fetch(`${API}/api/page-views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeSlug: 'my-store', path: '/' })
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success || data.id).toBeTruthy()
  })
})
