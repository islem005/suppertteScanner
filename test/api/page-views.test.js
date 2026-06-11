import { describe, it, expect } from 'vitest'
import { API_BASE } from './setup.js'

describe('Page Views API', () => {
  it('POST /api/page-views - should record a page view', async () => {
    const res = await fetch(`${API_BASE}/page-views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_slug: 'my-store', session_id: `test-${Date.now()}`, path: '/' })
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })
})
