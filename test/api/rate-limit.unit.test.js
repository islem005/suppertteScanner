import { describe, it, expect, beforeEach } from 'vitest'

const { checkRateLimit } = await import('../../api/src/rate-limit.js')

describe('Rate Limiter (unit)', () => {

  it('allows first request', () => {
    const result = checkRateLimit('test-key-1', 5, 60000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.resetIn).toBeGreaterThan(0)
  })

  it('allows requests within limit', () => {
    const key = 'test-key-2'
    for (let i = 0; i < 4; i++) {
      checkRateLimit(key, 5, 60000)
    }
    const result = checkRateLimit(key, 5, 60000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('blocks requests exceeding limit', () => {
    const key = 'test-key-3'
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60000)
    }
    const result = checkRateLimit(key, 5, 60000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('uses default maxRequests=20 and windowMs=60000', () => {
    const key = 'test-key-4'
    for (let i = 0; i < 20; i++) {
      const r = checkRateLimit(key)
      if (i < 19) expect(r.allowed).toBe(true)
    }
    const result = checkRateLimit(key)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets window after timeout', async () => {
    const key = 'test-key-5'
    checkRateLimit(key, 2, 50)
    checkRateLimit(key, 2, 50)
    expect(checkRateLimit(key, 2, 50).allowed).toBe(false)
    await new Promise(r => setTimeout(r, 60))
    const result = checkRateLimit(key, 2, 50)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('separates different keys', () => {
    const r1 = checkRateLimit('key-a', 2, 60000)
    const r2 = checkRateLimit('key-b', 2, 60000)
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
    checkRateLimit('key-a', 2, 60000)
    expect(checkRateLimit('key-a', 2, 60000).allowed).toBe(false)
    expect(checkRateLimit('key-b', 2, 60000).allowed).toBe(true)
  })
})
