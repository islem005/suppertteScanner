import { describe, it, expect, vi, beforeAll } from 'vitest'

let app
beforeAll(async () => {
  const mod = await import('../../api/src/index.js')
  app = mod.default
})

describe('Hono app — root', () => {
  it('returns app info on GET /', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('ivond API')
    expect(body.status).toBe('running')
  })
})

describe('Hono app — health', () => {
  it('GET /api/health returns ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns JSON content-type', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})

describe('Hono app — 404', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/api/nonexistent')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 404 for unknown top-level routes', async () => {
    const res = await app.request('/unknown')
    expect(res.status).toBe(404)
  })
})
